'use server';

import { connectToDatabase } from '@/database/mongoose';
import TradeHistory from '@/database/models/trading/trade-history.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

/**
 * Get trade history for a user in a specific competition
 */
export async function getCompetitionTradeHistory(competitionId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      throw new Error('Unauthorized');
    }
    
    const userId = session.user.id;

    await connectToDatabase();

    // Fetch all closed trades for this user in this competition
    const trades = await TradeHistory.find({
      competitionId,
      userId,
    })
      .sort({ closedAt: -1 }) // Most recent first
      .lean();

    // Transform for client
    const formattedTrades = trades.map((trade: any) => ({
      _id: String(trade._id),
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      orderType: trade.orderType || 'market',
      limitPrice: trade.limitPrice,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      realizedPnl: trade.realizedPnl || 0,
      realizedPnlPercentage: trade.realizedPnlPercentage || 0,
      marginUsed: trade.marginUsed || 0,
      entrySpread: trade.entrySpread || 0,
      exitSpread: trade.exitSpread || 0,
      totalCosts: trade.totalCosts || 0,
      openedAt: trade.openedAt.toISOString(),
      closedAt: trade.closedAt.toISOString(),
      closeReason: mapCloseReason(trade.closeReason),
    }));

    return {
      success: true,
      trades: formattedTrades,
    };
  } catch (error) {
    console.error('❌ Error fetching trade history:', error);
    return {
      success: false,
      trades: [],
      error: error instanceof Error ? error.message : 'Failed to fetch trade history',
    };
  }
}

/**
 * Get trade statistics for a user in a competition
 */
export async function getCompetitionTradeStats(competitionId: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      throw new Error('Unauthorized');
    }
    
    const userId = session.user.id;

    await connectToDatabase();

    const trades = await TradeHistory.find({
      competitionId,
      userId,
    }).lean();

    const totalTrades = trades.length;
    const winningTrades = trades.filter((t: any) => t.isWinner).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const totalPnl = trades.reduce((sum: number, t: any) => sum + t.realizedPnl, 0);
    const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

    const bestTrade = trades.length > 0 
      ? Math.max(...trades.map((t: any) => t.realizedPnl))
      : 0;
    
    const worstTrade = trades.length > 0 
      ? Math.min(...trades.map((t: any) => t.realizedPnl))
      : 0;

    return {
      success: true,
      stats: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnl,
        avgPnl,
        bestTrade,
        worstTrade,
      },
    };
  } catch (error) {
    console.error('❌ Error fetching trade stats:', error);
    return {
      success: false,
      stats: null,
      error: error instanceof Error ? error.message : 'Failed to fetch trade stats',
    };
  }
}

// Helper function to map close reasons
function mapCloseReason(reason: string): 'manual' | 'stop_loss' | 'take_profit' | 'liquidation' {
  switch (reason) {
    case 'user':
      return 'manual';
    case 'stop_loss':
      return 'stop_loss';
    case 'take_profit':
      return 'take_profit';
    case 'margin_call':
    case 'competition_end':
      return 'liquidation';
    default:
      return 'manual';
  }
}

