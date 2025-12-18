import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import TradeHistory from '@/database/models/trading/trade-history.model';

/**
 * Admin API: Check database for recent data
 * POST /api/admin/check-database
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const { competitionId } = await request.json().catch(() => ({}));

    // Get all competitions
    const competitions = await Competition.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name status startTime endTime currentParticipants')
      .lean();

    // Get total counts
    const totalParticipants = await CompetitionParticipant.countDocuments();
    const totalPositions = await TradingPosition.countDocuments();
    const totalTradeHistory = await TradeHistory.countDocuments();
    const openPositions = await TradingPosition.countDocuments({ status: 'open' });
    const closedPositions = await TradingPosition.countDocuments({ status: 'closed' });

    // Get recent trades
    const recentTrades = await TradeHistory.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('competitionId userId symbol realizedPnl closedAt')
      .lean();

    // Get participants with stats
    const participantsWithStats = await CompetitionParticipant.find({
      totalTrades: { $gt: 0 },
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('username competitionId totalTrades pnl currentCapital updatedAt')
      .lean();

    // If specific competition requested, get details
    let competitionDetails = null;
    if (competitionId) {
      const participants = await CompetitionParticipant.find({ competitionId })
        .select('username totalTrades pnl winRate currentCapital')
        .lean();

      const positions = await TradingPosition.find({ competitionId })
        .select('userId symbol status profitLoss closedAt')
        .lean();

      const trades = await TradeHistory.find({ competitionId })
        .select('userId symbol realizedPnl closedAt')
        .lean();

      competitionDetails = {
        participants,
        positions,
        trades,
      };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalCompetitions: competitions.length,
        totalParticipants,
        totalPositions,
        openPositions,
        closedPositions,
        totalTradeHistory,
      },
      recentCompetitions: competitions,
      recentTrades: recentTrades.map((t: any) => ({
        id: t._id.toString(),
        competitionId: t.competitionId,
        userId: t.userId,
        symbol: t.symbol,
        pnl: t.realizedPnl,
        closedAt: t.closedAt,
      })),
      participantsWithStats: participantsWithStats.map((p: any) => ({
        id: p._id.toString(),
        username: p.username,
        competitionId: p.competitionId,
        totalTrades: p.totalTrades,
        pnl: p.pnl,
        capital: p.currentCapital,
        lastUpdated: p.updatedAt,
      })),
      competitionDetails,
    });
  } catch (error) {
    console.error('Error checking database:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to check database',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

