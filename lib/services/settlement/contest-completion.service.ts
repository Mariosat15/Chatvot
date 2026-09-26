import type { ClientSession } from "mongoose";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import type { SettlementLeaderboardEntry } from "./types";

/**
 * Closing a contest out: statuses, the stored leaderboard and each player's final rank.
 *
 * Lifted out of `finalizeCompetition` step 5 by X5. Entirely game-agnostic already - a
 * rank is a rank - so the extraction changed nothing except who can call it.
 */

interface CompletableContest {
  status: string;
  winnerId?: string;
  winnerPnL?: number;
  finalLeaderboard?: unknown;
  noWinners?: boolean;
  _id: { toString(): string };
  save(opts: { session: ClientSession }): Promise<unknown>;
}

export interface CompleteContestInput {
  session: ClientSession;
  /** The live Mongoose document, because this stage saves it. */
  contest: CompletableContest;
  leaderboard: SettlementLeaderboardEntry[];
  /** Distributions produced, not payments made - see `fees.service.ts` for why. */
  prizeWinnerCount: number;
}

export async function completeContest({
  session,
  contest,
  leaderboard,
  prizeWinnerCount,
}: CompleteContestInput): Promise<{ participantsCompleted: number }> {
  contest.status = "completed";
  contest.winnerId = leaderboard[0]?.userId;

  // Reason: written ONLY when the winner actually has a profit and loss. A provider game
  // has none, and storing `undefined` on a declared number field would leave the contest
  // claiming a winner PnL of nothing-in-particular. Chapter 05 section 10: a figure is
  // generalised, or explicitly scoped to one game, or absent - and this one is scoped.
  if (leaderboard[0]?.pnl !== undefined) {
    contest.winnerPnL = leaderboard[0].pnl;
  }

  contest.finalLeaderboard = leaderboard;

  if (prizeWinnerCount === 0) {
    contest.noWinners = true;
  }

  await contest.save({ session });

  // Only `active` seats move to `completed`. A liquidated or disqualified player keeps the
  // status that explains why they are not in the prizes.
  const participantUpdateResult = await CompetitionParticipant.updateMany(
    { competitionId: contest._id, status: "active" },
    { $set: { status: "completed" } },
    { session },
  );

  console.log(
    `   ✅ Updated ${participantUpdateResult.modifiedCount} participant statuses to 'completed'`,
  );

  // Reason: the final rank has to be ON the participant row, because dashboard, profile,
  // leaderboard and matchmaking all count wins as `currentRank === 1` and podiums as
  // `<= 3`. Without this write, `currentRank` stays at its join-time 0 and every win
  // statistic on the platform reads as zero.
  if (leaderboard.length > 0) {
    const rankBulkOps = leaderboard.map((entry) => ({
      updateOne: {
        filter: { competitionId: contest._id, userId: entry.userId },
        update: { $set: { currentRank: entry.rank } },
      },
    }));

    const rankResult = await CompetitionParticipant.bulkWrite(rankBulkOps, {
      session,
    });
    console.log(
      `   ✅ Updated final ranks for ${rankResult.modifiedCount} participants`,
    );
  }

  return { participantsCompleted: participantUpdateResult.modifiedCount };
}
