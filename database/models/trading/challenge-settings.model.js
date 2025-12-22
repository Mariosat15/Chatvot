"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
// In-memory cache for singleton settings (60 second TTL)
// This avoids DB query on every challenge creation
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
let cachedSettings = null;
let cacheTimestamp = 0;
const ChallengeSettingsSchema = new mongoose_1.Schema({
    platformFeePercentage: {
        type: Number,
        required: true,
        default: 10, // 10% platform fee
        min: 0,
        max: 50,
    },
    minEntryFee: {
        type: Number,
        required: true,
        default: 5,
        min: 1,
    },
    maxEntryFee: {
        type: Number,
        required: true,
        default: 1000,
        min: 1,
    },
    defaultStartingCapital: {
        type: Number,
        required: true,
        default: 10000,
        min: 100,
    },
    minStartingCapital: {
        type: Number,
        required: true,
        default: 1000,
        min: 100,
    },
    maxStartingCapital: {
        type: Number,
        required: true,
        default: 100000,
        min: 100,
    },
    minDurationMinutes: {
        type: Number,
        required: true,
        default: 15,
        min: 1,
    },
    maxDurationMinutes: {
        type: Number,
        required: true,
        default: 1440, // 24 hours
        min: 1,
    },
    defaultDurationMinutes: {
        type: Number,
        required: true,
        default: 60,
        min: 1,
    },
    acceptDeadlineMinutes: {
        type: Number,
        required: true,
        default: 30,
        min: 1,
    },
    defaultAssetClasses: [
        {
            type: String,
            enum: ['stocks', 'forex', 'crypto', 'indices'],
        },
    ],
    challengesEnabled: {
        type: Boolean,
        required: true,
        default: true,
    },
    requireBothOnline: {
        type: Boolean,
        required: true,
        default: false,
    },
    allowChallengeWhileInCompetition: {
        type: Boolean,
        required: true,
        default: true,
    },
    challengeCooldownMinutes: {
        type: Number,
        required: true,
        default: 5,
        min: 0,
    },
    maxPendingChallenges: {
        type: Number,
        required: true,
        default: 5,
        min: 1,
    },
    maxActiveChallenges: {
        type: Number,
        required: true,
        default: 3,
        min: 1,
    },
}, {
    timestamps: true,
});
// Singleton pattern with in-memory caching
ChallengeSettingsSchema.statics.getSingleton = async function () {
    const now = Date.now();
    // Return cached settings if valid
    if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedSettings;
    }
    // Fetch from DB
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({
            defaultAssetClasses: ['stocks', 'forex', 'crypto', 'indices'],
        });
    }
    // Update cache
    cachedSettings = settings;
    cacheTimestamp = now;
    return settings;
};
// Clear cache (call after admin updates settings)
ChallengeSettingsSchema.statics.clearCache = function () {
    cachedSettings = null;
    cacheTimestamp = 0;
};
const ChallengeSettings = mongoose_1.models?.ChallengeSettings ||
    (0, mongoose_1.model)('ChallengeSettings', ChallengeSettingsSchema);
exports.default = ChallengeSettings;
//# sourceMappingURL=challenge-settings.model.js.map