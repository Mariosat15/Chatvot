import GameRound, {
  canTransitionRound,
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import ProviderEvent, {
  type EventProcessingResult,
} from "@/database/models/games/provider-event.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import type { NormalisedRoundResult } from "@/lib/services/game-providers/contract";
import { canContestAcceptScore } from "./contest-state";
import {
  checkTimestamp,
  extractEventId,
  loadProviderSecrets,
  normaliseHeaders,
  safeEqual,
  verifyCallbackSignature,
} from "./callback-verification";

/**
 * THE ONLY WAY A PROVIDER SCORE ENTERS THIS SYSTEM (X3, chapter 02 section 10 rule 3).
 *
 * Nothing else may write `game_round.rawScore` or influence ranking from provider data. The
 * reason is Stage 0's most expensive lesson: competition entry had four separate writers
 * that the plan described as two, they drifted, and one of them wrote an unattributable
 * ledger row for every entry fee ever taken. One door means one place to audit, one place
 * to fix, and one place where a rule can be added and be certain it applies.
 *
 * THE ELEVEN GATES, IN THIS ORDER (chapter 06 section 2)
 * -----------------------------------------------------
 *   1.  Store the raw event               <- BEFORE anything else, even validation
 *   2.  Provider known and enabled
 *   3.  Bearer token matches
 *   4.  Timestamp present and within 5 minutes
 *   5.  HMAC over the RAW BODY BYTES matches
 *   6.  eventId not already processed
 *   7.  Round exists and belongs to this provider
 *   8.  Round is in a state that can accept a result
 *   9.  Contest still open, or inside its grace period
 *   10. Score inside the game's declared range
 *   11. Apply, then mark the event processed
 *
 * The order is not decorative. Storing first means a throw anywhere below still leaves
 * evidence (chapter 04 section 3.4). Checking the token and signature before the round
 * lookup means an unauthenticated caller cannot use timing or error text to discover which
 * round ids exist. Deduplicating before applying is what makes a provider's retry free.
 */

export interface IngestCallbackInput {
  providerKey: string;
  /** The exact bytes received. Never a re-serialised object - see verifySignature. */
  rawBody: string;
  headers: Record<string, string>;
}

export interface IngestOutcome {
  /** True when the event was accepted OR safely ignored as a duplicate. */
  accepted: boolean;
  result: EventProcessingResult;
  /** Safe to return to the provider. Never leaks internal detail. */
  message: string;
  eventId?: string;
  roundId?: string;
  /** Raised for anything an operator must look at. */
  alert?: "warning" | "critical";
}

/** Records the outcome on the stored event. Never throws - the score already landed. */
async function finishEvent(
  eventId: string,
  patch: {
    result: EventProcessingResult;
    error?: string;
    roundId?: string;
    signatureValid?: boolean;
  },
): Promise<void> {
  await ProviderEvent.updateOne(
    { eventId },
    {
      $set: {
        processedAt: new Date(),
        processingResult: patch.result,
        ...(patch.error ? { processingError: patch.error } : {}),
        ...(patch.roundId ? { roundId: patch.roundId } : {}),
        ...(patch.signatureValid !== undefined
          ? { signatureValid: patch.signatureValid }
          : {}),
      },
    },
  ).catch((error) => {
    console.error(`❌ Could not record outcome for event ${eventId}:`, error);
  });
}

export async function ingestProviderCallback(
  input: IngestCallbackInput,
): Promise<IngestOutcome> {
  const { providerKey, rawBody } = input;
  const headers = normaliseHeaders(input.headers);

  const eventId = extractEventId(headers, rawBody);
  if (!eventId) {
    // Cannot deduplicate what has no id, and storing it under a generated one would make
    // a retry look like a new event. Refused before storage, and alerted: a provider
    // omitting the id is a contract break, not a player problem.
    return {
      accepted: false,
      result: "unparseable",
      message: "Event id missing.",
      alert: "warning",
    };
  }

  // ── GATE 1: store the raw event, before any validation ────────────────────────────────
  let isDuplicate = false;
  try {
    await ProviderEvent.create({
      eventId,
      providerKey,
      rawBody,
      headers: Object.fromEntries(headers),
      receivedAt: new Date(),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // Gate 6, reached early because the unique index IS the dedupe mechanism. A retried
      // delivery has done nothing wrong, so this is idempotent SUCCESS with no second
      // score - the same rule Stage 0 settled for a duplicate competition entry.
      isDuplicate = true;
    } else {
      console.error("❌ Could not store provider event:", error);
      return {
        accepted: false,
        result: "error",
        message: "Event could not be stored.",
        alert: "critical",
      };
    }
  }

  if (isDuplicate) {
    return {
      accepted: true,
      result: "duplicate_ignored",
      message: "Already processed.",
      eventId,
    };
  }

  // ── GATE 2: provider known and enabled ────────────────────────────────────────────────
  const adapter = getProviderAdapter(providerKey);
  const secrets = await loadProviderSecrets(providerKey);
  if (!adapter || !secrets) {
    await finishEvent(eventId, {
      result: "provider_unknown",
      error: `No enabled provider "${providerKey}".`,
    });
    return {
      accepted: false,
      result: "provider_unknown",
      message: "Unknown provider.",
      eventId,
      alert: "warning",
    };
  }

  // ── GATE 3: bearer token ──────────────────────────────────────────────────────────────
  const authorization = headers.get("authorization") ?? "";
  const offeredToken = authorization.replace(/^Bearer\s+/i, "");
  if (!secrets.callbackToken || !safeEqual(offeredToken, secrets.callbackToken)) {
    await finishEvent(eventId, {
      result: "signature_invalid",
      error: "Bearer token mismatch.",
      signatureValid: false,
    });
    return {
      accepted: false,
      result: "signature_invalid",
      message: "Unauthorized.",
      eventId,
      // Critical: either credentials are wrong or someone is probing the endpoint.
      alert: "critical",
    };
  }

  // ── GATE 4: timestamp within five minutes ─────────────────────────────────────────────
  const timestamp = checkTimestamp(headers.get("x-timestamp"));
  if (!timestamp.valid) {
    await finishEvent(eventId, {
      result: "timestamp_rejected",
      error: timestamp.reason,
    });
    return {
      accepted: false,
      result: "timestamp_rejected",
      message: "Timestamp rejected.",
      eventId,
      alert: "warning",
    };
  }

  // ── GATE 5: HMAC over the raw body bytes ──────────────────────────────────────────────
  const signature = headers.get("x-signature") ?? "";
  if (!signature || !verifyCallbackSignature(rawBody, signature, secrets)) {
    await finishEvent(eventId, {
      result: "signature_invalid",
      error: "HMAC mismatch.",
      signatureValid: false,
    });
    return {
      accepted: false,
      result: "signature_invalid",
      message: "Invalid signature.",
      eventId,
      alert: "critical",
    };
  }

  // ── GATE 5b: the adapter's own signature check ────────────────────────────────────────
  //
  // BOTH checks run, and neither is conditional. The plan names both (chapter 06 section 2
  // gate 5 for the engine's HMAC, chapter 02 section 4 for the adapter's `verifyCallback`),
  // and the duplication is deliberate rather than an oversight:
  //
  //   - The engine check enforces the scheme WE published in chapter 01 section 2.2. It
  //     cannot be weakened by a badly-written adapter, which matters because an adapter is
  //     the part most likely to be added in a hurry by someone integrating a new provider.
  //   - The adapter check lets a provider whose headers or encoding differ from our spec
  //     add its own, stricter test.
  //
  // For a spec-compliant provider these are the same computation over different header
  // names, and paying for it twice is cheap. What is NOT acceptable is an adapter that
  // returns `{ valid: true }` without checking anything - that is a review failure, not a
  // shortcut, because it turns this gate into a formality.
  const adapterVerdict = adapter.verifyCallback(rawBody, Object.fromEntries(headers));
  if (!adapterVerdict.valid) {
    await finishEvent(eventId, {
      result: "signature_invalid",
      error: `Adapter rejected the callback: ${adapterVerdict.reason}`,
      signatureValid: false,
    });
    return {
      accepted: false,
      result: "signature_invalid",
      message: "Invalid signature.",
      eventId,
      alert: "critical",
    };
  }

  const parsed = adapter.parseCallback(rawBody);
  if (!parsed.success) {
    await finishEvent(eventId, {
      result: "unparseable",
      error: parsed.error,
      signatureValid: true,
    });
    return {
      accepted: false,
      result: "unparseable",
      message: "Payload could not be read.",
      eventId,
      alert: "warning",
    };
  }
  const normalised = parsed.data;

  return applyResult({
    eventId,
    providerKey,
    normalised,
    source: "callback",
  });
}

/**
 * Applies a normalised result to its round. Shared by the callback and the poller.
 *
 * Reason it is shared: chapter 07 section 2 makes polling a first-class path, not a
 * fallback bolted on later - stages 2 and 3 of the safety net produce exactly the same
 * normalised result as a callback. Giving the poller its own apply function would be a
 * second door into scoring, which rule 3 forbids.
 */
export async function applyResult(args: {
  eventId?: string;
  providerKey: string;
  normalised: NormalisedRoundResult;
  source: "callback" | "poll" | "manual";
}): Promise<IngestOutcome> {
  const { eventId, providerKey, normalised, source } = args;

  const record = async (patch: Parameters<typeof finishEvent>[1]) => {
    if (eventId) await finishEvent(eventId, patch);
  };

  // ── GATE 7: round exists and belongs to this provider ─────────────────────────────────
  const round = await GameRound.findOne({
    roundId: normalised.roundId,
    providerKey,
  });
  if (!round) {
    await record({
      result: "round_not_found",
      error: `No round "${normalised.roundId}" for provider "${providerKey}".`,
      signatureValid: true,
    });
    return {
      accepted: false,
      result: "round_not_found",
      message: "Unknown round.",
      eventId,
      alert: "warning",
    };
  }

  // ── GATE 8: round can accept a result ─────────────────────────────────────────────────
  const target = normalised.status as RoundStatus;
  if (!canTransitionRound(round.status, target)) {
    // A round that already reported is the interesting case, and it splits in two.
    const alreadyScored = typeof round.rawScore === "number";
    const differentScore = alreadyScored && round.rawScore !== normalised.rawScore;

    if (differentScore) {
      // Chapter 07 section 4: FIRST VALID RESULT WINS. The second is flagged, never
      // applied - because the score that was ranked has to stay the score that is stored.
      round.conflictFlaggedAt = new Date();
      await round.save();
      await record({
        result: "conflict_flagged",
        error: `Conflicting score: stored ${round.rawScore}, received ${normalised.rawScore}.`,
        roundId: round.roundId,
        signatureValid: true,
      });
      return {
        accepted: false,
        result: "conflict_flagged",
        message: "Conflicting result recorded.",
        eventId,
        roundId: round.roundId,
        alert: "critical",
      };
    }

    await record({
      result: "round_not_acceptable",
      error: `Round is ${round.status}; cannot move to ${target}.`,
      roundId: round.roundId,
      signatureValid: true,
    });
    return {
      // Accepted: a provider re-sending the identical result it already delivered has done
      // nothing wrong, and answering with an error invites yet another retry.
      accepted: alreadyScored && !differentScore,
      result: "round_not_acceptable",
      message: "Round already reported.",
      eventId,
      roundId: round.roundId,
    };
  }

  // ── GATE 9: contest still open ────────────────────────────────────────────────────────
  const acceptance = await canContestAcceptScore(round);
  if (!acceptance.acceptable) {
    if (acceptance.settled) {
      // Chapter 07 section 4: recorded for audit, NOT applied, and alerted. Deliberately
      // does not touch `status` or `rawScore` - the ranked result must stay untouched.
      round.lateResultRecordedAt = new Date();
      await round.save();
      await record({
        result: "late_recorded_not_applied",
        error: `${acceptance.reason} Score ${normalised.rawScore} recorded but not applied.`,
        roundId: round.roundId,
        signatureValid: true,
      });
      return {
        accepted: true,
        result: "late_recorded_not_applied",
        message: "Result recorded after settlement; not applied.",
        eventId,
        roundId: round.roundId,
        alert: "critical",
      };
    }

    await record({
      result: "round_not_acceptable",
      error: acceptance.reason,
      roundId: round.roundId,
      signatureValid: true,
    });
    return {
      accepted: false,
      result: "round_not_acceptable",
      message: "Contest cannot accept this result.",
      eventId,
      roundId: round.roundId,
      alert: "warning",
    };
  }

  // ── GATE 10: score inside the declared range ──────────────────────────────────────────
  const rangeCheck = await scoreWithinRange(round.gameKey, normalised.rawScore);
  if (!rangeCheck.ok) {
    // Chapter 07 section 4: rejected, round marked unresolved, alert raised. Marked
    // unresolved rather than left launched so the reconciliation net stops polling it and
    // the contest's unresolved policy decides what the player gets.
    round.status = "unresolved";
    await round.save();
    await record({
      result: "score_out_of_range",
      error: rangeCheck.reason,
      roundId: round.roundId,
      signatureValid: true,
    });
    return {
      accepted: false,
      result: "score_out_of_range",
      message: "Score outside the declared range.",
      eventId,
      roundId: round.roundId,
      alert: "critical",
    };
  }

  // ── GATE 11: apply, then mark processed ───────────────────────────────────────────────
  round.status = target;
  round.rawScore = normalised.rawScore;
  round.scoreBreakdown = normalised.breakdown;
  round.providerRoundId = normalised.providerRoundId ?? round.providerRoundId;
  round.startedAt = normalised.startedAt ?? round.startedAt;
  round.completedAt = normalised.completedAt ?? round.completedAt;
  round.durationMs = normalised.durationMs ?? round.durationMs;
  round.replayUrl = normalised.replayUrl ?? round.replayUrl;
  round.integrityFlags = normalised.integrityFlags ?? round.integrityFlags;
  round.resultReceivedAt = new Date();
  round.resultSource = source;
  await round.save();

  await record({
    result: "scored",
    roundId: round.roundId,
    signatureValid: true,
  });

  return {
    accepted: true,
    result: "scored",
    message: "Result recorded.",
    eventId,
    roundId: round.roundId,
  };
}

/**
 * Gate 10's check against the catalogue's declared range.
 *
 * Reason an ABSENT range passes: chapter 04 section 3.2 makes `scoreRange` optional, and a
 * provider that declares no bounds has told us nothing to enforce. Treating absent as
 * "reject everything" would make every unbounded title unplayable, which is a worse failure
 * than accepting a score we cannot bound. A missing title, by contrast, fails - that is
 * corrupt data, not a permissive configuration.
 */
async function scoreWithinRange(
  gameKey: string,
  score: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!Number.isFinite(score)) {
    return { ok: false, reason: `Score is not a finite number: ${score}.` };
  }

  const title = await ProviderGame.findOne({ gameKey })
    .select("scoreRange")
    .lean<{ scoreRange?: { min?: number; max?: number } } | null>();

  if (!title) {
    return { ok: false, reason: `No catalogue entry for "${gameKey}".` };
  }

  const { min, max } = title.scoreRange ?? {};
  if (typeof min === "number" && score < min) {
    return { ok: false, reason: `Score ${score} is below the declared minimum ${min}.` };
  }
  if (typeof max === "number" && score > max) {
    return { ok: false, reason: `Score ${score} is above the declared maximum ${max}.` };
  }
  return { ok: true };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
