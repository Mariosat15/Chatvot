import { attemptDelivery, findDueDeliveries } from "./deliver";
import {
  findFinishedClocks,
  findOverdueRounds,
  finishRound,
  playability,
} from "../rounds/lifecycle";
import type { RoundDocument } from "../store/round.model";

/**
 * The timer that keeps section 13's promise.
 *
 * WHY A TIMER IS NOT OPTIONAL
 * ---------------------------
 * Every other way a round can end is driven by the player: they solve the last board, or they
 * press exit. A player who closes the tab, loses signal or simply walks away does neither, and
 * there is no request left to run any code in. Without a timer those rounds stay open for ever,
 * and section 13 is unambiguous about the cost - "a round that stops reporting is the worst thing
 * that can happen in this integration, because a contest cannot settle and other players' prize
 * money is frozen behind it".
 *
 * Three jobs, deliberately in this order:
 *
 *   1. Close rounds whose contest window has shut          -> `expired`
 *   2. Close rounds whose own gameplay clock has run out   -> `completed`
 *   3. Deliver any terminal result the platform has not acknowledged
 *
 * Closing before delivering is what makes one tick sufficient. A round that expires on this tick
 * gets its first delivery attempt on the same tick, so the specification's "within 60 seconds of
 * the round reaching a terminal state" is met by the tick interval rather than by luck.
 *
 * THIS IS THE ONLY PLACE THAT DELIVERS, AND THAT IS A DELIBERATE CORRECTION
 * -----------------------------------------------------------------------
 * The first version of this service also fired a delivery from the fetch endpoint and the void
 * endpoint, on the reasonable-sounding grounds that both know a round has just finished. The result
 * was that `finishRound` had eight call sites and three of them delivered: a player who solved
 * their last board, a player who left, and a player whose session resumed into a closed round all
 * reached a terminal state and reported nothing. Every test of the sweeper passed, because the
 * sweeper was one of the three that remembered.
 *
 * That is the "count the writers" failure in its usual shape - a rule applied at some call sites
 * rather than at one - and the fix is not to add the missing five. It is that a terminal transition
 * marks the delivery due and exactly one component acts on that, so a call site cannot forget a
 * step it does not perform.
 *
 * The cost is latency: a result waits up to one tick instead of going out immediately. That is
 * acceptable on purpose, and not only because 15 seconds is well inside the specification's 60. A
 * delivery fired from a player's request would put a call to the platform, with its own ten-second
 * timeout, inside the response to a puzzle submission.
 */

/**
 * Frequent enough that the 60-second delivery target is met by the schedule, not by chance.
 *
 * Overridable so the tests can drive the real timer rather than calling `sweepOnce` by hand. Reason
 * that matters: the interesting failures here are the overlap guard and the scheduling, and neither
 * exists on a path that a direct call takes.
 */
const TICK_MS = Number.parseInt(process.env.GAMES_SWEEP_MS ?? "", 10) || 15_000;

let timer: NodeJS.Timeout | null = null;
/**
 * The tick currently in flight, if any.
 *
 * Held so shutdown can wait for it. Without this, stopping the interval leaves an in-flight tick
 * running against a database the shutdown is about to close, and the tick fails with
 * `MongoClientClosedError` - which is alarming, logged as a sweeper failure, and entirely
 * self-inflicted. It also means a delivery could be abandoned halfway through a deploy.
 */
let inFlight: Promise<void> | null = null;

export interface SweepSummary {
  expired: number;
  clocksFinished: number;
  delivered: number;
  deliveryFailures: number;
}

