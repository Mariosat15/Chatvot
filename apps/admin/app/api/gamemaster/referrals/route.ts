import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { verifyGameMasterAuth } from '@/lib/admin/auth';
import mongoose from 'mongoose';

/**
 * GET /api/gamemaster/referrals
 * Get list of referred users
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyGameMasterAuth();
    if (!auth.isAuthenticated || !auth.isGameMaster) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Build query
    const query: Record<string, unknown> = {
      referredByGameMasterId: auth.userId,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Get referred users with pagination
    const users = await db.collection('user')
      .find(query)
      .project({
        _id: 1,
        name: 1,
        email: 1,
        createdAt: 1,
        image: 1,
        country: 1,
        referredAt: 1,
      })
      .sort({ referredAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await db.collection('user').countDocuments(query);

    // For each user, get their competition participation stats
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const participantStats = await db.collection('competitionparticipants').aggregate([
        { $match: { userId: user._id.toString() } },
        { 
          $group: {
            _id: null,
            totalCompetitions: { $sum: 1 },
            totalWins: { $sum: { $cond: [{ $eq: ['$currentRank', 1] }, 1, 0] } },
            totalPnl: { $sum: '$pnl' },
          }
        }
      ]).toArray();

      // Get earnings generated for this game master from this user
      const earningsFromUser = await db.collection('gamemasterearnings').aggregate([
        { 
          $match: { 
            gameMasterId: auth.userId,
            referredUserId: user._id.toString(),
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$netEarning' },
            transactionCount: { $sum: 1 },
          }
        }
      ]).toArray();

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        referredAt: user.referredAt,
        image: user.image,
        country: user.country,
        stats: participantStats[0] || {
          totalCompetitions: 0,
          totalWins: 0,
          totalPnl: 0,
        },
        earningsGenerated: earningsFromUser[0]?.totalEarnings || 0,
        transactionCount: earningsFromUser[0]?.transactionCount || 0,
      };
    }));

    return NextResponse.json({
      referrals: usersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
