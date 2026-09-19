import GameRound, {
  LIVE_ROUND_STATUSES,
} from "@/database/models/games/game-round.model";
import {
  loadProviderSecrets,
  normaliseHeaders,
  checkTimestamp,
  verifyCallbackSignature,
  safeEqual,
} from "./callback-verification";

/**
 * A round's progress WHILE IT IS STILL BEING PLAYED.
 *
 * THE DEFECT THIS CLOSES, reported by the owner on 11 September 2026 as the board "not showing
 * live the boards the user finished": there was no mid-round reporting anywhere on either side
 * of the provider seam. A score exists only once a round finishes; the frame's `postMessage`
 * carries none by construction; and the game's own per-board record never left its database. So
 * a contest board could say a player was playing and nothing more, however many boards they had
 * solved - which on a contest people watch is the difference between a live event and a list.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT A SECOND SCORING DOOR, AND THAT IS THE ONLY THING THAT MATTERS HERE
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Chapter 02 section 10 rule 3: scores enter the system through exactly one function, which is
 * `applyResult`. This file writes **`scoreBreakdown` and nothing else** - the display-only,
 * provider-ordered figures `01` section 3.2 already defines - and in particular it never
 * writes:
 *
 *   * `rawScore`, which is the only field that may influence ranking;
 *   * `status`, so it can neither finish a round nor revive a finished one;
 *   * anything at all on `CompetitionParticipant`, so it cannot move a leaderboard position.
 *
 * A test asserts each of those by inspecting the update this service builds, because a comment
 * saying "we only write the breakdown" is the shape of claim this codebase has found false five
 * times. The update is therefore constructed as an explicit `$set` of two named paths rather
 * than by spreading anything the provider sent: a spread is how the next field arrives, and the
 * field after that is `rawScore`.
 *
 * WHY IT IS SAFE TO TAKE THIS FROM THE PROVIDER AT ALL. The breakdown is already theirs - the
 * final callback carries it and we store it verbatim. Nothing ranks on it, nothing is paid from
 * it, and the worst a hostile provider achieves by lying here is a wrong sentence on a board
 * that their own final result will overwrite. The gates below exist because an UNAUTHENTICATED
 * writer of any field is the Prerequisite A shape, not because the field is dangerous.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * NOT MIRRORED, deliberately, exactly as `participant-score.service.ts` is not. A copy in
 * `apps/admin` would be a second writer of a field the main app owns, in the app with the
 * widest privileges and the least traffic.
 */

/** Everything a progress report may carry. Anything else is ignored rather than stored. */
export interface RoundProgressPayload {
  /** OUR round id. The provider's own id is accepted as a fallback - see `findRound`. */
  roundId?: string;
  providerRoundId?: string;
  /**
   * The game's own figures, in the game's own order.
   *
   * Reason it is not typed more tightly: `01` section 3.2 makes this free-form and
   * provider-ordered on purpose, and the platform choosing which keys are legitimate is a
   * `switch` on game code wearing a different hat - it would make the no-developer-needed
   * claim false for the next title.
   */
  breakdown?: Record<string, unknown>;
}

export type ProgressResult =
  | "recorded"
  | "provider_unknown"
  | "signature_invalid"
  | "timestamp_rejected"
  | "round_not_found"
  | "round_not_live"
  | "nothing_to_record"
  | "unparseable";

export interface ProgressOutcome {
  accepted: boolean;
  result: ProgressResult;
  message: string;
  roundId?: string;
}

function refuse(
  result: ProgressResult,
  message: string,
  roundId?: string,
): ProgressOutcome {
  return { accepted: false, result, message, roundId };
}

/**
 * The largest breakdown we will store from a progress report.
 *
 * Reason there is a cap at all: this route is called once per board, so it is the one provider
 * endpoint with a high call rate, and `scoreBreakdown` is `Schema.Types.Mixed` - it will store
 * whatever shape arrives. Without a bound, a provider looping a growing array through it
 * inflates one document on every board until the 16MB limit refuses the write, which is the
 * `brandingFiles` failure in a new place: a store that fills up by SUCCEEDING.
 *
 * Entries beyond the cap are DROPPED rather than the report refused, because the figures are
 * display-only and a partial line on a board is better than a board that stops updating.
 */
export const MAX_PROGRESS_ENTRIES = 24;

/**
 * Keeps the entries a screen can render, in the order the game declared them.
 *
 * Non-primitive values are dropped rather than stringified: a nested object renders as
 * `[object Object]` in any consumer that was not expecting it, and the alternative - the
 * platform deciding how to flatten a provider's structure - is per-game code.
 */
export function sanitiseBreakdown(
  breakdown: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!breakdown || typeof breakdown !== "object") return null;

  const kept: Record<string, unknown> = {};
  let count = 0;

  for (const [key, value] of Object.entries(breakdown)) {
    if (count >= MAX_PROGRESS_ENTRIES) break;
    // Reason for the `__proto__` guard: `Object.entries` on a JSON-parsed body cannot produce
    // it as an own enumerable key, but this function is exported and a future caller may hand
    // it something built another way. Defining that key on a plain object is a prototype write.
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      Object.defineProperty(kept, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      count++;
    }
  }

  return count > 0 ? kept : null;
}

