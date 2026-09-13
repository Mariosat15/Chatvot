/**
 * User Stats Service
 *
 * SINGLE SOURCE OF TRUTH for all user trading statistics.
 * Used by:
 * - Customer Dashboard
 * - Admin Trading History
 * - Profile Page
 * - Leaderboard
 *
 * ALL stats are computed from TradeHistory collection to ensure consistency.
 */

import { connectToDatabase } from "@/database/mongoose";
import TradeHistory from "@/database/models/trading/trade-history.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import mongoose from "mongoose";
import {
  computeProfitFactor,
  computeWinRate,
} from "@/lib/services/trading-metrics";

export interface UserTradingStats {
  userId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  competitions: number;
  challenges: number;
  winStreak: number;
  currentStreak: number;
}

export interface ContestStats {
  contestId: string;
  contestType: "competition" | "challenge";
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  averageHoldingTime: number;
  largestWin: number;
  largestLoss: number;
}

/**
 * Get trading stats for a user - SINGLE SOURCE OF TRUTH
 * All stats computed from TradeHistory collection
 */
export async function getUserTradingStats(
  userId: string,
  options?: {
    dateFrom?: Date;
    dateTo?: Date;
    contestType?: "all" | "competition" | "challenge";
  },
): Promise<UserTradingStats> {
  await connectToDatabase();

  const matchQuery: Record<string, unknown> = { userId };

  // Date filter
  if (options?.dateFrom || options?.dateTo) {
    matchQuery.closedAt = {};
    if (options.dateFrom) {
      (matchQuery.closedAt as Record<string, unknown>).$gte = options.dateFrom;
    }
    if (options.dateTo) {
      (matchQuery.closedAt as Record<string, unknown>).$lte = options.dateTo;
    }
  }

  // Contest type filter
  if (options?.contestType === "competition") {
    matchQuery.competitionId = { $ne: null };
    matchQuery.challengeId = null;
  } else if (options?.contestType === "challenge") {
    matchQuery.challengeId = { $ne: null };
    matchQuery.competitionId = null;
  }

  // Aggregate all trades
  const [tradeStats] = await TradeHistory.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$userId",
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] } },
        // Reason: count ONLY genuine losses (PnL < 0); breakeven excluded so
        // win rate / profit factor stay consistent across every surface.
        losingTrades: { $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] } },
        totalPnL: { $sum: "$realizedPnl" },
        grossProfit: {
          $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
        },
        grossLoss: {
          $sum: {
            $cond: [{ $lt: ["$realizedPnl", 0] }, { $abs: "$realizedPnl" }, 0],
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

  // Get competition and challenge counts
  const [competitionCount, challengeCount] = await Promise.all([
    CompetitionParticipant.countDocuments({ userId }),
    ChallengeParticipant.countDocuments({ userId }),
  ]);

  // Calculate derived stats
  const stats = tradeStats || {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnL: 0,
    grossProfit: 0,
    grossLoss: 0,
    largestWin: 0,
    largestLoss: 0,
  };

  const winRate = computeWinRate(stats.winningTrades, stats.losingTrades);

  const averageWin =
    stats.winningTrades > 0 ? stats.grossProfit / stats.winningTrades : 0;

  const averageLoss =
    stats.losingTrades > 0 ? -(stats.grossLoss / stats.losingTrades) : 0;

  const profitFactor = computeProfitFactor(stats.grossProfit, stats.grossLoss);

  // Calculate win streak (optional - can be expensive for many trades)
  const { winStreak, currentStreak } = await calculateWinStreak(userId);

  return {
    userId,
    totalTrades: stats.totalTrades,
    winningTrades: stats.winningTrades,
    losingTrades: stats.losingTrades,
    winRate,
    totalPnL: stats.totalPnL,
    averageWin,
    averageLoss,
    profitFactor,
    largestWin: stats.largestWin || 0,
    largestLoss: stats.largestLoss || 0,
    competitions: competitionCount,
    challenges: challengeCount,
    winStreak,
    currentStreak,
  };
}

/**
 * Get stats for a specific contest (competition or challenge)
 */
export async function getContestStats(
  userId: string,
  contestId: string,
  contestType: "competition" | "challenge",
): Promise<ContestStats> {
  await connectToDatabase();

  const matchQuery: Record<string, unknown> = { userId };
  if (contestType === "competition") {
    matchQuery.competitionId = new mongoose.Types.ObjectId(contestId);
  } else {
    matchQuery.challengeId = new mongoose.Types.ObjectId(contestId);
  }

  const [stats] = await TradeHistory.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] } },
        // Reason: count ONLY genuine losses (PnL < 0); breakeven excluded so
        // win rate / profit factor stay consistent across every surface.
        losingTrades: { $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] } },
        totalPnL: { $sum: "$realizedPnl" },
        totalHoldingTime: { $sum: "$holdingTimeSeconds" },
        largestWin: {
          $max: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
        },
        largestLoss: {
          $min: { $cond: [{ $lt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
        },
      },
    },
  ]);

  const result = stats || {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnL: 0,
    totalHoldingTime: 0,
    largestWin: 0,
    largestLoss: 0,
  };

  return {
    contestId,
    contestType,
    totalTrades: result.totalTrades,
    winningTrades: result.winningTrades,
    losingTrades: result.losingTrades,
    winRate: computeWinRate(result.winningTrades, result.losingTrades),
    totalPnL: result.totalPnL,
    averageHoldingTime:
      result.totalTrades > 0 ? result.totalHoldingTime / result.totalTrades : 0,
    largestWin: result.largestWin || 0,
    largestLoss: result.largestLoss || 0,
  };
}

