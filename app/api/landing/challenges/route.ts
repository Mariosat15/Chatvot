import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * GET /api/landing/challenges
 * Returns recent and active challenges for the landing page
 * No auth required - public endpoint
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get active challenges
    const activeChallenges = await db.collection('challenges').find({
      status: { $in: ['pending', 'accepted', 'active'] },
    }).sort({ createdAt: -1 }).limit(5).toArray();

    // Get recently completed challenges
    const completedChallenges = await db.collection('challenges').find({
      status: 'completed',
      updatedAt: { $gte: oneDayAgo }
    }).sort({ updatedAt: -1 }).limit(5).toArray();

    // Format active challenges
    const formattedActive = activeChallenges.map(challenge => {
      const now = new Date();
      const endTime = challenge.endTime ? new Date(challenge.endTime) : null;
      
      let timeRemaining = '';
      if (endTime && challenge.status === 'active') {
        const ms = endTime.getTime() - now.getTime();
        timeRemaining = formatTimeRemaining(ms);
      }

      return {
        id: challenge._id.toString(),
        challenger: anonymizeName(challenge.challengerName || 'Player 1'),
        challenged: anonymizeName(challenge.challengedName || 'Player 2'),
        stake: challenge.entryFee || 0,
        stakeFormatted: `$${(challenge.entryFee || 0).toLocaleString()}`,
        status: challenge.status,
        statusLabel: getStatusLabel(challenge.status),
        timeRemaining,
        duration: challenge.duration || '24h',
        // Current scores if available
        challengerScore: challenge.challengerPnl?.toFixed(2) || '0.00',
        challengedScore: challenge.challengedPnl?.toFixed(2) || '0.00',
      };
    });

    // Format completed challenges
    const formattedCompleted = completedChallenges.map(challenge => {
      const winnerName = challenge.winnerId === challenge.challengerId 
        ? challenge.challengerName 
        : challenge.challengedName;
      const loserName = challenge.winnerId === challenge.challengerId 
        ? challenge.challengedName 
        : challenge.challengerName;

      return {
        id: challenge._id.toString(),
        winner: anonymizeName(winnerName || 'Winner'),
        loser: anonymizeName(loserName || 'Loser'),
        winnerPrize: challenge.winnerPrize || 0,
        winnerPrizeFormatted: `$${(challenge.winnerPrize || 0).toLocaleString()}`,
        completedAt: challenge.updatedAt,
        // Final scores
        winnerScore: challenge.winnerId === challenge.challengerId 
          ? challenge.challengerPnl?.toFixed(2) 
          : challenge.challengedPnl?.toFixed(2),
        loserScore: challenge.winnerId === challenge.challengerId 
          ? challenge.challengedPnl?.toFixed(2) 
          : challenge.challengerPnl?.toFixed(2),
      };
    });

    // Get challenge stats
    const totalActive = await db.collection('challenges').countDocuments({
      status: { $in: ['pending', 'accepted', 'active'] }
    });
    
    const totalCompleted = await db.collection('challenges').countDocuments({
      status: 'completed'
    });

    // Calculate total challenge prize pool
    const totalPrizePool = await db.collection('challenges').aggregate([
      { $match: { status: { $in: ['pending', 'accepted', 'active'] } } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$entryFee', 2] } } } }
    ]).toArray();

    return NextResponse.json({
      active: formattedActive,
      completed: formattedCompleted,
      stats: {
        totalActive,
        totalCompleted,
        activePrizePool: totalPrizePool[0]?.total || 0,
        activePrizePoolFormatted: `$${(totalPrizePool[0]?.total || 0).toLocaleString()}`,
      },
      updatedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching landing challenges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

function formatTimeRemaining(ms: number): string {
  if (ms < 0) return 'Ended';
  
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Awaiting Response';
    case 'accepted': return 'Starting Soon';
    case 'active': return 'In Progress';
    default: return status;
  }
}

function anonymizeName(name: string): string {
  if (!name || name.length < 2) return 'Player';
  
  const cleanName = name.trim();
  if (cleanName.length <= 3) {
    return cleanName[0] + '***';
  }
  
  return cleanName[0] + '***' + cleanName[cleanName.length - 1];
}
