/**
 * Trade Queue Processor Job
 * 
 * Processes pending limit orders and checks for TP/SL triggers.
 * Runs every minute (same as Inngest: process-trade-queue)
 */

import { connectToDatabase } from '../config/database';

// Import models
import TradingOrder from '../../database/models/trading/trading-order.model';
import TradingPosition from '../../database/models/trading/trading-position.model';
import { fetchRealForexPrices } from '../../lib/services/real-forex-prices.service';
import type { ForexSymbol } from '../../lib/services/pnl-calculator.service';

export interface TradeQueueResult {
  pendingOrdersChecked: number;
  ordersExecuted: number;
  positionsChecked: number;
  tpSlTriggered: number;
  errors: string[];
}

export async function runTradeQueueProcessor(): Promise<TradeQueueResult> {
  const result: TradeQueueResult = {
    pendingOrdersChecked: 0,
    ordersExecuted: 0,
    positionsChecked: 0,
    tpSlTriggered: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    // ========== PART 1: Process Pending Limit Orders ==========
    const pendingOrders = await TradingOrder.find({
      status: 'pending',
      orderType: { $in: ['limit', 'stop'] },
    });

    result.pendingOrdersChecked = pendingOrders.length;

    if (pendingOrders.length > 0) {
      // Get unique symbols
      const symbols = [...new Set(pendingOrders.map(o => o.symbol))] as ForexSymbol[];
      const pricesMap = await fetchRealForexPrices(symbols);

      for (const order of pendingOrders) {
        try {
          const currentPrice = pricesMap.get(order.symbol as ForexSymbol);
          if (!currentPrice) continue;

          const marketPrice = order.side === 'buy' ? currentPrice.ask : currentPrice.bid;
          let shouldExecute = false;

          // Check if limit/stop price is reached
          if (order.orderType === 'limit') {
            if (order.side === 'buy' && marketPrice <= order.price) {
              shouldExecute = true;
            } else if (order.side === 'sell' && marketPrice >= order.price) {
              shouldExecute = true;
            }
          } else if (order.orderType === 'stop') {
            if (order.side === 'buy' && marketPrice >= order.price) {
              shouldExecute = true;
            } else if (order.side === 'sell' && marketPrice <= order.price) {
              shouldExecute = true;
            }
          }

          if (shouldExecute) {
            // Execute the order
            const { executeLimitOrder } = await import('../../lib/actions/trading/order.actions');
            await executeLimitOrder(order._id.toString(), marketPrice);
            result.ordersExecuted++;
          }
        } catch (orderError) {
          result.errors.push(`Order ${order._id} error: ${orderError}`);
        }
      }
    }

    // ========== PART 2: Check TP/SL on Open Positions ==========
    const openPositions = await TradingPosition.find({
      status: 'open',
      $or: [
        { takeProfit: { $exists: true, $ne: null } },
        { stopLoss: { $exists: true, $ne: null } },
      ],
    });

    result.positionsChecked = openPositions.length;

    if (openPositions.length > 0) {
      // Get unique symbols
      const symbols = [...new Set(openPositions.map(p => p.symbol))] as ForexSymbol[];
      const pricesMap = await fetchRealForexPrices(symbols);

      for (const position of openPositions) {
        try {
          const currentPrice = pricesMap.get(position.symbol as ForexSymbol);
          if (!currentPrice) continue;

          const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
          let shouldClose = false;
          let closeReason = '';

          // Check Take Profit
          if (position.takeProfit) {
            if (position.side === 'long' && marketPrice >= position.takeProfit) {
              shouldClose = true;
              closeReason = 'take_profit';
            } else if (position.side === 'short' && marketPrice <= position.takeProfit) {
              shouldClose = true;
              closeReason = 'take_profit';
            }
          }

          // Check Stop Loss
          if (!shouldClose && position.stopLoss) {
            if (position.side === 'long' && marketPrice <= position.stopLoss) {
              shouldClose = true;
              closeReason = 'stop_loss';
            } else if (position.side === 'short' && marketPrice >= position.stopLoss) {
              shouldClose = true;
              closeReason = 'stop_loss';
            }
          }

          if (shouldClose) {
            const { closePositionAutomatic } = await import('../../lib/actions/trading/position.actions');
            await closePositionAutomatic(position._id.toString(), marketPrice, closeReason as any);
            result.tpSlTriggered++;
          }
        } catch (posError) {
          result.errors.push(`Position ${position._id} error: ${posError}`);
        }
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Trade queue error: ${error}`);
    return result;
  }
}

export default runTradeQueueProcessor;

