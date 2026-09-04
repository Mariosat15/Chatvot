import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { payContestPrizes } from "./prize-payout.service";
import { settleFeesAndGameMasters } from "./fees.service";
import { completeContest } from "./contest-completion.service";
import type { SettlementLeaderboardEntry } from "./types";

/**
 * Settling a provider contest: rank the scores, pay the winners, close it out.
 *
 * WHAT MAKES THIS SHORT IS THE POINT. It is the trading finalize path with its first two
 * stages removed - no positions to close, no stats to recompute from trades - and every
 * remaining stage is the SAME FUNCTION the trading path calls. Chapter 09 predicted
 * exactly this: paying a provider contest is "an extraction, not a wiring job", and once
 * the extraction was done the wiring was forty lines.
 *
 * The alternative was a second payout loop. Stage 0 is the argument against it: four
 * competition entry writers, `referenceId` written identically by two of them and
 * `challengeId` by nine, producing the rule that one bug duplicated is not drift and that
 * no mirror guard will ever catch it. Money code gets one writer.
 *
 * WHERE THE SCORES COME FROM. Nothing here computes a score. They were written to
 * `participant.score` by the single ingestion function as each round's result arrived, and
 * reconciliation has already applied the contest's unresolved-round policy to anything
 * that never came back. By the time settlement runs, the scores are simply facts.
 */

export interface ProviderSettlementResult {
  success: boolean;
  error?: string;
  /** Present so this result is interchangeable with the trading path's at every caller. */
  message?: string;
  data?: {
    competitionId: string;
    competitionName: string;
    totalParticipants: number;
    winnersCount: number;
    prizePool: number;
    totalDistributed: number;
    leaderboard: SettlementLeaderboardEntry[];
  };
}

interface ProviderCompetitionDoc {
  _id: import("mongoose").Types.ObjectId;
  name: string;
  entryFee: number;
  currentParticipants?: number;
  prizePool?: number;
  platformFeePercentage: number;
  prizeDistribution?: { rank: number; percentage: number }[];
  startTime?: Date;
  endTime?: Date;
  gameMasterId?: string | null;
  gameKey?: string;
  rules?: Record<string, unknown>;
  status: string;
  save(opts: { session: import("mongoose").ClientSession }): Promise<unknown>;
}

/**
 * Settle a provider contest inside the caller's transaction.
 *
 * Takes the already-locked document rather than an id, because the optimistic
 * `active -> finalizing` claim and the lock release on failure belong to the caller. A
 * function that both claimed the lock and settled would have two ways to leave a contest
 * stranded in `finalizing` with nobody able to retry it.
 */
