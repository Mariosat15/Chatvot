import type {
  NormalisedRoundResult,
  ProviderResult,
  ProviderRoundStatus,
  ProviderScoreDirection,
} from "../../contract";

/**
 * The provider's result body, translated into our vocabulary (chapter 02 section 4.1).
 *
 * ONE PARSER, USED BY BOTH THE CALLBACK AND THE FETCH
 * ---------------------------------------------------
 * The provider builds the callback body and the fetch response from one serialiser, on the
 * grounds that two would agree the day they were written and diverge afterwards. The same
 * argument applies on this side and is worse if ignored: if `parseCallback` and `fetchRound`
 * read the payload differently, then reconciliation - whose entire job is to answer "did we
 * miss a result" - can report a different score from the callback it is checking for, and
 * there is no way to tell which of the two is the bug.
 *
 * This codebase has had that failure four times already (`referenceId`, `failedReason`,
 * `challengeId`, and a Game Master percentage), and `check:mirrors` saw none of them, because
 * it compares models rather than the code reading them.
 */

/** The shape ChartVolt Games sends. Every field optional, because a payload is an input. */
interface ProviderResultBody {
  eventId?: unknown;
  eventType?: unknown;
  occurredAt?: unknown;
  roundId?: unknown;
  providerRoundId?: unknown;
  playerId?: unknown;
  gameCode?: unknown;
  status?: unknown;
  score?: unknown;
  scoreBreakdown?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  durationMs?: unknown;
  replayUrl?: unknown;
  integrity?: { suspicious?: unknown; flags?: unknown };
}

const TERMINAL_STATUSES: ProviderRoundStatus[] = [
  "completed",
  "abandoned",
  "expired",
  "voided",
];

/**
 * Which way each of our own titles ranks.
 *
 * A SECOND COPY OF A FACT, KEPT DELIBERATELY, WITH ITS LIMITS STATED
 * -----------------------------------------------------------------
 * The authoritative record is `provider_game.scoreDirection`, written by the catalogue sync
 * from the provider's own declaration, and that is what settlement reads. This map exists
 * because `parseCallback` is SYNCHRONOUS in `GameProviderAdapter` - it cannot await a database
 * read - and the field it must fill is required.
 *
 * What the value here actually affects is narrow and worth being precise about, because
 * "scoreDirection is wrong" sounds catastrophic. It is passed to `syncParticipantScore`, which
 * uses it to pick the best of several attempts. Ranking and payout do NOT come from here; they
 * come from the catalogue via `resolveContestScoreDirection`. So a mistake in this map costs a
 * player the wrong attempt being counted, not a reversed leaderboard.
 *
 * The unknown case matches settlement's default EXACTLY, and that is the point rather than
 * laziness: a uniformly wrong direction is coherent and visibly wrong, while two components
 * disagreeing produces a result that looks plausible and cannot be explained to a player.
 */
const TITLE_DIRECTIONS = new Map<string, ProviderScoreDirection>([
  ["circuit-sprint", "higher_is_better"],
  ["circuit-perfect", "lower_is_better"],
]);

export function directionForGameCode(
  gameCode: string | undefined,
): ProviderScoreDirection {
  if (gameCode) {
    const known = TITLE_DIRECTIONS.get(gameCode);
    if (known) return known;
  }

  // Loud, because it means this adapter has seen a title it does not know about - which for a
  // first-party provider means the service shipped a game the platform was not updated for.
  console.warn(
    `⚠️ [chartvolt-games] no known score direction for "${gameCode ?? "(none)"}"; ` +
      `treating it as higher-is-better, matching settlement's default.`,
  );
  return "higher_is_better";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * A date, or nothing.
 *
 * Reason for rejecting an unparseable string rather than passing `new Date(x)` through: an
 * Invalid Date is truthy, survives assignment onto a Mongoose Date path, and fails at save
 * time with a CastError far from here - or worse, stores and then formats as "Invalid Date"
 * on a screen.
 */
function asDate(value: unknown): Date | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const flags = value.filter((entry): entry is string => typeof entry === "string");
  return flags.length > 0 ? flags : undefined;
}

