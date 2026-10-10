/**
 * Trade Queue Processor Job
 *
 * Processes pending limit orders only.
 * TP/SL is handled in real-time by tpsl-realtime.service.ts (on every price tick).
 * Runs every minute (same as Inngest: process-trade-queue)
 *
 * 📦 IMPORTANT: Worker reads prices from MongoDB cache (written by WEB app)
 * This allows a single WebSocket connection in WEB while Worker still gets prices!
 */

import { connectToDatabase } from "../config/database";

// Import models
import TradingOrder from "../../database/models/trading/trading-order.model";
import PriceCache from "../../database/models/price-cache.model";
import { fetchRealForexPrices } from "../../lib/services/real-forex-prices.service";
import type { ForexSymbol } from "../../lib/services/pnl-calculator.service";

/**
 * Fetch prices - tries MongoDB cache first, falls back to REST API
 * MongoDB cache is populated by WEB app's WebSocket connection
 *
 * OPTIMIZED: Uses targeted $in query for requested symbols instead of
 * PriceCache.getAllPrices() which does find({}).lean() (full collection scan).
 */
async function fetchPricesFromCacheOrAPI(
  symbols: ForexSymbol[],
): Promise<Map<ForexSymbol, { bid: number; ask: number }>> {
  const priceMap = new Map<ForexSymbol, { bid: number; ask: number }>();

  if (symbols.length === 0) return priceMap;

  try {
    // Targeted query — fetch ONLY the symbols we need (not the entire collection)
    const cachedDocs = await PriceCache.find({ symbol: { $in: symbols } }).lean();

    const missingSymbols: ForexSymbol[] = [];
    const now = Date.now();
    const cachedBySymbol = new Map<string, any>();
    for (const doc of cachedDocs) {
      cachedBySymbol.set(doc.symbol, doc);
    }

    for (const symbol of symbols) {
      const cached = cachedBySymbol.get(symbol);
      if (cached && now - cached.updatedAt?.getTime?.() < 60000) {
        priceMap.set(symbol, { bid: cached.bid, ask: cached.ask });
      } else {
        missingSymbols.push(symbol);
      }
    }

    // Fetch missing symbols from REST API
    if (missingSymbols.length > 0) {
      const apiPrices = await fetchRealForexPrices(missingSymbols);
      for (const [symbol, price] of apiPrices.entries()) {
        priceMap.set(symbol, { bid: price.bid, ask: price.ask });
      }
    }

    return priceMap;
  } catch (error) {
    // If cache fails, fall back to REST API entirely
    console.error(`[TRADE QUEUE] Cache error, falling back to REST API: ${error}`);
    const apiPrices = await fetchRealForexPrices(symbols);
    for (const [symbol, price] of apiPrices.entries()) {
      priceMap.set(symbol, { bid: price.bid, ask: price.ask });
    }
    return priceMap;
  }
}

export interface TradeQueueResult {
  pendingOrdersChecked: number;
  ordersExecuted: number;
  errors: string[];
}

export async function runTradeQueueProcessor(): Promise<TradeQueueResult> {
  const result: TradeQueueResult = {
    pendingOrdersChecked: 0,
    ordersExecuted: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    // Early exit: skip all work if no pending limit/stop orders
    const pendingCount = await TradingOrder.countDocuments({
      status: "pending",
      orderType: { $in: ["limit", "stop"] },
    });
    if (pendingCount === 0) {
      return result;
    }

    // ========== Process Pending Limit/Stop Orders ==========
    // NOTE: TP/SL checking is handled in real-time by tpsl-realtime.service.ts
    // (fires on every WebSocket price tick). Removed from here to avoid:
    // - Redundant TradingPosition.find() + PriceCache.find({}) full scan every minute
    // - Double-triggering of position closes

    const pendingOrders = await TradingOrder.find({
      status: "pending",
      orderType: { $in: ["limit", "stop"] },
    }).lean();

    result.pendingOrdersChecked = pendingOrders.length;

    if (pendingOrders.length > 0) {
      // Get unique symbols needed, then fetch only those prices
      const symbols = [
        ...new Set(pendingOrders.map((o) => o.symbol)),
      ] as ForexSymbol[];
      const pricesMap = await fetchPricesFromCacheOrAPI(symbols);

      for (const order of pendingOrders) {
        try {
          const currentPrice = pricesMap.get(order.symbol as ForexSymbol);
          if (!currentPrice) continue;

          const marketPrice =
            order.side === "buy" ? currentPrice.ask : currentPrice.bid;
          let shouldExecute = false;

          // Check if limit/stop price is reached
          if (order.orderType === "limit") {
            if (order.side === "buy" && marketPrice <= order.price) {
              shouldExecute = true;
            } else if (order.side === "sell" && marketPrice >= order.price) {
              shouldExecute = true;
            }
          } else if (order.orderType === "stop") {
            if (order.side === "buy" && marketPrice >= order.price) {
              shouldExecute = true;
            } else if (order.side === "sell" && marketPrice <= order.price) {
              shouldExecute = true;
            }
          }

          if (shouldExecute) {
            // Execute the order
            const { executeLimitOrder } =
              await import("../../lib/actions/trading/order.actions");
            await executeLimitOrder(order._id.toString(), marketPrice);
            result.ordersExecuted++;
          }
        } catch (orderError) {
          result.errors.push(`Order ${order._id} error: ${orderError}`);
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