/**
 * OUR id first, the provider's second, and the order is the same security property as
 * `extractEventId`'s.
 *
 * Both are looked up on indexed fields and both are scoped to a single provider, so a provider
 * cannot reach another's round by guessing an id. `providerKey` is in BOTH queries for that
 * reason and must not be dropped as redundant: `providerRoundId` is the provider's own
 * namespace and carries no promise of being unique across providers.
 */
async function findRound(providerKey: string, payload: RoundProgressPayload) {
  if (payload.roundId?.trim()) {
    return GameRound.findOne({ roundId: payload.roundId.trim(), providerKey });
  }
  if (payload.providerRoundId?.trim()) {
    return GameRound.findOne({
      providerRoundId: payload.providerRoundId.trim(),
      providerKey,
    });
  }
  return null;
}

/**
 * The whole of a progress report: verify, locate, record.
 *
 * The gate order matches the result callback's - provider, timestamp, signature, then the
 * round - so a provider debugging one endpoint learns the other. The refusal codes are
 * deliberately the same words too.
 */
export async function recordRoundProgress(input: {
  providerKey: string;
  rawBody: string;
  headers: Record<string, string>;
}): Promise<ProgressOutcome> {
  const { providerKey, rawBody } = input;
  const headers = normaliseHeaders(input.headers);

  // Gate 1. An unknown or disabled provider, or external games switched off platform-wide.
  // `loadProviderSecrets` answers all three, and it is the function that decides enablement so
  // that a caller cannot forget to.
  const secrets = await loadProviderSecrets(providerKey);
  if (!secrets?.callbackToken) {
    return refuse("provider_unknown", "Unknown provider.");
  }

  // Gate 2. The bearer token. Constant-time, and `safeEqual` returns false on a length
  // mismatch rather than throwing, so a short guess cannot be told apart from a wrong one.
  const authorization = headers.get("authorization") ?? "";
  const offered = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!offered || !safeEqual(offered, secrets.callbackToken)) {
    return refuse("signature_invalid", "Callback credentials were refused.");
  }

  // Gate 3. Freshness, before the signature, because a replayed request carries a genuinely
  // valid signature and the timestamp is the only thing that can see it.
  const timestamp = checkTimestamp(headers.get("x-timestamp"));
  if (!timestamp.valid) {
    return refuse("timestamp_rejected", timestamp.reason);
  }

  // Gate 4. The HMAC over the RAW BYTES. Never over a re-serialised body - key order,
  // whitespace and number formatting all shift, so that fails for valid requests and can be
  // made to pass for crafted ones.
  const signature = headers.get("x-signature") ?? "";
  if (!signature || !verifyCallbackSignature(rawBody, signature, secrets)) {
    return refuse("signature_invalid", "Callback credentials were refused.");
  }

  let payload: RoundProgressPayload;
  try {
    payload = JSON.parse(rawBody) as RoundProgressPayload;
  } catch {
    return refuse("unparseable", "Body was not valid JSON.");
  }

  const round = await findRound(providerKey, payload);
  if (!round) {
    return refuse("round_not_found", "No such round for this provider.");
  }

  /*
   * Gate 5. THE ROUND MUST STILL BE LIVE, and this is the gate that keeps the file honest.
   *
   * A finished round's breakdown is the one the RESULT carried, which is the figure the score
   * was computed from and the one a player's own results page explains. Letting a progress
   * report land afterwards means the board and the payout are describing different runs - and
   * it would arrive with no score beside it, so it reads as authoritative.
   *
   * `LIVE_ROUND_STATUSES` is `pending` and `launched`, so this also refuses a `voided` round
   * (whose zero is bookkeeping, `13` s4.1n) and an `unresolved` one (whose fate belongs to the
   * contest's `unresolvedRoundPolicy`, and answering it here answers it twice).
   */
  if (!LIVE_ROUND_STATUSES.includes(round.status)) {
    return refuse(
      "round_not_live",
      `Round is ${round.status} and no longer accepting progress.`,
      round.roundId,
    );
  }

  const breakdown = sanitiseBreakdown(payload.breakdown);
  if (!breakdown) {
    // Reason this is a refusal rather than a silent 200: a provider sending a shape we store
    // nothing from should find that out on their first call, not discover months later that a
    // board has been blank. It is still a 2xx at the route, because retrying will not help.
    return refuse(
      "nothing_to_record",
      "No renderable figures in the breakdown.",
      round.roundId,
    );
  }

  /*
   * TWO NAMED PATHS. Not a spread, not `Object.assign`, not the parsed body.
   *
   * `progressAt` is here so a screen can tell a report that arrived ten seconds ago from one
   * that arrived at the start of a round the player then walked away from - without it, a
   * stalled game and an active one are indistinguishable on the board.
   */
  await GameRound.updateOne(
    { _id: round._id },
    { $set: { scoreBreakdown: breakdown, progressAt: new Date() } },
  );

  return {
    accepted: true,
    result: "recorded",
    message: "Progress recorded.",
    roundId: round.roundId,
  };
}
