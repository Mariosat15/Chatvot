'use server';

import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/database/mongoose';
import TradingPosition from '@/database/models/trading/trading-position.model';
import TradingOrder from '@/database/models/trading/trading-order.model';
import TradeHistory from '@/database/models/trading/trade-history.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import mongoose from 'mongoose';
import { getParticipant, ContestType } from './contest-utils';
import {
  calculateUnrealizedPnL,
  calculatePnLPercentage,
  ForexSymbol,
} from '@/lib/services/pnl-calculator.service';
import { getRealPrice, isForexMarketOpen, getMarketStatus, getPriceFromCacheOnly } from '@/lib/services/real-forex-prices.service';
import { getMarginStatus } from '@/lib/services/risk-manager.service';

/**
 * Check if market is open and throw error if closed
 * Used for all user-initiated trading actions
 */
async function ensureMarketOpen(): Promise<void> {
  const isOpen = await isForexMarketOpen();
  if (!isOpen) {
    const status = getMarketStatus();
    throw new Error(`Market is currently closed. ${status}. Trading is not available until market opens.`);
  }
}

// Get user's open positions
export const getUserPositions = async (competitionId: string) => {
  // Disable caching to always fetch fresh position data (including TP/SL)
  noStore();
  
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    const positions = await TradingPosition.find({
      competitionId,
      userId: session.user.id,
      status: 'open',
    })
      .sort({ openedAt: -1 })
      .lean();

    // Update P&L for each position with current REAL prices
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positionsWithCurrentPnL = await Promise.all(positions.map(async (position: any) => {
      const currentPrice = await getRealPrice(position.symbol as ForexSymbol);
      if (currentPrice) {
        const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
        const pnl = calculateUnrealizedPnL(
          position.side,
          position.entryPrice,
          marketPrice,
          position.quantity,
          position.symbol as ForexSymbol
        );
        const pnlPercentage = calculatePnLPercentage(pnl, position.marginUsed);

        return {
          ...position,
          orderType: position.orderType || 'market', // Default to 'market' for old positions
          limitPrice: position.limitPrice,
          takeProfit: position.takeProfit,
          stopLoss: position.stopLoss,
          currentPrice: marketPrice,
          unrealizedPnl: pnl,
          unrealizedPnlPercentage: pnlPercentage,
        };
      }
      return {
        ...position,
        orderType: position.orderType || 'market', // Default to 'market' for old positions
        limitPrice: position.limitPrice,
        takeProfit: position.takeProfit,
        stopLoss: position.stopLoss,
      };
    }));

    // Debug: Log TP/SL data being returned
    console.log(`📊 Fetched ${positionsWithCurrentPnL.length} positions with TP/SL:`, 
      positionsWithCurrentPnL.map(p => ({
        id: p._id,
        symbol: p.symbol,
        hasTP: !!p.takeProfit,
        hasSL: !!p.stopLoss,
        tp: p.takeProfit,
        sl: p.stopLoss
      }))
    );

    return JSON.parse(JSON.stringify(positionsWithCurrentPnL));
  } catch (error) {
    console.error('Error getting positions:', error);
    throw new Error('Failed to get positions');
  }
};

// Update Take Profit and Stop Loss for a position
export const updatePositionTPSL = async (
  positionId: string,
  takeProfit: number | null,
  stopLoss: number | null
) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    // ⏰ Check if market is open
    console.log(`⏰ Checking market status for TP/SL modification...`);
    try {
      await ensureMarketOpen();
      console.log(`   ✅ Market is open`);
    } catch (marketError) {
      console.log(`   ❌ Market is closed - modification blocked`);
      return { 
        success: false, 
        error: marketError instanceof Error ? marketError.message : 'Market is closed' 
      };
    }

    // Check if user is restricted from trading
    console.log(`🔐 Checking trading restrictions for user ${session.user.id} (modify TP/SL)`);
    const { canUserPerformAction } = await import('@/lib/services/user-restriction.service');
    const restrictionCheck = await canUserPerformAction(session.user.id, 'trade');
    console.log(`   Restriction check result:`, restrictionCheck);

    if (!restrictionCheck.allowed) {
      console.log(`   ❌ Modification blocked due to restrictions`);
      return { 
        success: false, 
        error: restrictionCheck.reason || 'You are not allowed to modify trades' 
      };
    }
    console.log(`   ✅ User allowed to modify position`);

    await connectToDatabase();

    const position = await TradingPosition.findOne({
      _id: positionId,
      userId: session.user.id,
      status: 'open',
    });

    if (!position) {
      return { success: false, error: 'Position not found or already closed' };
    }

    // Update TP/SL
    position.takeProfit = takeProfit || undefined;
    position.stopLoss = stopLoss || undefined;
    await position.save();

    revalidatePath('/');

    return {
      success: true,
      message: 'TP/SL updated successfully',
      position: {
        _id: position._id.toString(),
        takeProfit: position.takeProfit,
        stopLoss: position.stopLoss,
      },
    };
  } catch (error) {
    console.error('Error updating TP/SL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update TP/SL',
    };
  }
};

