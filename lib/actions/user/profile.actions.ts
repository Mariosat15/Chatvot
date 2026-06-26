"use server";
/* eslint-disable */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import { getUserFinancialSummary } from "@/lib/services/user-financial-summary.service";
import TradeHistory from "@/database/models/trading/trade-history.model";
import {
  computeProfitFactor,
  computeWinRate,
} from "@/lib/services/trading-metrics";

/**
 * Combined trading stats (competitions + challenges)
 * This matches the dashboard's overview stats exactly!
 */
export interface CombinedTradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercentage: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  totalPrizesWon: number;
}

/**
 * Get combined trading stats (competitions + challenges)
 * SINGLE SOURCE OF TRUTH: Calculates from TradeHistory collection
 * This ensures consistency between dashboard, profile, and admin panel
 */
export async function getCombinedTradingStats(
  userId?: string,
): Promise<CombinedTradingStats> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    const targetUserId = userId || session.user.id;

    await connectToDatabase();

    // Reason: Use shared getUserFinancialSummary service as SINGLE SOURCE OF TRUTH.
    const [competitionParticipations, financialSummary] = await Promise.all([
      CompetitionParticipant.find({ userId: targetUserId }).lean(),
      getUserFinancialSummary(targetUserId),
    ]);

    // SINGLE SOURCE OF TRUTH: Get stats from TradeHistory collection
    // This ensures admin and customer see the SAME numbers
    const [tradeStats] = await TradeHistory.aggregate([
      { $match: { userId: targetUserId } },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          winningTrades: { $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] } },
          // Reason: count ONLY genuine losses (PnL < 0); breakeven excluded.
          losingTrades: { $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] } },
          totalPnL: { $sum: "$realizedPnl" },
          grossWins: {
            $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
          },
          grossLosses: {
            $sum: {
              $cond: [
                { $lt: ["$realizedPnl", 0] },
                { $abs: "$realizedPnl" },
                0,
              ],
            },
          },
          largestWin: {
            $max: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
          },
          largestLoss: {
            $min: { $cond: [{ $lt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
          },
        },
      },
    ]);

    const stats = tradeStats || {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      grossWins: 0,
      grossLosses: 0,
      largestWin: 0,
      largestLoss: 0,
    };

    // Calculate total starting capital from participations
    const totalStartingCapital = competitionParticipations.reduce(
      (sum: number, p: any) => sum + (p.startingCapital || 0),
      0,
    );

    // Calculate derived stats
    const winRate = computeWinRate(stats.winningTrades, stats.losingTrades);
    const profitFactor = computeProfitFactor(stats.grossWins, stats.grossLosses);
    const averageWin =
      stats.winningTrades > 0 ? stats.grossWins / stats.winningTrades : 0;
    const averageLoss =
      stats.losingTrades > 0 ? stats.grossLosses / stats.losingTrades : 0;
    const totalPnLPercentage =
      totalStartingCapital > 0
        ? (stats.totalPnL / totalStartingCapital) * 100
        : 0;

    // Reason: Use shared financial summary service — single formula, all pages match.
    const totalPrizesWon = financialSummary.totalPrizesWon;

    return {
      totalTrades: stats.totalTrades,
      winningTrades: stats.winningTrades,
      losingTrades: stats.losingTrades,
      winRate,
      totalPnL: stats.totalPnL,
      totalPnLPercentage,
      profitFactor,
      averageWin,
      averageLoss,
      largestWin: stats.largestWin || 0,
      largestLoss: stats.largestLoss || 0,
      totalPrizesWon,
    };
  } catch (error) {
    console.error("Error getting combined trading stats:", error);
    throw new Error("Failed to get combined trading stats");
  }
}

export interface UserCompetitionStats {
  // Overall Stats
  totalCompetitionsEntered: number;
  totalCompetitionsCompleted: number;
  totalCompetitionsActive: number;

  // Performance Metrics
  totalCapitalTraded: number;
  totalPnl: number;
  totalPnlPercentage: number;
  totalTrades: number;
  totalWinningTrades: number;
  totalLosingTrades: number;
  overallWinRate: number;
  averageRoi: number;
  profitFactor: number;

  // Best Performances
  bestRank: number;
  bestPnl: number;
  bestRoi: number;
  bestWinRate: number;
  mostTrades: number;

