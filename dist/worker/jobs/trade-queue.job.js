"use strict";
/**
 * Trade Queue Processor Job
 *
 * Processes pending limit orders and checks for TP/SL triggers.
 * Runs every minute (same as Inngest: process-trade-queue)
 *
 * 📦 IMPORTANT: Worker reads prices from MongoDB cache (written by WEB app)
 * This allows a single WebSocket connection in WEB while Worker still gets prices!
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTradeQueueProcessor = runTradeQueueProcessor;
const database_1 = require("../config/database");
// Import models
const trading_order_model_1 = __importDefault(require("../../database/models/trading/trading-order.model"));
const trading_position_model_1 = __importDefault(require("../../database/models/trading/trading-position.model"));
const price_cache_model_1 = __importDefault(require("../../database/models/price-cache.model"));
const real_forex_prices_service_1 = require("../../lib/services/real-forex-prices.service");
/**
 * Fetch prices - tries MongoDB cache first, falls back to REST API
 * MongoDB cache is populated by WEB app's WebSocket connection
 */
async function fetchPricesFromCacheOrAPI(symbols) {
    const priceMap = new Map();
    try {
        // Try MongoDB cache first (populated by WEB WebSocket)
        const cachedPrices = await price_cache_model_1.default.getAllPrices();
        // Check which symbols we got from cache
        const missingSymbols = [];
        for (const symbol of symbols) {
            const cached = cachedPrices.get(symbol);
            if (cached && Date.now() - cached.timestamp < 60000) { // Use if less than 1 min old
                priceMap.set(symbol, { bid: cached.bid, ask: cached.ask });
            }
            else {
                missingSymbols.push(symbol);
            }
        }
        // If we have some from cache, log it
        if (priceMap.size > 0) {
            console.log(`   📦 Got ${priceMap.size}/${symbols.length} prices from MongoDB cache`);
        }
        // Fetch missing symbols from REST API
        if (missingSymbols.length > 0) {
            console.log(`   🌐 Fetching ${missingSymbols.length} prices from REST API`);
            const apiPrices = await (0, real_forex_prices_service_1.fetchRealForexPrices)(missingSymbols);
            for (const [symbol, price] of apiPrices.entries()) {
                priceMap.set(symbol, { bid: price.bid, ask: price.ask });
            }
        }
        return priceMap;
    }
    catch (error) {
        // If cache fails, fall back to REST API entirely
        console.log(`   ⚠️ Cache error, using REST API: ${error}`);
        const apiPrices = await (0, real_forex_prices_service_1.fetchRealForexPrices)(symbols);
        for (const [symbol, price] of apiPrices.entries()) {
            priceMap.set(symbol, { bid: price.bid, ask: price.ask });
        }
        return priceMap;
    }
}
async function runTradeQueueProcessor() {
    const result = {
        pendingOrdersChecked: 0,
        ordersExecuted: 0,
        positionsChecked: 0,
        tpSlTriggered: 0,
        errors: [],
    };
    try {
        await (0, database_1.connectToDatabase)();
        // ========== PART 1: Process Pending Limit Orders ==========
        const pendingOrders = await trading_order_model_1.default.find({
            status: 'pending',
            orderType: { $in: ['limit', 'stop'] },
        });
        result.pendingOrdersChecked = pendingOrders.length;
        if (pendingOrders.length > 0) {
            // Get unique symbols
            const symbols = [...new Set(pendingOrders.map(o => o.symbol))];
            const pricesMap = await fetchPricesFromCacheOrAPI(symbols);
            for (const order of pendingOrders) {
                try {
                    const currentPrice = pricesMap.get(order.symbol);
                    if (!currentPrice)
                        continue;
                    const marketPrice = order.side === 'buy' ? currentPrice.ask : currentPrice.bid;
                    let shouldExecute = false;
                    // Check if limit/stop price is reached
                    if (order.orderType === 'limit') {
                        if (order.side === 'buy' && marketPrice <= order.price) {
                            shouldExecute = true;
                        }
                        else if (order.side === 'sell' && marketPrice >= order.price) {
                            shouldExecute = true;
                        }
                    }
                    else if (order.orderType === 'stop') {
                        if (order.side === 'buy' && marketPrice >= order.price) {
                            shouldExecute = true;
                        }
                        else if (order.side === 'sell' && marketPrice <= order.price) {
                            shouldExecute = true;
                        }
                    }
                    if (shouldExecute) {
                        // Execute the order
                        const { executeLimitOrder } = await import('../../lib/actions/trading/order.actions');
                        await executeLimitOrder(order._id.toString(), marketPrice);
                        result.ordersExecuted++;
                    }
                }
                catch (orderError) {
                    result.errors.push(`Order ${order._id} error: ${orderError}`);
                }
            }
        }
        // ========== PART 2: Check TP/SL on Open Positions ==========
        const openPositions = await trading_position_model_1.default.find({
            status: 'open',
            $or: [
                { takeProfit: { $exists: true, $ne: null } },
                { stopLoss: { $exists: true, $ne: null } },
            ],
        });
        result.positionsChecked = openPositions.length;
        if (openPositions.length > 0) {
            // Get unique symbols
            const symbols = [...new Set(openPositions.map(p => p.symbol))];
            const pricesMap = await fetchPricesFromCacheOrAPI(symbols);
            for (const position of openPositions) {
                try {
                    const currentPrice = pricesMap.get(position.symbol);
                    if (!currentPrice)
                        continue;
                    const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
                    let shouldClose = false;
                    let closeReason = '';
                    // Check Take Profit
                    if (position.takeProfit) {
                        if (position.side === 'long' && marketPrice >= position.takeProfit) {
                            shouldClose = true;
                            closeReason = 'take_profit';
                        }
                        else if (position.side === 'short' && marketPrice <= position.takeProfit) {
                            shouldClose = true;
                            closeReason = 'take_profit';
                        }
                    }
                    // Check Stop Loss
                    if (!shouldClose && position.stopLoss) {
                        if (position.side === 'long' && marketPrice <= position.stopLoss) {
                            shouldClose = true;
                            closeReason = 'stop_loss';
                        }
                        else if (position.side === 'short' && marketPrice >= position.stopLoss) {
                            shouldClose = true;
                            closeReason = 'stop_loss';
                        }
                    }
                    if (shouldClose) {
                        const { closePositionAutomatic } = await import('../../lib/actions/trading/position.actions');
                        await closePositionAutomatic(position._id.toString(), marketPrice, closeReason);
                        result.tpSlTriggered++;
                    }
                }
                catch (posError) {
                    result.errors.push(`Position ${position._id} error: ${posError}`);
                }
            }
        }
        return result;
    }
    catch (error) {
        result.errors.push(`Trade queue error: ${error}`);
        return result;
    }
}
exports.default = runTradeQueueProcessor;
