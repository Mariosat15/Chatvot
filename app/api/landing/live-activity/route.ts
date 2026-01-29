import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

interface ActivityItem {
  id: string;
  type: 'competition_win' | 'challenge_complete' | 'new_user' | 'big_trade' | 'competition_start';
  message: string;
  icon: string;
  color: string;
  timestamp: Date;
}

/**
 * GET /api/landing/live-activity
 * Returns recent platform activity for the landing page feed
 * No auth required - public endpoint
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const activities: ActivityItem[] = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get recent competition winners (from completed competitions)
    const recentWinners = await db.collection('competitionparticipants').aggregate([
      {
        $match: {
          finalRank: 1,
          updatedAt: { $gte: oneDayAgo }
        }
      },
      {
        $lookup: {
          from: 'competitions',
          let: { compId: { $toObjectId: '$competitionId' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$compId'] } } }
          ],
          as: 'competition'
        }
      },
      { $unwind: { path: '$competition', preserveNullAndEmptyArrays: true } },
      { $limit: 5 },
      { $sort: { updatedAt: -1 } }
    ]).toArray();

    for (const winner of recentWinners) {
      const prizeWon = winner.prizeWon || 0;
      const competitionName = winner.competition?.name || 'Competition';
      const displayName = anonymizeName(winner.username || 'Trader');
      
      activities.push({
        id: `win_${winner._id}`,
        type: 'competition_win',
        message: `${displayName} just won $${prizeWon.toLocaleString()} in ${competitionName}!`,
        icon: '🏆',
        color: 'text-yellow-400',
        timestamp: winner.updatedAt || new Date(),
      });
    }

    // Get recent challenge completions
    const recentChallenges = await db.collection('challenges').aggregate([
      {
        $match: {
          status: 'completed',
          updatedAt: { $gte: oneDayAgo }
        }
      },
      { $limit: 5 },
      { $sort: { updatedAt: -1 } }
    ]).toArray();

    for (const challenge of recentChallenges) {
      const winnerName = anonymizeName(challenge.winnerName || 'Player');
      const loserName = anonymizeName(
        challenge.winnerId === challenge.challengerId 
          ? challenge.challengedName 
          : challenge.challengerName
      );
      
      activities.push({
        id: `challenge_${challenge._id}`,
        type: 'challenge_complete',
        message: `${winnerName} defeated ${loserName} in a 1v1 challenge!`,
        icon: '⚔️',
        color: 'text-purple-400',
        timestamp: challenge.updatedAt || new Date(),
      });
    }

    // Get recently started/upcoming competitions
    const upcomingCompetitions = await db.collection('competitions').find({
      status: { $in: ['active', 'upcoming'] },
      startTime: { $gte: oneHourAgo, $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    }).sort({ startTime: -1 }).limit(3).toArray();

    for (const comp of upcomingCompetitions) {
      const status = comp.status === 'active' ? 'just started' : 'starting soon';
      activities.push({
        id: `comp_${comp._id}`,
        type: 'competition_start',
        message: `${comp.name} ${status}! Prize pool: $${comp.prizePool?.toLocaleString() || 0}`,
        icon: '🎮',
        color: 'text-green-400',
        timestamp: comp.startTime || new Date(),
      });
    }

    // Get recent new users (anonymized)
    const recentUsers = await db.collection('user').countDocuments({
      createdAt: { $gte: oneHourAgo }
    });

    if (recentUsers > 0) {
      activities.push({
        id: `users_${Date.now()}`,
        type: 'new_user',
        message: `${recentUsers} new trader${recentUsers > 1 ? 's' : ''} joined in the last hour!`,
        icon: '👋',
        color: 'text-blue-400',
        timestamp: new Date(),
      });
    }

    // Get big trades (top PnL in last hour)
    const bigTrades = await db.collection('positions').aggregate([
      {
        $match: {
          status: 'closed',
          closedAt: { $gte: oneHourAgo },
          realizedPnl: { $gt: 100 } // Only show profitable trades > $100
        }
      },
      { $sort: { realizedPnl: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: 'user',
          let: { oderId: '$userId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$id', '$$oderId'] } } },
            { $project: { name: 1, username: 1 } }
          ],
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    for (const trade of bigTrades) {
      const displayName = anonymizeName(trade.user?.username || trade.user?.name || 'Trader');
      const pnl = Math.round(trade.realizedPnl);
      
      activities.push({
        id: `trade_${trade._id}`,
        type: 'big_trade',
        message: `${displayName} just made +$${pnl.toLocaleString()} on ${trade.symbol}!`,
        icon: '📈',
        color: 'text-emerald-400',
        timestamp: trade.closedAt || new Date(),
      });
    }

    // Sort all activities by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limitedActivities = activities.slice(0, 10);

    return NextResponse.json({
      activities: limitedActivities,
      count: limitedActivities.length,
      updatedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching live activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}

// Anonymize names for privacy (show first letter + last letter)
function anonymizeName(name: string): string {
  if (!name || name.length < 2) return 'Trader';
  
  const cleanName = name.trim();
  if (cleanName.length <= 3) {
    return cleanName[0] + '***';
  }
  
  return cleanName[0] + '***' + cleanName[cleanName.length - 1];
}
