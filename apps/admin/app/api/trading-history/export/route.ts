import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import TradeHistory from '@/database/models/trading/trade-history.model';
import Competition from '@/database/models/trading/competition.model';
import Challenge from '@/database/models/trading/challenge.model';

/**
 * GET /api/trading-history/export
 * 
 * Export trading history to CSV
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const contestType = searchParams.get('contestType') || 'all';
    const dateRange = searchParams.get('dateRange') || 'all';

    // Build date filter
    let dateFilter: Record<string, unknown> = {};
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

    // Get all trades
    const trades = await TradeHistory.find(dateFilter).sort({ closedAt: -1 }).lean();

    // Get all unique user IDs
    const userIds = [...new Set(trades.map(t => t.userId))];
    
    // Get user details from better-auth 'user' collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not found');
    }

    let userQuery: Record<string, unknown> = {};
    if (search) {
      userQuery = {
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ],
      };
    }
    
    const allUsers = await db.collection('user').find(userQuery).toArray();
    
    // Create a map of users by their ID
    const userMap = new Map<string, { email: string; name: string }>();
    const allowedUserIds = new Set<string>();
    
    allUsers.forEach((u: any) => {
      const id = u.id || u._id?.toString();
      if (userIds.includes(id)) {
        userMap.set(id, { email: u.email, name: u.name || '' });
        allowedUserIds.add(id);
      }
    });

    // Get competitions and challenges
    const competitionIds = [...new Set(trades.filter(t => t.competitionId).map(t => t.competitionId))];
    const competitions = await Competition.find({ _id: { $in: competitionIds } }).select('_id name').lean() as unknown as Array<{ _id: any; name: string }>;
    const competitionMap = new Map(competitions.map(c => [c._id.toString(), c.name]));

    const challengeIds = [...new Set(trades.filter(t => t.challengeId).map(t => t.challengeId))];
    const challenges = await Challenge.find({ _id: { $in: challengeIds } }).select('_id name').lean() as unknown as Array<{ _id: any; name: string }>;
    const challengeMap = new Map(challenges.map(c => [c._id.toString(), c.name]));

    // Filter trades
    let filteredTrades = trades.filter(t => allowedUserIds.has(t.userId.toString()));

    if (contestType === 'competition') {
      filteredTrades = filteredTrades.filter(t => t.competitionId && !t.challengeId);
    } else if (contestType === 'challenge') {
      filteredTrades = filteredTrades.filter(t => t.challengeId);
    }

    // Build CSV
    const headers = [
      'Trade ID',
      'User Email',
      'User Name',
      'Contest Type',
      'Contest Name',
      'Symbol',
      'Side',
      'Quantity',
      'Entry Price',
      'Exit Price',
      'Realized PnL',
      'PnL %',
      'Close Reason',
      'Leverage',
      'Margin Used',
      'Had Stop Loss',
      'Stop Loss Price',
      'Had Take Profit',
      'Take Profit Price',
      'Holding Time (seconds)',
      'Opened At',
      'Closed At',
      'Is Winner',
    ];

    const rows = filteredTrades.map((trade: any) => {
      const user = userMap.get(trade.userId.toString());
      const isCompetition = trade.competitionId && !trade.challengeId;
      const contestId = trade.challengeId || trade.competitionId;
      const contestName = trade.challengeId 
        ? challengeMap.get(trade.challengeId.toString()) 
        : competitionMap.get(trade.competitionId?.toString() || '');

      return [
        trade._id.toString(),
        user?.email || 'Unknown',
        user?.name || '',
        isCompetition ? 'Competition' : 'Challenge',
        contestName || 'Unknown',
        trade.symbol,
        trade.side,
        trade.quantity,
        trade.entryPrice,
        trade.exitPrice,
        trade.realizedPnl?.toFixed(2) || '0',
        trade.realizedPnlPercentage?.toFixed(2) || '0',
        trade.closeReason,
        trade.leverage || 1,
        trade.marginUsed?.toFixed(2) || '0',
        trade.hadStopLoss ? 'Yes' : 'No',
        trade.stopLossPrice || '',
        trade.hadTakeProfit ? 'Yes' : 'No',
        trade.takeProfitPrice || '',
        trade.holdingTimeSeconds || 0,
        trade.openedAt ? new Date(trade.openedAt).toISOString() : '',
        trade.closedAt ? new Date(trade.closedAt).toISOString() : '',
        trade.isWinner ? 'Yes' : 'No',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="trading-history-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting trading history:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}

