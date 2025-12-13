'use server';

import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import { getMarginStatus } from '@/lib/services/risk-manager.service';
import { getMarginThresholds } from '@/lib/actions/trading/risk-settings.actions';
import { getRealPrice } from '@/lib/services/real-forex-prices.service';
import { calculateUnrealizedPnL, ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { closePositionAutomatic } from '@/lib/actions/trading/position.actions';

/**
 * Check current user's margin level and auto-liquidate if needed
 * This runs on every price update from the client for real-time monitoring
 */
export const checkUserMargin = async (competitionId: string) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { liquidated: false, marginLevel: 100 };
    }

    await connectToDatabase();

    // Get user's participant record
    const participant = await CompetitionParticipant.findOne({
      competitionId,
      userId: session.user.id,
      status: 'active',
    });

    if (!participant || participant.currentOpenPositions === 0) {
      return { liquidated: false, marginLevel: Infinity };
    }

    // Load admin thresholds
    const adminThresholds = await getMarginThresholds();
    const thresholds = {
      liquidation: adminThresholds.LIQUIDATION,
      marginCall: adminThresholds.MARGIN_CALL,
      warning: adminThresholds.WARNING,
    };

    // Get all open positions
    const openPositions = await TradingPosition.find({
      participantId: participant._id,
      status: 'open',
    });

    // Calculate REAL-TIME unrealized P&L
    let totalUnrealizedPnl = 0;
    for (const position of openPositions) {
      const currentPrice = await getRealPrice(position.symbol as ForexSymbol);
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

    // Check margin status with real-time P&L
    const marginStatus = getMarginStatus(
      participant.currentCapital,
      totalUnrealizedPnl,
      participant.usedMargin,
      thresholds
    );

    console.log(`📊 User Margin Check: ${session.user.name} - ${marginStatus.marginLevel.toFixed(2)}% (${marginStatus.status})`);

    // Send margin notifications based on status
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      
      if (marginStatus.status === 'warning') {
        await notificationService.notifyMarginWarning(session.user.id, marginStatus.marginLevel);
      } else if (marginStatus.status === 'danger') {
        // 'danger' status indicates margin call
        await notificationService.notifyMarginCall(session.user.id, marginStatus.marginLevel);
      }
    } catch (notifError) {
      console.error('Error sending margin notification:', notifError);
    }

    // Auto-liquidate if needed
    if (marginStatus.status === 'liquidation') {
      console.log(`🚨 AUTO-LIQUIDATING ${openPositions.length} positions for ${session.user.name}`);

      // Send liquidation notifications
      try {
        const { notificationService } = await import('@/lib/services/notification.service');
        for (const position of openPositions) {
          await notificationService.notifyLiquidation(session.user.id, position.symbol);
        }
      } catch (notifError) {
        console.error('Error sending liquidation notification:', notifError);
      }

      for (const position of openPositions) {
        const currentPrice = await getRealPrice(position.symbol as ForexSymbol);
        if (!currentPrice) continue;

        const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
        await closePositionAutomatic(position._id.toString(), marketPrice, 'margin_call');
      }

      return {
        liquidated: true,
        marginLevel: marginStatus.marginLevel,
        positionsClosed: openPositions.length,
      };
    }

    return {
      liquidated: false,
      marginLevel: marginStatus.marginLevel,
      status: marginStatus.status,
    };
  } catch (error) {
    console.error('Error checking user margin:', error);
    return { liquidated: false, marginLevel: 100, error: true };
  }
};

