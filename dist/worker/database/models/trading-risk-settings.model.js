"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
// In-memory cache for singleton settings (60 second TTL)
// This avoids DB query on every trade/challenge
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
let cachedRiskSettings = null;
let riskCacheTimestamp = 0;
const TradingRiskSettingsSchema = new mongoose_1.Schema({
    _id: {
        type: String,
        default: 'global-trading-risk-settings',
    },
    // Margin Levels
    marginLiquidation: {
        type: Number,
        required: true,
        default: 50,
        min: 1,
        max: 1000, // Increased from 100 to allow more flexibility
    },
    marginCall: {
        type: Number,
        required: true,
        default: 100,
        min: 1,
        max: 1000, // Increased from 200 to allow more flexibility
    },
    marginWarning: {
        type: Number,
        required: true,
        default: 150,
        min: 1,
        max: 1000, // Increased from 300 to allow more flexibility
    },
    marginSafe: {
        type: Number,
        required: true,
        default: 200,
        min: 1,
        max: 1000, // Increased from 500 to allow more flexibility
    },
    // Position Limits
    maxOpenPositions: {
        type: Number,
        required: true,
        default: 10,
        min: 1,
        max: 100,
    },
    maxPositionSize: {
        type: Number,
        required: true,
        default: 100,
        min: 0.01,
    },
    // Leverage Limits
    minLeverage: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
    },
    maxLeverage: {
        type: Number,
        required: true,
        default: 500,
        max: 500,
    },
    defaultLeverage: {
        type: Number,
        required: true,
        default: 10,
        min: 1,
    },
    // Risk Limits
    maxDrawdownPercent: {
        type: Number,
        required: true,
        default: 50,
        min: 1,
        max: 100,
    },
    dailyLossLimit: {
        type: Number,
        required: true,
        default: 20,
        min: 1,
        max: 100,
    },
    // Monitoring Settings
    marginCheckIntervalSeconds: {
        type: Number,
        required: true,
        default: 60, // Check every 60 seconds by default
        min: 1, // At least 1 second
        max: 3600, // Max 1 hour
    },
    // Metadata
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    updatedBy: {
        type: String,
    },
});
// There should only be one settings document
// We'll use a singleton pattern with a fixed ID and in-memory caching
TradingRiskSettingsSchema.statics.getSingleton = async function () {
    const now = Date.now();
    // Return cached settings if valid
    if (cachedRiskSettings && (now - riskCacheTimestamp) < CACHE_TTL_MS) {
        return cachedRiskSettings;
    }
    const SINGLETON_ID = 'global-trading-risk-settings';
    let settings = await this.findById(SINGLETON_ID);
    if (!settings) {
        // Create default settings if none exist
        settings = await this.create({
            _id: SINGLETON_ID,
            marginLiquidation: 50,
            marginCall: 100,
            marginWarning: 150,
            marginSafe: 200,
            maxOpenPositions: 10,
            maxPositionSize: 100,
            minLeverage: 1,
            maxLeverage: 500,
            defaultLeverage: 10,
            maxDrawdownPercent: 50,
            dailyLossLimit: 20,
            marginCheckIntervalSeconds: 60,
        });
    }
    // Update cache
    cachedRiskSettings = settings;
    riskCacheTimestamp = now;
    return settings;
};
TradingRiskSettingsSchema.statics.updateSingleton = async function (updates) {
    const SINGLETON_ID = 'global-trading-risk-settings';
    const settings = await this.findByIdAndUpdate(SINGLETON_ID, {
        ...updates,
        updatedAt: new Date(),
    }, {
        new: true,
        upsert: true,
        runValidators: true,
    });
    // Clear cache after update so next read gets fresh data
    cachedRiskSettings = null;
    riskCacheTimestamp = 0;
    return settings;
};
// Clear cache (call after admin updates settings)
TradingRiskSettingsSchema.statics.clearCache = function () {
    cachedRiskSettings = null;
    riskCacheTimestamp = 0;
};
const TradingRiskSettings = (mongoose_1.default.models.TradingRiskSettings ||
    mongoose_1.default.model('TradingRiskSettings', TradingRiskSettingsSchema));
exports.default = TradingRiskSettings;
