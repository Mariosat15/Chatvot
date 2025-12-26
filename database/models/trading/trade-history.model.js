"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const TradeHistorySchema = new mongoose_1.Schema({
    competitionId: {
        type: String,
        required: true,
    },
    userId: {
        type: String,
        required: true,
    },
    participantId: {
        type: String,
        required: true,
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true,
    },
    side: {
        type: String,
        required: true,
        enum: ['long', 'short'],
    },
    quantity: {
        type: Number,
        required: true,
        min: 0.01,
    },
    orderType: {
        type: String,
        required: true,
        enum: ['market', 'limit'],
        default: 'market',
    },
    limitPrice: {
        type: Number,
        min: 0,
    },
    entryPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    exitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    priceChange: {
        type: Number,
        required: true,
    },
    priceChangePercentage: {
        type: Number,
        required: true,
    },
    realizedPnl: {
        type: Number,
        required: true,
    },
    realizedPnlPercentage: {
        type: Number,
        required: true,
    },
    openedAt: {
        type: Date,
        required: true,
    },
    closedAt: {
        type: Date,
        required: true,
    },
    holdingTimeSeconds: {
        type: Number,
        required: true,
        min: 0,
    },
    closeReason: {
        type: String,
        required: true,
        enum: ['user', 'stop_loss', 'take_profit', 'margin_call', 'competition_end', 'challenge_end'],
    },
    leverage: {
        type: Number,
        required: true,
        min: 1,
    },
    marginUsed: {
        type: Number,
        required: true,
        min: 0,
    },
    hadStopLoss: {
        type: Boolean,
        required: true,
        default: false,
    },
    stopLossPrice: {
        type: Number,
        min: 0,
    },
    hadTakeProfit: {
        type: Boolean,
        required: true,
        default: false,
    },
    takeProfitPrice: {
        type: Number,
        min: 0,
    },
    openOrderId: {
        type: String,
        required: true,
    },
    closeOrderId: {
        type: String,
        required: true,
    },
    positionId: {
        type: String,
        required: true,
    },
    isWinner: {
        type: Boolean,
        required: true,
    },
    riskRewardRatio: {
        type: Number,
        min: 0,
    },
    entrySpread: {
        type: Number,
        min: 0,
    },
    entryVolatility: {
        type: Number,
        min: 0,
    },
    exitSpread: {
        type: Number,
        min: 0,
    },
    exitVolatility: {
        type: Number,
        min: 0,
    },
    commission: {
        type: Number,
        default: 0,
        min: 0,
    },
    swap: {
        type: Number,
        default: 0,
    },
    totalCosts: {
        type: Number,
        default: 0,
        min: 0,
    },
    netPnl: {
        type: Number,
    },
}, {
    timestamps: true,
});
// Indexes for fast queries
TradeHistorySchema.index({ competitionId: 1, closedAt: -1 });
TradeHistorySchema.index({ userId: 1, closedAt: -1 });
TradeHistorySchema.index({ participantId: 1, closedAt: -1 });
TradeHistorySchema.index({ symbol: 1, closedAt: -1 });
TradeHistorySchema.index({ competitionId: 1, isWinner: 1 });
TradeHistorySchema.index({ userId: 1, isWinner: 1 });
// PERFORMANCE: Additional indexes for analytics and reporting
TradeHistorySchema.index({ userId: 1, competitionId: 1, closedAt: -1 }); // User's trades in competition
TradeHistorySchema.index({ competitionId: 1, realizedPnl: -1 }); // Top trades leaderboard
TradeHistorySchema.index({ closeReason: 1, closedAt: -1 }); // Analyzing close reasons
// Virtual for trade duration (human readable)
TradeHistorySchema.virtual('holdingTimeDuration').get(function () {
    const seconds = this.holdingTimeSeconds;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0)
        return `${hours}h ${minutes}m`;
    return `${minutes}m`;
});
// Virtual for was stopped out
TradeHistorySchema.virtual('wasStoppedOut').get(function () {
    return this.closeReason === 'stop_loss';
});
// Virtual for hit take profit
TradeHistorySchema.virtual('hitTakeProfit').get(function () {
    return this.closeReason === 'take_profit';
});
const TradeHistory = mongoose_1.models?.TradeHistory || (0, mongoose_1.model)('TradeHistory', TradeHistorySchema);
exports.default = TradeHistory;
//# sourceMappingURL=trade-history.model.js.map