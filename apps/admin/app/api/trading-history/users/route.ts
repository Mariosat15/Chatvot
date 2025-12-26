import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import TradeHistory from '@/database/models/trading/trade-history.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';

/**
 * GET /api/trading-history/users
 * 
 * Fetch all users with their trading summary
 * Supports search, filtering, sorting, and pagination
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const contestType = searchParams.get('contestType') || 'all';
    const dateRange = searchParams.get('dateRange') || 'all';
    const sortBy = searchParams.get('sortBy') || 'trades';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build date filter
    let dateFilter = {};
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      dateFilter = { closedAt: { $gte: startDate } };
    }

    // Get all users with trades
    const usersWithTrades = await TradeHistory.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$userId',
          totalTrades: { $sum: 1 },
          winningTrades: { $sum: { $cond: ['$isWinner', 1, 0] } },
          losingTrades: { $sum: { $cond: ['$isWinner', 0, 1] } },
          totalPnl: { $sum: '$realizedPnl' },
          competitions: { $addToSet: { $cond: [{ $ne: ['$competitionId', null] }, '$competitionId', null] } },
        },
      },
    ]);

    // Get user details from better-auth 'user' collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not found');
    }

    const userIds = usersWithTrades.map(u => u._id);
    
    // Build search query for users
    let userQuery: Record<string, unknown> = {};
    if (search) {
      userQuery = {
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { id: search },
        ],
      };
    }
    
    const allUsers = await db.collection('user').find(userQuery).toArray();
    
    // Create a map of users by their ID (handle both 'id' and '_id' fields)
    const userMap = new Map<string, { _id: string; email: string; name: string }>();
    allUsers.forEach((u: any) => {
      const id = u.id || u._id?.toString();
      if (userIds.includes(id)) {
        userMap.set(id, { _id: id, email: u.email, name: u.name || '' });
      }
    });

    // Get competition and challenge counts
    const competitionCounts = await CompetitionParticipant.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);

    const challengeCounts = await ChallengeParticipant.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);

    // Merge data
    const competitionMap = new Map(competitionCounts.map(c => [c._id, c.count]));
    const challengeMap = new Map(challengeCounts.map(c => [c._id, c.count]));
    const tradeMap = new Map(usersWithTrades.map(t => [t._id, t]));

    let result: Array<{
      id: string;
      email: string;
      name: string;
      totalTrades: number;
      winningTrades: number;
      losingTrades: number;
      winRate: number;
      totalPnl: number;
      competitions: number;
      challenges: number;
    }> = [];

    userMap.forEach((user, userId) => {
      const trades = tradeMap.get(userId) || { totalTrades: 0, winningTrades: 0, losingTrades: 0, totalPnl: 0 };
      const competitions = competitionMap.get(userId) || 0;
      const challenges = challengeMap.get(userId) || 0;

      // Filter by contest type
      if (contestType === 'competition' && competitions === 0) return;
      if (contestType === 'challenge' && challenges === 0) return;

      result.push({
        id: userId,
        email: user.email,
        name: user.name || '',
        totalTrades: trades.totalTrades,
        winningTrades: trades.winningTrades,
        losingTrades: trades.losingTrades,
        winRate: trades.totalTrades > 0 ? (trades.winningTrades / trades.totalTrades) * 100 : 0,
        totalPnl: trades.totalPnl,
        competitions,
        challenges,
      });
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'trades':
          comparison = a.totalTrades - b.totalTrades;
          break;
        case 'pnl':
          comparison = a.totalPnl - b.totalPnl;
          break;
        case 'winrate':
          comparison = a.winRate - b.winRate;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const total = result.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedResult = result.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      users: paginatedResult,
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching trading history users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