// Close a position manually
export const closePosition = async (positionId: string) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    // ⏰ Check if market is open
    console.log(`⏰ Checking market status for closing position...`);
    await ensureMarketOpen();
    console.log(`   ✅ Market is open`);

    // Check if user is restricted from trading
    console.log(`🔐 Checking trading restrictions for user ${session.user.id} (close position)`);
    const { canUserPerformAction } = await import('@/lib/services/user-restriction.service');
    const restrictionCheck = await canUserPerformAction(session.user.id, 'trade');
    console.log(`   Restriction check result:`, restrictionCheck);

    if (!restrictionCheck.allowed) {
      console.log(`   ❌ Close position blocked due to restrictions`);
      throw new Error(restrictionCheck.reason || 'You are not allowed to close trades');
    }
    console.log(`   ✅ User allowed to close position`);

    await connectToDatabase();

    const position = await TradingPosition.findOne({
      _id: positionId,
      userId: session.user.id,
      status: 'open',
    });

    if (!position) {
      throw new Error('Position not found or already closed');
    }

    // Get current REAL market price
    const currentPrice = await getRealPrice(position.symbol as ForexSymbol);
    if (!currentPrice) {
      throw new Error('Unable to get current market price. Market may be closed or API unavailable.');
    }

    const exitPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;

    // Calculate spread costs
    const entrySpread = position.entryPrice * 0.0001; // Approximate entry spread (we don't store it)
    const exitSpread = currentPrice.spread; // Current spread at exit
    const spreadCostInPips = (entrySpread + exitSpread) / 0.0001; // Total spread in pips
    const spreadCostInUSD = (entrySpread + exitSpread) * position.quantity * 100000; // Spread cost in USD

    // Calculate final P&L
    const realizedPnl = calculateUnrealizedPnL(
      position.side,
      position.entryPrice,
      exitPrice,
      position.quantity,
      position.symbol as ForexSymbol
    );
    const realizedPnlPercentage = calculatePnLPercentage(realizedPnl, position.marginUsed);

    // Start MongoDB transaction
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // Update position
      position.status = 'closed';
      position.closeReason = 'user';
      position.currentPrice = exitPrice;
      position.closedAt = new Date();
      position.holdingTimeSeconds = Math.floor(
        (position.closedAt.getTime() - position.openedAt.getTime()) / 1000
      );
      await position.save({ session: mongoSession });

      // Create close order record
      const closeOrder = await TradingOrder.create(
        [
          {
            competitionId: position.competitionId,
            userId: position.userId,
            participantId: position.participantId,
            symbol: position.symbol,
            side: position.side === 'long' ? 'sell' : 'buy',
            orderType: 'market',
            quantity: position.quantity,
            executedPrice: exitPrice,
            leverage: position.leverage,
            marginRequired: 0,
            status: 'filled',
            filledQuantity: position.quantity,
            remainingQuantity: 0,
            placedAt: new Date(),
            executedAt: new Date(),
            orderSource: 'web',
            positionId: position._id.toString(),
          },
        ],
        { session: mongoSession }
      );

      position.closeOrderId = closeOrder[0]._id.toString();
      await position.save({ session: mongoSession });

      // Create trade history
      const tradeHistory = await TradeHistory.create(
        [
          {
            competitionId: position.competitionId,
            userId: position.userId,
            participantId: position.participantId,
            symbol: position.symbol,
            side: position.side,
            quantity: position.quantity,
            orderType: position.orderType || 'market',
            limitPrice: position.limitPrice,
            entryPrice: position.entryPrice,
            exitPrice: exitPrice,
            priceChange: exitPrice - position.entryPrice,
            priceChangePercentage: ((exitPrice - position.entryPrice) / position.entryPrice) * 100,
            realizedPnl,
            realizedPnlPercentage,
            entrySpread: entrySpread,
            exitSpread: exitSpread,
            commission: 0, // No commission in simulation
            swap: 0, // No swap in short-term trades
            totalCosts: spreadCostInUSD,
            netPnl: realizedPnl, // Net P&L is same as realized (spread already included in bid/ask)
            openedAt: position.openedAt,
            closedAt: position.closedAt,
            holdingTimeSeconds: position.holdingTimeSeconds,
            closeReason: 'user',
            leverage: position.leverage,
            marginUsed: position.marginUsed,
            hadStopLoss: !!position.stopLoss,
            stopLossPrice: position.stopLoss,
            hadTakeProfit: !!position.takeProfit,
            takeProfitPrice: position.takeProfit,
            openOrderId: position.openOrderId,
            closeOrderId: closeOrder[0]._id.toString(),
            positionId: position._id.toString(),
            isWinner: realizedPnl > 0,
          },
        ],
        { session: mongoSession }
      );

      position.tradeHistoryId = tradeHistory[0]._id.toString();
      await position.save({ session: mongoSession });

      // Detect contest type and get participant
      const contestInfo = await getParticipant(position.competitionId, position.userId);
      const contestType: ContestType = contestInfo?.type || 'competition';
      const ParticipantModel = contestType === 'competition' ? CompetitionParticipant : ChallengeParticipant;
      
      // Update participant
      const participant = await ParticipantModel.findById(position.participantId).session(
        mongoSession
      );
      if (!participant) throw new Error('Participant not found');

      const newCapital = participant.currentCapital + realizedPnl;
      const newAvailableCapital = participant.availableCapital + position.marginUsed + realizedPnl;
      const newRealizedPnl = participant.realizedPnl + realizedPnl;
      const newPnl = participant.pnl + realizedPnl;
      const newPnlPercentage = ((newCapital - participant.startingCapital) / participant.startingCapital) * 100;

      // Log trade details for transparency
      console.log('💰 POSITION CLOSED:');
      console.log(`   Symbol: ${position.symbol}`);
      console.log(`   Side: ${position.side.toUpperCase()}`);
      console.log(`   Quantity: ${position.quantity} lots`);
      console.log(`   Entry Price: ${position.entryPrice.toFixed(5)}`);
      console.log(`   Exit Price: ${exitPrice.toFixed(5)}`);
      console.log(`   📊 Spread Costs:`);
      console.log(`      Entry Spread: ${(entrySpread * 10000).toFixed(1)} pips`);
      console.log(`      Exit Spread: ${(exitSpread * 10000).toFixed(1)} pips`);
      console.log(`      Total Spread Cost: ${spreadCostInPips.toFixed(1)} pips ($${spreadCostInUSD.toFixed(2)})`);
      console.log(`   Realized P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} (${realizedPnlPercentage.toFixed(2)}%)`);
      console.log(`   Note: P&L already includes spread costs (you bought at ASK, sold at BID)`);
      console.log(`   Margin Released: $${position.marginUsed.toFixed(2)}`);
      console.log(`   Previous Available Capital: $${participant.availableCapital.toFixed(2)}`);
      console.log(`   New Available Capital: $${newAvailableCapital.toFixed(2)} (${realizedPnl >= 0 ? 'PROFIT ADDED ✅' : 'LOSS DEDUCTED ❌'})`);

      const isWinner = realizedPnl > 0;
      const winningTrades = participant.winningTrades + (isWinner ? 1 : 0);
      const losingTrades = participant.losingTrades + (isWinner ? 0 : 1);
      const totalTrades = participant.totalTrades + 1; // INCREMENT total trades!
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

      // Update averages
      const averageWin = winningTrades > 0
        ? (participant.averageWin * participant.winningTrades + (isWinner ? realizedPnl : 0)) / winningTrades
        : 0;
      const averageLoss = losingTrades > 0
        ? (participant.averageLoss * participant.losingTrades + (!isWinner ? Math.abs(realizedPnl) : 0)) / losingTrades
        : 0;

      await ParticipantModel.findByIdAndUpdate(
        participant._id,
        {
          $inc: {
            currentOpenPositions: -1,
            totalTrades: 1, // INCREMENT total trades!
            winningTrades: isWinner ? 1 : 0,
            losingTrades: isWinner ? 0 : 1,
          },
          $set: {
            currentCapital: newCapital,
            availableCapital: newAvailableCapital,
            usedMargin: participant.usedMargin - position.marginUsed,
            realizedPnl: newRealizedPnl,
            pnl: newPnl,
            pnlPercentage: newPnlPercentage,
            winRate: winRate,
            averageWin: averageWin,
            averageLoss: averageLoss,
            largestWin: Math.max(participant.largestWin, realizedPnl),
            largestLoss: Math.min(participant.largestLoss, realizedPnl),
          },
        },
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();

      console.log(`✅ Position closed: ${position.symbol}, P&L: $${realizedPnl.toFixed(2)}`);

      // Evaluate badges for the user (fire and forget - don't wait)
      try {
        const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
        evaluateUserBadges(session.user.id).then(result => {
          if (result.newBadges.length > 0) {
            console.log(`🏅 User earned ${result.newBadges.length} new badges after closing position`);
          }
        }).catch(err => console.error('Error evaluating badges:', err));
      } catch (error) {
        console.error('Error importing badge service:', error);
      }

      // Update behavioral trading profile and check for mirror trading + similarity (fire and forget)
      try {
        const { BehavioralAnalysisService } = await import('@/lib/services/fraud/behavioral-analysis.service');
        const { MirrorTradingService } = await import('@/lib/services/fraud/mirror-trading.service');
        const { SimilarityDetectionService } = await import('@/lib/services/fraud/similarity-detection.service');
        
        const tradeData = {
          tradeId: tradeHistory[0]._id.toString(),
          pair: position.symbol,
          direction: position.side === 'long' ? 'buy' as const : 'sell' as const,
          openTime: position.openedAt,
          closeTime: position.closedAt,
          lotSize: position.quantity,
          pnl: realizedPnl,
          pips: position.side === 'long' 
            ? (exitPrice - position.entryPrice) * 10000 
            : (position.entryPrice - exitPrice) * 10000,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit
        };
        
        // Update trading behavior profile
        BehavioralAnalysisService.updateProfileOnTrade(session.user.id, tradeData)
          .then(async () => {
            console.log('📊 Trading behavior profile updated');
            
            // After updating profile, check similarity with other users who traded same pair
            try {
              const TradingBehaviorProfile = (await import('@/database/models/fraud/trading-behavior-profile.model')).default;
              const otherProfiles = await TradingBehaviorProfile.find({
                userId: { $ne: session.user.id },
                'patterns.preferredPairs': position.symbol
              }).limit(20).select('userId');
              
              console.log(`📊 Found ${otherProfiles.length} other users who trade ${position.symbol}`);
              
              for (const other of otherProfiles) {
                SimilarityDetectionService.calculateSimilarity(
                  session.user.id, 
                  other.userId.toString()
                ).then(result => {
                  if (result.similarityScore >= 0.7) {
                    console.log(`📊 HIGH SIMILARITY: ${(result.similarityScore * 100).toFixed(1)}% with ${other.userId.toString().substring(0, 8)}...`);
                  }
                }).catch(err => console.error('Error calculating similarity:', err));
              }
            } catch (err) {
              console.error('Error in similarity check:', err);
            }
          })
          .catch(err => console.error('Error updating trading profile:', err));
        
        // Real-time mirror trading check
        MirrorTradingService.checkRealTimeMirrorTrading(session.user.id, tradeData)
          .then(() => console.log('🪞 Mirror trading check completed'))
          .catch(err => console.error('Error checking mirror trading:', err));
      } catch (error) {
        console.error('Error in behavioral analysis:', error);
      }

      // Revalidate appropriate paths based on contest type
      if (contestType === 'competition') {
        revalidatePath(`/competitions/${position.competitionId}/trade`);
        revalidatePath(`/competitions/${position.competitionId}`);
      } else {
        revalidatePath(`/challenges/${position.competitionId}/trade`);
        revalidatePath(`/challenges/${position.competitionId}`);
      }

      return {
        success: true,
        realizedPnl,
        message: `Position closed. ${realizedPnl >= 0 ? 'Profit' : 'Loss'}: $${Math.abs(realizedPnl).toFixed(2)}`,
      };
    } catch (error) {
      await mongoSession.abortTransaction();
      throw error;
    } finally {
      mongoSession.endSession();
    }
  } catch (error) {
    console.error('Error closing position:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to close position');
  }
};

