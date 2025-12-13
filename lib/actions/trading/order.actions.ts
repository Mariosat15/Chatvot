'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/database/mongoose';
import TradingOrder from '@/database/models/trading/trading-order.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import Competition from '@/database/models/trading/competition.model';
import { getContestAndParticipant, getParticipantModel, ContestType } from './contest-utils';
import mongoose from 'mongoose';
import {
  calculateMarginRequired,
  calculateUnrealizedPnL,
  calculatePnLPercentage,
  validateQuantity,
  validateSLTP,
  ForexSymbol,
  FOREX_PAIRS,
} from '@/lib/services/pnl-calculator.service';
import { validateNewOrder } from '@/lib/services/risk-manager.service';
import { getRealPrice, isForexMarketOpen, getMarketStatus } from '@/lib/services/real-forex-prices.service';
import { validateLimitOrderPrice } from '@/lib/utils/limit-order-validation';

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
async function checkCompetitionRiskLimits(
  competition: any,
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
      // Get current prices for all open position symbols
      const symbols = [...new Set(openPositions.map(p => p.symbol))];
      
      for (const position of openPositions) {
        try {
          const currentPrice = await getRealPrice(position.symbol);
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

    // Get current REAL market price from Massive.com
    const currentPriceQuote = await getRealPrice(symbol);
    if (!currentPriceQuote) {
      throw new Error('Unable to get current market price. Market may be closed or API unavailable.');
    }

    // Determine execution price
    const executionPrice = orderType === 'market'
      ? side === 'buy' ? currentPriceQuote.ask : currentPriceQuote.bid
      : limitPrice!;

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

        console.log('✅ POSITION OPENED:');
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Side: ${side.toUpperCase()}`);
        console.log(`   Quantity: ${quantity} lots`);
        console.log(`   Entry Price: ${executionPrice.toFixed(5)} (${side === 'buy' ? 'ASK' : 'BID'})`);
        console.log(`   Leverage: 1:${leverage}`);
        console.log(`   Margin Required: $${marginRequired.toFixed(2)}`);
        console.log(`   Previous Available: $${participant.availableCapital.toFixed(2)}`);
        console.log(`   New Available: $${(participant.availableCapital - marginRequired).toFixed(2)} (Margin Locked 🔒)`);
      } else {
        console.log(`✅ Limit order placed: ${side} ${quantity} ${symbol} @ ${limitPrice}`);
      }

      await mongoSession.commitTransaction();

      // Send order filled notification for market orders
      if (orderType === 'market') {
        try {
          const { notificationService } = await import('@/lib/services/notification.service');
          await notificationService.notifyOrderFilled(
            session.user.id,
            symbol,
            side.toUpperCase(),
            executionPrice,
            quantity
          );
        } catch (notifError) {
          console.error('Error sending order filled notification:', notifError);
        }
      }

      // Revalidate appropriate paths based on contest type
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
        message: orderType === 'market'
          ? 'Order executed successfully'
          : 'Limit order placed successfully',
      };
    } catch (error) {
      await mongoSession.abortTransaction();
      throw error;
    } finally {
      mongoSession.endSession();
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