  // Prizes
  totalPrizesWon: number;
  totalCreditsWon: number;
  competitionsWon: number; // Rank 1 finishes
  podiumFinishes: number; // Top 3 finishes

  // Recent Competitions
  recentCompetitions: {
    competitionId: string;
    competitionName: string;
    rank: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winRate: number;
    status: string;
    prizeAmount: number;
    startedAt: Date;
    endedAt: Date;
  }[];
}

/**
 * Get comprehensive competition stats for a user
 *
 * SOURCE OF TRUTH:
 * - Financial stats (totalCreditsWon, totalPrizesWon) → getUserFinancialSummary (WalletTransaction)
 * - Trading metrics (trades, PnL, win rate) → CompetitionParticipant records
 * - Competition counts (entered, won, podium) → CompetitionParticipant records
 */
export async function getUserCompetitionStats(
  userId?: string,
): Promise<UserCompetitionStats> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    const targetUserId = userId || session.user.id;

    await connectToDatabase();

    // Reason: Fetch participations + transaction-based win/spent totals in parallel.
    // We use WalletTransaction as the SINGLE source of truth for credits won/spent,
    // because CreditWallet fields were historically polluted by refunds.
    // Reason: Use shared getUserFinancialSummary service as SINGLE SOURCE OF TRUTH.
    const [participations, compFinancials] = await Promise.all([
      CompetitionParticipant.find({ userId: targetUserId })
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
      getUserFinancialSummary(targetUserId),
    ]);
    const trueCompWins = compFinancials.competitionWins;

    // Calculate overall stats
    const completedParticipations = participations.filter(
      (p) => p.status === "completed",
    );
    const activeParticipations = participations.filter(
      (p) => p.status === "active",
    );

    // Aggregate performance metrics
    let totalCapitalTraded = 0;
    let totalPnl = 0;
    let totalTrades = 0;
    let totalWinningTrades = 0;
    let totalLosingTrades = 0;
    let totalRoi = 0;
    let totalGross = 0;
    let totalLoss = 0;

    // Best performances
    let bestRank = Number.MAX_SAFE_INTEGER;
    let bestPnl = 0;
    let bestRoi = 0;
    let bestWinRate = 0;
    let mostTrades = 0;

    // Count wins and podiums
    let competitionsWon = 0;
    let podiumFinishes = 0;

    // Get competition IDs that are completed (for accurate win counting)
    const competitionIds = participations.map((p) => p.competitionId);
    const competitionsData = await Competition.find({
      _id: { $in: competitionIds },
    }).lean();
    const completedCompetitionIds = new Set(
      competitionsData
        .filter((c: any) => c.status === "completed")
        .map((c: any) => c._id.toString()),
    );

    participations.forEach((p: any) => {
      totalCapitalTraded += p.startingCapital || 0;
      totalPnl += p.pnl || 0;
      totalTrades += p.totalTrades || 0;
      totalWinningTrades += p.winningTrades || 0;
      totalLosingTrades += p.losingTrades || 0;
      totalRoi += p.pnlPercentage || 0;

      // For profit factor
      if (p.averageWin && p.winningTrades)
        totalGross += p.averageWin * p.winningTrades;
      if (p.averageLoss && p.losingTrades)
        totalLoss += Math.abs(p.averageLoss) * p.losingTrades;

      // Best performances (include active competitions)
      if (p.currentRank && p.currentRank < bestRank) bestRank = p.currentRank;
      if ((p.pnl || 0) > bestPnl) bestPnl = p.pnl || 0;
      if ((p.pnlPercentage || 0) > bestRoi) bestRoi = p.pnlPercentage || 0;

      const winRate =
        p.totalTrades > 0 ? (p.winningTrades / p.totalTrades) * 100 : 0;
      if (winRate > bestWinRate) bestWinRate = winRate;

      if (p.totalTrades > mostTrades) mostTrades = p.totalTrades;

      // Count wins and podiums - ONLY for COMPLETED competitions (same as dashboard)
      const isCompleted = completedCompetitionIds.has(
        p.competitionId?.toString(),
      );
      if (isCompleted && p.currentRank === 1) competitionsWon++;
      if (isCompleted && p.currentRank && p.currentRank <= 3) podiumFinishes++;
    });

    const overallWinRate =
      totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;
    const averageRoi =
      participations.length > 0 ? totalRoi / participations.length : 0;
    // Reason: shared helper for a single, consistent no-loss sentinel (999)
    // across dashboard, profile and leaderboard (was an inconsistent 9999 here).
    const profitFactor = computeProfitFactor(totalGross, totalLoss);
    const totalPnlPercentage =
      totalCapitalTraded > 0 ? (totalPnl / totalCapitalTraded) * 100 : 0;

    // Get recent competitions with details (show both active and completed)
    const recentParticipations = participations.slice(0, 10);
    const recentCompetitionIds = recentParticipations.map(
      (p) => p.competitionId,
    );
    const competitions = await Competition.find({
      _id: { $in: recentCompetitionIds },
    }).lean();

    const competitionMap = new Map(
      competitions.map((c: any) => [c._id.toString(), c]),
    );

    const recentCompetitions = recentParticipations.map((p: any) => {
      const competition = competitionMap.get(p.competitionId.toString());
      const winRate =
        p.totalTrades > 0 ? (p.winningTrades / p.totalTrades) * 100 : 0;

      // Find prize amount from leaderboard (only for completed)
      let prizeAmount = 0;
      if (competition?.status === "completed" && competition.finalLeaderboard) {
        const leaderboardEntry = competition.finalLeaderboard.find(
          (entry: any) => entry.userId === targetUserId,
        );
        if (leaderboardEntry) prizeAmount = leaderboardEntry.prizeAmount || 0;
      }

      return {
        competitionId: p.competitionId,
        competitionName: competition?.name || "Unknown Competition",
        rank: p.currentRank || 0,
        pnl: p.pnl || 0,
        pnlPercentage: p.pnlPercentage || 0,
        totalTrades: p.totalTrades || 0,
        winRate,
        status: competition?.status || p.status, // Use competition status, fallback to participant status
        prizeAmount,
        startedAt: competition?.startTime || p.createdAt,
        endedAt: competition?.endTime || p.updatedAt,
      };
    });

    return {
      totalCompetitionsEntered: participations.length,
      totalCompetitionsCompleted: completedParticipations.length,
      totalCompetitionsActive: activeParticipations.length,
      totalCapitalTraded,
      totalPnl,
      totalPnlPercentage,
      totalTrades,
      totalWinningTrades,
      totalLosingTrades,
      overallWinRate,
      averageRoi,
      profitFactor,
      bestRank: bestRank === Number.MAX_SAFE_INTEGER ? 0 : bestRank,
      bestPnl,
      bestRoi,
      bestWinRate,
      mostTrades,
      // Reason: Use transaction-based totals — single source of truth
      totalPrizesWon: trueCompWins,
      totalCreditsWon: trueCompWins,
      competitionsWon,
      podiumFinishes,
      recentCompetitions,
    };
  } catch (error) {
    console.error("Error getting user competition stats:", error);
    throw new Error("Failed to get competition stats");
  }
}

