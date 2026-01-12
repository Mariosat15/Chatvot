import { NextRequest, NextResponse } from 'next/server';
import { getBulkUserStats } from '../../../../../lib/services/user-stats.service';

/**
 * GET /api/trading-history/users
 * 
 * Fetch all users with their trading summary
 * Uses the shared user-stats.service for CONSISTENT stats across admin and customer
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const contestType = (searchParams.get('contestType') || 'all') as 'all' | 'competition' | 'challenge';
    const dateRange = searchParams.get('dateRange') || 'all';
    const sortBy = (searchParams.get('sortBy') || 'trades') as 'trades' | 'pnl' | 'winrate';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Build date filter
    let dateFrom: Date | undefined;
    if (dateRange !== 'all') {
      const now = new Date();
      switch (dateRange) {
        case '7d':
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Use the shared service for consistent stats
    const { users, total, totalPages } = await getBulkUserStats({
      search: search || undefined,
      contestType,
      dateFrom,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    // Transform to match expected response format
    const result = users.map(user => ({
      id: user.userId,
      email: user.email,
      name: user.name,
      totalTrades: user.totalTrades,
      winningTrades: user.winningTrades,
      losingTrades: user.losingTrades,
      winRate: user.winRate,
      totalPnl: user.totalPnL,
      competitions: user.competitions,
      challenges: user.challenges,
    }));

    return NextResponse.json({
      users: result,
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

