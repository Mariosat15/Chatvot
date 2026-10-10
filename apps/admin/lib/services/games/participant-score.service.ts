import mongoose from "mongoose";
import GameRound, {
  type RoundStatus,
} from "@/database/models/games/game-round.model";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import type { ProviderScoreDirection } from "@/lib/services/game-providers/contract";
import {
  SCORE_PRODUCING_ROUND_STATUSES,
  type AttemptsPolicy,
} from "./round-types";

/**
 * Carrying a round's score up to the contest participant, where ranking reads it.
 *
 * WHY THIS FILE EXISTS: THE SEAM WAS MISSING, AND EVERY DOCUMENT SAID IT WAS NOT.
 * `provider-settlement.service.ts` opens with "nothing here computes a score - they were
 * written to `participant.score` by the single ingestion function as each round's result
 * arrived". That sentence was false. `applyResult` wrote `game_round` and stopped, and
 * `buildParticipantSeat` seats every player at `score: 0`.
 *
 * The consequence was not a crash. **Every participant in a provider contest would have
 * settled on a score of zero, tied at rank 1, and split the prize pool equally regardless of
 * how well anyone played** - the exact shape of the trading finalization bug that seeded
 * `pnl` on a participant and had it overwritten, which "reads as a prize-distribution bug in
 * production". Nothing in the settlement tests could catch it, because they seed the scores
 * they rank (900/500/100) and so prove that ranking works *given* scores, never that a score
 * ever arrives.
 *
 * The general rule this is the fourth instance of: **an aside in a comment is a claim, not a
 * fact.** `challengeId`, the R7 severity, `billsPerRound` and now this one.
 *
 * WHY IT RECOMPUTES FROM PERSISTED ROUNDS RATHER THAN ACCUMULATING.
 * An increment is wrong here in three separate ways, and each is silent:
 *
 *   - A replayed result would add twice. Gate 6 dedupes by `eventId`, but a *poll* and a
 *     *callback* reporting the same round carry different event ids by design.
 *   - Results can arrive out of order, so "the latest round" is not "the best round".
 *   - `totalScore` on `SuspicionScore` taught this one at cost: a derived total computed
 *     from a stale in-memory copy is last-write-wins, and the document then contradicts its
 *     own parts. Recomputing from what is persisted is order-independent, so concurrent
 *     callers converge on the same answer however they interleave.
 *
 * It is therefore safe to call repeatedly, which is what makes an operator-triggered
 * re-sync from the round inspector a safe operation rather than a dangerous one.
 */

export type ScoreSyncOutcome =
  /**
   * `score` is absent when no round contributed one, which is a different outcome from a
   * sync that could not run - the row WAS updated, to hold no score. Callers that report the
   * score onward must pass the absence through rather than substituting a nought.
   */
  | {
      synced: true;
      score?: number;
      durationMs?: number;
      scoreCompletedAt?: Date;
      roundsCounted: number;
    }
  | { synced: false; reason: string };

/**
 * Rounds that contribute a score.
 *
 * THIS WAS `completed` ALONE UNTIL 7 SEPTEMBER 2026, AND THAT WAS R48. The owner's report was
 * that only a player who finished every board seemed to win. Neither codebase has ever had a
 * rule about finishing: `games-service` scores any board a player solved, and returns nothing
 * at all only for `voided`, because the provider specification asks twice for a partial score
 * on the grounds that "a dropped mobile signal should not cost someone a paid entry".
 *
 * The platform then discarded it. A real partial score was stored on `game_round` and never
 * reached `participant.score`, so the player ranked on the seat default of nought - which made
 * **the way a round ENDED decide whether the play counted at all**:
 *
 *   - the game's own clock expiring is `completed`, and counted;
 *   - the CONTEST's window closing over the player is `expired`, and did not;
 *   - leaving mid-round is `abandoned`, and did not.
 *
 * The second is what made it urgent rather than tidy. `expired` is the ordinary ending under
 * the universal cut-off - every round closed at one moment so nobody waits for anybody - so
 * the better a contest was attended near its end, the more players ranked at nought. No error,
 * no log line, and a prize table that looks deliberate.
 *
 * WHAT STAYS OUT, for two different reasons. A `voided` round has no score by construction and
 * the attempt is handed back, so any number arriving with that status is bookkeeping rather
 * than play - counting it would let a support action move a leaderboard. An `unresolved` one is
 * the contest's `unresolvedRoundPolicy` to decide (score zero, exclude and refund, or hold for
 * a human), and counting it here would answer that question twice.
 *
 * There is no incentive to abandon deliberately: an attempt is consumed when the round is
 * CREATED. And under every attempts policy, counting a cut-short run can only help the player -
 * `best_of_n` discards it if it was worse, `sum_of_n` adds it, `single` means it was their one
 * attempt.
 *
 * THE LIST ITSELF MOVED to `round-types.ts` on 10 September 2026, and only the list. This name
 * is unchanged and so is its value - the move exists so admin reporting can share the constant
 * without importing this file. As of X9 re-settle this whole service IS mirrored into admin
 * (byte-identical): it only recomputes from persisted rounds and never invents a score, so it
 * is not a second ingestion door. `applyResult` stays main-app only.
 */