export interface UserChallengeStats {
  // Overall Stats
  totalChallengesEntered: number;
  totalChallengesCompleted: number;
  totalChallengesActive: number;
  totalChallengesWon: number;
  totalChallengesLost: number;
  totalChallengesTied: number;

  // Performance Metrics
  totalPnl: number;
  totalTrades: number;
  overallWinRate: number;

  // Best Performances
  bestPnl: number;
  bestRoi: number;
  mostTrades: number;

  // Prizes
  totalCreditsWon: number;
  totalCreditsSpent: number;

  // Recent Challenges
  recentChallenges: {
    challengeId: string;
    opponentName: string;
    entryFee: number;
    winnerPrize: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winRate: number;
    status: string;
    isWinner: boolean;
    isTie: boolean;
    noWinner: boolean;
    prizeAmount: number;
    startTime: Date;
    endTime: Date;
  }[];
}

/**
 * Get comprehensive challenge stats for a user
 *
 * SOURCE OF TRUTH:
 * - Financial stats (totalCreditsWon, totalCreditsSpent) → getUserFinancialSummary (WalletTransaction)
 * - Trading metrics (trades, PnL, win rate) → ChallengeParticipant records
 * - Challenge results (won, lost, tied) → ChallengeParticipant + Challenge records
 */
