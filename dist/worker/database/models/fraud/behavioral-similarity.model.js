"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const SimilarityBreakdownSchema = new mongoose_1.Schema({
    pairSimilarity: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    timingSimilarity: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    sizeSimilarity: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    durationSimilarity: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    riskSimilarity: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    styleScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    fingerprintDistance: {
        type: Number,
        default: 0
    }
}, { _id: false });
const MirrorTradingEvidenceSchema = new mongoose_1.Schema({
    tradeId1: {
        type: String,
        required: true
    },
    tradeId2: {
        type: String,
        required: true
    },
    pair: {
        type: String,
        required: true
    },
    timeDelta: {
        type: Number,
        required: true
    },
    direction1: {
        type: String,
        enum: ['buy', 'sell'],
        required: true
    },
    direction2: {
        type: String,
        enum: ['buy', 'sell'],
        required: true
    },
    isOpposite: {
        type: Boolean,
        default: false
    },
    isSameTime: {
        type: Boolean,
        default: false
    },
    detectedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });
const BehavioralSimilaritySchema = new mongoose_1.Schema({
    userId1: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    userId2: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    similarityScore: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 1,
        index: true
    },
    similarityBreakdown: {
        type: SimilarityBreakdownSchema,
        default: () => ({})
    },
    mirrorTradingDetected: {
        type: Boolean,
        default: false,
        index: true
    },
    mirrorTradingScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    mirrorTradingEvidence: {
        type: [MirrorTradingEvidenceSchema],
        default: []
    },
    flaggedForReview: {
        type: Boolean,
        default: false,
        index: true
    },
    reviewedAt: Date,
    reviewedBy: String,
    reviewNotes: String,
    firstDetected: {
        type: Date,
        default: Date.now
    },
    lastCalculated: {
        type: Date,
        default: Date.now,
        index: true
    },
    calculationCount: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true,
    collection: 'behavioralsimilarities'
});
// Compound index for unique pairs (order-independent)
BehavioralSimilaritySchema.index({ userId1: 1, userId2: 1 }, { unique: true });
BehavioralSimilaritySchema.index({ similarityScore: -1, mirrorTradingDetected: 1 });
BehavioralSimilaritySchema.index({ flaggedForReview: 1, similarityScore: -1 });
// Keep only last 20 mirror trading evidence entries
BehavioralSimilaritySchema.pre('save', function (next) {
    if (this.mirrorTradingEvidence && this.mirrorTradingEvidence.length > 20) {
        this.mirrorTradingEvidence = this.mirrorTradingEvidence.slice(-20);
    }
    next();
});
// Static method to find or create similarity record (order-independent)
BehavioralSimilaritySchema.statics.findOrCreatePair = async function (userId1, userId2) {
    // Ensure consistent ordering (smaller ID first)
    const [sortedId1, sortedId2] = [userId1, userId2].sort();
    let similarity = await this.findOne({
        userId1: sortedId1,
        userId2: sortedId2
    });
    if (!similarity) {
        similarity = await this.create({
            userId1: sortedId1,
            userId2: sortedId2
        });
    }
    return similarity;
};
// Static method to find high similarity pairs
BehavioralSimilaritySchema.statics.findHighSimilarity = function (threshold = 0.7) {
    return this.find({
        similarityScore: { $gte: threshold }
    }).sort({ similarityScore: -1 });
};
// Static method to find mirror trading pairs
BehavioralSimilaritySchema.statics.findMirrorTrading = function () {
    return this.find({
        mirrorTradingDetected: true
    }).sort({ mirrorTradingScore: -1 });
};
const BehavioralSimilarity = (mongoose_1.models.BehavioralSimilarity || (0, mongoose_1.model)('BehavioralSimilarity', BehavioralSimilaritySchema));
exports.default = BehavioralSimilarity;
