'use server';
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkMarginCalls = exports.checkStopLossTakeProfit = exports.updateAllPositionsPnL = exports.closePosition = exports.updatePositionTPSL = exports.getUserPositions = void 0;
exports.closePositionAutomatic = closePositionAutomatic;
const cache_1 = require("next/cache");
const auth_1 = require("@/lib/better-auth/auth");
const headers_1 = require("next/headers");
const navigation_1 = require("next/navigation");
const mongoose_1 = require("@/database/mongoose");
const trading_position_model_1 = __importDefault(require("@/database/models/trading/trading-position.model"));
const trading_order_model_1 = __importDefault(require("@/database/models/trading/trading-order.model"));
const trade_history_model_1 = __importDefault(require("@/database/models/trading/trade-history.model"));
const competition_participant_model_1 = __importDefault(require("@/database/models/trading/competition-participant.model"));
const challenge_participant_model_1 = __importDefault(require("@/database/models/trading/challenge-participant.model"));
const mongoose_2 = __importDefault(require("mongoose"));
const contest_utils_1 = require("./contest-utils");
const pnl_calculator_service_1 = require("@/lib/services/pnl-calculator.service");
const real_forex_prices_service_1 = require("@/lib/services/real-forex-prices.service");
const risk_manager_service_1 = require("@/lib/services/risk-manager.service");
const price_log_model_1 = __importDefault(require("@/database/models/trading/price-log.model"));
/**
 * Check if market is open and throw error if closed
 * Used for all user-initiated trading actions
 */
