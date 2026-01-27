import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import GameMasterSubscription from '@/database/models/gamemaster/gamemaster-subscription.model';
import GameMasterEarning from '@/database/models/gamemaster/gamemaster-earning.model';

/**
 * GET /api/gamemaster/earnings
 * Get detailed earnings history for a Game Master
 * Supports date filtering with startDate/endDate or days (preset periods)
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
    const sourceType = searchParams.get('sourceType'); // 'competition' or 'challenge'
    const days = searchParams.get('days'); // Preset: 30, 60, 90, 120
    const startDate = searchParams.get('startDate'); // Custom date range
    const endDate = searchParams.get('endDate');

    // Check if user is a Game Master
    const subscription = await GameMasterSubscription.findOne({ userId });
    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Not a Game Master' }, { status: 403 });
    }

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { gameMasterId: userId };
    if (sourceType && ['competition', 'challenge'].includes(sourceType)) {
      query.sourceType = sourceType;
    }

    // Apply date filtering
    if (days) {
      const daysNum = parseInt(days);
      if (!isNaN(daysNum) && daysNum > 0) {
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - daysNum);
        dateFrom.setHours(0, 0, 0, 0);
        query.createdAt = { $gte: dateFrom };
      }
    } else if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Get total count
    const total = await GameMasterEarning.countDocuments(query);

    // Get earnings with pagination
    const earnings = await GameMasterEarning.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Calculate totals for the filtered period (not just paginated results)
    const allFilteredEarnings = await GameMasterEarning.find(query).lean();
    
    const totals = allFilteredEarnings.reduce((acc, e) => {
      acc.totalEarnings += e.netEarning || 0;
      if (e.status === 'paid') acc.paidEarnings += e.netEarning || 0;
      if (e.status === 'pending') acc.pendingEarnings += e.netEarning || 0;
      if (e.sourceType === 'competition') acc.fromCompetitions += e.netEarning || 0;
      if (e.sourceType === 'challenge') acc.fromChallenges += e.netEarning || 0;
      return acc;
    }, {
      totalEarnings: 0,
      paidEarnings: 0,
      pendingEarnings: 0,
      fromCompetitions: 0,
      fromChallenges: 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        earnings,
        totals,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching GM earnings:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