/**
 * Calculate win streak for a user
 */
async function calculateWinStreak(
  userId: string,
): Promise<{ winStreak: number; currentStreak: number }> {
  const trades = await TradeHistory.find({ userId })
    .sort({ closedAt: -1 })
    .select("isWinner")
    .lean();

  if (trades.length === 0) {
    return { winStreak: 0, currentStreak: 0 };
  }

  let maxStreak = 0;
  let currentStreak = 0;
  let isCurrentStreakActive = true;

  for (const trade of trades) {
    if (trade.isWinner) {
      currentStreak++;
      if (isCurrentStreakActive && currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else {
      isCurrentStreakActive = false;
      maxStreak = Math.max(maxStreak, currentStreak);
      currentStreak = 0;
    }
  }

  // Check if current streak at end
  maxStreak = Math.max(maxStreak, currentStreak);

  // Calculate current active streak
  let activeStreak = 0;
  for (const trade of trades) {
    if (trade.isWinner) {
      activeStreak++;
    } else {
      break;
    }
  }

  return { winStreak: maxStreak, currentStreak: activeStreak };
}

/**
 * Get stats for multiple users (for admin trading history)
 */
export async function getBulkUserStats(options?: {
  search?: string;
  contestType?: "all" | "competition" | "challenge";
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: "trades" | "pnl" | "winrate";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}): Promise<{
  users: Array<UserTradingStats & { email: string; name: string }>;
  total: number;
  totalPages: number;
}> {
  await connectToDatabase();

  const matchQuery: Record<string, unknown> = {};

  // Date filter
  if (options?.dateFrom || options?.dateTo) {
    matchQuery.closedAt = {};
    if (options.dateFrom) {
      (matchQuery.closedAt as Record<string, unknown>).$gte = options.dateFrom;
    }
    if (options.dateTo) {
      (matchQuery.closedAt as Record<string, unknown>).$lte = options.dateTo;
    }
  }

  // Contest type filter
  if (options?.contestType === "competition") {
    matchQuery.competitionId = { $ne: null };
    matchQuery.challengeId = null;
  } else if (options?.contestType === "challenge") {
    matchQuery.challengeId = { $ne: null };
    matchQuery.competitionId = null;
  }

  // Get all user stats
  const userStats = await TradeHistory.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$userId",
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] } },
        // Reason: count ONLY genuine losses (PnL < 0); breakeven excluded so
        // win rate / profit factor stay consistent across every surface.
        losingTrades: { $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] } },
        totalPnL: { $sum: "$realizedPnl" },
        grossProfit: {
          $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
        },
        grossLoss: {
          $sum: {
            $cond: [{ $lt: ["$realizedPnl", 0] }, { $abs: "$realizedPnl" }, 0],
          },
        },
      },
    },
  ]);

  // Get user info
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");

  const userIds = userStats.map((u) => u._id);

  // Build user search query
  let userSearchQuery: Record<string, unknown> = {};
  if (options?.search) {
    userSearchQuery = {
      $or: [
        { email: { $regex: options.search, $options: "i" } },
        { name: { $regex: options.search, $options: "i" } },
        { id: options.search },
      ],
    };
  }

  const allUsers = await db.collection("user").find(userSearchQuery).toArray();
  const userMap = new Map<string, { email: string; name: string }>();

  allUsers.forEach((u: any) => {
    const id = u.id || u._id?.toString();
    if (userIds.includes(id)) {
      userMap.set(id, { email: u.email, name: u.name || "" });
    }
  });

  // Get competition and challenge counts
  const [competitionCounts, challengeCounts] = await Promise.all([
    CompetitionParticipant.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]),
    ChallengeParticipant.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]),
  ]);

  const compMap = new Map(competitionCounts.map((c) => [c._id, c.count]));
  const challMap = new Map(challengeCounts.map((c) => [c._id, c.count]));

  // Combine data
  let results: Array<UserTradingStats & { email: string; name: string }> =
    userStats
      .filter((stats) => userMap.has(stats._id))
      .map((stats) => {
        const user = userMap.get(stats._id)!;
        const winRate = computeWinRate(
          stats.winningTrades,
          stats.losingTrades,
        );
        const profitFactor = computeProfitFactor(
          stats.grossProfit,
          stats.grossLoss,
        );

        return {
          userId: stats._id,
          email: user.email,
          name: user.name,
          totalTrades: stats.totalTrades,
          winningTrades: stats.winningTrades,
          losingTrades: stats.losingTrades,
          winRate,
          totalPnL: stats.totalPnL,
          averageWin:
            stats.winningTrades > 0
              ? stats.grossProfit / stats.winningTrades
              : 0,
          averageLoss:
            stats.losingTrades > 0
              ? -(stats.grossLoss / stats.losingTrades)
              : 0,
          profitFactor,
          largestWin: 0,
          largestLoss: 0,
          competitions: compMap.get(stats._id) || 0,
          challenges: challMap.get(stats._id) || 0,
          winStreak: 0,
          currentStreak: 0,
        };
      });

  // Filter by contest type
  if (options?.contestType === "competition") {
    results = results.filter((r) => r.competitions > 0);
  } else if (options?.contestType === "challenge") {
    results = results.filter((r) => r.challenges > 0);
  }

  // Sort
  const sortBy = options?.sortBy || "trades";
  const sortOrder = options?.sortOrder || "desc";
  results.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "trades":
        comparison = a.totalTrades - b.totalTrades;
        break;
      case "pnl":
        comparison = a.totalPnL - b.totalPnL;
        break;
      case "winrate":
        comparison = a.winRate - b.winRate;
        break;
    }
    return sortOrder === "desc" ? -comparison : comparison;
  });

  // Pagination
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const total = results.length;
  const totalPages = Math.ceil(total / limit);
  const paginatedResults = results.slice((page - 1) * limit, page * limit);

  return {
    users: paginatedResults,
    total,
    totalPages,
  };
}

