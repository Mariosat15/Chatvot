import { Types } from "mongoose";
import GameRound, {
  LIVE_ROUND_STATUSES,
} from "@/database/models/games/game-round.model";
// From `round-types.ts` and not from `reconciliation.service.ts`, because this file is
// mirrored into `apps/admin` and that service is not - see the constant's own comment.
import { DEFAULT_RESULT_GRACE_SECONDS } from "@/lib/services/games/round-types";

/**
 * The universal cut-off: one clock for every player, and the wait that makes it fair.
 *
 * THE OWNER'S QUESTION, WHICH IS THE RIGHT ONE
 * --------------------------------------------
 * "One player has a different time from another - one finishes and the other is still
 * going. We need a universal time when the competition starts and ends for all, so players
 * do not wait for others to finish."
 *
 * Half of that was already true and the half that was missing was the half that costs money.
 *
 * WHAT WAS ALREADY RIGHT. A round cannot outlive its contest: `createRound` clamps
 * `expiresAt` to `playWindowEnd`, and since `12` s2.3 the play window IS the contest clock.
 * So there is genuinely one cut-off, nobody waits for anybody, and a player who starts too
 * late to finish is refused up front rather than cut off mid-game.
 *
 * WHAT WAS WRONG, AND IT WAS NOT THE CLOCK - IT WAS THE HANDOVER
 * --------------------------------------------------------------
 * `checkAndFinalizeCompetitions` runs every minute and claims any contest whose `endTime`
 * has passed. So a provider contest settled within about sixty seconds of its cut-off -
 * **before the grace window had even opened.**
 *
 * A provider does not report synchronously. A player finishing at 13:59:50 has their result
 * posted to our callback some seconds later, and `resultGracePeriodSeconds` exists precisely
 * to say how long after the window a late result is still welcome. Settling at 14:00:00
 * threw that promise away: the score was refused as `late_recorded_not_applied`, the player
 * was ranked on nothing, **and the round they actually finished paid them nothing.** The only
 * trace is a critical audit entry nobody is watching, and the player cannot tell the
 * difference between that and being cheated.
 *
 * So the fix is not a new clock. It is that **settlement must not start until every round
 * has either reported or run out of time to.** That wait is bounded by the grace period, so
 * a deferral cannot become a strand - the cron simply picks the contest up a few passes
 * later.
 *
 * WHY THIS IS A DEFERRAL AND NOT A REFUSAL, AND WHY IT SITS BEFORE THE LOCK
 * ------------------------------------------------------------------------
 * Same reasoning as the `hold_and_alert` gate beside it: the condition is transient but it
 * persists for minutes, so claiming `active -> finalizing` and releasing it on every cron
 * pass would churn the contest's status for no purpose. Checked before the claim, the
 * contest is left completely untouched.
 *
 * It refuses a MANUAL admin finalize too, deliberately. An operator forcing settlement two
 * minutes after the cut-off would be destroying the scores of everyone who finished in the
 * last minute, and they would never know it happened. The refusal names the time it can
 * settle, so the answer is to wait rather than to override.
 *
 * WHAT HAPPENS TO A ROUND THAT NEVER REPORTS - see `endLiveRoundsForContest`'s `cutoff`
 * outcome. Short version: it becomes `unresolved`, which is the one persisted fact the
 * contest's unresolved-round policy reads, so the operator's configured answer decides what
 * the player gets rather than this file deciding for them.
 *
 * A NOTE THAT WOULD OTHERWISE BE MISSED: THE RECONCILIATION NET IS NOT SCHEDULED
 * -----------------------------------------------------------------------------
 * `reconcileRound` and `findRoundsNeedingReconciliation` are imported by their own test and
 * by nothing else - the schedule belongs to **E7/X8**, which is not built, and the
 * reconciliation service says so itself. That is a planned deferral rather than a defect,
 * but it changes what this file has to do, so it must not be assumed away:
 *
 *   - **Nothing polls.** A lost webhook is a genuinely lost score today, not a slow one.
 *     Waiting out the grace window is therefore the only recovery the platform has.
 *   - **Nothing else ever closes a live round.** Without the step below a round would sit
 *     `launched` for ever against a contest that finished weeks ago.
 *   - **No critical alert fires**, because nothing runs to raise one. Any document claiming
 *     an operator is paged for a round that never reported is describing E7.
 *
 * When E7 lands, the net and this file agree by construction: both write `unresolved`, and
 * both read it back through `assessUnresolvedRounds`. Whichever gets there first, the
 * outcome is the same - which is the property the plan chose a persisted status for.
 */

