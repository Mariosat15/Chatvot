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
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";

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
 */
export async function getUserCompetitionStats(
  userId?: string,
): Promise<UserCompetitionStats> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    const targetUserId = userId || session.user.id;

    await connectToDatabase();

    // Get all participations
    const participations = await CompetitionParticipant.find({
      userId: targetUserId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Get wallet for spending info (balance, deposited, etc.)
    const wallet = await CreditWallet.findOne({ userId: targetUserId }).lean();

    // Reason: Use WalletTransaction as single source of truth for wins AND spending.
    // CreditWallet fields were historically polluted by refunds.
    const compTxTotals = await WalletTransaction.aggregate([
      { $match: { userId: targetUserId, status: "completed", transactionType: { $in: ["competition_win", "competition_entry", "competition_refund"] } } },
      { $group: { _id: "$transactionType", total: { $sum: "$amount" } } },
    ]);
    const compTxMap = new Map<string, number>();
    for (const t of compTxTotals) { compTxMap.set(t._id, Math.abs(t.total)); }
    const txCompWins = compTxMap.get("competition_win") || 0;

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

      // Count wins and podiums
      if (p.currentRank === 1) competitionsWon++;
      if (p.currentRank && p.currentRank <= 3) podiumFinishes++;
    });

    const overallWinRate =
      totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;
    const averageRoi =
      participations.length > 0 ? totalRoi / participations.length : 0;
    const profitFactor =
      totalLoss > 0
        ? totalGross / totalLoss
        : totalWinningTrades > 0
          ? 9999
          : 0;
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
      // Reason: Use WalletTransaction as single source of truth for wins.
      // CreditWallet.totalWonFromCompetitions was historically polluted by refunds.
      totalPrizesWon: txCompWins,
      totalCreditsWon: txCompWins,
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
    prizeAmount: number;
    startTime: Date;
    endTime: Date;
  }[];
}

/**
 * Get comprehensive challenge stats for a user
 */
export async function getUserChallengeStats(
  userId?: string,
): Promise<UserChallengeStats> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/sign-in");

    const targetUserId = userId || session.user.id;

    await connectToDatabase();

    // Get all challenges where user is a participant
    const challenges = await Challenge.find({
      $or: [{ challengerId: targetUserId }, { challengedId: targetUserId }],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Get all participations
    const participations = await ChallengeParticipant.find({
      userId: targetUserId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Reason: Wallet no longer used for wins/spending — transaction-based
    // aggregation below is the single source of truth. Kept for potential future use.
    const _wallet = await CreditWallet.findOne({ userId: targetUserId }).lean();

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

    // Reason: Use WalletTransaction as single source of truth for wins AND spending.
    // CreditWallet fields were historically polluted by refunds.
    // Net spending = entries − refunds (refunds reverse the original entry fee).
    const chalTxTotals = await WalletTransaction.aggregate([
      { $match: { userId: targetUserId, status: "completed", transactionType: { $in: ["challenge_win", "challenge_entry", "challenge_refund"] } } },
      { $group: { _id: "$transactionType", total: { $sum: "$amount" } } },
    ]);
    const chalTxMap = new Map<string, number>();
    for (const t of chalTxTotals) { chalTxMap.set(t._id, Math.abs(t.total)); }
    const txChallengeWins = chalTxMap.get("challenge_win") || 0;
    const txChalRefund = chalTxMap.get("challenge_refund") || 0;
    const txChalSpent = (chalTxMap.get("challenge_entry") || 0) - txChalRefund;
    if (txChallengeWins > 0) totalPrizeAmount = txChallengeWins;

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
      totalCreditsWon: txChallengeWins || totalPrizeAmount,
      // Reason: Net spending = entries − refunds, already computed above
      totalCreditsSpent: txChalSpent,
      recentChallenges,
    };
  } catch (error) {
    console.error("Error getting user challenge stats:", error);
    throw new Error("Failed to get challenge stats");
  }
}
