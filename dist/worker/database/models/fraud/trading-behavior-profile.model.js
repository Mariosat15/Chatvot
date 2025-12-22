"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const TradingPatternSchema = new mongoose_1.Schema({
    preferredPairs: {
        type: [String],
        default: []
    },
    tradingHoursDistribution: {
        type: [Number],
        default: () => Array(24).fill(0)
    },
    avgTradeSize: {
        type: Number,
        default: 0
    },
    avgTradeDuration: {
        type: Number,
        default: 0
    },
    avgStopLoss: {
        type: Number,
        default: 0
    },
    avgTakeProfit: {
        type: Number,
        default: 0
    },
    winRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    profitFactor: {
        type: Number,
        default: 0
    },
    avgTradesPerDay: {
        type: Number,
        default: 0
    },
    maxConcurrentPositions: {
        type: Number,
        default: 0
    },
    riskPerTrade: {
        type: Number,
        default: 0
    },
    scalperScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    swingScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    dayTraderScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    }
}, { _id: false });
const RecentTradeSchema = new mongoose_1.Schema({
    tradeId: {
        type: String,
        required: true
    },
    pair: {
        type: String,
        required: true
    },
    direction: {
        type: String,
        enum: ['buy', 'sell'],
        required: true
    },
    openTime: {
        type: Date,
        required: true
    },
    closeTime: Date,
    duration: Number,
    lotSize: {
        type: Number,
        required: true
    },
    pnl: Number,
    pips: Number,
    stopLoss: Number,
    takeProfit: Number
}, { _id: false });
const MirrorTradingSuspectSchema = new mongoose_1.Schema({
    pairedUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    detectedAt: {
        type: Date,
        default: Date.now
    },
    matchingTrades: {
        type: Number,
        default: 0
    },
    timingCorrelation: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    directionCorrelation: {
        type: Number,
        default: 0,
        min: -1,
        max: 1
    },
    confidence: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    }
}, { _id: false });
const TradingBehaviorProfileSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        unique: true,
        index: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
        index: true
    },
    totalTradesAnalyzed: {
        type: Number,
        default: 0
    },
    patterns: {
        type: TradingPatternSchema,
        default: () => ({})
    },
    behavioralFingerprint: {
        type: [Number],
        default: () => Array(32).fill(0)
    },
    recentTradeSequence: {
        type: [RecentTradeSchema],
        default: []
    },
    mirrorTradingSuspects: {
        type: [MirrorTradingSuspectSchema],
        default: []
    },
    competitionEntryTimes: {
        type: [Date],
        default: []
    },
    avgTimeToFirstTrade: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    collection: 'tradingbehaviorprofiles'
});
// Indexes
TradingBehaviorProfileSchema.index({ 'patterns.preferredPairs': 1 });
TradingBehaviorProfileSchema.index({ 'mirrorTradingSuspects.pairedUserId': 1 });
TradingBehaviorProfileSchema.index({ totalTradesAnalyzed: -1 });
// Keep only last 50 trades
TradingBehaviorProfileSchema.pre('save', function (next) {
    if (this.recentTradeSequence && this.recentTradeSequence.length > 50) {
        this.recentTradeSequence = this.recentTradeSequence.slice(-50);
    }
    if (this.competitionEntryTimes && this.competitionEntryTimes.length > 20) {
        this.competitionEntryTimes = this.competitionEntryTimes.slice(-20);
    }
    next();
});
const TradingBehaviorProfile = (mongoose_1.models.TradingBehaviorProfile || (0, mongoose_1.model)('TradingBehaviorProfile', TradingBehaviorProfileSchema));
exports.default = TradingBehaviorProfile;
