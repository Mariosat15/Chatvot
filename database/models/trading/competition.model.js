"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const CompetitionSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    entryFee: {
        type: Number,
        required: true,
        min: 0,
    },
    startingCapital: {
        type: Number,
        required: true,
        min: 100,
    },
    minParticipants: {
        type: Number,
        required: true,
        default: 2,
        min: 2,
    },
    maxParticipants: {
        type: Number,
        required: true,
        default: 100,
        min: 2,
    },
    currentParticipants: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    startTime: {
        type: Date,
        required: true,
    },
    endTime: {
        type: Date,
        required: true,
    },
    registrationDeadline: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['draft', 'upcoming', 'active', 'completed', 'cancelled'],
        default: 'draft',
    },
    cancellationReason: {
        type: String,
    },
    assetClasses: [
        {
            type: String,
            enum: ['stocks', 'forex', 'crypto', 'indices'],
        },
    ],
    allowedSymbols: [String],
    blockedSymbols: [String],
    leverage: {
        enabled: { type: Boolean, default: false },
        min: { type: Number, default: 1, min: 1 },
        max: { type: Number, default: 10, min: 1, max: 500 },
        default: { type: Number, default: 1, min: 1 },
    },
    competitionType: {
        type: String,
        required: true,
        enum: ['time_based', 'goal_based', 'hybrid'],
        default: 'time_based',
    },
    goalConfig: {
        targetReturn: { type: Number },
        targetCapital: { type: Number },
    },
    prizePool: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    platformFeePercentage: {
        type: Number,
        required: true,
        default: 20,
        min: 0,
        max: 50,
    },
    prizeDistribution: [
        {
            rank: { type: Number, required: true },
            percentage: { type: Number, required: true, min: 0, max: 100 },
        },
    ],
    rules: {
        rankingMethod: {
            type: String,
            enum: ['pnl', 'roi', 'total_capital', 'win_rate', 'total_wins', 'profit_factor'],
            required: true,
            default: 'pnl',
        },
        tieBreaker1: {
            type: String,
            enum: ['trades_count', 'win_rate', 'total_capital', 'roi', 'join_time', 'split_prize'],
            required: true,
            default: 'trades_count',
        },
        tieBreaker2: {
            type: String,
            enum: ['trades_count', 'win_rate', 'total_capital', 'roi', 'join_time', 'split_prize'],
        },
        minimumTrades: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        minimumWinRate: {
            type: Number,
            min: 0,
            max: 100,
        },
        tiePrizeDistribution: {
            type: String,
            enum: ['split_equally', 'split_weighted', 'first_gets_all'],
            required: true,
            default: 'split_equally',
        },
        disqualifyOnLiquidation: {
            type: Boolean,
            required: true,
            default: true,
        },
    },
    levelRequirement: {
        enabled: {
            type: Boolean,
            required: true,
            default: false,
        },
        minLevel: {
            type: Number,
            min: 1,
            max: 10,
            default: 1,
        },
        maxLevel: {
            type: Number,
            min: 1,
            max: 10,
        },
    },
    maxPositionSize: {
        type: Number,
        required: true,
        default: 20, // 20% of capital per position
        min: 1,
        max: 100,
    },
    maxOpenPositions: {
        type: Number,
        required: true,
        default: 10,
        min: 1,
        max: 100,
    },
    allowShortSelling: {
        type: Boolean,
        required: true,
        default: false,
    },
    marginCallThreshold: {
        type: Number,
        required: true,
        default: 50, // 50% of starting capital
        min: 10,
        max: 90,
    },
    riskLimits: {
        maxDrawdownPercent: {
            type: Number,
            default: 50, // 50% max drawdown by default
            min: 1,
            max: 100,
        },
        dailyLossLimitPercent: {
            type: Number,
            default: 20, // 20% daily loss limit by default
            min: 1,
            max: 100,
        },
        equityDrawdownPercent: {
            type: Number,
            default: 30, // 30% equity drawdown by default (stricter than balance)
            min: 1,
            max: 100,
        },
        equityCheckEnabled: {
            type: Boolean,
            default: false, // Equity check disabled by default
        },
        enabled: {
            type: Boolean,
            default: false, // Disabled by default
        },
    },
    winnerId: {
        type: String,
    },
    winnerPnL: {
        type: Number,
    },
    finalLeaderboard: [
        {
            rank: Number,
            userId: String,
            username: String,
            finalCapital: Number,
            pnl: Number,
            pnlPercentage: Number,
            totalTrades: Number,
            winRate: Number,
            prizeAmount: Number,
        },
    ],
    createdBy: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
    },
    tags: [String],
}, {
    timestamps: true,
});
// Indexes for fast queries
CompetitionSchema.index({ status: 1, startTime: -1 });
// Note: slug already has unique index from schema definition (unique: true)
CompetitionSchema.index({ createdBy: 1 });
CompetitionSchema.index({ status: 1, registrationDeadline: 1 });
// PERFORMANCE: Additional indexes for common queries
CompetitionSchema.index({ status: 1, endTime: 1 }); // Finding active/ending competitions
CompetitionSchema.index({ status: 1, currentParticipants: 1 }); // Finding competitions with spots
CompetitionSchema.index({ tags: 1, status: 1 }); // Tag-based filtering
// Virtual for days until start
CompetitionSchema.virtual('daysUntilStart').get(function () {
    if (this.status !== 'upcoming')
        return 0;
    const now = new Date();
    const diff = this.startTime.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
});
// Virtual for competition duration
CompetitionSchema.virtual('durationDays').get(function () {
    const diff = this.endTime.getTime() - this.startTime.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
});
// Virtual for is registration open
CompetitionSchema.virtual('isRegistrationOpen').get(function () {
    const now = new Date();
    return (this.status === 'upcoming' &&
        now < this.registrationDeadline &&
        this.currentParticipants < this.maxParticipants);
});
const Competition = mongoose_1.models?.Competition || (0, mongoose_1.model)('Competition', CompetitionSchema);
exports.default = Competition;