export async function settleProviderCompetition(
  competition: ProviderCompetitionDoc,
  session: import("mongoose").ClientSession,
): Promise<ProviderSettlementResult> {
  const competitionId = competition._id.toString();

  console.log(`🏁 Settling provider contest ${competitionId}`);

  const participants = await CompetitionParticipant.find({
    competitionId,
  })
    .session(session)
    .lean<
      {
        userId: string;
        username?: string;
        score?: number;
        scoreDirection?: string;
        status?: string;
        enteredAt?: Date;
      }[]
    >();

  console.log(`Found ${participants.length} participants`);

  const { calculateRankings, distributePrizesWithTies } = await import(
    "@/lib/services/competition-ranking.service"
  );

  // Reason: `gameType` is passed so `calculateRankings` dispatches to the provider game
  // module, which ranks on `score` and applies the title's direction. Omit it and the
  // shared ranking step falls back to trading, reads every score as a missing PnL, ties
  // every player at rank 1 and splits the pool equally - which reads in production as a
  // prize-distribution bug rather than a missing argument.
  const rankedParticipants = calculateRankings(
    participants.map((p) => ({
      userId: p.userId,
      username: p.username || "Anonymous",
      score: p.score,
      // Reason: narrowed from the stored string, defaulting to higher-is-better. An
      // unrecognised direction must NOT silently invert a leaderboard, so anything other
      // than the one known downward value is treated as upward - the same fail-safe
      // reasoning as the market-hours gate, applied to sort order.
      scoreDirection:
        p.scoreDirection === "lower_is_better"
          ? ("lower_is_better" as const)
          : ("higher_is_better" as const),
      status: p.status ?? "active",
      enteredAt: p.enteredAt ?? new Date(),
    })),
    {
      // A provider game reports one number, so the six trading ranking methods would be
      // six labels for one behaviour. The module ignores them by design.
      rankingMethod: "pnl" as const,
      tieBreaker1: "win_rate" as const,
      tieBreaker2: "join_time" as const,
      minimumTrades: 0,
      tiePrizeDistribution: "split_equally" as const,
      disqualifyOnLiquidation: false,
      ...(competition.rules || {}),
    },
    { competitionStatus: "completed", gameType: "provider" },
  );

  const leaderboard: SettlementLeaderboardEntry[] = rankedParticipants.map(
    (p) => ({
      rank: p.rank,
      userId: p.userId,
      username: p.username,
      // Reason: the RAW score, never the value the ranking engine compared on. A
      // lower-is-better title is negated only at comparison, so storing the comparison
      // value would show a race time as a negative number on every screen that reads the
      // stored leaderboard, and poison any cross-game total built from it.
      score: p.score,
      prizeAmount: 0,
      isTied: p.isTied,
      qualificationStatus: p.qualificationStatus,
      disqualificationReason: p.disqualificationReason,
    }),
  );

  // The same integrity cap the trading path applies. A stored pool higher than the fees
  // actually collected means phantom credits would be created out of a bug elsewhere.
  const actualCollectedFees =
    (competition.currentParticipants || 0) * (competition.entryFee || 0);
  let prizePool = competition.prizePool || 0;

  if (prizePool > actualCollectedFees && actualCollectedFees > 0) {
    console.error(
      `🚨 [PROVIDER] PRIZE POOL INTEGRITY VIOLATION for ${competitionId}! stored ${prizePool}, collected ${actualCollectedFees}. Capping.`,
    );
    prizePool = actualCollectedFees;
    await Competition.findByIdAndUpdate(
      competitionId,
      { $set: { prizePool: actualCollectedFees } },
      { session },
    );
  }

  // A fraction, not a percentage. The stored field is 0-50 and
  // `distributePrizesWithTies` rejects anything above 1 - risk R30 was half a variable
  // named `platformFeePercentage` holding 0.2.
  const platformFeeFraction = competition.platformFeePercentage / 100;

  const prizeDistributions = distributePrizesWithTies(
    rankedParticipants,
    competition.prizeDistribution || [],
    prizePool,
    {
      rankingMethod: "pnl" as const,
      tieBreaker1: "win_rate" as const,
      tieBreaker2: "join_time" as const,
      minimumTrades: 0,
      tiePrizeDistribution: "split_equally" as const,
      disqualifyOnLiquidation: false,
      ...(competition.rules || {}),
    },
    platformFeeFraction,
  );

  console.log(
    `💎 Calculated ${prizeDistributions.length} prize distributions (including ties)`,
  );

  const { totalDistributed, winnersPaid, walletMap } = await payContestPrizes({
    session,
    contest: competition,
    distributions: prizeDistributions,
    leaderboard,
  });

  const qualifiedWinners = rankedParticipants.filter(
    (p) => p.qualificationStatus === "qualified",
  );

  await settleFeesAndGameMasters({
    session,
    contest: competition,
    prizePool,
    totalDistributed,
    prizeWinnerCount: prizeDistributions.length,
    expectedWinners: competition.prizeDistribution?.length || 0,
    qualifiedWinnersCount: qualifiedWinners.length,
    participants: participants.map((p) => ({ userId: p.userId })),
    walletMap,
    platformFeeFraction,
  });

  await completeContest({
    session,
    contest: competition,
    leaderboard,
    prizeWinnerCount: prizeDistributions.length,
  });

  console.log(
    `✅ Provider contest ${competition.name} settled: ${winnersPaid} winner(s), ${totalDistributed} credits distributed`,
  );

  return {
    success: true,
    data: {
      competitionId,
      competitionName: competition.name,
      totalParticipants: participants.length,
      winnersCount: winnersPaid,
      prizePool,
      totalDistributed,
      leaderboard: leaderboard.slice(0, 10),
    },
  };
}