// Update all positions P&L (called periodically)
export const updateAllPositionsPnL = async (competitionId: string, userId: string) => {
  try {
    await connectToDatabase();

    const positions = await TradingPosition.find({
      competitionId,
      userId,
      status: 'open',
    });

    let totalUnrealizedPnl = 0;

    for (const position of positions) {
      // Use cached price first (instant, 0 API calls)
      let currentPrice = getPriceFromCacheOnly(position.symbol as ForexSymbol);
      if (!currentPrice) {
        currentPrice = await getRealPrice(position.symbol as ForexSymbol);
      }
      if (!currentPrice) continue;

      const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
      const pnl = calculateUnrealizedPnL(
        position.side,
        position.entryPrice,
        marketPrice,
        position.quantity,
        position.symbol as ForexSymbol
      );
      const pnlPercentage = calculatePnLPercentage(pnl, position.marginUsed);

      position.currentPrice = marketPrice;
      position.unrealizedPnl = pnl;
      position.unrealizedPnlPercentage = pnlPercentage;
      position.lastPriceUpdate = new Date();
      position.priceUpdateCount += 1;
      await position.save();

      totalUnrealizedPnl += pnl;
    }

    // Update participant's unrealized P&L (try competition first, then challenge)
    let participant = await CompetitionParticipant.findOne({
      competitionId,
      userId,
    });

    if (!participant) {
      participant = await ChallengeParticipant.findOne({
        challengeId: competitionId,
        userId,
      });
    }

    if (participant) {
      const newPnl = participant.realizedPnl + totalUnrealizedPnl;
      const newPnlPercentage =
        ((participant.currentCapital + totalUnrealizedPnl - participant.startingCapital) /
          participant.startingCapital) *
        100;

      participant.unrealizedPnl = totalUnrealizedPnl;
      participant.pnl = newPnl;
      participant.pnlPercentage = newPnlPercentage;
      await participant.save();
    }

    return { success: true, totalUnrealizedPnl };
  } catch (error) {
    console.error('Error updating positions P&L:', error);
    return { success: false, totalUnrealizedPnl: 0 };
  }
};