export const SCORING_ROUND_STATUSES: RoundStatus[] = [
  ...SCORE_PRODUCING_ROUND_STATUSES,
];

/**
 * Whether a round's score is one that ranking counts.
 *
 * EXPORTED SO THE PLAYER'S RESULTS SCREEN CANNOT DISAGREE WITH THIS FILE. `findCountedAttempt`
 * in `contest-results.service.ts` decides which attempt to label as the one that counted, and
 * its own header says it "must agree with `participant-score.service.ts`". It filtered on the
 * presence of a score alone, which was already wrong for one status and would have drifted
 * further the moment this list changed again: a **voided** round is stored with `rawScore: 0`,
 * deliberately - the adapter defaults an absent score to zero and notes it is "safe HERE
 * specifically because a voided round never reaches ranking" - so the screen would tell a
 * player that a voided attempt was the one that counted while the leaderboard ignored it.
 *
 * Sharing the predicate makes the agreement structural rather than a coincidence held by a
 * test. Same reasoning as `UNSCORED_REFUND_REASON` and the round-resolution action list: when
 * one rule is read in two places, the second copy drifts silently and in the direction where
 * the writer stays correct and the screen starts lying.
 */
export function roundContributesScore(status: string | undefined): boolean {
  return SCORING_ROUND_STATUSES.includes(status as RoundStatus);
}

/**
 * Combine one player's round scores into the single number ranking compares.
 *
 * Exported and pure so the aggregation can be tested without a database - the policies are
 * where the arithmetic mistakes live, not in the query around them.
 *
 * Reason `best_of_n` consults the direction: "best" is the maximum for a points game and the
 * **minimum** for a race time. Taking the maximum unconditionally would rank a time trial by
 * who was slowest, which is not a crash and not a visible error - it is a leaderboard that
 * is exactly upside down.
 */
export function combineRoundScores(
  scores: number[],
  policy: AttemptsPolicy,
  direction: ProviderScoreDirection,
): number {
  return (
    selectCountedAttempt(
      scores.map((rawScore) => ({ rawScore })),
      policy,
      direction,
    )?.score ?? 0
  );
}

/** One persisted round's facts used to pick the attempt ranking will count. */
export interface RoundAttemptInput {
  rawScore?: number;
  durationMs?: number;
  completedAt?: Date | string | null;
}

/**
 * The attempt that ranking will treat as this player's result: score plus the duration /
 * finish time that A9 uses as tie-breaks.
 *
 * For `best_of_n` / `single`, duration and completedAt come from the winning round. When
 * two rounds share the same best score, the shorter duration (then earlier finish) wins
 * that pick, matching the eventual ranking rule so the stored seat cannot disagree with
 * what settlement would have chosen.
 *
 * For `sum_of_n`, duration is the sum of finite round durations (total time to the
 * summed score) and completedAt is the latest finish among contributing rounds.
 */
