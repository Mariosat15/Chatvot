import { signOutbound } from "../http/inbound-auth";
import { buildResultBody } from "../rounds/report";
import { Round, type RoundDoc } from "../store/round.model";

/**
 * Delivering the result to the platform - endpoint 3, "the most important call in the
 * integration".
 *
 * RETRYING IS NOT AN OPTIMISATION HERE, IT IS THE FEATURE
 * ------------------------------------------------------
 * The specification asks for retries with backoff "for at least 24 hours" using the same
 * `eventId`, and states the asymmetry that justifies it: "duplicate deliveries are completely safe
 * for us; a lost one is not". A dropped score is a contest that cannot settle, with other
 * players' prize money frozen behind it.
 *
 * So the design rule is that a delivery is never fire-and-forget. Every terminal round carries its
 * own delivery record, and the only question the sweeper asks is whether an unacknowledged one is
 * due. A round awaiting delivery is therefore always discoverable, which a separate in-memory
 * queue would not be across a restart - and a deployment during a contest is exactly when this
 * matters.
 */

/**
 * The backoff schedule, in milliseconds after the first attempt.
 *
 * WHY THE LAST ENTRY IS A CAP AND NOT A CONTINUATION
 * -------------------------------------------------
 * Doubling for ever looks like the careful choice and quietly switches the retry off: within a
 * 24-hour window an uncapped delay eventually exceeds the window itself, so the last few hours
 * contain no attempts at all. There is no error and no log line - the delivery simply stops being
 * tried while still counting as pending. Capping at four hours keeps attempts landing across the
 * whole window, which is the property the specification actually asked for.
 */
const BACKOFF_MS = [
  0,
  30_000,
  60_000,
  2 * 60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
  4 * 60 * 60_000,
];

const MAX_BACKOFF_MS = 4 * 60 * 60_000;

/** The window the specification asks us to keep trying for. */
const RETRY_WINDOW_MS = 24 * 60 * 60_000;

/** The specification's own timeout expectation, applied in the direction we control. */
const DELIVERY_TIMEOUT_MS = 10_000;

/** Exported so a test can assert the cap holds, which is the property that is silent when it breaks. */
export function delayFor(attempt: number): number {
  if (attempt < BACKOFF_MS.length) {
    // eslint-disable-next-line security/detect-object-injection
    return BACKOFF_MS[attempt];
  }
  return MAX_BACKOFF_MS;
}

export type DeliveryOutcome =
  | { sent: true; status: number }
  | { sent: false; reason: string; retryable: boolean }
  | { sent: false; reason: "suppressed"; retryable: false }
  | { sent: false; reason: "not_reportable"; retryable: false };

/**
 * Whether this round's result is ours to report at all.
 *
 * A practice round is not. Section 7 says `ranked` "must produce a result callback" and that
 * practice "is free play and is never scored by us", which leaves whether to send one for practice
 * genuinely undecided - the document neither asks for it nor forbids it. Not sending is the
 * reading taken here, on the grounds that a platform which never scores a practice result has no
 * use for the message, and a stream of events it must accept and discard is a cost with no
 * benefit. The fetch endpoint still reports practice rounds in full, so nothing is hidden.
 * Ambiguity A5.
 */
function isReportable(round: RoundDoc): boolean {
  return round.mode === "ranked";
}

