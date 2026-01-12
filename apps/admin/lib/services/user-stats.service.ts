/**
 * User Stats Service (Admin App Version)
 * 
 * SINGLE SOURCE OF TRUTH for all user trading statistics.
 * ALL stats are computed from TradeHistory collection to ensure consistency.
 */

import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

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

/**
 * Get stats for multiple users (for admin trading history)
 */
export async function getBulkUserStats(
  options?: {
    search?: string;
    contestType?: 'all' | 'competition' | 'challenge';
    dateFrom?: Date;
    dateTo?: Date;
    sortBy?: 'trades' | 'pnl' | 'winrate';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }
): Promise<{
  users: Array<UserTradingStats & { email: string; name: string }>;
  total: number;
  totalPages: number;
}> {
  await connectToDatabase();

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

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
  if (options?.contestType === 'competition') {
    matchQuery.competitionId = { $ne: null };
    matchQuery.challengeId = null;
  } else if (options?.contestType === 'challenge') {
    matchQuery.challengeId = { $ne: null };
    matchQuery.competitionId = null;
  }

  // Get all user stats from TradeHistory collection
  const userStats = await db.collection('tradehistories').aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$userId',
        totalTrades: { $sum: 1 },
        winningTrades: { $sum: { $cond: ['$isWinner', 1, 0] } },
        losingTrades: { $sum: { $cond: ['$isWinner', 0, 1] } },
        totalPnL: { $sum: '$realizedPnl' },
        grossProfit: {
          $sum: { $cond: [{ $gt: ['$realizedPnl', 0] }, '$realizedPnl', 0] }
        },
        grossLoss: {
          $sum: { $cond: [{ $lt: ['$realizedPnl', 0] }, { $abs: '$realizedPnl' }, 0] }
        },
      }
    }
  ]).toArray();

  const userIds = userStats.map(u => u._id);
  
  // Build user search query
  let userSearchQuery: Record<string, unknown> = {};
  if (options?.search) {
    userSearchQuery = {
      $or: [
        { email: { $regex: options.search, $options: 'i' } },
        { name: { $regex: options.search, $options: 'i' } },
        { id: options.search },
      ],
    };
  }

  const allUsers = await db.collection('user').find(userSearchQuery).toArray();
  const userMap = new Map<string, { email: string; name: string }>();
  
  allUsers.forEach((u: any) => {
    const id = u.id || u._id?.toString();
    if (userIds.includes(id)) {
      userMap.set(id, { email: u.email, name: u.name || '' });
    }
  });

  // Get competition and challenge counts
  const [competitionCounts, challengeCounts] = await Promise.all([
    db.collection('competitionparticipants').aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]).toArray(),
    db.collection('challengeparticipants').aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]).toArray()
  ]);

  const compMap = new Map(competitionCounts.map(c => [c._id, c.count]));
  const challMap = new Map(challengeCounts.map(c => [c._id, c.count]));

  // Combine data
  let results: Array<UserTradingStats & { email: string; name: string }> = userStats
    .filter(stats => userMap.has(stats._id))
    .map(stats => {
      const user = userMap.get(stats._id)!;
      const winRate = stats.totalTrades > 0 
        ? (stats.winningTrades / stats.totalTrades) * 100 
        : 0;
      const profitFactor = stats.grossLoss > 0 
        ? stats.grossProfit / stats.grossLoss 
        : stats.winningTrades > 0 ? 9999 : 0;

      return {
        userId: stats._id,
        email: user.email,
        name: user.name,
        totalTrades: stats.totalTrades,
        winningTrades: stats.winningTrades,
        losingTrades: stats.losingTrades,
        winRate,
        totalPnL: stats.totalPnL,
        averageWin: stats.winningTrades > 0 ? stats.grossProfit / stats.winningTrades : 0,
        averageLoss: stats.losingTrades > 0 ? -(stats.grossLoss / stats.losingTrades) : 0,
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
  if (options?.contestType === 'competition') {
    results = results.filter(r => r.competitions > 0);
  } else if (options?.contestType === 'challenge') {
    results = results.filter(r => r.challenges > 0);
  }

  // Sort
  const sortBy = options?.sortBy || 'trades';
  const sortOrder = options?.sortOrder || 'desc';
  results.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'trades': comparison = a.totalTrades - b.totalTrades; break;
      case 'pnl': comparison = a.totalPnL - b.totalPnL; break;
      case 'winrate': comparison = a.winRate - b.winRate; break;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
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