export function selectCountedAttempt(
  rounds: readonly RoundAttemptInput[],
  policy: AttemptsPolicy,
  direction: ProviderScoreDirection,
):
  | { score: number; durationMs?: number; scoreCompletedAt?: Date }
  | undefined {
  const usable = rounds.filter(
    (round) => typeof round.rawScore === "number" && Number.isFinite(round.rawScore),
  );
  if (usable.length === 0) return undefined;

  if (policy === "sum_of_n") {
    const score = usable.reduce((total, round) => total + (round.rawScore as number), 0);
    const durations = usable
      .map((round) => round.durationMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const durationMs = durations.length > 0
      ? durations.reduce((total, value) => total + value, 0)
      : undefined;
    const finishTimes = usable
      .map((round) =>
        round.completedAt != null ? new Date(round.completedAt).getTime() : NaN,
      )
      .filter((value) => Number.isFinite(value));
    const scoreCompletedAt =
      finishTimes.length > 0
        ? new Date(Math.max(...finishTimes))
        : undefined;
    return { score, durationMs, scoreCompletedAt };
  }

  // best_of_n and single: pick one round.
  const isBetter = (candidate: RoundAttemptInput, incumbent: RoundAttemptInput): boolean => {
    const cScore = candidate.rawScore as number;
    const iScore = incumbent.rawScore as number;
    if (cScore !== iScore) {
      return direction === "lower_is_better" ? cScore < iScore : cScore > iScore;
    }
    const cDur =
      typeof candidate.durationMs === "number" && Number.isFinite(candidate.durationMs)
        ? candidate.durationMs
        : Number.POSITIVE_INFINITY;
    const iDur =
      typeof incumbent.durationMs === "number" && Number.isFinite(incumbent.durationMs)
        ? incumbent.durationMs
        : Number.POSITIVE_INFINITY;
    if (cDur !== iDur) return cDur < iDur;
    const cAt =
      candidate.completedAt != null
        ? new Date(candidate.completedAt).getTime()
        : Number.POSITIVE_INFINITY;
    const iAt =
      incumbent.completedAt != null
        ? new Date(incumbent.completedAt).getTime()
        : Number.POSITIVE_INFINITY;
    return cAt < iAt;
  };

  let best = usable[0]!;
  for (let i = 1; i < usable.length; i++) {
    // Reason: `.at` is preferred over `usable[i]` here — the security rule flags any
    // computed index even when the bound is a loop over a local array we built.
    const next = usable.at(i);
    if (next && isBetter(next, best)) best = next;
  }

  return {
    score: best.rawScore as number,
    durationMs:
      typeof best.durationMs === "number" && Number.isFinite(best.durationMs)
        ? best.durationMs
        : undefined,
    scoreCompletedAt:
      best.completedAt != null && Number.isFinite(new Date(best.completedAt).getTime())
        ? new Date(best.completedAt)
        : undefined,
  };
}

/**
 * Recompute and store one participant's score for a provider contest OR challenge.
 *
 * Called from `applyResult` after a round is saved, and from dedicated re-settle after a
 * disputed round is voided. Both paths read persisted rounds only - neither invents a score.
 *
 * BRANCHES ON `contestType` RATHER THAN BEING TWO FUNCTIONS, deliberately - the two paths
 * differ only in which model holds the attempts policy and which model holds the participant
 * row, and every piece of arithmetic above this point (`SCORING_ROUND_STATUSES`,
 * `combineRoundScores`, the nothing-contributed distinction) is shared unchanged. Splitting
 * it into `syncParticipantScore` and `syncChallengeParticipantScore` would duplicate the one
 * subtle rule this file exists to hold in one place - the "one rule, two copies" shape this
 * codebase keeps finding - for a caller (gate 11b) that already knows which kind of contest
 * it has and would have to call the right one anyway.
 */
export async function syncParticipantScore(input: {
  contestId: mongoose.Types.ObjectId | null | undefined;
  userId: string;
  contestType: string;
  scoreDirection: ProviderScoreDirection;
  /** When set, every read/write joins that transaction (re-settle). */
  session?: mongoose.ClientSession;
}): Promise<ScoreSyncOutcome> {
  const { contestId, userId, contestType, scoreDirection, session } = input;

  // Practice is free, unranked and prize-less, so it has no participant row to write to.
  if (contestType !== "competition" && contestType !== "challenge") {
    return { synced: false, reason: `contest type "${contestType}" has no participant row` };
  }

  if (!contestId) {
    return { synced: false, reason: "round carries no contest id" };
  }

  const isChallenge = contestType === "challenge";

  const contestQuery = isChallenge
    ? Challenge.findById(contestId).select("attemptsPolicy gameType")
    : Competition.findById(contestId).select("attemptsPolicy gameType");
  if (session) contestQuery.session(session);
  const contest = await contestQuery.lean<{
    attemptsPolicy?: string;
    gameType?: string;
  } | null>();

  if (!contest) {
    return { synced: false, reason: "contest not found" };
  }

  // Reason for refusing rather than defaulting: a contest with no attempts policy is one
  // whose round settings did not persist, and the publish checklist refuses to publish it.
  // Guessing `single` here would rank a player on a rule nobody chose.
  const policy = contest.attemptsPolicy as AttemptsPolicy | undefined;
  if (policy !== "single" && policy !== "best_of_n" && policy !== "sum_of_n") {
    return {
      synced: false,
      reason: `contest has no usable attempts policy (${String(policy)})`,
    };
  }

  const roundsQuery = GameRound.find({
    contestId,
    userId,
    status: { $in: SCORING_ROUND_STATUSES },
  }).select("rawScore durationMs completedAt");
  if (session) roundsQuery.session(session);
  const rounds = await roundsQuery.lean<
    { rawScore?: number; durationMs?: number; completedAt?: Date }[]
  >();

  const counted = selectCountedAttempt(rounds, policy, scoreDirection);

  /*
    NOTHING CONTRIBUTED MEANS NO SCORE, NOT A SCORE OF NOTHING - and the two must be stored
    differently, because `providerHasResult` reads a stored nought as "played and scored
    nothing" and pays that player for the position they land in.

    `combineRoundScores` returns 0 for an empty list, which is right for its own job: it is
    the identity for a sum and it keeps the function total. Writing that 0 to the participant
    would be the phantom-zero defect (R50) arriving one step later than the seat's. The case
    is reachable: a support action voids a player's only round, the sync runs again from the
    round inspector, and every contributing round is gone.

    `$unset` rather than leaving the field alone, because the sync's contract is that it
    recomputes from persisted rounds - a stale score surviving a re-sync would be a number no
    round supports, which is the harder kind of wrong to explain. Duration and finish time
    travel with the score for the same reason (A9): a stale duration after a void would
    break a tie that no longer has a scored attempt.
  */
  const contributed = counted != null;
  const score = counted?.score;
  const durationMs = counted?.durationMs;
  const scoreCompletedAt = counted?.scoreCompletedAt;

  // `$set` of values derived from persisted rows, never `$inc`. See the header.
  //
  // ONLY result fields. The direction is deliberately NOT stored here, and the first version of
  // this file did store it, on the grounds that settlement reads `p.scoreDirection` off the
  // participant. That read was the bug, not the design: chapter 05 section 2 says direction
  // is threaded in at finalization from the catalogue, "because duplicating it per row would
  // create a second place for it to be wrong" - and the failure that reasoning prevents is
  // worse than the one it costs. Per-row storage lets two participants in the SAME contest
  // hold different directions if a title is corrected mid-contest, so half the leaderboard
  // negates and half does not. A uniformly wrong direction is at least coherent and visibly
  // wrong; an incoherent one looks plausible and cannot be explained to a player.
  let update: Record<string, unknown>;
  if (!contributed) {
    update = { $unset: { score: "", durationMs: "", scoreCompletedAt: "" } };
  } else {
    const $set: Record<string, unknown> = { score };
    const $unset: Record<string, string> = {};
    if (typeof durationMs === "number") $set.durationMs = durationMs;
    else $unset.durationMs = "";
    if (scoreCompletedAt) $set.scoreCompletedAt = scoreCompletedAt;
    else $unset.scoreCompletedAt = "";
    update =
      Object.keys($unset).length > 0 ? { $set, $unset } : { $set };
  }

  const updated = isChallenge
    ? await ChallengeParticipant.findOneAndUpdate(
        { challengeId: contestId, userId },
        update,
        { new: true, session },
      )
    : await CompetitionParticipant.findOneAndUpdate(
        { competitionId: contestId, userId },
        update,
        { new: true, session },
      );

  if (!updated) {
    return { synced: false, reason: "no participant row for this user in this contest" };
  }

  return {
    synced: true,
    score,
    durationMs,
    scoreCompletedAt,
    roundsCounted: rounds.filter(
      (round) => typeof round.rawScore === "number" && Number.isFinite(round.rawScore),
    ).length,
  };
}
