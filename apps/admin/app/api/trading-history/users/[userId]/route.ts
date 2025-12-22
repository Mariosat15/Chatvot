import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import TradeHistory from '@/database/models/trading/trade-history.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import Competition from '@/database/models/trading/competition.model';
import Challenge from '@/database/models/trading/challenge.model';

/**
 * GET /api/trading-history/users/[userId]
 * 
 * Fetch detailed trading history for a specific user
 * Including all contests and individual trades
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await connectToDatabase();

    const { userId } = await params;
    const searchParams = request.nextUrl.searchParams;
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

    // Get user info from better-auth 'user' collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not found');
    }

    // Try to find user by 'id' field first (better-auth custom id)
    let userDoc = await db.collection('user').findOne({ id: userId });
    
    // If not found, try by _id
    if (!userDoc) {
      try {
        const { ObjectId } = await import('mongodb');
        if (ObjectId.isValid(userId)) {
          userDoc = await db.collection('user').findOne({ _id: new ObjectId(userId) });
        }
      } catch {
        // Not a valid ObjectId, skip
      }
    }

    if (!userDoc) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = {
      _id: userDoc.id || userDoc._id?.toString(),
      email: userDoc.email,
      name: userDoc.name || '',
    };

    // Get all trades for this user
    const trades = await TradeHistory.find({
      userId,
      ...dateFilter,
    }).sort({ closedAt: -1 }).lean();

    // Get competition participations
    const competitionParticipants = await CompetitionParticipant.find({
      userId,
    }).lean();

    // Get challenge participations  
    const challengeParticipants = await ChallengeParticipant.find({
      userId,
    }).lean();

    // Get competition details
    const competitionIds = competitionParticipants.map(p => p.competitionId);
    const competitions = await Competition.find({
      _id: { $in: competitionIds },
    }).select('_id name status').lean();

    // Get challenge details
    const challengeIds = challengeParticipants.map(p => p.challengeId);
    const challenges = await Challenge.find({
      _id: { $in: challengeIds },
    }).select('_id slug status challengerName challengedName entryFee duration').lean();

    // Group trades by contest
    const tradesByContest = new Map<string, typeof trades>();
    trades.forEach(trade => {
      const contestId = trade.competitionId;
      if (!tradesByContest.has(contestId)) {
        tradesByContest.set(contestId, []);
      }
      tradesByContest.get(contestId)!.push(trade);
    });

    // Build contests array
    const contests: Array<{
      id: string;
      name: string;
      type: 'competition' | 'challenge';
      status: string;
      trades: any[];
      summary: {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
        totalPnl: number;
        largestWin: number;
        largestLoss: number;
        averageHoldingTime: number;
      };
    }> = [];

    // Helper function to create trade entry
    const createTradeEntry = (t: any) => ({
      _id: t._id.toString(),
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      realizedPnl: t.realizedPnl,
      realizedPnlPercentage: t.realizedPnlPercentage,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
      closeReason: t.closeReason,
      holdingTimeSeconds: t.holdingTimeSeconds,
      leverage: t.leverage,
      marginUsed: t.marginUsed,
      hadStopLoss: t.hadStopLoss,
      stopLossPrice: t.stopLossPrice,
      hadTakeProfit: t.hadTakeProfit,
      takeProfitPrice: t.takeProfitPrice,
      isWinner: t.isWinner,
    });

    // Helper function to calculate summary
    const calculateSummary = (contestTrades: any[]) => {
      const winningTrades = contestTrades.filter(t => t.isWinner).length;
      const losingTrades = contestTrades.length - winningTrades;
      const totalPnl = contestTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
      const wins = contestTrades.filter(t => t.realizedPnl > 0).map(t => t.realizedPnl);
      const losses = contestTrades.filter(t => t.realizedPnl < 0).map(t => t.realizedPnl);
      const totalHoldingTime = contestTrades.reduce((sum, t) => sum + (t.holdingTimeSeconds || 0), 0);

      return {
        totalTrades: contestTrades.length,
        winningTrades,
        losingTrades,
        winRate: contestTrades.length > 0 ? (winningTrades / contestTrades.length) * 100 : 0,
        totalPnl,
        largestWin: wins.length > 0 ? Math.max(...wins) : 0,
        largestLoss: losses.length > 0 ? Math.min(...losses) : 0,
        averageHoldingTime: contestTrades.length > 0 ? totalHoldingTime / contestTrades.length : 0,
      };
    };

    // Add competitions
    if (contestType === 'all' || contestType === 'competition') {
      for (const comp of competitions as any[]) {
        const compId = (comp._id as any).toString();
        const compTrades = tradesByContest.get(compId) || [];
        
        if (compTrades.length === 0 && dateRange !== 'all') continue;

        contests.push({
          id: compId,
          name: comp.name,
          type: 'competition',
          status: comp.status,
          trades: compTrades.map(createTradeEntry),
          summary: calculateSummary(compTrades),
        });
      }
    }

    // Add challenges
    if (contestType === 'all' || contestType === 'challenge') {
      for (const chal of challenges as any[]) {
        const chalId = (chal._id as any).toString();
        const chalTrades = tradesByContest.get(chalId) || [];
        
        if (chalTrades.length === 0 && dateRange !== 'all') continue;

        // Generate a meaningful name for the challenge
        const challengeName = `${chal.challengerName || 'Player 1'} vs ${chal.challengedName || 'Player 2'}${chal.entryFee ? ` ($${chal.entryFee})` : ''}`;

        contests.push({
          id: chalId,
          name: challengeName,
          type: 'challenge',
          status: chal.status,
          trades: chalTrades.map(createTradeEntry),
          summary: calculateSummary(chalTrades),
        });
      }
    }

    // Calculate overall user summary
    const allTrades = trades;
    const totalWins = allTrades.filter(t => t.isWinner).length;

    return NextResponse.json({
      user: {
        id: userId,
        email: user.email,
        name: user.name || '',
        totalTrades: allTrades.length,
        winningTrades: totalWins,
        losingTrades: allTrades.length - totalWins,
        winRate: allTrades.length > 0 ? (totalWins / allTrades.length) * 100 : 0,
        totalPnl: allTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0),
        competitions: competitions.length,
        challenges: challenges.length,
      },
      contests: contests.sort((a, b) => b.summary.totalTrades - a.summary.totalTrades),
    });
  } catch (error) {
    console.error('Error fetching user trading history:', error);
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}

