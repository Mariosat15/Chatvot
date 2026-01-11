"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const ChallengeParticipantSchema = new mongoose_1.Schema({
    challengeId: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        enum: ['challenger', 'challenged'],
    },
    startingCapital: {
        type: Number,
        required: true,
        min: 0,
    },
    currentCapital: {
        type: Number,
        required: true,
        min: 0,
    },
    availableCapital: {
        type: Number,
        required: true,
        min: 0,
    },
    usedMargin: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    pnl: {
        type: Number,
        required: true,
        default: 0,
    },
    pnlPercentage: {
        type: Number,
        required: true,
        default: 0,
    },
    realizedPnl: {
        type: Number,
        required: true,
        default: 0,
    },
    unrealizedPnl: {
        type: Number,
        required: true,
        default: 0,
    },
    totalTrades: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    winningTrades: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    losingTrades: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    winRate: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 100,
    },
    averageWin: {
        type: Number,
        required: true,
        default: 0,
    },
    averageLoss: {
        type: Number,
        required: true,
        default: 0,
    },
    largestWin: {
        type: Number,
        required: true,
        default: 0,
    },
    largestLoss: {
        type: Number,
        required: true,
        default: 0,
    },
    currentOpenPositions: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    maxDrawdown: {
        type: Number,
        required: true,
        default: 0,
    },
    maxDrawdownPercentage: {
        type: Number,
        required: true,
        default: 0,
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'liquidated', 'completed', 'disqualified'],
        default: 'active',
    },
    liquidationReason: {
        type: String,
    },
    disqualificationReason: {
        type: String,
    },
    marginCallWarnings: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    lastMarginCallAt: {
        type: Date,
    },
    isWinner: {
        type: Boolean,
        required: true,
        default: false,
    },
    prizeReceived: {
        type: Number,
        required: true,
        default: 0,
    },
    joinedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    lastTradeAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Indexes
ChallengeParticipantSchema.index({ challengeId: 1, userId: 1 }, { unique: true });
ChallengeParticipantSchema.index({ userId: 1, status: 1 });
ChallengeParticipantSchema.index({ challengeId: 1, pnl: -1 });
const ChallengeParticipant = mongoose_1.models?.ChallengeParticipant ||
    (0, mongoose_1.model)('ChallengeParticipant', ChallengeParticipantSchema);
exports.default = ChallengeParticipant;
//# sourceMappingURL=challenge-participant.model.js.map