// Check stop loss and take profit levels (background process)
export const checkStopLossTakeProfit = async (competitionId: string) => {
  try {
    await connectToDatabase();

    const positions = await TradingPosition.find({
      competitionId,
      status: 'open',
      $or: [{ stopLoss: { $exists: true, $ne: null } }, { takeProfit: { $exists: true, $ne: null } }],
    });

    for (const position of positions) {
      // Use cached price first (instant), fallback to REST if needed
      let currentPrice = getPriceFromCacheOnly(position.symbol as ForexSymbol);
      if (!currentPrice) {
        currentPrice = await getRealPrice(position.symbol as ForexSymbol);
      }
      if (!currentPrice) continue;

      const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;

      let shouldClose = false;
      let closeReason: 'stop_loss' | 'take_profit' | undefined;

      // Check stop loss
      if (position.stopLoss) {
        if (position.side === 'long' && marketPrice <= position.stopLoss) {
          shouldClose = true;
          closeReason = 'stop_loss';
        } else if (position.side === 'short' && marketPrice >= position.stopLoss) {
          shouldClose = true;
          closeReason = 'stop_loss';
        }
      }

      // Check take profit
      if (!shouldClose && position.takeProfit) {
        if (position.side === 'long' && marketPrice >= position.takeProfit) {
          shouldClose = true;
          closeReason = 'take_profit';
        } else if (position.side === 'short' && marketPrice <= position.takeProfit) {
          shouldClose = true;
          closeReason = 'take_profit';
        }
      }

      if (shouldClose && closeReason) {
        // Close position automatically
        await closePositionAutomatic(position._id.toString(), marketPrice, closeReason);
        console.log(`✅ Auto-closed position: ${position.symbol}, reason: ${closeReason}`);
      }
    }
  } catch (error) {
    console.error('Error checking SL/TP:', error);
  }
};

