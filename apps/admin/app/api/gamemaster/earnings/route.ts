import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { verifyGameMasterAuth } from '@/lib/admin/auth';
import mongoose from 'mongoose';

/**
 * GET /api/gamemaster/earnings
 * Get earnings history for game master
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
    const status = searchParams.get('status');  // 'pending', 'paid', 'cancelled'
    const sourceType = searchParams.get('sourceType');  // 'competition', 'challenge'
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Build query
    const query: Record<string, unknown> = {
      gameMasterId: auth.userId,
    };

    if (status) {
      query.status = status;
    }

    if (sourceType) {
      query.sourceType = sourceType;
    }

    // Get earnings with pagination
    const earnings = await db.collection('gamemasterearnings')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await db.collection('gamemasterearnings').countDocuments(query);

    // Get aggregated stats
    const stats = await db.collection('gamemasterearnings').aggregate([
      { $match: { gameMasterId: auth.userId } },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$grossEarning' },
          totalNet: { $sum: '$netEarning' },
          totalPaid: { 
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$netEarning', 0] }
          },
          totalPending: { 
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$netEarning', 0] }
          },
          competitionEarnings: { 
            $sum: { $cond: [{ $eq: ['$sourceType', 'competition'] }, '$netEarning', 0] }
          },
          challengeEarnings: { 
            $sum: { $cond: [{ $eq: ['$sourceType', 'challenge'] }, '$netEarning', 0] }
          },
          transactionCount: { $sum: 1 },
        }
      }
    ]).toArray();

    // Get monthly breakdown (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyBreakdown = await db.collection('gamemasterearnings').aggregate([
      { 
        $match: { 
          gameMasterId: auth.userId,
          createdAt: { $gte: sixMonthsAgo },
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          earnings: { $sum: '$netEarning' },
          count: { $sum: 1 },
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]).toArray();

    return NextResponse.json({
      earnings: earnings.map(e => ({
        id: e._id.toString(),
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        sourceName: e.sourceName,
        referredUserId: e.referredUserId,
        referredUserEmail: e.referredUserEmail,
        referredUserName: e.referredUserName,
        entryFeeAmount: e.entryFeeAmount,
        earningPercentage: e.earningPercentage,
        grossEarning: e.grossEarning,
        platformFee: e.platformFee,
        netEarning: e.netEarning,
        status: e.status,
        paidAt: e.paidAt,
        transactionId: e.transactionId,
        eventStartTime: e.eventStartTime,
        eventEndTime: e.eventEndTime,
        participantCount: e.participantCount,
        referredUserRank: e.referredUserRank,
        createdAt: e.createdAt,
      })),
      stats: stats[0] || {
        totalGross: 0,
        totalNet: 0,
        totalPaid: 0,
        totalPending: 0,
        competitionEarnings: 0,
        challengeEarnings: 0,
        transactionCount: 0,
      },
      monthlyBreakdown: monthlyBreakdown.map(m => ({
        year: m._id.year,
        month: m._id.month,
        earnings: m.earnings,
        count: m.count,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