async function ensureMarketOpen() {
    const isOpen = await (0, real_forex_prices_service_1.isForexMarketOpen)();
    if (!isOpen) {
        const status = (0, real_forex_prices_service_1.getMarketStatus)();
        throw new Error(`Market is currently closed. ${status}. Trading is not available until market opens.`);
    }
}
// Get user's open positions
const getUserPositions = async (competitionId) => {
    // Disable caching to always fetch fresh position data (including TP/SL)
    (0, cache_1.unstable_noStore)();
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user)
            (0, navigation_1.redirect)('/sign-in');
        await (0, mongoose_1.connectToDatabase)();
        const positions = await trading_position_model_1.default.find({
            competitionId,
            userId: session.user.id,
            status: 'open',
        })
            .sort({ openedAt: -1 })
            .lean();
        // OPTIMIZATION: Fetch all prices at once (single batch request)
        const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
        const pricesMap = uniqueSymbols.length > 0 ? await (0, real_forex_prices_service_1.fetchRealForexPrices)(uniqueSymbols) : new Map();
        // Update P&L for each position with current REAL prices (instant - from batch)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const positionsWithCurrentPnL = positions.map((position) => {
            const currentPrice = pricesMap.get(position.symbol);
            if (currentPrice) {
                const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
                const pnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, marketPrice, position.quantity, position.symbol);
                const pnlPercentage = (0, pnl_calculator_service_1.calculatePnLPercentage)(pnl, position.marginUsed);
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
        });
        return JSON.parse(JSON.stringify(positionsWithCurrentPnL));
    }
    catch (error) {
        console.error('Error getting positions:', error);
        throw new Error('Failed to get positions');
    }
};
exports.getUserPositions = getUserPositions;
// Update Take Profit and Stop Loss for a position
const updatePositionTPSL = async (positionId, takeProfit, stopLoss) => {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user)
            (0, navigation_1.redirect)('/sign-in');
        // ⏰ Check if market is open
        console.log(`⏰ Checking market status for TP/SL modification...`);
        try {
            await ensureMarketOpen();
            console.log(`   ✅ Market is open`);
        }
        catch (marketError) {
            console.log(`   ❌ Market is closed - modification blocked`);
            return {
                success: false,
                error: marketError instanceof Error ? marketError.message : 'Market is closed'
            };
        }
        // Check if user is restricted from trading
        console.log(`🔐 Checking trading restrictions for user ${session.user.id} (modify TP/SL)`);
        const { canUserPerformAction } = await Promise.resolve().then(() => __importStar(require('@/lib/services/user-restriction.service')));
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
        await (0, mongoose_1.connectToDatabase)();
        const position = await trading_position_model_1.default.findOne({
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
        // ⚡ Update real-time TP/SL cache for instant triggering
        try {
            const { updatePositionInCache } = await Promise.resolve().then(() => __importStar(require('@/lib/services/tpsl-realtime.service')));
            updatePositionInCache(position._id.toString(), position.symbol, position.side, takeProfit, stopLoss, position.entryPrice, position.quantity, position.userId.toString(), position.competitionId.toString());
        }
        catch {
            // Cache update is optional, don't fail the operation
        }
        (0, cache_1.revalidatePath)('/');
        return {
            success: true,
            message: 'TP/SL updated successfully',
            position: {
                _id: position._id.toString(),
                takeProfit: position.takeProfit,
                stopLoss: position.stopLoss,
            },
        };
    }
    catch (error) {
        console.error('Error updating TP/SL:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update TP/SL',
        };
    }
};
exports.updatePositionTPSL = updatePositionTPSL;
// Close a position manually
// requestedPrice: Optional locked price from frontend (what user saw when they clicked close)
const closePosition = async (positionId, requestedPrice) => {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user)
            (0, navigation_1.redirect)('/sign-in');
        // ⏰ Check if market is open
        console.log(`⏰ Checking market status for closing position...`);
        await ensureMarketOpen();
        console.log(`   ✅ Market is open`);
        // Check if user is restricted from trading
        console.log(`🔐 Checking trading restrictions for user ${session.user.id} (close position)`);
        const { canUserPerformAction } = await Promise.resolve().then(() => __importStar(require('@/lib/services/user-restriction.service')));
        const restrictionCheck = await canUserPerformAction(session.user.id, 'trade');
        console.log(`   Restriction check result:`, restrictionCheck);
        if (!restrictionCheck.allowed) {
            console.log(`   ❌ Close position blocked due to restrictions`);
            throw new Error(restrictionCheck.reason || 'You are not allowed to close trades');
        }
        console.log(`   ✅ User allowed to close position`);
        await (0, mongoose_1.connectToDatabase)();
        const position = await trading_position_model_1.default.findOne({
            _id: positionId,
            userId: session.user.id,
            status: 'open',
        });
        if (!position) {
            throw new Error('Position not found or already closed');
        }
        // Determine exit price - use locked price from frontend if provided and fresh
        let exitPrice;
        let currentPrice;
        const MAX_PRICE_AGE_MS = 2000; // Max 2 seconds old for locked price
        const MAX_SLIPPAGE_PIPS = 5; // Max 5 pips slippage allowed
        const pipSize = position.symbol.includes('JPY') ? 0.01 : 0.0001;
        if (requestedPrice && (Date.now() - requestedPrice.timestamp) < MAX_PRICE_AGE_MS) {
            // User provided a locked price that's still fresh - USE IT
            console.log(`🔒 [EXIT] Using LOCKED price from frontend (age: ${Date.now() - requestedPrice.timestamp}ms)`);
            console.log(`   Locked BID: ${requestedPrice.bid.toFixed(5)}`);
            console.log(`   Locked ASK: ${requestedPrice.ask.toFixed(5)}`);
            exitPrice = position.side === 'long' ? requestedPrice.bid : requestedPrice.ask;
            currentPrice = {
                bid: requestedPrice.bid,
                ask: requestedPrice.ask,
                mid: (requestedPrice.bid + requestedPrice.ask) / 2,
                spread: requestedPrice.ask - requestedPrice.bid,
                timestamp: requestedPrice.timestamp,
            };
            console.log(`   Exit Price: ${exitPrice.toFixed(5)} (${position.side === 'long' ? 'BID' : 'ASK'}) ✅ LOCKED`);
        }
        else {
            // No locked price or too old - fetch fresh price
            console.log(`🔄 [EXIT] Fetching fresh price (no locked price or expired)`);
            const freshPrice = await (0, real_forex_prices_service_1.getRealPrice)(position.symbol);
            if (!freshPrice) {
                throw new Error('Unable to get current market price. Market may be closed or API unavailable.');
            }
            currentPrice = freshPrice;
            exitPrice = position.side === 'long' ? freshPrice.bid : freshPrice.ask;
            console.log(`   Fresh BID: ${freshPrice.bid.toFixed(5)}`);
            console.log(`   Fresh ASK: ${freshPrice.ask.toFixed(5)}`);
            console.log(`   Exit Price: ${exitPrice.toFixed(5)} (${position.side === 'long' ? 'BID' : 'ASK'})`);
            // If user provided a price but it's stale, warn about slippage
            if (requestedPrice) {
                const expectedExit = position.side === 'long' ? requestedPrice.bid : requestedPrice.ask;
                const slippagePips = Math.abs(exitPrice - expectedExit) / pipSize;
                console.log(`   ⚠️ Locked price expired (age: ${Date.now() - requestedPrice.timestamp}ms)`);
                console.log(`   Slippage: ${slippagePips.toFixed(2)} pips from expected ${expectedExit.toFixed(5)}`);
            }
        }
        // Calculate spread costs
        const entrySpread = position.entryPrice * 0.0001; // Approximate entry spread (we don't store it)
        const exitSpread = currentPrice.spread; // Current spread at exit
        const spreadCostInPips = (entrySpread + exitSpread) / 0.0001; // Total spread in pips
        const spreadCostInUSD = (entrySpread + exitSpread) * position.quantity * 100000; // Spread cost in USD
        // Calculate final P&L
        const realizedPnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, exitPrice, position.quantity, position.symbol);
        const realizedPnlPercentage = (0, pnl_calculator_service_1.calculatePnLPercentage)(realizedPnl, position.marginUsed);
        // Start MongoDB transaction
        const mongoSession = await mongoose_2.default.startSession();
        mongoSession.startTransaction();
        try {
            // Update position
            position.status = 'closed';
            position.closeReason = 'user';
            position.currentPrice = exitPrice;
            position.closedAt = new Date();
            position.holdingTimeSeconds = Math.floor((position.closedAt.getTime() - position.openedAt.getTime()) / 1000);
            await position.save({ session: mongoSession });
            // Create close order record
            const closeOrder = await trading_order_model_1.default.create([
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
            ], { session: mongoSession });
            position.closeOrderId = closeOrder[0]._id.toString();
            await position.save({ session: mongoSession });
            // Create trade history
            const tradeHistory = await trade_history_model_1.default.create([
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
            ], { session: mongoSession });
            position.tradeHistoryId = tradeHistory[0]._id.toString();
            await position.save({ session: mongoSession });
            // Detect contest type and get participant
            const contestInfo = await (0, contest_utils_1.getParticipant)(position.competitionId, position.userId);
            const contestType = contestInfo?.type || 'competition';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ParticipantModel = contestType === 'competition' ? competition_participant_model_1.default : challenge_participant_model_1.default;
            // Update participant
            const participant = await ParticipantModel.findById(position.participantId).session(mongoSession);
            if (!participant)
                throw new Error('Participant not found');
            const newCapital = participant.currentCapital + realizedPnl;
            const newAvailableCapital = participant.availableCapital + position.marginUsed + realizedPnl;
            const newRealizedPnl = participant.realizedPnl + realizedPnl;
            const newPnl = participant.pnl + realizedPnl;
            const newPnlPercentage = ((newCapital - participant.startingCapital) / participant.startingCapital) * 100;
            // 📝 Log price snapshot for trade validation/auditing (NON-BLOCKING)
            const expectedExitPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
            const pipSize = position.symbol.includes('JPY') ? 0.01 : 0.0001;
            const exitSlippagePips = Math.abs(exitPrice - expectedExitPrice) / pipSize;
            // Don't await - this is non-critical and shouldn't block the response
            price_log_model_1.default.create({
                symbol: position.symbol,
                bid: currentPrice.bid,
                ask: currentPrice.ask,
                mid: currentPrice.mid,
                spread: currentPrice.spread,
                timestamp: new Date(),
                tradeId: position._id.toString(),
                tradeType: 'exit',
                tradeSide: position.side,
                executionPrice: exitPrice,
                expectedPrice: expectedExitPrice,
                priceMatchesExpected: exitSlippagePips < 0.5,
                slippagePips: exitSlippagePips,
                priceSource: 'rest',
            }).catch(logError => {
                console.warn('⚠️ Failed to create exit price log (non-critical):', logError);
            });
            // Log trade details for transparency
            console.log('💰 POSITION CLOSED:');
            console.log(`   Symbol: ${position.symbol}`);
            console.log(`   Side: ${position.side.toUpperCase()}`);
            console.log(`   Quantity: ${position.quantity} lots`);
            console.log(`   Entry Price: ${position.entryPrice.toFixed(5)}`);
            console.log(`   Exit Price: ${exitPrice.toFixed(5)}`);
            console.log(`   Bid/Ask at Exit: ${currentPrice.bid.toFixed(5)} / ${currentPrice.ask.toFixed(5)}`);
            console.log(`   Exit Slippage: ${exitSlippagePips.toFixed(2)} pips`);
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
            await ParticipantModel.findByIdAndUpdate(participant._id, {
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
            }, { session: mongoSession });
            await mongoSession.commitTransaction();
            mongoSession.endSession(); // End session immediately after commit
            console.log(`✅ Position closed: ${position.symbol}, P&L: $${realizedPnl.toFixed(2)}`);
            // Evaluate badges for the user (fire and forget - don't wait)
            try {
                const { evaluateUserBadges } = await Promise.resolve().then(() => __importStar(require('@/lib/services/badge-evaluation.service')));
                evaluateUserBadges(session.user.id).then(result => {
                    if (result.newBadges.length > 0) {
                        console.log(`🏅 User earned ${result.newBadges.length} new badges after closing position`);
                    }
                }).catch(err => console.error('Error evaluating badges:', err));
            }
            catch (error) {
                console.error('Error importing badge service:', error);
            }
            // Update behavioral trading profile and check for mirror trading + similarity (fire and forget)
            try {
                const { BehavioralAnalysisService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/fraud/behavioral-analysis.service')));
                const { MirrorTradingService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/fraud/mirror-trading.service')));
                const { SimilarityDetectionService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/fraud/similarity-detection.service')));
                const tradeData = {
                    tradeId: tradeHistory[0]._id.toString(),
                    pair: position.symbol,
                    direction: position.side === 'long' ? 'buy' : 'sell',
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
                        const TradingBehaviorProfile = (await Promise.resolve().then(() => __importStar(require('@/database/models/fraud/trading-behavior-profile.model')))).default;
                        const otherProfiles = await TradingBehaviorProfile.find({
                            userId: { $ne: session.user.id },
                            'patterns.preferredPairs': position.symbol
                        }).limit(20).select('userId');
                        console.log(`📊 Found ${otherProfiles.length} other users who trade ${position.symbol}`);
                        for (const other of otherProfiles) {
                            SimilarityDetectionService.calculateSimilarity(session.user.id, other.userId.toString()).then(result => {
                                if (result.similarityScore >= 0.7) {
                                    console.log(`📊 HIGH SIMILARITY: ${(result.similarityScore * 100).toFixed(1)}% with ${other.userId.toString().substring(0, 8)}...`);
                                }
                            }).catch(err => console.error('Error calculating similarity:', err));
                        }
                    }
                    catch (err) {
                        console.error('Error in similarity check:', err);
                    }
                })
                    .catch(err => console.error('Error updating trading profile:', err));
                // Real-time mirror trading check
                MirrorTradingService.checkRealTimeMirrorTrading(session.user.id, tradeData)
                    .then(() => console.log('🪞 Mirror trading check completed'))
                    .catch(err => console.error('Error checking mirror trading:', err));
            }
            catch (error) {
                console.error('Error in behavioral analysis:', error);
            }
            // Revalidate appropriate paths based on contest type
            if (contestType === 'competition') {
                (0, cache_1.revalidatePath)(`/competitions/${position.competitionId}/trade`);
                (0, cache_1.revalidatePath)(`/competitions/${position.competitionId}`);
            }
            else {
                (0, cache_1.revalidatePath)(`/challenges/${position.competitionId}/trade`);
                (0, cache_1.revalidatePath)(`/challenges/${position.competitionId}`);
            }
            // ⚡ Emit real-time SSE event for instant UI update (manual close)
            try {
                const PositionEvent = (await Promise.resolve().then(() => __importStar(require('@/database/models/position-event.model')))).default;
                await PositionEvent.create({
                    userId: position.userId,
                    competitionId: position.competitionId,
                    contestType: contestType,
                    positionId: position._id.toString(),
                    symbol: position.symbol,
                    side: position.side,
                    eventType: 'closed',
                    closeReason: 'user',
                    realizedPnl: realizedPnl,
                    exitPrice: exitPrice,
                    createdAt: new Date(),
                });
                console.log(`⚡ [SSE] Manual close event emitted: ${position.symbol}`);
            }
            catch (sseError) {
                console.error('Error emitting SSE event:', sseError);
            }
            return {
                success: true,
                realizedPnl,
                message: `Position closed. ${realizedPnl >= 0 ? 'Profit' : 'Loss'}: $${Math.abs(realizedPnl).toFixed(2)}`,
            };
        }
        catch (error) {
            // Only abort if session is still in a transaction (not yet committed)
            if (mongoSession.inTransaction()) {
                await mongoSession.abortTransaction();
            }
            mongoSession.endSession();
            throw error;
        }
    }
    catch (error) {
        console.error('Error closing position:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to close position');
    }
};
exports.closePosition = closePosition;
// Update all positions P&L (called periodically)
const updateAllPositionsPnL = async (competitionId, userId) => {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const positions = await trading_position_model_1.default.find({
            competitionId,
            userId,
            status: 'open',
        });
        if (positions.length === 0)
            return { success: true, unrealizedPnl: 0 };
        // OPTIMIZATION: Fetch all prices at once (single batch)
        const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
        const pricesMap = await (0, real_forex_prices_service_1.fetchRealForexPrices)(uniqueSymbols);
        let totalUnrealizedPnl = 0;
        for (const position of positions) {
            // Get price from batch (instant!)
            const currentPrice = pricesMap.get(position.symbol);
            if (!currentPrice)
                continue;
            const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
            const pnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, marketPrice, position.quantity, position.symbol);
            const pnlPercentage = (0, pnl_calculator_service_1.calculatePnLPercentage)(pnl, position.marginUsed);
            position.currentPrice = marketPrice;
            position.unrealizedPnl = pnl;
            position.unrealizedPnlPercentage = pnlPercentage;
            position.lastPriceUpdate = new Date();
            position.priceUpdateCount += 1;
            await position.save();
            totalUnrealizedPnl += pnl;
        }
        // Update participant's unrealized P&L (try competition first, then challenge)
        let participant = await competition_participant_model_1.default.findOne({
            competitionId,
            userId,
        });
        if (!participant) {
            participant = await challenge_participant_model_1.default.findOne({
                challengeId: competitionId,
                userId,
            });
        }
        if (participant) {
            const newPnl = participant.realizedPnl + totalUnrealizedPnl;
            const newPnlPercentage = ((participant.currentCapital + totalUnrealizedPnl - participant.startingCapital) /
                participant.startingCapital) *
                100;
            participant.unrealizedPnl = totalUnrealizedPnl;
            participant.pnl = newPnl;
            participant.pnlPercentage = newPnlPercentage;
            await participant.save();
        }
        return { success: true, totalUnrealizedPnl };
    }
    catch (error) {
        console.error('Error updating positions P&L:', error);
        return { success: false, totalUnrealizedPnl: 0 };
    }
};
exports.updateAllPositionsPnL = updateAllPositionsPnL;
// Check stop loss and take profit levels (background process)
const checkStopLossTakeProfit = async (competitionId) => {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const positions = await trading_position_model_1.default.find({
            competitionId,
            status: 'open',
            $or: [{ stopLoss: { $exists: true, $ne: null } }, { takeProfit: { $exists: true, $ne: null } }],
        });
        if (positions.length === 0)
            return;
        // OPTIMIZATION: Fetch all prices at once (single batch)
        const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
        const pricesMap = await (0, real_forex_prices_service_1.fetchRealForexPrices)(uniqueSymbols);
        const now = Date.now();
        const MAX_PRICE_AGE_MS = 60000; // 60 seconds
        for (const position of positions) {
            // Get price from batch (instant!)
            const currentPrice = pricesMap.get(position.symbol);
            if (!currentPrice)
                continue;
            // ⚠️ SAFETY CHECK: Skip if using fallback/stale prices
            if (currentPrice.isFallback || currentPrice.isStale) {
                console.warn(`⚠️ Skipping SL/TP check for ${position.symbol} - using fallback/stale price`);
                continue;
            }
            // Check if price is too old
            const priceAge = now - currentPrice.timestamp;
            if (priceAge > MAX_PRICE_AGE_MS) {
                console.warn(`⚠️ Skipping SL/TP check for ${position.symbol} - price is ${Math.round(priceAge / 1000)}s old`);
                continue;
            }
            const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
            let shouldClose = false;
            let closeReason;
            // Check stop loss
            if (position.stopLoss) {
                if (position.side === 'long' && marketPrice <= position.stopLoss) {
                    shouldClose = true;
                    closeReason = 'stop_loss';
                }
                else if (position.side === 'short' && marketPrice >= position.stopLoss) {
                    shouldClose = true;
                    closeReason = 'stop_loss';
                }
            }
            // Check take profit
            if (!shouldClose && position.takeProfit) {
                if (position.side === 'long' && marketPrice >= position.takeProfit) {
                    shouldClose = true;
                    closeReason = 'take_profit';
                }
                else if (position.side === 'short' && marketPrice <= position.takeProfit) {
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
    }
    catch (error) {
        console.error('Error checking SL/TP:', error);
    }
};
exports.checkStopLossTakeProfit = checkStopLossTakeProfit;
// Close position automatically (SL/TP/Liquidation)
async function closePositionAutomatic(positionId, exitPrice, closeReason) {
    const mongoSession = await mongoose_2.default.startSession();
    mongoSession.startTransaction();
    try {
        const position = await trading_position_model_1.default.findById(positionId).session(mongoSession);
        if (!position || position.status !== 'open') {
            await mongoSession.abortTransaction();
            return;
        }
        const realizedPnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, exitPrice, position.quantity, position.symbol);
        const realizedPnlPercentage = (0, pnl_calculator_service_1.calculatePnLPercentage)(realizedPnl, position.marginUsed);
        // Update position
        position.status = closeReason === 'margin_call' ? 'liquidated' : 'closed';
        position.closeReason = closeReason;
        position.currentPrice = exitPrice;
        position.closedAt = new Date();
        position.holdingTimeSeconds = Math.floor((position.closedAt.getTime() - position.openedAt.getTime()) / 1000);
        await position.save({ session: mongoSession });
        // Create close order
        const closeOrder = await trading_order_model_1.default.create([
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
        ], { session: mongoSession });
        position.closeOrderId = closeOrder[0]._id.toString();
        await position.save({ session: mongoSession });
        // Create trade history
        const tradeHistory = await trade_history_model_1.default.create([
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
        ], { session: mongoSession });
        position.tradeHistoryId = tradeHistory[0]._id.toString();
        await position.save({ session: mongoSession });
        // Detect contest type and use correct participant model
        const contestInfoForSLTP = await (0, contest_utils_1.getParticipant)(position.competitionId, position.userId);
        const contestTypeForSLTP = contestInfoForSLTP?.type || 'competition';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ParticipantModelForSLTP = contestTypeForSLTP === 'competition' ? competition_participant_model_1.default : challenge_participant_model_1.default;
        // Update participant
        const participant = await ParticipantModelForSLTP.findById(position.participantId).session(mongoSession);
        if (!participant)
            throw new Error('Participant not found');
        const newCapital = participant.currentCapital + realizedPnl;
        const newAvailableCapital = participant.availableCapital + position.marginUsed + realizedPnl;
        const newRealizedPnl = participant.realizedPnl + realizedPnl;
        const newPnl = participant.pnl + realizedPnl;
        const newPnlPercentage = ((newCapital - participant.startingCapital) / participant.startingCapital) * 100;
        const isWinner = realizedPnl > 0;
        const winningTrades = participant.winningTrades + (isWinner ? 1 : 0);
        const losingTrades = participant.losingTrades + (isWinner ? 0 : 1);
        const totalTrades = participant.totalTrades + 1; // INCREMENT total trades!
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const averageWin = winningTrades > 0
            ? (participant.averageWin * participant.winningTrades + (isWinner ? realizedPnl : 0)) / winningTrades
            : 0;
        const averageLoss = losingTrades > 0
            ? (participant.averageLoss * participant.losingTrades + (!isWinner ? Math.abs(realizedPnl) : 0)) /
                losingTrades
            : 0;
        await ParticipantModelForSLTP.findByIdAndUpdate(participant._id, {
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
        }, { session: mongoSession });
        await mongoSession.commitTransaction();
        // Send notifications based on close reason
        try {
            const { notificationService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/notification.service')));
            if (closeReason === 'stop_loss') {
                await notificationService.notifyStopLossTriggered(position.userId, position.symbol, exitPrice, realizedPnl);
            }
            else if (closeReason === 'take_profit') {
                await notificationService.notifyTakeProfitTriggered(position.userId, position.symbol, exitPrice, realizedPnl);
            }
            // Also send position closed notification
            await notificationService.notifyPositionClosed(position.userId, position.symbol, realizedPnl, realizedPnlPercentage);
        }
        catch (notifError) {
            console.error('Error sending position close notification:', notifError);
        }
        // ⚡ Emit real-time SSE event for instant UI update
        try {
            const PositionEvent = (await Promise.resolve().then(() => __importStar(require('@/database/models/position-event.model')))).default;
            await PositionEvent.create({
                userId: position.userId,
                competitionId: position.competitionId,
                contestType: contestTypeForSLTP,
                positionId: position._id.toString(),
                symbol: position.symbol,
                side: position.side,
                eventType: 'closed',
                closeReason: closeReason,
                realizedPnl: realizedPnl,
                exitPrice: exitPrice,
                createdAt: new Date(),
            });
            console.log(`⚡ [SSE] Position closed event emitted: ${position.symbol} ${closeReason}`);
        }
        catch (sseError) {
            console.error('Error emitting SSE event:', sseError);
        }
    }
    catch (error) {
        await mongoSession.abortTransaction();
        throw error;
    }
    finally {
        mongoSession.endSession();
    }
}
// Check for margin calls and liquidate if necessary
const checkMarginCalls = async (competitionId) => {
    try {
        await (0, mongoose_1.connectToDatabase)();
        // Load admin-configured thresholds
        const { getMarginThresholds } = await Promise.resolve().then(() => __importStar(require('@/lib/actions/trading/risk-settings.actions')));
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
        let allParticipants = await competition_participant_model_1.default.find({
            competitionId,
        }).select('username status currentOpenPositions currentCapital unrealizedPnl usedMargin');
        let isChallenge = false;
        if (allParticipants.length === 0) {
            allParticipants = await challenge_participant_model_1.default.find({
                challengeId: competitionId,
            }).select('username status currentOpenPositions currentCapital unrealizedPnl usedMargin');
            isChallenge = true;
        }
        console.log(`\n📋 All Participants (${allParticipants.length}):`);
        for (const p of allParticipants) {
            console.log(`   - ${p.username}: Status=${p.status}, OpenPositions=${p.currentOpenPositions}, Capital=$${p.currentCapital.toFixed(2)}, UsedMargin=$${p.usedMargin.toFixed(2)}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ParticipantModel = isChallenge ? challenge_participant_model_1.default : competition_participant_model_1.default;
        const idField = isChallenge ? { challengeId: competitionId } : { competitionId };
        const participants = await ParticipantModel.find({
            ...idField,
            status: 'active',
            currentOpenPositions: { $gt: 0 },
        });
        console.log(`\n✅ Active participants with open positions: ${participants.length}`);
        // OPTIMIZATION: Get ALL open positions for ALL participants at once
        const allOpenPositions = await trading_position_model_1.default.find({
            participantId: { $in: participants.map((p) => p._id) },
            status: 'open',
        });
        // Batch fetch ALL prices at once (single request for all symbols!)
        const allSymbols = [...new Set(allOpenPositions.map(p => p.symbol))];
        const pricesMap = allSymbols.length > 0 ? await (0, real_forex_prices_service_1.fetchRealForexPrices)(allSymbols) : new Map();
        console.log(`📊 Fetched ${pricesMap.size} prices for margin check`);
        // Group positions by participant for processing
        const positionsByParticipant = new Map();
        for (const position of allOpenPositions) {
            const participantId = position.participantId.toString();
            if (!positionsByParticipant.has(participantId)) {
                positionsByParticipant.set(participantId, []);
            }
            positionsByParticipant.get(participantId).push(position);
        }
        for (const participant of participants) {
            console.log(`\n👤 Checking: ${participant.username}`);
            console.log(`   💰 Current Capital (DB): $${participant.currentCapital.toFixed(2)}`);
            console.log(`   📈 Unrealized P&L (DB): $${participant.unrealizedPnl.toFixed(2)}`);
            console.log(`   🔒 Used Margin (DB): $${participant.usedMargin.toFixed(2)}`);
            // Get positions for this participant from our pre-fetched list
            const openPositions = positionsByParticipant.get(participant._id.toString()) || [];
            console.log(`   📊 Found ${openPositions.length} open positions`);
            let totalUnrealizedPnl = 0;
            for (const position of openPositions) {
                // Get price from batch (instant!)
                const currentPrice = pricesMap.get(position.symbol);
                if (!currentPrice)
                    continue;
                const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
                const unrealizedPnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(position.side, position.entryPrice, marketPrice, position.quantity, position.symbol);
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
            const marginStatus = (0, risk_manager_service_1.getMarginStatus)(participant.currentCapital, totalUnrealizedPnl, // Use real-time P&L, not stale DB value
            participant.usedMargin, thresholds);
            console.log(`   ⚠️  Status: ${marginStatus.status}`);
            console.log(`   🎯 Threshold Check: ${marginStatus.marginLevel.toFixed(2)}% < ${thresholds.liquidation}% ? ${marginStatus.marginLevel < thresholds.liquidation}`);
            if (marginStatus.status === 'liquidation') {
                // ⚠️ CRITICAL SAFETY CHECK: NEVER liquidate with fallback/stale prices!
                // This prevents catastrophic losses from bad price data
                let hasFallbackPrices = false;
                let hasStalePrices = false;
                const MAX_PRICE_AGE_MS = 60000; // 60 seconds
                const now = Date.now();
                for (const position of openPositions) {
                    const currentPrice = pricesMap.get(position.symbol);
                    if (!currentPrice) {
                        console.error(`🚨 BLOCKED: No price available for ${position.symbol}`);
                        hasFallbackPrices = true;
                        break;
                    }
                    // Check if price is marked as fallback
                    if (currentPrice.isFallback) {
                        console.error(`🚨 BLOCKED LIQUIDATION: ${position.symbol} is using FALLBACK price ${currentPrice.mid.toFixed(5)} - REFUSING to liquidate!`);
                        hasFallbackPrices = true;
                        break;
                    }
                    // Check if price is stale (older than 60 seconds)
                    const priceAge = now - currentPrice.timestamp;
                    if (priceAge > MAX_PRICE_AGE_MS || currentPrice.isStale) {
                        console.error(`🚨 BLOCKED LIQUIDATION: ${position.symbol} price is STALE (${Math.round(priceAge / 1000)}s old) - REFUSING to liquidate!`);
                        hasStalePrices = true;
                        break;
                    }
                    // Check for suspicious price difference from entry (> 10% is very suspicious for forex)
                    const priceDiff = Math.abs(currentPrice.mid - position.entryPrice) / position.entryPrice;
                    if (priceDiff > 0.10) { // > 10% difference = definitely bad data
                        console.error(`🚨 BLOCKED LIQUIDATION: ${position.symbol} price ${currentPrice.mid.toFixed(5)} differs ${(priceDiff * 100).toFixed(2)}% from entry ${position.entryPrice.toFixed(5)} - likely BAD DATA!`);
                        hasFallbackPrices = true;
                        break;
                    }
                }
                if (hasFallbackPrices || hasStalePrices) {
                    console.log(`⚠️ SKIPPING liquidation for ${participant.username} due to unreliable price data`);
                    console.log(`   This is a SAFETY FEATURE to prevent liquidation at wrong prices!`);
                    continue; // Skip this participant entirely
                }
                console.log(`🚨 LIQUIDATING ${openPositions.length} positions for ${participant.username} (Margin: ${marginStatus.marginLevel.toFixed(2)}%)`);
                console.log(`   ✅ All prices verified as REAL and FRESH`);
                for (const position of openPositions) {
                    // Get price from batch (instant!)
                    const currentPrice = pricesMap.get(position.symbol);
                    if (!currentPrice)
                        continue;
                    const marketPrice = position.side === 'long' ? currentPrice.bid : currentPrice.ask;
                    await closePositionAutomatic(position._id.toString(), marketPrice, 'margin_call');
                }
                console.log(`   ⚠️ ✅ Liquidated all ${openPositions.length} positions for: ${participant.username}`);
            }
            else {
                console.log(`   ✅ No liquidation needed (Status: ${marginStatus.status})`);
            }
        }
        console.log(`\n🔍 ========== MARGIN CHECK END ==========\n`);
    }
    catch (error) {
        console.error('❌ Error checking margin calls:', error);
        console.error('❌ Stack:', error instanceof Error ? error.stack : error);
    }
};
exports.checkMarginCalls = checkMarginCalls;
