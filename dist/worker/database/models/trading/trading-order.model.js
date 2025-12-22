"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const TradingOrderSchema = new mongoose_1.Schema({
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
        enum: ['buy', 'sell'],
    },
    orderType: {
        type: String,
        required: true,
        enum: ['market', 'limit', 'stop', 'stop_limit'],
        default: 'market',
    },
    quantity: {
        type: Number,
        required: true,
        min: 0.01, // Minimum 0.01 lot
    },
    requestedPrice: {
        type: Number,
        min: 0,
    },
    executedPrice: {
        type: Number,
        min: 0,
    },
    slippage: {
        type: Number,
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
    leverage: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
        max: 500,
    },
    marginRequired: {
        type: Number,
        required: true,
        min: 0,
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'filled', 'partially_filled', 'cancelled', 'rejected', 'expired'],
        default: 'pending',
    },
    filledQuantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    remainingQuantity: {
        type: Number,
        required: true,
        min: 0,
    },
    placedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    executedAt: {
        type: Date,
    },
    expiresAt: {
        type: Date,
    },
    rejectionReason: {
        type: String,
    },
    positionId: {
        type: String,
    },
    orderSource: {
        type: String,
        required: true,
        enum: ['web', 'mobile', 'api', 'system'],
        default: 'web',
    },
    ipAddress: {
        type: String,
    },
}, {
    timestamps: true,
});
// Indexes for fast queries
TradingOrderSchema.index({ competitionId: 1, userId: 1, placedAt: -1 });
TradingOrderSchema.index({ status: 1, placedAt: -1 });
TradingOrderSchema.index({ symbol: 1, status: 1 });
TradingOrderSchema.index({ userId: 1, status: 1, placedAt: -1 });
// Virtual for is filled
TradingOrderSchema.virtual('isFilled').get(function () {
    return this.status === 'filled';
});
// Virtual for fill percentage
TradingOrderSchema.virtual('fillPercentage').get(function () {
    if (this.quantity === 0)
        return 0;
    return (this.filledQuantity / this.quantity) * 100;
});
// Virtual for total value
TradingOrderSchema.virtual('totalValue').get(function () {
    if (!this.executedPrice)
        return 0;
    return this.executedPrice * this.filledQuantity;
});
const TradingOrder = (mongoose_1.models.TradingOrder || (0, mongoose_1.model)('TradingOrder', TradingOrderSchema));
exports.default = TradingOrder;
