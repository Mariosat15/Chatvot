import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';

/**
 * GET /api/wallet/withdraw/history
 * Get user's withdrawal history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const query: any = { userId: session.user.id };
    if (status && status !== 'all') {
      query.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      WithdrawalRequest.find(query)
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WithdrawalRequest.countDocuments(query),
    ]);

    // Get stats
    const stats = await WithdrawalRequest.aggregate([
      { $match: { userId: session.user.id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amountEUR' },
        },
      },
    ]);

    const statsMap: any = {};
    stats.forEach((s: any) => {
      statsMap[s._id] = { count: s.count, totalAmount: s.totalAmount };
    });

    return NextResponse.json({
      success: true,
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: statsMap,
    });
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch withdrawal history' },
      { status: 500 }
    );
  }
}

