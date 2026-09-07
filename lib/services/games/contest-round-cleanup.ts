import type { ClientSession } from "mongoose";
import GameRound, {
  canTransitionRound,
  LIVE_ROUND_STATUSES,
  type RoundStatus,
} from "@/database/models/games/game-round.model";

/**
 * Ending the rounds still in flight when a contest is cancelled (X6, chapter 12 section 3).
 *
 * WHY CANCELLING A CONTEST HAS TO REACH INTO ITS ROUNDS AT ALL
 * -----------------------------------------------------------
 * Cancelling a trading contest closes its open positions, because a position is the only
 * thing a trading contest leaves running. A provider contest leaves a **round** running, and
 * nothing was closing it - so cancelling one produced this sequence, none of it visible as an
 * error:
 *
 *   1. The player is refunded and the contest disappears from their lobby, while their round
 *      is still open in an iframe. They keep playing a contest that no longer exists.
 *   2. The provider posts the result. `canContestAcceptScore` refuses it, because `cancelled`
 *      is a closed status, and records it as a LATE RESULT - audited and alerted.
 *   3. The round stays `launched`, so the reconciliation net polls it, backs off, and after
 *      the grace window writes it `unresolved` and raises a CRITICAL alert.
 *
 * The operator therefore gets a critical alert for the consequence of their own deliberate
 * action, which is the fastest way to teach a team to ignore critical alerts. Ending the
 * rounds up front turns all of that into one recorded decision.
 *
 * WHY THIS IS NOT A SECOND INGESTION DOOR. It writes a **status**, never a score - the same
 * argument that lets `resolveRoundManually` exist in the admin app. `02` section 10 rule 3 is
 * about scores, and `applyResult` remains the only function that writes one.
 *
 * WHY `voided` AND NOT `abandoned` OR `expired`. Those two describe something the player or
 * the clock did. `voided` is the platform saying the attempt produced nothing usable, which
 * is exactly what happened, and it is the status the manual resolution path already uses for
 * an operator decision. It also means `resultSource: "manual"` is honest.
 */

export interface EndLiveRoundsResult {
  /** How many rounds were moved to a terminal status. */
  ended: number;
  /** Their ids, for the audit entry. */
  roundIds: string[];
  /**
   * Rounds that were live but whose transition the state machine refused.
   *
   * ALWAYS ZERO TODAY, and saying so is the point. `LIVE_ROUND_STATUSES` is `pending` and
   * `launched`, and `ROUND_TRANSITIONS` permits `voided` from both, so the query filter has
   * already guaranteed every legal move before the check runs. Proven rather than reasoned
   * about: deleting the check left the suite green, which is the third answer to a green
   * probe - the guard is real but unreachable on this path.
   *
   * It is kept as a tripwire, not claimed as a fix. The day `unresolved` is added to
   * `LIVE_ROUND_STATUSES` - which is a plausible change, since an unresolved round is one the
   * net gave up on and a cancellation arguably should close it - the check starts firing and
   * this count starts being the thing that says so. Without it, a widening of that list would
   * silently overwrite a terminal status and lose the record that a provider never reported.
   *
   * The property "terminal rounds are left alone" is therefore held by the QUERY FILTER, and
   * the test and the probe are aimed there. An overstated comment is a wrong fact.
   */
  skipped: number;
}

/**
 * Move every in-flight round of one contest to `voided`.
 *
 * Idempotent: a second call finds nothing live and returns zero, so a retried cancellation
 * costs nothing. Takes the caller's `session` when there is one, because the round must not
 * be voided if the refund transaction it belongs to rolls back.
 */
export async function endLiveRoundsForContest(input: {
  contestId: string;
  reason: string;
  session?: ClientSession;
}): Promise<EndLiveRoundsResult> {
  const { contestId, reason, session } = input;

  const live = await GameRound.find({
    contestId,
    status: { $in: LIVE_ROUND_STATUSES },
  }).session(session ?? null);

  const roundIds: string[] = [];
  let skipped = 0;

  for (const round of live) {
    // Unreachable while `LIVE_ROUND_STATUSES` stays `pending`/`launched` - see `skipped` above
    // for why it is kept anyway and where the property it looks like it holds actually lives.
    if (!canTransitionRound(round.status as RoundStatus, "voided")) {
      skipped++;
      continue;
    }

    round.status = "voided";
    // Reason: the same fields the manual resolution path writes, so a round voided by a
    // cancellation is indistinguishable in shape from one voided by an operator - both are
    // decisions, and neither should look like the reconciliation net giving up.
    round.resultSource = "manual";
    round.resultReceivedAt = new Date();
    await round.save({ session: session ?? undefined });
    roundIds.push(round.roundId);
  }

  if (roundIds.length > 0 || skipped > 0) {
    console.log(
      `🛑 Voided ${roundIds.length} live round(s) on contest ${contestId} (${skipped} already terminal): ${reason}`,
    );
  }

  return { ended: roundIds.length, roundIds, skipped };
}
