'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/database/mongoose';
import TradingOrder from '@/database/models/trading/trading-order.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import { getContestAndParticipant, getParticipantModel } from './contest-utils';
import mongoose from 'mongoose';
import {
  calculateMarginRequired,
  validateQuantity,
  validateSLTP,
  ForexSymbol,
  FOREX_PAIRS,
} from '@/lib/services/pnl-calculator.service';
import { validateNewOrder } from '@/lib/services/risk-manager.service';
import { getRealPrice, fetchRealForexPrices, isForexMarketOpen, getMarketStatus } from '@/lib/services/real-forex-prices.service';
import { validateLimitOrderPrice } from '@/lib/utils/limit-order-validation';
import PriceLog from '@/database/models/trading/price-log.model';

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

/**
 * Check competition risk limits (max drawdown and daily loss)
 * Returns { allowed: boolean, reason?: string }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkCompetitionRiskLimits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  participant: any
): Promise<{ allowed: boolean; reason?: string }> {
  // Check if risk limits are enabled for this competition
  if (!competition.riskLimits?.enabled) {
    console.log(`📊 [RISK] Risk limits NOT enabled for this competition`);
    return { allowed: true };
  }

  const startingCapital = competition.startingCapital;
  const currentCapital = participant.currentCapital; // Fixed: was currentBalance
  
  console.log(`📊 [RISK] Checking limits - Starting: $${startingCapital}, Current: $${currentCapital}`);
  
  // 1. Check Max Drawdown (from starting capital)
  const maxDrawdownPercent = competition.riskLimits.maxDrawdownPercent || 50;
  const maxDrawdownThreshold = startingCapital * (1 - maxDrawdownPercent / 100);
  const currentDrawdownPercent = ((startingCapital - currentCapital) / startingCapital) * 100;
  
  console.log(`   Max Drawdown: ${maxDrawdownPercent}% | Current Drawdown: ${currentDrawdownPercent.toFixed(2)}%`);
  console.log(`   Balance Threshold: $${maxDrawdownThreshold.toFixed(2)} | Current: $${currentCapital.toFixed(2)}`);
  
  if (currentCapital <= maxDrawdownThreshold) {
    console.log(`🛑 [RISK] Max drawdown exceeded: Balance $${currentCapital.toFixed(2)} <= Threshold $${maxDrawdownThreshold.toFixed(2)} (${maxDrawdownPercent}% limit)`);
    return {
      allowed: false,
      reason: `🛑 Trading blocked: Max drawdown limit reached!\n\nYour balance ($${currentCapital.toFixed(2)}) has dropped ${currentDrawdownPercent.toFixed(2)}% from starting capital ($${startingCapital}).\n\nLimit: ${maxDrawdownPercent}%\nYour loss: ${currentDrawdownPercent.toFixed(2)}%`
    };
  }

  // 2. Check Daily Loss Limit
  const dailyLossLimitPercent = competition.riskLimits.dailyLossLimitPercent || 20;
  
  // Calculate today's start balance (at 00:00 UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  // Get closed positions from today
  const TradingPosition = (await import('@/database/models/trading/trading-position.model')).default;
  const todaysClosedPositions = await TradingPosition.find({
    participantId: participant._id,
    competitionId: competition._id,
    status: 'closed',
    closedAt: { $gte: today }
  });

  // Calculate today's realized PnL
  const todaysRealizedPnL = todaysClosedPositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
  const dailyLossPercent = todaysRealizedPnL < 0 ? (Math.abs(todaysRealizedPnL) / startingCapital) * 100 : 0;
  
  // Daily loss threshold amount (as positive number for comparison)
  const dailyLossThresholdAmount = startingCapital * dailyLossLimitPercent / 100;
  
  console.log(`   Daily Loss Limit: ${dailyLossLimitPercent}% ($${dailyLossThresholdAmount.toFixed(2)})`);
  console.log(`   Today's Realized PnL: $${todaysRealizedPnL.toFixed(2)} (${dailyLossPercent.toFixed(2)}% loss)`);
  
  if (todaysRealizedPnL < 0 && Math.abs(todaysRealizedPnL) >= dailyLossThresholdAmount) {
    console.log(`🛑 [RISK] Daily loss limit exceeded: Today's loss $${Math.abs(todaysRealizedPnL).toFixed(2)} >= Limit $${dailyLossThresholdAmount.toFixed(2)}`);
    return {
      allowed: false,
      reason: `🛑 Trading blocked for today: Daily loss limit reached!\n\nToday's loss: $${Math.abs(todaysRealizedPnL).toFixed(2)} (${dailyLossPercent.toFixed(2)}%)\nDaily limit: ${dailyLossLimitPercent}% ($${dailyLossThresholdAmount.toFixed(2)})\n\nTrading will resume tomorrow at 00:00 UTC.`
    };
  }

  // 3. Check Equity Drawdown (includes unrealized PnL - Anti-Fraud)
  if (competition.riskLimits?.equityCheckEnabled) {
    const equityDrawdownPercent = competition.riskLimits.equityDrawdownPercent || 30;
    
    // Calculate current equity (balance + unrealized PnL)
    const TradingPosition = (await import('@/database/models/trading/trading-position.model')).default;
    const openPositions = await TradingPosition.find({
      participantId: participant._id,
      competitionId: competition._id,
      status: 'open'
    });

    // Calculate unrealized PnL for all open positions
    let totalUnrealizedPnL = 0;
    
    if (openPositions.length > 0) {
      // OPTIMIZATION: Fetch all prices at once (instead of one by one in loop!)
      const uniqueSymbols = [...new Set(openPositions.map(p => p.symbol))] as ForexSymbol[];
      const pricesMap = await fetchRealForexPrices(uniqueSymbols);
      
      for (const position of openPositions) {
        try {
          const currentPrice = pricesMap.get(position.symbol as ForexSymbol);
          if (currentPrice) {
            const exitPrice = position.side === 'buy' ? currentPrice.bid : currentPrice.ask;
            const priceDiff = position.side === 'buy' 
              ? exitPrice - position.entryPrice 
              : position.entryPrice - exitPrice;
            
            // Standard lot size for forex is 100,000 units
            const positionUnrealizedPnL = priceDiff * position.quantity * 100000;
            totalUnrealizedPnL += positionUnrealizedPnL;
          }
        } catch (e) {
          console.warn(`Could not get price for ${position.symbol}, using last known PnL`);
          totalUnrealizedPnL += position.unrealizedPnL || 0;
        }
      }
    }

    const currentEquity = currentCapital + totalUnrealizedPnL;
    const equityThreshold = startingCapital * (1 - equityDrawdownPercent / 100);
    
    console.log(`📊 [RISK] Equity check: Balance=${currentCapital.toFixed(2)}, Unrealized=${totalUnrealizedPnL.toFixed(2)}, Equity=${currentEquity.toFixed(2)}, Threshold=${equityThreshold.toFixed(2)}`);
    
    if (currentEquity <= equityThreshold) {
      const equityLossPercent = ((1 - currentEquity / startingCapital) * 100).toFixed(1);
      console.log(`🛑 [RISK] Equity drawdown exceeded: Equity ${currentEquity.toFixed(2)} <= Threshold ${equityThreshold.toFixed(2)} (${equityDrawdownPercent}% of starting ${startingCapital})`);
      return {
        allowed: false,
        reason: `Trading blocked: Your equity (balance + unrealized P&L) is ${equityLossPercent}% below starting capital, exceeding the ${equityDrawdownPercent}% limit. Current equity: $${currentEquity.toFixed(2)}. Close some positions to continue trading.`
      };
    }
  }

  console.log(`✅ [RISK] Risk limits check passed - Drawdown: ${((startingCapital - currentCapital) / startingCapital * 100).toFixed(1)}%/${maxDrawdownPercent}%, Daily Loss: $${Math.abs(todaysRealizedPnL).toFixed(2)}/$${dailyLossThresholdAmount.toFixed(2)}`);
  
  return { allowed: true };
}

// Place a new order
// lockedPrice: Optional - locked bid/ask from frontend at the moment user clicked trade
export const placeOrder = async (params: {
  competitionId: string;
  symbol: ForexSymbol;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  lockedPrice?: { bid: number; ask: number; timestamp: number };
}) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    // ⏰ Check if market is open (required for ALL order types)
    console.log(`⏰ Checking market status for placing ${params.orderType} order...`);
    await ensureMarketOpen();
    console.log(`   ✅ Market is open`);

    await connectToDatabase();

    // ✅ CHECK USER RESTRICTIONS
    console.log(`🔐 Checking trading restrictions for user ${session.user.id}`);
    const { canUserPerformAction } = await import('@/lib/services/user-restriction.service');
    const restrictionCheck = await canUserPerformAction(session.user.id, 'trade');
    
    console.log(`   Restriction check result:`, restrictionCheck);
    
    if (!restrictionCheck.allowed) {
      console.log(`   ❌ Trade blocked due to restrictions`);
      throw new Error(restrictionCheck.reason || 'You are not allowed to trade');
    }
    
    console.log(`   ✅ User allowed to trade`);

    const {
      competitionId,
      symbol,
      side,
      orderType,
      quantity,
      limitPrice,
      stopLoss,
      takeProfit,
      leverage: userLeverage,
    } = params;

    // Get contest (competition or challenge) and participant
    const contestData = await getContestAndParticipant(competitionId, session.user.id);
    if (!contestData) {
      throw new Error('Contest not found or you are not a participant');
    }

    const { type: contestType, contest, participant } = contestData;

    // Check contest is active
    if (contestData.status !== 'active') {
      throw new Error(`${contestType === 'competition' ? 'Competition' : 'Challenge'} is not active`);
    }

    if (participant.status !== 'active') {
      throw new Error('Your participation status is not active');
    }

    // ✅ CHECK RISK LIMITS (Max Drawdown & Daily Loss) - Only for competitions with risk limits
    console.log(`📊 Checking ${contestType} risk limits...`);
    if (contestData.riskLimits?.enabled) {
      const riskLimitCheck = await checkCompetitionRiskLimits(contest, participant);
      if (!riskLimitCheck.allowed) {
        console.log(`   ❌ Trade blocked due to risk limits: ${riskLimitCheck.reason}`);
        throw new Error(riskLimitCheck.reason);
      }
    }
    console.log(`   ✅ Risk limits check passed`);

    // Validate quantity
    const quantityValidation = validateQuantity(quantity);
    if (!quantityValidation.valid) {
      throw new Error(quantityValidation.error);
    }

    // Validate symbol is in competition's allowed assets
    if (!FOREX_PAIRS[symbol]) {
      throw new Error(`Invalid forex pair: ${symbol}`);
    }

    // Determine price to use for execution
    // Priority: 1) Locked price from frontend (if fresh), 2) Fresh API price
    const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
    const MAX_PRICE_AGE_MS = 2000; // Max 2 seconds for locked price
    
    let currentPriceQuote: { bid: number; ask: number; mid: number; spread: number; timestamp: number };
    let executionPrice: number;
    
    const { lockedPrice } = params;
    
    if (orderType === 'market' && lockedPrice && (Date.now() - lockedPrice.timestamp) < MAX_PRICE_AGE_MS) {
      // 🔒 Use LOCKED price from frontend - what user saw when they clicked trade
      console.log(`\n🔒 [ORDER] Using LOCKED price for ${symbol} (age: ${Date.now() - lockedPrice.timestamp}ms)`);
      console.log(`   Locked BID: ${lockedPrice.bid.toFixed(5)} (${side === 'sell' ? '← WILL USE' : ''})`);
      console.log(`   Locked ASK: ${lockedPrice.ask.toFixed(5)} (${side === 'buy' ? '← WILL USE' : ''})`);
      
      currentPriceQuote = {
        bid: lockedPrice.bid,
        ask: lockedPrice.ask,
        mid: (lockedPrice.bid + lockedPrice.ask) / 2,
        spread: lockedPrice.ask - lockedPrice.bid,
        timestamp: lockedPrice.timestamp,
      };
      
      executionPrice = side === 'buy' ? lockedPrice.ask : lockedPrice.bid;
      console.log(`   ✅ Execution price: ${executionPrice.toFixed(5)} (${side === 'buy' ? 'ASK' : 'BID'}) 🔒 LOCKED`);
    } else {
      // Fetch fresh price from API
      console.log(`\n🔄 [ORDER] Getting fresh price for ${symbol}...`);
      if (lockedPrice) {
        console.log(`   ⚠️ Locked price expired (age: ${Date.now() - lockedPrice.timestamp}ms)`);
      }
      
      const freshPrice = await getRealPrice(symbol);
      if (!freshPrice) {
        throw new Error('Unable to get current market price. Market may be closed or API unavailable.');
      }
      
      currentPriceQuote = freshPrice;
      
      const spreadPips = (freshPrice.spread / pipSize).toFixed(2);
      console.log(`📊 [ORDER] Market price received:`);
      console.log(`   BID: ${freshPrice.bid.toFixed(5)} (${side === 'sell' ? '← WILL USE' : ''})`);
      console.log(`   ASK: ${freshPrice.ask.toFixed(5)} (${side === 'buy' ? '← WILL USE' : ''})`);
      console.log(`   Spread: ${spreadPips} pips`);
      console.log(`   Timestamp: ${new Date(freshPrice.timestamp).toISOString()}`);
      
      executionPrice = orderType === 'market'
        ? side === 'buy' ? freshPrice.ask : freshPrice.bid
        : limitPrice!;
      
      console.log(`✅ [ORDER] Execution price: ${executionPrice.toFixed(5)} (${side === 'buy' ? 'ASK' : 'BID'})`);
    }

    if (orderType === 'limit' && !limitPrice) {
      throw new Error('Limit price required for limit orders');
    }

    // Validate limit order price (direction, minimum distance, maximum distance)
    if (orderType === 'limit' && limitPrice) {
      const limitValidation = validateLimitOrderPrice(
        side,
        limitPrice,
        currentPriceQuote,
        symbol
      );

      if (!limitValidation.valid) {
        // Throw detailed error with explanation
        const errorMessage = limitValidation.explanation 
          ? `${limitValidation.error}\n\n${limitValidation.explanation}`
          : limitValidation.error;
        throw new Error(errorMessage);
      }
    }

    // Use contest leverage or user-specified (whichever is lower)
    const maxLeverage = contestData.leverage.max || 100;
    const leverage = userLeverage
      ? Math.min(userLeverage, maxLeverage)
      : maxLeverage;

    // Validate SL/TP levels
    if (stopLoss || takeProfit) {
      const slTpValidation = validateSLTP(
        side === 'buy' ? 'long' : 'short',
        executionPrice,
        stopLoss,
        takeProfit
      );
      if (!slTpValidation.valid) {
        throw new Error(slTpValidation.error);
      }
    }

    // Calculate margin required
    const marginRequired = calculateMarginRequired(
      quantity,
      executionPrice,
      leverage,
      symbol
    );

    // Validate order can be placed
    const orderValidation = validateNewOrder(
      participant.availableCapital,
      marginRequired,
      participant.currentOpenPositions,
      quantity,
      leverage,
      contestData.maxOpenPositions || 10, // Max open positions from contest settings
      maxLeverage
    );

    if (!orderValidation.valid) {
      throw new Error(orderValidation.error);
    }

    // Start MongoDB transaction
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // Create order
      const order = await TradingOrder.create(
        [
          {
            competitionId,
            userId: session.user.id,
            participantId: participant._id,
            symbol,
            side,
            orderType,
            quantity,
            requestedPrice: limitPrice,
            executedPrice: orderType === 'market' ? executionPrice : undefined,
            stopLoss,
            takeProfit,
            leverage,
            marginRequired,
            status: orderType === 'market' ? 'filled' : 'pending',
            filledQuantity: orderType === 'market' ? quantity : 0,
            remainingQuantity: orderType === 'market' ? 0 : quantity,
            placedAt: new Date(),
            executedAt: orderType === 'market' ? new Date() : undefined,
            orderSource: 'web',
          },
        ],
        { session: mongoSession }
      );

      // ⚡ For optimistic UI - store position data for immediate frontend update
      let positionData: {
        _id: string;
        symbol: string;
        side: string;
        quantity: number;
        entryPrice: number;
        currentPrice: number;
        unrealizedPnl: number;
        unrealizedPnlPercentage: number;
        stopLoss?: number;
        takeProfit?: number;
        leverage: number;
        marginUsed: number;
        status: string;
        openedAt: string;
      } | undefined = undefined;

      // If market order, create position immediately
      if (orderType === 'market') {
        const position = await TradingPosition.create(
          [
            {
              competitionId,
              userId: session.user.id,
              participantId: participant._id,
              symbol,
              side: side === 'buy' ? 'long' : 'short',
              quantity,
              orderType: 'market', // Positions are only created for market orders
              limitPrice: undefined, // Market orders don't have limit prices
              entryPrice: executionPrice,
              currentPrice: executionPrice,
              unrealizedPnl: 0,
              unrealizedPnlPercentage: 0,
              stopLoss,
              takeProfit,
              leverage,
              marginUsed: marginRequired,
              maintenanceMargin: marginRequired * 0.5,
              status: 'open',
              openedAt: new Date(),
              openOrderId: order[0]._id.toString(),
              lastPriceUpdate: new Date(),
              priceUpdateCount: 0,
            },
          ],
          { session: mongoSession }
        );

        // Update order with position ID
        order[0].positionId = position[0]._id.toString();
        await order[0].save({ session: mongoSession });

        // Debug: Log TP/SL saved
        console.log(`📊 Position created with TP/SL:`, {
          positionId: position[0]._id.toString(),
          takeProfit: position[0].takeProfit,
          stopLoss: position[0].stopLoss,
          hasTakeProfit: !!position[0].takeProfit,
          hasStopLoss: !!position[0].stopLoss
        });

        // ⚡ Add to real-time TP/SL cache for instant triggering
        if (stopLoss || takeProfit) {
          try {
            const { updatePositionInCache } = await import('@/lib/services/tpsl-realtime.service');
            updatePositionInCache(
              position[0]._id.toString(),
              symbol,
              side === 'buy' ? 'long' : 'short',
              takeProfit ?? null,
              stopLoss ?? null,
              executionPrice,
              quantity,
              session.user.id,
              competitionId
            );
          } catch {
            // Cache update is optional
          }
        }

        // Update participant (use correct model based on contest type)
        const ParticipantModel = await getParticipantModel(contestType);
        await ParticipantModel.findByIdAndUpdate(
          participant._id,
          {
            $inc: {
              currentOpenPositions: 1,
              totalTrades: 1,
            },
            $set: {
              availableCapital: participant.availableCapital - marginRequired,
              usedMargin: participant.usedMargin + marginRequired,
              lastTradeAt: new Date(),
            },
          },
          { session: mongoSession }
        );

        // 📝 Log price snapshot for trade validation/auditing (NON-BLOCKING - fire and forget)
        const expectedPrice = side === 'buy' ? currentPriceQuote.ask : currentPriceQuote.bid;
        const slippagePips = Math.abs(executionPrice - expectedPrice) / pipSize;
        
        // Don't await - this is non-critical and shouldn't block the response
        PriceLog.create({
          symbol,
          bid: currentPriceQuote.bid,
          ask: currentPriceQuote.ask,
          mid: currentPriceQuote.mid,
          spread: currentPriceQuote.spread,
          timestamp: new Date(),
          tradeId: position[0]._id.toString(),
          orderId: order[0]._id.toString(),
          tradeType: 'entry',
          tradeSide: side === 'buy' ? 'long' : 'short',
          executionPrice,
          expectedPrice,
          priceMatchesExpected: slippagePips < 0.5,
          slippagePips,
          priceSource: 'rest',
        }).catch(logError => {
          console.warn('⚠️ Failed to create price log (non-critical):', logError);
        });

        console.log('✅ POSITION OPENED:');
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Side: ${side.toUpperCase()}`);
        console.log(`   Quantity: ${quantity} lots`);
        console.log(`   Entry Price: ${executionPrice.toFixed(5)} (${side === 'buy' ? 'ASK' : 'BID'})`);
        console.log(`   Bid/Ask at Entry: ${currentPriceQuote.bid.toFixed(5)} / ${currentPriceQuote.ask.toFixed(5)}`);
        console.log(`   Spread: ${(currentPriceQuote.spread / pipSize).toFixed(2)} pips`);
        console.log(`   Slippage: ${slippagePips.toFixed(2)} pips`);
        console.log(`   Leverage: 1:${leverage}`);
        console.log(`   Margin Required: $${marginRequired.toFixed(2)}`);
        console.log(`   Previous Available: $${participant.availableCapital.toFixed(2)}`);
        console.log(`   New Available: $${(participant.availableCapital - marginRequired).toFixed(2)} (Margin Locked 🔒)`);

        // ⚡ Store position data for immediate frontend update
        positionData = {
          _id: position[0]._id.toString(),
          symbol,
          side: side === 'buy' ? 'long' : 'short',
          quantity,
          entryPrice: executionPrice,
          currentPrice: executionPrice,
          unrealizedPnl: 0,
          unrealizedPnlPercentage: 0,
          stopLoss,
          takeProfit,
          leverage,
          marginUsed: marginRequired,
          status: 'open',
          openedAt: new Date().toISOString(),
        };
      } else {
        console.log(`✅ Limit order placed: ${side} ${quantity} ${symbol} @ ${limitPrice}`);
      }

      await mongoSession.commitTransaction();
      mongoSession.endSession(); // End session immediately after commit

      // 🔔 Send notifications NON-BLOCKING (fire and forget)
      if (orderType === 'market') {
        import('@/lib/services/notification.service').then(({ notificationService }) => {
          notificationService.notifyOrderFilled(
            session.user.id,
            symbol,
            side.toUpperCase(),
            executionPrice,
            quantity
          ).catch(notifError => {
            console.error('Error sending order filled notification:', notifError);
          });
        }).catch(() => {});
      }

      // Revalidate paths (keep this - Next.js needs it for SSR)
      if (contestType === 'competition') {
        revalidatePath(`/competitions/${competitionId}/trade`);
        revalidatePath(`/competitions/${competitionId}`);
      } else {
        revalidatePath(`/challenges/${competitionId}/trade`);
        revalidatePath(`/challenges/${competitionId}`);
      }

      return {
        success: true,
        orderId: order[0]._id.toString(),
        positionId: orderType === 'market' ? order[0].positionId : undefined,
        position: positionData, // ⚡ Include position for immediate UI update!
        message: orderType === 'market'
          ? 'Order executed successfully'
          : 'Limit order placed successfully',
      };
    } catch (error) {
      // Only abort if session is still in a transaction (not yet committed)
      if (mongoSession.inTransaction()) {
        await mongoSession.abortTransaction();
      }
      mongoSession.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error placing order:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to place order');
  }
};

// Get user's orders for a competition
export const getUserOrders = async (
  competitionId: string,
  status?: 'pending' | 'filled' | 'cancelled'
) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      competitionId,
      userId: session.user.id,
    };

    if (status) {
      query.status = status;
    }

    const orders = await TradingOrder.find(query)
      .sort({ placedAt: -1 })
      .limit(100)
      .lean();

    return JSON.parse(JSON.stringify(orders));
  } catch (error) {
    console.error('Error getting orders:', error);
    throw new Error('Failed to get orders');
  }
};

// Cancel a pending order
export const cancelOrder = async (orderId: string) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    // ⏰ Check if market is open
    console.log(`⏰ Checking market status for cancelling order...`);
    await ensureMarketOpen();
    console.log(`   ✅ Market is open`);

    // Check if user is restricted from trading
    console.log(`🔐 Checking trading restrictions for user ${session.user.id} (cancel order)`);
    const { canUserPerformAction } = await import('@/lib/services/user-restriction.service');
    const restrictionCheck = await canUserPerformAction(session.user.id, 'trade');
    console.log(`   Restriction check result:`, restrictionCheck);

    if (!restrictionCheck.allowed) {
      console.log(`   ❌ Cancel order blocked due to restrictions`);
      throw new Error(restrictionCheck.reason || 'You are not allowed to cancel orders');
    }
    console.log(`   ✅ User allowed to cancel order`);

    await connectToDatabase();

    const order = await TradingOrder.findOne({
      _id: orderId,
      userId: session.user.id,
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Only pending orders can be cancelled');
    }

    // NOTE: Pending limit orders do NOT lock margin
    // Margin is only locked when the order executes and creates a position
    // So we don't need to "release" anything here

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();

    revalidatePath(`/competitions/${order.competitionId}/trade`);

    console.log(`✅ Limit order cancelled: ${orderId}`);
    console.log(`   💡 Note: No margin was locked (limit orders don't lock margin until execution)`);

    return { success: true, message: 'Order cancelled successfully' };
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to cancel order');
  }
};

// Get order by ID
export const getOrderById = async (orderId: string) => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    await connectToDatabase();

    const order = await TradingOrder.findOne({
      _id: orderId,
      userId: session.user.id,
    }).lean();

    if (!order) {
      return null;
    }

    return JSON.parse(JSON.stringify(order));
  } catch (error) {
    console.error('Error getting order:', error);
    throw new Error('Failed to get order');
  }
};

// Check and execute limit orders (background process)
export const checkLimitOrders = async (competitionId: string) => {
  try {
    await connectToDatabase();

    // Get all pending limit orders for this competition
    const pendingOrders = await TradingOrder.find({
      competitionId,
      status: 'pending',
      orderType: 'limit',
    });

    for (const order of pendingOrders) {
      // Get current REAL price
      const currentPrice = await getRealPrice(order.symbol as ForexSymbol);
      if (!currentPrice) continue;

      const marketPrice = order.side === 'buy' ? currentPrice.ask : currentPrice.bid;

      // Check if limit price reached
      let shouldExecute = false;

      if (order.side === 'buy') {
        // Buy limit: execute when price falls to or below limit
        shouldExecute = marketPrice <= order.requestedPrice!;
      } else {
        // Sell limit: execute when price rises to or above limit
        shouldExecute = marketPrice >= order.requestedPrice!;
      }

      if (shouldExecute) {
        // Execute the order
        const mongoSession = await mongoose.startSession();
        mongoSession.startTransaction();

        try {
          // Get participant
          const participant = await CompetitionParticipant.findById(order.participantId).session(
            mongoSession
          );
          if (!participant) continue;

          // Check if still have capital
          if (participant.availableCapital < order.marginRequired) {
            order.status = 'cancelled';
            order.rejectionReason = 'Insufficient capital';
            await order.save({ session: mongoSession });
            await mongoSession.commitTransaction();
            continue;
          }

          // Update order
          order.status = 'filled';
          order.executedPrice = marketPrice;
          order.filledQuantity = order.quantity;
          order.remainingQuantity = 0;
          order.executedAt = new Date();
          await order.save({ session: mongoSession });

          // Create position
          const position = await TradingPosition.create(
            [
              {
                competitionId: order.competitionId,
                userId: order.userId,
                participantId: order.participantId,
                symbol: order.symbol,
                side: order.side === 'buy' ? 'long' : 'short',
                quantity: order.quantity,
                entryPrice: marketPrice,
                currentPrice: marketPrice,
                unrealizedPnl: 0,
                unrealizedPnlPercentage: 0,
                stopLoss: order.stopLoss,
                takeProfit: order.takeProfit,
                leverage: order.leverage,
                marginUsed: order.marginRequired,
                maintenanceMargin: order.marginRequired * 0.5,
                status: 'open',
                openedAt: new Date(),
                openOrderId: order._id.toString(),
                lastPriceUpdate: new Date(),
                priceUpdateCount: 0,
              },
            ],
            { session: mongoSession }
          );

          // Update order with position ID
          order.positionId = position[0]._id.toString();
          await order.save({ session: mongoSession });

          // Update participant
          await CompetitionParticipant.findByIdAndUpdate(
            participant._id,
            {
              $inc: {
                currentOpenPositions: 1,
                totalTrades: 1,
              },
              $set: {
                availableCapital: participant.availableCapital - order.marginRequired,
                usedMargin: participant.usedMargin + order.marginRequired,
                lastTradeAt: new Date(),
              },
            },
            { session: mongoSession }
          );

          await mongoSession.commitTransaction();

          console.log(`✅ Limit order executed: ${order.symbol} @ ${marketPrice}`);
        } catch (error) {
          await mongoSession.abortTransaction();
          console.error('Error executing limit order:', error);
        } finally {
          mongoSession.endSession();
        }
      }
    }
  } catch (error) {
    console.error('Error checking limit orders:', error);
  }
};

// Execute a single limit order (used by worker)
export const executeLimitOrder = async (orderId: string, marketPrice: number) => {
  try {
    await connectToDatabase();

    const order = await TradingOrder.findById(orderId);
    if (!order || order.status !== 'pending') {
      return { success: false, message: 'Order not found or not pending' };
    }

    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // Get participant
      const participant = await CompetitionParticipant.findById(order.participantId).session(mongoSession);
      if (!participant) {
        await mongoSession.abortTransaction();
        return { success: false, message: 'Participant not found' };
      }

      // Check if still have capital
      if (participant.availableCapital < order.marginRequired) {
        order.status = 'cancelled';
        order.rejectionReason = 'Insufficient capital';
        await order.save({ session: mongoSession });
        await mongoSession.commitTransaction();
        return { success: false, message: 'Insufficient capital' };
      }

      // Update order
      order.status = 'filled';
      order.executedPrice = marketPrice;
      order.filledQuantity = order.quantity;
      order.remainingQuantity = 0;
      order.executedAt = new Date();
      await order.save({ session: mongoSession });

      // Create position
      const position = await TradingPosition.create(
        [
          {
            competitionId: order.competitionId,
            userId: order.userId,
            participantId: order.participantId,
            symbol: order.symbol,
            side: order.side === 'buy' ? 'long' : 'short',
            quantity: order.quantity,
            entryPrice: marketPrice,
            currentPrice: marketPrice,
            unrealizedPnl: 0,
            unrealizedPnlPercentage: 0,
            stopLoss: order.stopLoss,
            takeProfit: order.takeProfit,
            leverage: order.leverage,
            marginUsed: order.marginRequired,
            maintenanceMargin: order.marginRequired * 0.5,
            status: 'open',
            openedAt: new Date(),
            openOrderId: order._id.toString(),
            lastPriceUpdate: new Date(),
            priceUpdateCount: 0,
          },
        ],
        { session: mongoSession }
      );

      // Update order with position ID
      order.positionId = position[0]._id.toString();
      await order.save({ session: mongoSession });

      // Update participant
      await CompetitionParticipant.findByIdAndUpdate(
        participant._id,
        {
          $inc: {
            currentOpenPositions: 1,
            totalTrades: 1,
          },
          $set: {
            availableCapital: participant.availableCapital - order.marginRequired,
            usedMargin: participant.usedMargin + order.marginRequired,
            lastTradeAt: new Date(),
          },
        },
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();

      console.log(`✅ Limit order executed: ${order.symbol} @ ${marketPrice}`);
      return { success: true, positionId: position[0]._id.toString() };
    } catch (error) {
      await mongoSession.abortTransaction();
      console.error('Error executing limit order:', error);
      return { success: false, message: 'Transaction failed' };
    } finally {
      mongoSession.endSession();
    }
  } catch (error) {
    console.error('Error in executeLimitOrder:', error);
    return { success: false, message: 'Failed to execute order' };
  }
};

