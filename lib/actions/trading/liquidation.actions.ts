'use server';

import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import { getMarginStatus } from '@/lib/services/risk-manager.service';
import { getMarginThresholds } from '@/lib/actions/trading/risk-settings.actions';
import { fetchRealForexPrices } from '@/lib/services/real-forex-prices.service';
import { calculateUnrealizedPnL, ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { closePositionAutomatic } from '@/lib/actions/trading/position.actions';

/**
 * Execute liquidation for current user
 * Called when client-side margin calculation detects liquidation threshold breached
 * 
 * IMPORTANT: This function VALIDATES on server before closing
 * - Fetches fresh prices from API
 * - Recalculates margin to confirm liquidation is needed
 * - Only closes if server-side calculation also shows liquidation
 * 
 * This prevents:
 * - Client-server price desync issues
 * - Malicious liquidation requests
 * - Race conditions
 */
export const executeLiquidation = async (
  competitionId: string,
  clientMarginLevel: number // Client's calculated margin level (for logging)
): Promise<{
  success: boolean;
  liquidated: boolean;
  positionsClosed: number;
  serverMarginLevel: number;
  message: string;
}> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return {
        success: false,
        liquidated: false,
        positionsClosed: 0,
        serverMarginLevel: 100,
        message: 'Not authenticated',
      };
    }

    await connectToDatabase();

    // Get user's participant record
    const participant = await CompetitionParticipant.findOne({
      competitionId,
      userId: session.user.id,
      status: 'active',
    });

    if (!participant) {
      return {
        success: false,
        liquidated: false,
        positionsClosed: 0,
        serverMarginLevel: 100,
        message: 'Participant not found',
      };
    }

    // Get all open positions
    const openPositions = await TradingPosition.find({
      participantId: participant._id,
      status: 'open',
    });

    if (openPositions.length === 0) {
      return {
        success: true,
        liquidated: false,
        positionsClosed: 0,
        serverMarginLevel: Infinity,
        message: 'No open positions',
      };
    }

    // Load admin thresholds
    const adminThresholds = await getMarginThresholds();
    const thresholds = {
      liquidation: adminThresholds.LIQUIDATION,
      marginCall: adminThresholds.MARGIN_CALL,
      warning: adminThresholds.WARNING,
    };

    // CRITICAL: Fetch FRESH prices from API (not cached)
    const uniqueSymbols = [...new Set(openPositions.map(p => p.symbol))] as ForexSymbol[];
    const pricesMap = await fetchRealForexPrices(uniqueSymbols);

    // SERVER-SIDE VALIDATION: Recalculate margin with fresh prices
    let totalUnrealizedPnl = 0;
    for (const position of openPositions) {
      const currentPrice = pricesMap.get(position.symbol as ForexSymbol);
      if (!currentPrice) continue;

      const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
      const unrealizedPnl = calculateUnrealizedPnL(
        position.side,
        position.entryPrice,
        marketPrice,
        position.quantity,
        position.symbol as ForexSymbol
      );

      totalUnrealizedPnl += unrealizedPnl;
    }

    // Calculate server-side margin status
    const marginStatus = getMarginStatus(
      participant.currentCapital,
      totalUnrealizedPnl,
      participant.usedMargin,
      thresholds
    );

    // VALIDATION: Only liquidate if SERVER confirms liquidation is needed
    if (marginStatus.status !== 'liquidation') {
      return {
        success: true,
        liquidated: false,
        positionsClosed: 0,
        serverMarginLevel: marginStatus.marginLevel,
        message: `Server margin level (${marginStatus.marginLevel.toFixed(2)}%) is above liquidation threshold`,
      };
    }

    // EXECUTE LIQUIDATION
    // Send liquidation notifications
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      for (const position of openPositions) {
        // Fire and forget - don't block liquidation
        notificationService.notifyLiquidation(session.user.id, position.symbol).catch(() => {});
      }
    } catch {
      // Notifications are non-critical
    }

    let closedCount = 0;
    for (const position of openPositions) {
      const currentPrice = pricesMap.get(position.symbol as ForexSymbol);
      if (!currentPrice) continue;

      const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
      
      try {
        await closePositionAutomatic(position._id.toString(), marketPrice, 'margin_call');
        closedCount++;
      } catch {
        // Position close failed - continue with others
      }
    }

    return {
      success: true,
      liquidated: true,
      positionsClosed: closedCount,
      serverMarginLevel: marginStatus.marginLevel,
      message: `Liquidated ${closedCount} positions`,
    };
  } catch (error) {
    return {
      success: false,
      liquidated: false,
      positionsClosed: 0,
      serverMarginLevel: 100,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Backup margin check - runs periodically as safety net
 * Less aggressive than executeLiquidation, used for catching edge cases
 */
export const backupMarginCheck = async (competitionId: string): Promise<{
  needsLiquidation: boolean;
  marginLevel: number;
}> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { needsLiquidation: false, marginLevel: 100 };
    }

    await connectToDatabase();

    const participant = await CompetitionParticipant.findOne({
      competitionId,
      userId: session.user.id,
      status: 'active',
    });

    if (!participant || participant.currentOpenPositions === 0) {
      return { needsLiquidation: false, marginLevel: Infinity };
    }

    const openPositions = await TradingPosition.find({
      participantId: participant._id,
      status: 'open',
    });

    if (openPositions.length === 0) {
      return { needsLiquidation: false, marginLevel: Infinity };
    }

    const adminThresholds = await getMarginThresholds();
    const uniqueSymbols = [...new Set(openPositions.map(p => p.symbol))] as ForexSymbol[];
    const pricesMap = await fetchRealForexPrices(uniqueSymbols);

    let totalUnrealizedPnl = 0;
    for (const position of openPositions) {
      const currentPrice = pricesMap.get(position.symbol as ForexSymbol);
      if (!currentPrice) continue;

      const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
      totalUnrealizedPnl += calculateUnrealizedPnL(
        position.side,
        position.entryPrice,
        marketPrice,
        position.quantity,
        position.symbol as ForexSymbol
      );
    }

    const marginStatus = getMarginStatus(
      participant.currentCapital,
      totalUnrealizedPnl,
      participant.usedMargin,
      {
        liquidation: adminThresholds.LIQUIDATION,
        marginCall: adminThresholds.MARGIN_CALL,
        warning: adminThresholds.WARNING,
      }
    );

    return {
      needsLiquidation: marginStatus.status === 'liquidation',
      marginLevel: marginStatus.marginLevel,
    };
  } catch {
    return { needsLiquidation: false, marginLevel: 100 };
  }
};

