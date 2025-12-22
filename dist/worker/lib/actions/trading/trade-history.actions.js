'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompetitionTradeHistory = getCompetitionTradeHistory;
exports.getCompetitionTradeStats = getCompetitionTradeStats;
const mongoose_1 = require("@/database/mongoose");
const trade_history_model_1 = __importDefault(require("@/database/models/trading/trade-history.model"));
const auth_1 = require("@/lib/better-auth/auth");
const headers_1 = require("next/headers");
/**
 * Get trade history for a user in a specific competition
 */
async function getCompetitionTradeHistory(competitionId) {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user) {
            throw new Error('Unauthorized');
        }
        const userId = session.user.id;
        await (0, mongoose_1.connectToDatabase)();
        // Fetch all closed trades for this user in this competition
        const trades = await trade_history_model_1.default.find({
            competitionId,
            userId,
        })
            .sort({ closedAt: -1 }) // Most recent first
            .lean();
        // Transform for client
        const formattedTrades = trades.map((trade) => ({
            _id: String(trade._id),
            symbol: trade.symbol,
            side: trade.side,
            quantity: trade.quantity,
            orderType: trade.orderType || 'market',
            limitPrice: trade.limitPrice,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            realizedPnl: trade.realizedPnl || 0,
            realizedPnlPercentage: trade.realizedPnlPercentage || 0,
            marginUsed: trade.marginUsed || 0,
            entrySpread: trade.entrySpread || 0,
            exitSpread: trade.exitSpread || 0,
            totalCosts: trade.totalCosts || 0,
            openedAt: trade.openedAt.toISOString(),
            closedAt: trade.closedAt.toISOString(),
            closeReason: mapCloseReason(trade.closeReason),
        }));
        return {
            success: true,
            trades: formattedTrades,
        };
    }
    catch (error) {
        console.error('❌ Error fetching trade history:', error);
        return {
            success: false,
            trades: [],
            error: error instanceof Error ? error.message : 'Failed to fetch trade history',
        };
    }
}
/**
 * Get trade statistics for a user in a competition
 */
async function getCompetitionTradeStats(competitionId) {
    try {
        const session = await auth_1.auth.api.getSession({ headers: await (0, headers_1.headers)() });
        if (!session?.user) {
            throw new Error('Unauthorized');
        }
        const userId = session.user.id;
        await (0, mongoose_1.connectToDatabase)();
        const trades = await trade_history_model_1.default.find({
            competitionId,
            userId,
        }).lean();
        const totalTrades = trades.length;
        const winningTrades = trades.filter((t) => t.isWinner).length;
        const losingTrades = totalTrades - winningTrades;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const totalPnl = trades.reduce((sum, t) => sum + t.realizedPnl, 0);
        const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;
        const bestTrade = trades.length > 0
            ? Math.max(...trades.map((t) => t.realizedPnl))
            : 0;
        const worstTrade = trades.length > 0
            ? Math.min(...trades.map((t) => t.realizedPnl))
            : 0;
        return {
            success: true,
            stats: {
                totalTrades,
                winningTrades,
                losingTrades,
                winRate,
                totalPnl,
                avgPnl,
                bestTrade,
                worstTrade,
            },
        };
    }
    catch (error) {
        console.error('❌ Error fetching trade stats:', error);
        return {
            success: false,
            stats: null,
            error: error instanceof Error ? error.message : 'Failed to fetch trade stats',
        };
    }
}
// Helper function to map close reasons
function mapCloseReason(reason) {
    switch (reason) {
        case 'user':
            return 'manual';
        case 'stop_loss':
            return 'stop_loss';
        case 'take_profit':
            return 'take_profit';
        case 'margin_call':
        case 'competition_end':
            return 'liquidation';
        default:
            return 'manual';
    }
}