export async function sweepOnce(now = new Date()): Promise<SweepSummary> {
  const summary: SweepSummary = {
    expired: 0,
    clocksFinished: 0,
    delivered: 0,
    deliveryFailures: 0,
  };

  /*
   * The two queries FIND candidates; `playability` DECIDES what each one owes.
   *
   * This was originally two loops, each passing a status it had chosen itself - `expired` for the
   * overdue query, `completed` for the run-out clocks. It produced the right answers and was still
   * the wrong shape, because the same rule already existed in `playability`, which is what every
   * play endpoint and the fetch endpoint use. One rule in two copies, and the copy with the tests
   * around it was this one: a probe that changed `playability` to report a run-out clock as
   * `expired` left the whole suite green, because the only test of that rule went through the
   * sweeper and the sweeper was not asking.
   *
   * Deciding here also removes an order dependency that read as a coincidence. A round past BOTH
   * deadlines used to be `expired` because the overdue loop happened to run first; now it is
   * `expired` because `playability` checks the contest window before the gameplay clock, which is
   * the actual reason.
   */
  const candidates = new Map<string, RoundDocument>();
  for (const round of await findOverdueRounds(now)) candidates.set(round.roundId, round);
  for (const round of await findFinishedClocks(now)) candidates.set(round.roundId, round);

  for (const round of candidates.values()) {
    const owed = playability(round, now);
    // Skipping a candidate the rule says is still playable is deliberate: the queries are
    // deliberately broad - `findFinishedClocks` cannot express its deadline in MongoDB at all - so
    // a candidate that turns out to be live is an expected outcome, not an anomaly.
    if (owed.playable || !owed.owes) continue;

    const outcome = await finishRound(round.roundId, { status: owed.owes, at: now });
    if (!outcome?.transitioned) continue;

    if (owed.owes === "expired") summary.expired++;
    else summary.clocksFinished++;
  }

  for (const round of await findDueDeliveries(now)) {
    // Reason for awaiting each in turn rather than in parallel: a platform that is down will
    // reject all of them, and firing a whole batch at a struggling endpoint is how a retry
    // mechanism becomes the outage. Sequential delivery also keeps the 10-second timeout
    // meaningful as a bound on the tick.
    const outcome = await attemptDelivery(round.roundId);
    if (outcome.sent) summary.delivered++;
    else if (outcome.reason !== "suppressed" && outcome.reason !== "not_reportable") {
      summary.deliveryFailures++;
    }
  }

  return summary;
}

export function startSweeper(): void {
  if (timer) return;

  timer = setInterval(() => {
    // The overlap guard.
    //
    // A tick that takes longer than the interval - a slow platform, a batch of retries - would
    // otherwise start a second pass over the same rounds. The terminal transitions are protected
    // by their own conditional update, but two passes would still double the requests to a
    // callback host that is already failing, which is the opposite of a backoff.
    if (inFlight) return;

    inFlight = sweepOnce()
      .then((summary) => {
        if (summary.expired || summary.clocksFinished || summary.delivered) {
          console.log(
            `🔄 [sweeper] expired ${summary.expired}, clocks ${summary.clocksFinished}, ` +
              `delivered ${summary.delivered}, failed ${summary.deliveryFailures}`,
          );
        }
      })
      .catch((error) => {
        // A throw inside a timer callback with no handler takes the process down, which would
        // stop every future sweep - the one failure this module exists to prevent.
        console.error("❌ [sweeper] tick failed:", error);
      })
      .finally(() => {
        inFlight = null;
      });
  }, TICK_MS);

  // Reason for `unref`: the timer must not be what keeps the process alive during a shutdown, or
  // the container waits the full tick interval before exiting on every deploy.
  timer.unref();
  console.log(`🔄 ChartVolt Games sweeper running every ${TICK_MS / 1000}s`);
}

/**
 * Stops the timer and waits for any tick already running.
 *
 * Awaiting matters: `clearInterval` stops future ticks and does nothing about the one in progress, so
 * a shutdown that did not wait would close the database underneath a delivery. The visible symptom
 * is a `MongoClientClosedError` logged as a sweeper failure on every deploy, which is exactly the
 * kind of alarming-but-meaningless log that teaches a team to ignore this component's errors.
 */
export async function stopSweeper(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  if (inFlight) await inFlight;
}