export async function getUserChallengeStats(
  userId?: string,
): Promise<UserChallengeStats> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    const targetUserId = userId || session.user.id;

    await connectToDatabase();

    // Reason: Fetch challenges, participations, and shared financial summary in parallel.
    // We use getUserFinancialSummary as the SINGLE source of truth for credits won/spent.
    const [challenges, participations, chalFinancials] = await Promise.all([
      Challenge.find({
        $or: [{ challengerId: targetUserId }, { challengedId: targetUserId }],
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      ChallengeParticipant.find({ userId: targetUserId })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      getUserFinancialSummary(targetUserId),
    ]);

    const trueChalWins = chalFinancials.challengeWins;
    const trueChalSpent = chalFinancials.netChallengeSpent;

    // Calculate stats
    const completedChallenges = challenges.filter(
      (c: any) => c.status === "completed",
    );
    const activeChallenges = challenges.filter(
      (c: any) => c.status === "active",
    );

    let totalChallengesWon = 0;
    let totalChallengesLost = 0;
    let totalChallengesTied = 0;
    let totalPnl = 0;
    let totalTrades = 0;
    let totalWinningTrades = 0;
    let bestPnl = 0;
    let bestRoi = 0;
    let mostTrades = 0;
    let totalPrizeAmount = 0;

    // Aggregate from participations
    participations.forEach((p: any) => {
      totalPnl += p.pnl || 0;
      totalTrades += p.totalTrades || 0;
      totalWinningTrades += p.winningTrades || 0;

      if ((p.pnl || 0) > bestPnl) bestPnl = p.pnl || 0;
      if ((p.pnlPercentage || 0) > bestRoi) bestRoi = p.pnlPercentage || 0;
      if ((p.totalTrades || 0) > mostTrades) mostTrades = p.totalTrades || 0;

      if (p.prizeReceived) totalPrizeAmount += p.prizeReceived;
      if (p.isWinner) totalChallengesWon++;
    });

    // Count wins/losses from challenges
    completedChallenges.forEach((c: any) => {
      if (c.isTie) {
        totalChallengesTied++;
      } else if (c.winnerId === targetUserId) {
        // Already counted in participations
      } else if (c.loserId === targetUserId) {
        totalChallengesLost++;
      }
    });

    // Reason: If participations didn't track prizes, fall back to transaction-based total
    if (totalPrizeAmount === 0) {
      totalPrizeAmount = trueChalWins;
    }

    const overallWinRate =
      totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;

    // Build recent challenges
    const recentChallenges = challenges.slice(0, 10).map((c: any) => {
      const isChallenger = c.challengerId === targetUserId;
      const opponentName = isChallenger ? c.challengedName : c.challengerName;
      const myStats = isChallenger
        ? c.challengerFinalStats
        : c.challengedFinalStats;
      const isWinner = c.winnerId === targetUserId;

      return {
        challengeId: c._id.toString(),
        opponentName,
        entryFee: c.entryFee,
        winnerPrize: c.winnerPrize,
        pnl: myStats?.pnl || 0,
        pnlPercentage: myStats?.pnlPercentage || 0,
        totalTrades: myStats?.totalTrades || 0,
        winRate: myStats?.winRate || 0,
        status: c.status,
        isWinner,
        isTie: c.isTie || false,
        noWinner: c.noWinner || false,
        prizeAmount: isWinner ? c.winnerPrize : 0,
        startTime: c.startTime || c.createdAt,
        endTime: c.endTime || c.updatedAt,
      };
    });

    return {
      totalChallengesEntered: challenges.length,
      totalChallengesCompleted: completedChallenges.length,
      totalChallengesActive: activeChallenges.length,
      totalChallengesWon,
      totalChallengesLost,
      totalChallengesTied,
      totalPnl,
      totalTrades,
      overallWinRate,
      bestPnl,
      bestRoi,
      mostTrades,
      // Reason: Use transaction-based totals — single source of truth
      totalCreditsWon: trueChalWins || totalPrizeAmount,
      totalCreditsSpent: trueChalSpent,
      recentChallenges,
    };
  } catch (error) {
    console.error("Error getting user challenge stats:", error);
    throw new Error("Failed to get challenge stats");
  }
}