async function postResult(
  url: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number; body: string }> {
  const { body, headers } = signOutbound(payload);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      // The SAME string that was signed. Re-serialising the object here is the single most common
      // way a signed webhook integration fails: key order and number formatting shift, the
      // signature no longer matches the bytes, and the platform correctly rejects a valid result.
      body,
      signal: controller.signal,
    });

    const text = await response.text().catch(() => "");
    return { ok: response.ok, status: response.status, body: text.slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Attempts one delivery for a round, and records what happened.
 *
 * Returns rather than throws, because the caller is a sweeper iterating over many rounds and one
 * unreachable callback host must not stop the others being tried.
 */
export async function attemptDelivery(roundId: string): Promise<DeliveryOutcome> {
  const round = await Round.findOne({ roundId });
  if (!round) return { sent: false, reason: "unknown_round", retryable: false };

  if (!isReportable(round)) {
    await Round.updateOne(
      { roundId },
      { $set: { "delivery.acknowledgedAt": new Date(), "delivery.nextAttemptAt": null } },
    );
    return { sent: false, reason: "not_reportable", retryable: false };
  }

  if (round.sandbox.suppressCallback) {
    // Deliberately leaves the delivery UNACKNOWLEDGED rather than marking it done.
    //
    // The control exists so the platform can prove its own recovery path works when a message
    // never arrives, and a suppressed delivery that quietly marked itself complete would be a
    // different scenario: it would look, from the outside, like a provider that had nothing to
    // say. Leaving it pending reproduces the real failure - a result that exists, is fetchable,
    // and was never delivered.
    console.warn(`⚠️ [delivery] ${roundId}: callback suppressed by sandbox control`);
    return { sent: false, reason: "suppressed", retryable: false };
  }

  const attempt = round.delivery.attempts;
  const first = round.delivery.firstAttemptAt ?? new Date();
  const now = new Date();

  if (now.getTime() - first.getTime() > RETRY_WINDOW_MS) {
    // Giving up is always critical, even though the round itself is finished and correct.
    //
    // It means the platform never received a real score, so a contest is sitting unsettled with
    // this player's result missing - and every earlier attempt in a 24-hour window has already
    // failed, which is not a transient fault.
    await Round.updateOne({ roundId }, { $set: { "delivery.gaveUpAt": now } });
    console.error(
      `❌ [delivery] ${roundId}: giving up after ${attempt} attempts over 24h. ` +
        `The platform never acknowledged event ${round.delivery.eventId}.`,
    );
    return { sent: false, reason: "gave_up", retryable: false };
  }

  const payload = buildResultBody(round.toObject(), now);

  try {
    const response = await postResult(round.resultCallbackUrl, payload);

    if (response.ok) {
      await Round.updateOne(
        { roundId },
        {
          $set: {
            "delivery.acknowledgedAt": now,
            "delivery.lastAttemptAt": now,
            "delivery.firstAttemptAt": first,
            "delivery.nextAttemptAt": null,
          },
          $unset: { "delivery.lastError": "" },
          $inc: { "delivery.attempts": 1 },
        },
      );
      return { sent: true, status: response.status };
    }

    await recordFailure(
      roundId,
      attempt,
      now,
      first,
      `HTTP ${response.status}: ${response.body}`,
    );
    return {
      sent: false,
      reason: `HTTP ${response.status}`,
      // Every non-2xx is retried, and that is the specification's instruction rather than a
      // guess: it asks for retries "if you do not receive a 2xx from us", without exempting the
      // 4xx range. A 401 during a secret rotation and a 500 during a deployment both recover on
      // their own, and both would otherwise lose a real score.
      retryable: true,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Delivery failed.";
    await recordFailure(roundId, attempt, now, first, reason);
    return { sent: false, reason, retryable: true };
  }
}

async function recordFailure(
  roundId: string,
  attempt: number,
  now: Date,
  first: Date,
  reason: string,
): Promise<void> {
  const nextAttemptAt = new Date(now.getTime() + delayFor(attempt + 1));
  await Round.updateOne(
    { roundId },
    {
      $set: {
        "delivery.lastAttemptAt": now,
        "delivery.firstAttemptAt": first,
        "delivery.nextAttemptAt": nextAttemptAt,
        "delivery.lastError": reason.slice(0, 500),
      },
      $inc: { "delivery.attempts": 1 },
    },
  );
}

/**
 * Deliveries that are due.
 *
 * `acknowledgedAt: null` and `gaveUpAt: null` are both expressed as `$in: [null, undefined]`
 * rather than `$exists: false`. Reason: an absent field, an explicit `null` and a field the
 * schema defaulted are three different shapes in a document, and a filter matching only one of
 * them leaves the other two behind - which for a delivery queue means a score that is due for
 * ever and never sent.
 */
export async function findDueDeliveries(now = new Date(), limit = 25) {
  return Round.find({
    "delivery.eventId": { $exists: true, $ne: null },
    "delivery.acknowledgedAt": { $in: [null, undefined] },
    "delivery.gaveUpAt": { $in: [null, undefined] },
    "delivery.nextAttemptAt": { $lte: now },
  })
    .sort({ "delivery.nextAttemptAt": 1 })
    .limit(limit);
}
