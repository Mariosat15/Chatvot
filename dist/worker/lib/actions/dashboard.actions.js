'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserDashboardData = exports.getUserDashboardDataForApi = void 0;
const auth_1 = require("@/lib/better-auth/auth");
const headers_1 = require("next/headers");
const navigation_1 = require("next/navigation");
const mongoose_1 = require("@/database/mongoose");
const competition_participant_model_1 = __importDefault(require("@/database/models/trading/competition-participant.model"));
const competition_model_1 = __importDefault(require("@/database/models/trading/competition.model"));
const trading_position_model_1 = __importDefault(require("@/database/models/trading/trading-position.model"));
const trade_history_model_1 = __importDefault(require("@/database/models/trading/trade-history.model"));
const real_forex_prices_service_1 = require("@/lib/services/real-forex-prices.service");
const pnl_calculator_service_1 = require("@/lib/services/pnl-calculator.service");
// Disable verbose logging in production
const DEBUG = false;
const log = (...args) => { if (DEBUG)
    console.log(...args); };
// Get user's dashboard data (for API routes - takes userId directly, no redirect)
const getUserDashboardDataForApi = async (userId) => {
    try {
        await (0, mongoose_1.connectToDatabase)();
        log('📊 Dashboard API: Fetching data for user:', userId);
        // Get all active competitions the user is participating in (only LIVE competitions)
        const activeParticipations = await competition_participant_model_1.default.find({
            userId: userId,
            status: 'active',
        }).lean();
        log('📊 Active participations found:', activeParticipations.length);
        // Filter to only include competitions that are currently active (live now)
        const liveCompetitionIds = await competition_model_1.default.find({
            status: 'active',
            startTime: { $lte: new Date() },
            endTime: { $gte: new Date() },
        }).distinct('_id');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liveParticipations = activeParticipations.filter((participation) => liveCompetitionIds.some((id) => id.toString() === participation.competitionId.toString()));
        // Same logic as getUserDashboardData but with userId parameter
        const competitionsWithStats = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        liveParticipations.map(async (participation) => {
            try {
                const competition = await competition_model_1.default.findById(participation.competitionId).lean();
                if (!competition)
                    return null;
                const openPositions = await trading_position_model_1.default.find({
                    participantId: participation._id,
                    status: 'open',
                }).lean();
                // Calculate unrealized PnL for open positions
                let totalUnrealizedPnL = 0;
                const positionsWithPnL = await Promise.all(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                openPositions.map(async (pos) => {
                    try {
                        const priceQuote = await (0, real_forex_prices_service_1.getRealPrice)(pos.symbol);
                        if (priceQuote) {
                            const currentPrice = pos.type === 'long' ? priceQuote.bid : priceQuote.ask;
                            const unrealizedPnL = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(pos.type, pos.entryPrice, currentPrice, pos.size, pos.symbol);
                            totalUnrealizedPnL += unrealizedPnL;
                            return { ...pos, currentPrice, unrealizedPnL };
                        }
                        return pos;
                    }
                    catch {
                        return pos;
                    }
                }));
                const comp = competition;
                const currentCapital = (participation.currentCapital || comp.startingCapital || 0) + totalUnrealizedPnL;
                return {
                    competition: JSON.parse(JSON.stringify(competition)),
                    participation: {
                        ...JSON.parse(JSON.stringify(participation)),
                        currentCapital,
                        unrealizedPnL: totalUnrealizedPnL,
                    },
                    openPositions: JSON.parse(JSON.stringify(positionsWithPnL)),
                    openPositionsCount: openPositions.length,
                };
            }
            catch (error) {
                console.error(`❌ Error processing competition ${participation.competitionId}:`, error);
                return null;
            }
        }));
        const validCompetitions = competitionsWithStats.filter(Boolean);
        const totalCapital = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.currentCapital || 0), 0);
        const totalPnL = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.pnl || 0), 0);
        const totalPositions = validCompetitions.reduce((sum, comp) => sum + (comp?.openPositionsCount || 0), 0);
        const totalTrades = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.totalTrades || 0), 0);
        const totalWinningTrades = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.winningTrades || 0), 0);
        const totalLosingTrades = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.losingTrades || 0), 0);
        const overallWinRate = totalTrades > 0 ? (totalWinningTrades / totalTrades) * 100 : 0;
        return {
            activeCompetitions: validCompetitions,
            overallStats: {
                totalCapital,
                totalPnL,
                totalPositions,
                totalTrades,
                totalWinningTrades,
                totalLosingTrades,
                overallWinRate,
                profitFactor: 0,
                activeCompetitionsCount: validCompetitions.length,
            },
            globalCharts: {
                dailyPnL: [],
            },
        };
    }
    catch (error) {
        console.error('❌ Error getting dashboard data for API:', error);
        return null;
    }
};
exports.getUserDashboardDataForApi = getUserDashboardDataForApi;
// Get user's dashboard data (for client components - uses redirect)
// OPTIMIZED: Batch queries instead of N+1 problem
const getUserDashboardData = async () => {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user)
            (0, navigation_1.redirect)('/sign-in');
        await (0, mongoose_1.connectToDatabase)();
        const userId = session.user.id;
        log('📊 Dashboard: Fetching data for user:', userId, session.user.name);
        // ========== STEP 1: Get user's active participations ==========
        const activeParticipations = await competition_participant_model_1.default.find({
            userId,
            status: 'active',
        }).lean();
        if (activeParticipations.length === 0) {
            return getEmptyDashboardData();
        }
        // ========== STEP 2: Get all live competitions in ONE query ==========
        const now = new Date();
        const liveCompetitions = await competition_model_1.default.find({
            status: 'active',
            startTime: { $lte: now },
            endTime: { $gte: now },
        }).lean();
        const liveCompetitionMap = new Map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        liveCompetitions.map((c) => [c._id.toString(), c]));
        // Filter to live participations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liveParticipations = activeParticipations.filter((p) => liveCompetitionMap.has(p.competitionId.toString()));
        if (liveParticipations.length === 0) {
            return getEmptyDashboardData();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const competitionIds = liveParticipations.map((p) => p.competitionId);
        // ========== STEP 3: Batch fetch ALL data in parallel ==========
        const [allOpenPositions, allRecentTrades, participantStatsByComp, allParticipantsByComp,] = await Promise.all([
            // All open positions for user across all competitions
            trading_position_model_1.default.find({
                competitionId: { $in: competitionIds },
                userId,
                status: 'open',
            }).lean(),
            // All recent trades for user across all competitions
            trade_history_model_1.default.find({
                competitionId: { $in: competitionIds },
                userId,
            })
                .sort({ closedAt: -1 })
                .limit(50) // Reasonable limit
                .lean(),
            // Participant stats aggregation for all competitions at once
            competition_participant_model_1.default.aggregate([
                { $match: { competitionId: { $in: competitionIds } } },
                {
                    $group: {
                        _id: { competitionId: '$competitionId', status: '$status' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            // All participants for win probability (limited fields)
            competition_participant_model_1.default.find({
                competitionId: { $in: competitionIds },
            })
                .select('competitionId userId currentCapital pnl pnlPercentage totalTrades winningTrades losingTrades winRate currentRank status')
                .lean(),
        ]);
        // ========== STEP 4: Fetch ALL prices in ONE batch call ==========
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueSymbols = [...new Set(allOpenPositions.map((p) => p.symbol))];
        const pricesMap = uniqueSymbols.length > 0
            ? await (0, real_forex_prices_service_1.fetchRealForexPrices)(uniqueSymbols)
            : new Map();
        // ========== STEP 5: Build competition data from pre-fetched results ==========
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const competitionsWithStats = liveParticipations.map((participation) => {
            const compId = participation.competitionId.toString();
            const competition = liveCompetitionMap.get(compId);
            if (!competition)
                return null;
            // Filter positions for this competition
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const openPositions = allOpenPositions.filter((p) => p.competitionId.toString() === compId);
            // Calculate unrealized P&L using pre-fetched prices
            let totalUnrealizedPnL = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const openPositionsWithPrices = openPositions.map((pos) => {
                const priceQuote = pricesMap.get(pos.symbol);
                const currentPrice = priceQuote
                    ? (pos.side === 'long' ? priceQuote.bid : priceQuote.ask)
                    : pos.entryPrice;
                const unrealizedPnl = (0, pnl_calculator_service_1.calculateUnrealizedPnL)(pos.side, pos.entryPrice, currentPrice, pos.quantity, pos.symbol);
                totalUnrealizedPnL += unrealizedPnl;
                const unrealizedPnlPercentage = pos.marginUsed > 0
                    ? (unrealizedPnl / pos.marginUsed) * 100
                    : 0;
                return { ...pos, currentPrice, unrealizedPnl, unrealizedPnlPercentage };
            });
            // Filter trades for this competition
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const recentClosedTrades = allRecentTrades.filter((t) => t.competitionId.toString() === compId).slice(0, 10);
            // Build participant stats from aggregation
            const stats = { active: 0, liquidated: 0, completed: 0, disqualified: 0, total: 0 };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            participantStatsByComp.forEach((s) => {
                if (s._id.competitionId.toString() === compId) {
                    const status = s._id.status;
                    if (status in stats) {
                        stats[status] = s.count;
                        stats.total += s.count;
                    }
                }
            });
            // Filter participants for this competition
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const compParticipants = allParticipantsByComp.filter((p) => p.competitionId.toString() === compId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const activeParticipantsList = compParticipants.filter((p) => p.status === 'active')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .sort((a, b) => (a.currentRank || 999) - (b.currentRank || 999))
                .slice(0, 20);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const liquidatedParticipants = compParticipants.filter((p) => p.status === 'liquidated').slice(0, 20);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const disqualifiedParticipants = compParticipants.filter((p) => p.status === 'disqualified').slice(0, 20);
            return {
                competition: JSON.parse(JSON.stringify(competition)),
                participation: JSON.parse(JSON.stringify({
                    ...participation,
                    unrealizedPnl: totalUnrealizedPnL,
                })),
                openPositionsCount: openPositions.length,
                recentClosedTrades: JSON.parse(JSON.stringify(recentClosedTrades)),
                openPositions: JSON.parse(JSON.stringify(openPositionsWithPrices)),
                participantStats: {
                    counts: stats,
                    active: JSON.parse(JSON.stringify(activeParticipantsList)),
                    liquidated: JSON.parse(JSON.stringify(liquidatedParticipants)),
                    disqualified: JSON.parse(JSON.stringify(disqualifiedParticipants)),
                },
                allParticipants: JSON.parse(JSON.stringify(compParticipants)),
            };
        });
        // Filter out null values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const validCompetitions = competitionsWithStats.filter(Boolean);
        // ========== STEP 6: Calculate overall stats ==========
        const totalCapital = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.currentCapital || 0), 0);
        const totalPnL = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.pnl || 0), 0);
        const totalPositions = validCompetitions.reduce((sum, comp) => sum + (comp?.openPositionsCount || 0), 0);
        const totalTrades = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.totalTrades || 0), 0);
        const totalWinningTrades = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.winningTrades || 0), 0);
        const totalLosingTrades = validCompetitions.reduce((sum, comp) => sum + (comp?.participation.losingTrades || 0), 0);
        const overallWinRate = totalTrades > 0
            ? (totalWinningTrades / totalTrades) * 100
            : 0;
        // Calculate profit factor
        let totalGrossProfit = 0;
        let totalGrossLoss = 0;
        validCompetitions.forEach((comp) => {
            const p = comp?.participation;
            if (p?.averageWin && p?.winningTrades) {
                totalGrossProfit += p.averageWin * p.winningTrades;
            }
            if (p?.averageLoss && p?.losingTrades) {
                totalGrossLoss += Math.abs(p.averageLoss) * p.losingTrades;
            }
        });
        const profitFactor = totalGrossLoss > 0
            ? totalGrossProfit / totalGrossLoss
            : totalWinningTrades > 0 ? 9999 : 0;
        // ========== STEP 7: Build daily P&L chart (using pre-fetched trades) ==========
        const aggregatedDailyPnL = new Map();
        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            aggregatedDailyPnL.set(dateStr, { pnl: 0, trades: 0 });
        }
        // Aggregate from pre-fetched trades (already have them!)
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dayTrades = allRecentTrades.filter((t) => {
                const tradeDate = new Date(t.closedAt);
                return tradeDate >= startOfDay && tradeDate <= endOfDay;
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dayPnL = dayTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
            aggregatedDailyPnL.set(dateStr, { pnl: dayPnL, trades: dayTrades.length });
        }
        const globalDailyPnL = Array.from(aggregatedDailyPnL.entries()).map(([date, data]) => ({
            date,
            pnl: data.pnl,
            trades: data.trades
        }));
        log('📊 Dashboard Summary (OPTIMIZED):');
        log(`   - Competitions: ${validCompetitions.length}`);
        log(`   - Total Positions: ${totalPositions}`);
        log(`   - Total Trades: ${totalTrades}`);
        return {
            activeCompetitions: validCompetitions,
            overallStats: {
                totalCapital,
                totalPnL,
                totalPositions,
                totalTrades,
                totalWinningTrades,
                totalLosingTrades,
                overallWinRate,
                profitFactor,
                activeCompetitionsCount: validCompetitions.length,
            },
            globalCharts: {
                dailyPnL: globalDailyPnL,
            },
        };
    }
    catch (error) {
        if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
            throw error;
        }
        console.error('❌ Error getting dashboard data:', error);
        return getEmptyDashboardData();
    }
};
exports.getUserDashboardData = getUserDashboardData;
// Helper function to return empty dashboard data
function getEmptyDashboardData() {
    return {
        activeCompetitions: [],
        overallStats: {
            totalCapital: 0,
            totalPnL: 0,
            totalPositions: 0,
            totalTrades: 0,
            totalWinningTrades: 0,
            totalLosingTrades: 0,
            overallWinRate: 0,
            profitFactor: 0,
            activeCompetitionsCount: 0,
        },
        globalCharts: {
            dailyPnL: [],
        },
    };
}