/**
 * Sync participant stats with trade history
 * Call this after trades are closed to keep participant records in sync
 */
export async function syncParticipantStats(
  participantId: string,
  participantType: "competition" | "challenge",
): Promise<void> {
  await connectToDatabase();

  const Model =
    participantType === "competition"
      ? CompetitionParticipant
      : ChallengeParticipant;

  const participant = await Model.findById(participantId);
  if (!participant) return;

  const contestField =
    participantType === "competition" ? "competitionId" : "challengeId";

  const [stats] = await TradeHistory.aggregate([
    {
      $match: {
        userId: participant.userId,
        [contestField]:
          participant[
            contestField === "competitionId" ? "competitionId" : "challengeId"
          ],
      },
    },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] } },
        // Reason: count ONLY genuine losses (PnL < 0); breakeven excluded so
        // win rate / profit factor stay consistent across every surface.
        losingTrades: { $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] } },
        totalPnL: { $sum: "$realizedPnl" },
        grossProfit: {
          $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0] },
        },
        grossLoss: {
          $sum: {
            $cond: [{ $lt: ["$realizedPnl", 0] }, { $abs: "$realizedPnl" }, 0],
          },
        },
      },
    },
  ]);

  if (stats) {
    const winRate = computeWinRate(stats.winningTrades, stats.losingTrades);

    await Model.findByIdAndUpdate(participantId, {
      totalTrades: stats.totalTrades,
      winningTrades: stats.winningTrades,
      losingTrades: stats.losingTrades,
      winRate,
      pnl: stats.totalPnL,
      averageWin:
        stats.winningTrades > 0 ? stats.grossProfit / stats.winningTrades : 0,
      averageLoss:
        stats.losingTrades > 0 ? -(stats.grossLoss / stats.losingTrades) : 0,
    });
  }
}