// Close position automatically (SL/TP/Liquidation)
export async function closePositionAutomatic(
  positionId: string,
  exitPrice: number,
  closeReason: 'stop_loss' | 'take_profit' | 'margin_call'
) {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const position = await TradingPosition.findById(positionId).session(mongoSession);
    if (!position || position.status !== 'open') {
      await mongoSession.abortTransaction();
      return;
    }

    const realizedPnl = calculateUnrealizedPnL(
      position.side,
      position.entryPrice,
      exitPrice,
      position.quantity,
      position.symbol as ForexSymbol
    );
    const realizedPnlPercentage = calculatePnLPercentage(realizedPnl, position.marginUsed);

    // Update position
    position.status = closeReason === 'margin_call' ? 'liquidated' : 'closed';
    position.closeReason = closeReason;
    position.currentPrice = exitPrice;
    position.closedAt = new Date();
    position.holdingTimeSeconds = Math.floor(
      (position.closedAt.getTime() - position.openedAt.getTime()) / 1000
    );
    await position.save({ session: mongoSession });

    // Create close order
    const closeOrder = await TradingOrder.create(
      [
        {
          competitionId: position.competitionId,
          userId: position.userId,
          participantId: position.participantId,
          symbol: position.symbol,
          side: position.side === 'long' ? 'sell' : 'buy',
          orderType: 'market',
          quantity: position.quantity,
          executedPrice: exitPrice,
          leverage: position.leverage,
          marginRequired: 0,
          status: 'filled',
          filledQuantity: position.quantity,
          remainingQuantity: 0,
          placedAt: new Date(),
          executedAt: new Date(),
          orderSource: 'system',
          positionId: position._id.toString(),
        },
      ],
      { session: mongoSession }
    );

    position.closeOrderId = closeOrder[0]._id.toString();
    await position.save({ session: mongoSession });

    // Create trade history
    const tradeHistory = await TradeHistory.create(
      [
        {
          competitionId: position.competitionId,
          userId: position.userId,
          participantId: position.participantId,
          symbol: position.symbol,
          side: position.side,
          quantity: position.quantity,
          entryPrice: position.entryPrice,
          exitPrice: exitPrice,
          priceChange: exitPrice - position.entryPrice,
          priceChangePercentage: ((exitPrice - position.entryPrice) / position.entryPrice) * 100,
          realizedPnl,
          realizedPnlPercentage,
          openedAt: position.openedAt,
          closedAt: position.closedAt,
          holdingTimeSeconds: position.holdingTimeSeconds,
          closeReason,
          leverage: position.leverage,
          marginUsed: position.marginUsed,
          hadStopLoss: !!position.stopLoss,
          stopLossPrice: position.stopLoss,
          hadTakeProfit: !!position.takeProfit,
          takeProfitPrice: position.takeProfit,
          openOrderId: position.openOrderId,
          closeOrderId: closeOrder[0]._id.toString(),
          positionId: position._id.toString(),
          isWinner: realizedPnl > 0,
        },
      ],
      { session: mongoSession }
    );

    position.tradeHistoryId = tradeHistory[0]._id.toString();
    await position.save({ session: mongoSession });

    // Detect contest type and use correct participant model
    const contestInfoForSLTP = await getParticipant(position.competitionId, position.userId);
    const contestTypeForSLTP: ContestType = contestInfoForSLTP?.type || 'competition';
    const ParticipantModelForSLTP = contestTypeForSLTP === 'competition' ? CompetitionParticipant : ChallengeParticipant;
    
    // Update participant
    const participant = await ParticipantModelForSLTP.findById(position.participantId).session(
      mongoSession
    );
    if (!participant) throw new Error('Participant not found');

    const newCapital = participant.currentCapital + realizedPnl;
    const newAvailableCapital = participant.availableCapital + position.marginUsed + realizedPnl;
    const newRealizedPnl = participant.realizedPnl + realizedPnl;
    const newPnl = participant.pnl + realizedPnl;
    const newPnlPercentage =
      ((newCapital - participant.startingCapital) / participant.startingCapital) * 100;

    const isWinner = realizedPnl > 0;
    const winningTrades = participant.winningTrades + (isWinner ? 1 : 0);
    const losingTrades = participant.losingTrades + (isWinner ? 0 : 1);
    const totalTrades = participant.totalTrades + 1; // INCREMENT total trades!
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const averageWin =
      winningTrades > 0
        ? (participant.averageWin * participant.winningTrades + (isWinner ? realizedPnl : 0)) / winningTrades
        : 0;
    const averageLoss =
      losingTrades > 0
        ? (participant.averageLoss * participant.losingTrades + (!isWinner ? Math.abs(realizedPnl) : 0)) /
          losingTrades
        : 0;

    await ParticipantModelForSLTP.findByIdAndUpdate(
      participant._id,
      {
        $inc: {
          currentOpenPositions: -1,
          totalTrades: 1, // INCREMENT total trades!
          winningTrades: isWinner ? 1 : 0,
          losingTrades: isWinner ? 0 : 1,
          marginCallWarnings: closeReason === 'margin_call' ? 1 : 0,
        },
        $set: {
          currentCapital: newCapital,
          availableCapital: newAvailableCapital,
          usedMargin: participant.usedMargin - position.marginUsed,
          realizedPnl: newRealizedPnl,
          pnl: newPnl,
          pnlPercentage: newPnlPercentage,
          winRate: winRate,
          averageWin: averageWin,
          averageLoss: averageLoss,
          largestWin: Math.max(participant.largestWin, realizedPnl),
          largestLoss: Math.min(participant.largestLoss, realizedPnl),
          status: closeReason === 'margin_call' && newCapital <= 0 ? 'liquidated' : participant.status,
          liquidationReason: closeReason === 'margin_call' && newCapital <= 0 ? 'Margin call' : undefined,
          lastMarginCallAt: closeReason === 'margin_call' ? new Date() : participant.lastMarginCallAt,
        },
      },
      { session: mongoSession }
    );

    await mongoSession.commitTransaction();
    
    // Send notifications based on close reason
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      
      if (closeReason === 'stop_loss') {
        await notificationService.notifyStopLossTriggered(
          position.userId,
          position.symbol,
          exitPrice,
          realizedPnl
        );
      } else if (closeReason === 'take_profit') {
        await notificationService.notifyTakeProfitTriggered(
          position.userId,
          position.symbol,
          exitPrice,
          realizedPnl
        );
      }
      
      // Also send position closed notification
      await notificationService.notifyPositionClosed(
        position.userId,
        position.symbol,
        realizedPnl,
        realizedPnlPercentage
      );
    } catch (notifError) {
      console.error('Error sending position close notification:', notifError);
    }
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
}