/**
 * Translates a result body.
 *
 * REFUSES A NON-TERMINAL ROUND, AND THAT IS THE INTERESTING DECISION
 * -----------------------------------------------------------------
 * The fetch endpoint legitimately returns `created` or `in_progress` for a round still being
 * played, and `NormalisedRoundResult.status` has no value for either - it is typed to the four
 * terminal states, because it describes a FINISHED round.
 *
 * So a live round is refused here with a distinguishable code rather than coerced. Coercing it
 * to `abandoned` or `expired` would hand reconciliation a terminal state for a round the player
 * is still playing, which is the one thing chapter 07 section 2's poll must never do: it would
 * settle a contest against a score that was still being earned. `ROUND_PENDING` is the same code
 * the mock returns for the same situation, so the reconciliation path sees one vocabulary.
 */
export function normaliseResultBody(
  payload: unknown,
): ProviderResult<NormalisedRoundResult> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {
      success: false,
      error: "Result payload is not an object.",
      code: "MALFORMED_RESULT",
      retryable: false,
    };
  }

  const body = payload as ProviderResultBody;

  const roundId = asString(body.roundId);
  if (!roundId) {
    return {
      success: false,
      error: "Result is missing roundId.",
      code: "MALFORMED_RESULT",
      retryable: false,
    };
  }

  const status = asString(body.status);
  if (!status) {
    return {
      success: false,
      error: `Result for round "${roundId}" is missing status.`,
      code: "MALFORMED_RESULT",
      retryable: false,
    };
  }

  if (!TERMINAL_STATUSES.includes(status as ProviderRoundStatus)) {
    return {
      success: false,
      error: `Round "${roundId}" is still in progress (status "${status}").`,
      code: "ROUND_PENDING",
      // Retryable: polling again later is exactly the right response, and it is what the
      // four-stage safety net does.
      retryable: true,
    };
  }

  const gameCode = asString(body.gameCode);

  /*
   * A missing score on a terminal round becomes 0 rather than a refusal, and the choice is not
   * obvious in either direction.
   *
   * `rawScore` is required by the contract, so something must be supplied. A `voided` round has
   * no score by design - chapter 01 section 13 says it is "not scored, and we return the attempt
   * to the player" - so refusing the payload would discard the one message that tells us to give
   * the attempt back. Zero is safe HERE specifically because a voided round never reaches
   * ranking: gate 11 stores the status and the participant is excluded, so the number is never
   * compared with anything.
   *
   * It would NOT be safe as a general default for a lower-is-better title, where zero is the
   * best possible score - which is why the provider itself refuses to report a bare zero for an
   * unplayed Circuit Perfect round and sends the worst time instead.
   */
  const rawScore = asFiniteNumber(body.score) ?? 0;

  const result: NormalisedRoundResult = {
    roundId,
    providerRoundId: asString(body.providerRoundId) ?? roundId,
    status: status as ProviderRoundStatus,
    rawScore,
    scoreDirection: directionForGameCode(gameCode),
  };

  const breakdown = body.scoreBreakdown;
  if (typeof breakdown === "object" && breakdown !== null && !Array.isArray(breakdown)) {
    // Display only. Chapter 01 section 5.4: ranking on a breakdown component would make the
    // result depend on data whose meaning was never agreed.
    result.breakdown = breakdown as Record<string, unknown>;
  }

  const startedAt = asDate(body.startedAt);
  if (startedAt) result.startedAt = startedAt;
  const completedAt = asDate(body.completedAt);
  if (completedAt) result.completedAt = completedAt;
  const occurredAt = asDate(body.occurredAt);
  if (occurredAt) result.occurredAt = occurredAt;

  const durationMs = asFiniteNumber(body.durationMs);
  if (durationMs !== undefined) result.durationMs = durationMs;

  const replay = asString(body.replayUrl);
  if (replay) result.replayUrl = replay;

  const flags = asStringArray(body.integrity?.flags);
  if (flags) result.integrityFlags = flags;

  return { success: true, data: result };
}
