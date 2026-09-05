import mongoose from "mongoose";
import GameRound from "@/database/models/games/game-round.model";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import type { ProviderScoreDirection } from "@/lib/services/game-providers/contract";
import type { AttemptsPolicy } from "./round-types";

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
  | { synced: true; score: number; roundsCounted: number }
  | { synced: false; reason: string };

/** Rounds that contribute a score. Nothing else has a number worth ranking. */
const SCORING_ROUND_STATUS = "completed";

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
  const usable = scores.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return 0;

  switch (policy) {
    case "sum_of_n":
      return usable.reduce((total, value) => total + value, 0);

    case "best_of_n":
      return direction === "lower_is_better"
        ? Math.min(...usable)
        : Math.max(...usable);

    case "single":
      // Reason it is not simply `usable[0]`: the unique index allows one round per attempt
      // number, and `single` means one attempt - but a contest whose policy was changed, or
      // a round voided and replayed, can leave more than one completed row. Applying the
      // same "best" rule is the answer that cannot disadvantage a player for our own
      // bookkeeping.
      return direction === "lower_is_better"
        ? Math.min(...usable)
        : Math.max(...usable);
  }
}

/**
 * Recompute and store one participant's score for a provider contest.
 *
 * Called only from `applyResult`, and only AFTER the round has been saved - the recomputation
 * reads persisted rounds, so running it first would silently omit the result being ingested.
 */
export async function syncParticipantScore(input: {
  contestId: mongoose.Types.ObjectId | null | undefined;
  userId: string;
  contestType: string;
  scoreDirection: ProviderScoreDirection;
}): Promise<ScoreSyncOutcome> {
  const { contestId, userId, contestType, scoreDirection } = input;

  // Practice is free, unranked and prize-less, so it has no participant row to write to.
  // A challenge is exactly two players and is tracked on the `Challenge` model, not on
  // `CompetitionParticipant` - provider challenges are E8 and deliberately out of scope.
  if (contestType !== "competition") {
    return { synced: false, reason: `contest type "${contestType}" has no participant row` };
  }

  if (!contestId) {
    return { synced: false, reason: "round carries no contest id" };
  }

  const contest = await Competition.findById(contestId)
    .select("attemptsPolicy gameType")
    .lean<{ attemptsPolicy?: string; gameType?: string } | null>();

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

  const rounds = await GameRound.find({
    contestId,
    userId,
    status: SCORING_ROUND_STATUS,
  })
    .select("rawScore")
    .lean<{ rawScore?: number }[]>();

  const scores = rounds
    .map((round) => round.rawScore)
    .filter((value): value is number => typeof value === "number");

  const score = combineRoundScores(scores, policy, scoreDirection);

  // `$set` of a value derived from persisted rows, never `$inc`. See the header.
  //
  // ONLY `score`. The direction is deliberately NOT stored here, and the first version of
  // this file did store it, on the grounds that settlement reads `p.scoreDirection` off the
  // participant. That read was the bug, not the design: chapter 05 section 2 says direction
  // is threaded in at finalization from the catalogue, "because duplicating it per row would
  // create a second place for it to be wrong" - and the failure that reasoning prevents is
  // worse than the one it costs. Per-row storage lets two participants in the SAME contest
  // hold different directions if a title is corrected mid-contest, so half the leaderboard
  // negates and half does not. A uniformly wrong direction is at least coherent and visibly
  // wrong; an incoherent one looks plausible and cannot be explained to a player.
  const updated = await CompetitionParticipant.findOneAndUpdate(
    { competitionId: contestId, userId },
    { $set: { score } },
    { new: true },
  );

  if (!updated) {
    return { synced: false, reason: "no participant row for this user in this contest" };
  }

  return { synced: true, score, roundsCounted: scores.length };
}