// Check for margin calls and liquidate if necessary
export const checkMarginCalls = async (competitionId: string) => {
  try {
    await connectToDatabase();

    // Load admin-configured thresholds
    const { getMarginThresholds } = await import('@/lib/actions/trading/risk-settings.actions');
    const adminThresholds = await getMarginThresholds();
    
    const thresholds = {
      liquidation: adminThresholds.LIQUIDATION,
      marginCall: adminThresholds.MARGIN_CALL,
      warning: adminThresholds.WARNING,
    };

    console.log(`\n🔍 ========== MARGIN CHECK START ==========`);
    console.log(`📊 Competition ID: ${competitionId}`);
    console.log(`⚙️  Admin Thresholds:`, thresholds);

    // First, get ALL participants to see what we have (try competition, then challenge)
    let allParticipants = await CompetitionParticipant.find({
      competitionId,
    }).select('username status currentOpenPositions currentCapital unrealizedPnl usedMargin');
    
    let isChallenge = false;
    if (allParticipants.length === 0) {
      allParticipants = await ChallengeParticipant.find({
        challengeId: competitionId,
      }).select('username status currentOpenPositions currentCapital unrealizedPnl usedMargin');
      isChallenge = true;
    }

    console.log(`\n📋 All Participants (${allParticipants.length}):`);
    for (const p of allParticipants) {
      console.log(`   - ${p.username}: Status=${p.status}, OpenPositions=${p.currentOpenPositions}, Capital=$${p.currentCapital.toFixed(2)}, UsedMargin=$${p.usedMargin.toFixed(2)}`);
    }

    const ParticipantModel = isChallenge ? ChallengeParticipant : CompetitionParticipant;
    const idField = isChallenge ? { challengeId: competitionId } : { competitionId };
    
    const participants = await ParticipantModel.find({
      ...idField,
      status: 'active',
      currentOpenPositions: { $gt: 0 },
    });

    console.log(`\n✅ Active participants with open positions: ${participants.length}`);

    for (const participant of participants) {
      console.log(`\n👤 Checking: ${participant.username}`);
      console.log(`   💰 Current Capital (DB): $${participant.currentCapital.toFixed(2)}`);
      console.log(`   📈 Unrealized P&L (DB): $${participant.unrealizedPnl.toFixed(2)}`);
      console.log(`   🔒 Used Margin (DB): $${participant.usedMargin.toFixed(2)}`);
      
      // RECALCULATE unrealized P&L from actual open positions (real-time)
      const openPositions = await TradingPosition.find({
        participantId: participant._id,
        status: 'open',
      });
      
      console.log(`   📊 Found ${openPositions.length} open positions`);
      
      let totalUnrealizedPnl = 0;
      for (const position of openPositions) {
        // Use cached price first (instant, 0 API calls), fallback to REST if needed
        let currentPrice = getPriceFromCacheOnly(position.symbol as ForexSymbol);
        if (!currentPrice) {
          currentPrice = await getRealPrice(position.symbol as ForexSymbol);
        }
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
      
      console.log(`   🔄 REAL-TIME Unrealized P&L: $${totalUnrealizedPnl.toFixed(2)}`);
      
      const equity = participant.currentCapital + totalUnrealizedPnl;
      const calculatedMarginLevel = participant.usedMargin > 0 
        ? (equity / participant.usedMargin) * 100 
        : Infinity;
      
      console.log(`   💎 Equity (Real-time): $${equity.toFixed(2)}`);
      console.log(`   📊 Calculated Margin Level (Real-time): ${calculatedMarginLevel.toFixed(2)}%`);
      
      // Use REAL-TIME P&L for margin status check
      const marginStatus = getMarginStatus(
        participant.currentCapital,
        totalUnrealizedPnl, // Use real-time P&L, not stale DB value
        participant.usedMargin,
        thresholds
      );

      console.log(`   ⚠️  Status: ${marginStatus.status}`);
      console.log(`   🎯 Threshold Check: ${marginStatus.marginLevel.toFixed(2)}% < ${thresholds.liquidation}% ? ${marginStatus.marginLevel < thresholds.liquidation}`);

      if (marginStatus.status === 'liquidation') {
        // Liquidate all positions
        const positions = await TradingPosition.find({
          participantId: participant._id,
          status: 'open',
        });

        console.log(`🚨 LIQUIDATING ${positions.length} positions for ${participant.username} (Margin: ${marginStatus.marginLevel.toFixed(2)}%)`);

        for (const position of positions) {
          // Use cached price first, fallback to REST
          let currentPrice = getPriceFromCacheOnly(position.symbol as ForexSymbol);
          if (!currentPrice) {
            currentPrice = await getRealPrice(position.symbol as ForexSymbol);
          }
          if (!currentPrice) continue;

          const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
          await closePositionAutomatic(position._id.toString(), marketPrice, 'margin_call');
        }

        console.log(`   ⚠️ ✅ Liquidated all ${positions.length} positions for: ${participant.username}`);
      } else {
        console.log(`   ✅ No liquidation needed (Status: ${marginStatus.status})`);
      }
    }
    
    console.log(`\n🔍 ========== MARGIN CHECK END ==========\n`);
  } catch (error) {
    console.error('❌ Error checking margin calls:', error);
    console.error('❌ Stack:', error instanceof Error ? error.stack : error);
  }
};

