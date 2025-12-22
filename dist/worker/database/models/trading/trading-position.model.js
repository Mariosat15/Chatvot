"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const TradingPositionSchema = new mongoose_1.Schema({
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
    currentPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    unrealizedPnl: {
        type: Number,
        required: true,
        default: 0,
    },
    unrealizedPnlPercentage: {
        type: Number,
        required: true,
        default: 0,
    },
    stopLoss: {
        type: Number,
        min: 0,
    },
    takeProfit: {
        type: Number,
        min: 0,
    },
    trailingStop: {
        type: Number,
        min: 0,
    },
    leverage: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
        max: 500,
    },
    marginUsed: {
        type: Number,
        required: true,
        min: 0,
    },
    maintenanceMargin: {
        type: Number,
        required: true,
        min: 0,
    },
    status: {
        type: String,
        required: true,
        enum: ['open', 'closed', 'liquidated'],
        default: 'open',
    },
    closeReason: {
        type: String,
        enum: ['user', 'stop_loss', 'take_profit', 'margin_call', 'competition_end', 'challenge_end'],
    },
    openedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    closedAt: {
        type: Date,
    },
    holdingTimeSeconds: {
        type: Number,
        min: 0,
    },
    openOrderId: {
        type: String,
        required: true,
    },
    closeOrderId: {
        type: String,
    },
    tradeHistoryId: {
        type: String,
    },
    lastPriceUpdate: {
        type: Date,
        required: true,
        default: Date.now,
    },
    priceUpdateCount: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
});
// Indexes for fast queries
TradingPositionSchema.index({ competitionId: 1, status: 1 });
TradingPositionSchema.index({ userId: 1, status: 1 });
TradingPositionSchema.index({ symbol: 1, status: 1 });
TradingPositionSchema.index({ participantId: 1, status: 1 });
TradingPositionSchema.index({ competitionId: 1, userId: 1, status: 1 });
// PERFORMANCE: Additional indexes for common operations
TradingPositionSchema.index({ userId: 1, competitionId: 1, openedAt: -1 }); // User's positions in competition
TradingPositionSchema.index({ status: 1, lastPriceUpdate: 1 }); // For price update jobs
TradingPositionSchema.index({ competitionId: 1, symbol: 1, status: 1 }); // Symbol-based queries in competition
// Virtual for is profitable
TradingPositionSchema.virtual('isProfitable').get(function () {
    return this.unrealizedPnl > 0;
});
// Virtual for margin level (%)
TradingPositionSchema.virtual('marginLevel').get(function () {
    if (this.maintenanceMargin === 0)
        return 0;
    return (this.marginUsed / this.maintenanceMargin) * 100;
});
// Virtual for is at risk (close to margin call)
TradingPositionSchema.virtual('isAtRisk').get(function () {
    if (this.maintenanceMargin === 0)
        return false;
    const marginLevel = (this.marginUsed / this.maintenanceMargin) * 100;
    return marginLevel < 120; // Below 120% margin level
});
// Virtual for position value
TradingPositionSchema.virtual('positionValue').get(function () {
    return this.currentPrice * this.quantity;
});
const TradingPosition = (mongoose_1.models.TradingPosition || (0, mongoose_1.model)('TradingPosition', TradingPositionSchema));
exports.default = TradingPosition;