export interface RoundCutoffAssessment {
  /** Rounds still `pending` or `launched` for this contest. */
  liveRoundCount: number;
  /**
   * `playWindowEnd + resultGracePeriodSeconds`, or null when the contest has no play window
   * (a trading contest, or a provider contest that predates the field).
   */
  graceEndsAt: Date | null;
  /**
   * The grace period actually applied, resolved against the default.
   *
   * Returned rather than left for the caller to recompute. A caller that wants this figure
   * for a log line or an audit reason would otherwise carry its own
   * `?? DEFAULT_RESULT_GRACE_SECONDS`, and a second copy of a default is how the recorded
   * reason ends up naming a window nobody waited.
   */
  graceSeconds: number;
  /** True while a live round could still legitimately report. */
  deferSettlement: boolean;
  /** Operator-facing reason, set whenever `deferSettlement` is true. */
  deferReason?: string;
}

interface CutoffInput {
  competitionId: string;
  playWindowEnd?: Date | null;
  resultGracePeriodSeconds?: number | null;
  now?: Date;
  session?: import("mongoose").ClientSession;
}

const NOTHING_TO_WAIT_FOR: RoundCutoffAssessment = {
  liveRoundCount: 0,
  graceEndsAt: null,
  graceSeconds: 0,
  deferSettlement: false,
};

export async function assessRoundCutoff({
  competitionId,
  playWindowEnd,
  resultGracePeriodSeconds,
  now = new Date(),
  session,
}: CutoffInput): Promise<RoundCutoffAssessment> {
  /*
    No window means nothing to wait for, and this is the branch that keeps the gate off
    trading. A trading contest has no rounds at all, so the query below would return zero
    anyway - but returning early is cheaper and, more usefully, it means a contest that
    predates the field cannot be deferred by a grace window computed from `undefined`.
  */
  if (!playWindowEnd) return NOTHING_TO_WAIT_FOR;

  // The `isValid` guard is the load-bearing half. Mongoose casts a string to ObjectId when
  // the query executes, so passing it through would match correctly - but a non-ObjectId
  // string throws a CastError, and a throw here aborts a settlement that could otherwise
  // have paid everyone. Same reasoning as `assessUnresolvedRounds`, and note the raw driver
  // does NOT cast, so a test seeding rounds must build a real ObjectId.
  if (!Types.ObjectId.isValid(competitionId)) return NOTHING_TO_WAIT_FOR;

  const query = GameRound.find({
    contestId: new Types.ObjectId(competitionId),
    status: { $in: LIVE_ROUND_STATUSES },
  }).select("_id");

  if (session) query.session(session);

  const live = await query.lean<{ _id: unknown }[]>();

  /*
    Reason the grace window is computed even when nothing is live: it is the figure the
    caller logs, and computing it only on the deferral path is how a log line ends up
    reading `graceEndsAt: null` for a contest that plainly had one.

    Measured from the play window END and not from a round's `expiresAt`, matching
    `decideStage`. Every round in the contest shares one deadline, which is the whole point
    of the universal cut-off - a per-round grace window would give the player who started
    last the longest wait.
  */
  const graceSeconds = resultGracePeriodSeconds ?? DEFAULT_RESULT_GRACE_SECONDS;
  const graceEndsAt = new Date(
    new Date(playWindowEnd).getTime() + graceSeconds * 1000,
  );

  if (live.length === 0) {
    return {
      liveRoundCount: 0,
      graceEndsAt,
      graceSeconds,
      deferSettlement: false,
    };
  }

  if (now.getTime() < graceEndsAt.getTime()) {
    const secondsLeft = Math.ceil((graceEndsAt.getTime() - now.getTime()) / 1000);
    return {
      liveRoundCount: live.length,
      graceEndsAt,
      graceSeconds,
      deferSettlement: true,
      deferReason: `Settlement is waiting for ${live.length} round(s) that were still open when play closed. A provider may still report them for another ${secondsLeft}s (until ${graceEndsAt.toISOString()}), and settling now would discard the scores of everyone who finished at the last moment. This contest will settle automatically once that window closes.`,
    };
  }

  return {
    liveRoundCount: live.length,
    graceEndsAt,
    graceSeconds,
    deferSettlement: false,
  };
}
