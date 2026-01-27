import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import GameMasterSubscription from '@/database/models/gamemaster/gamemaster-subscription.model';
import UserReferral from '@/database/models/user-referral.model';
import mongoose from 'mongoose';

/**
 * GET /api/gamemaster/referrals
 * Get detailed list of referred users for a Game Master
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // 'active' or 'inactive'
    const search = searchParams.get('search');

    // Check if user is a Game Master
    const subscription = await GameMasterSubscription.findOne({ userId });
    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Not a Game Master' }, { status: 403 });
    }

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { gameMasterId: userId };
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    if (search) {
      query.$or = [
        { userEmail: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await UserReferral.countDocuments(query);

    // Get referrals with pagination
    const referrals = await UserReferral.find(query)
      .sort({ referredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get MongoDB connection for aggregations
    const db = mongoose.connection.db;
    
    // Get earnings data from gamemasterearnings collection (source of truth)
    let earningsByUser: Map<string, { totalEntryFees: number; totalEarnings: number }> = new Map();
    let totalEntryFees = 0;
    let totalEarningsGenerated = 0;
    
    if (db) {
      // Get earnings grouped by referred user
      const earningsData = await db.collection('gamemasterearnings').aggregate([
        { $match: { gameMasterId: userId } },
        { 
          $group: { 
            _id: '$referredUserId',
            totalEntryFees: { $sum: '$entryFeeAmount' },
            totalEarnings: { $sum: '$netEarning' },
          } 
        }
      ]).toArray();
      
      for (const e of earningsData) {
        earningsByUser.set(e._id, {
          totalEntryFees: e.totalEntryFees || 0,
          totalEarnings: e.totalEarnings || 0,
        });
        totalEntryFees += e.totalEntryFees || 0;
        totalEarningsGenerated += e.totalEarnings || 0;
      }
    }

    // Enrich referrals with actual earnings data
    const enrichedReferrals = referrals.map(r => {
      const earnings = earningsByUser.get(r.userId) || { totalEntryFees: 0, totalEarnings: 0 };
      return {
        ...r,
        totalEntryFees: earnings.totalEntryFees,
        totalGMEarnings: earnings.totalEarnings,
      };
    });

    // Count stats from UserReferral
    const allReferrals = await UserReferral.find({ gameMasterId: userId }).lean();
    const totalReferred = allReferrals.length;
    const activeUsers = allReferrals.filter(r => r.isActive).length;
    
    const stats = {
      totalReferred,
      activeUsers,
      totalEntryFees,
      totalEarningsGenerated,
      avgEarningsPerUser: totalReferred > 0 ? totalEarningsGenerated / totalReferred : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        referrals: enrichedReferrals,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching GM referrals:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
