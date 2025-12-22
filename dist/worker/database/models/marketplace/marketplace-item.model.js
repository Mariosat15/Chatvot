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
exports.MarketplaceItem = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const StrategyConditionSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    indicator: { type: String, required: true },
    indicatorParams: { type: mongoose_1.Schema.Types.Mixed },
    operator: {
        type: String,
        required: true,
        enum: ['above', 'below', 'crosses_above', 'crosses_below', 'between', 'equals']
    },
    compareWith: { type: String, enum: ['value', 'indicator'], default: 'value' },
    compareValue: { type: Number },
    compareIndicator: { type: String },
    compareIndicatorParams: { type: mongoose_1.Schema.Types.Mixed },
}, { _id: false });
const StrategyRuleSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    conditions: [StrategyConditionSchema],
    logic: { type: String, enum: ['AND', 'OR'], default: 'AND' },
    signal: {
        type: String,
        required: true,
        enum: ['buy', 'sell', 'strong_buy', 'strong_sell', 'neutral']
    },
    signalStrength: { type: Number, min: 1, max: 5, default: 3 },
}, { _id: false });
const StrategyConfigSchema = new mongoose_1.Schema({
    rules: [StrategyRuleSchema],
    defaultIndicators: [String],
    signalDisplay: {
        showOnChart: { type: Boolean, default: true },
        showArrows: { type: Boolean, default: true },
        showLabels: { type: Boolean, default: true },
        arrowSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    },
}, { _id: false });
const MarketplaceItemSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    shortDescription: {
        type: String,
        required: true,
        maxlength: 200,
    },
    fullDescription: {
        type: String,
        required: true,
        maxlength: 5000,
    },
    category: {
        type: String,
        required: true,
        enum: ['indicator', 'strategy'],
        default: 'indicator',
    },
    price: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    originalPrice: {
        type: Number,
        min: 0,
    },
    isFree: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'inactive', 'coming_soon', 'deprecated'],
        default: 'active',
    },
    isPublished: {
        type: Boolean,
        default: false,
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    iconUrl: String,
    thumbnailUrl: String,
    screenshots: [String],
    version: {
        type: String,
        default: '1.0.0',
    },
    indicatorType: {
        type: String,
        enum: ['sma', 'ema', 'bb', 'rsi', 'macd', 'support_resistance'],
    },
    strategyConfig: StrategyConfigSchema,
    codeTemplate: {
        type: String,
        required: true,
        default: '{}',
    },
    defaultSettings: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    supportedAssets: {
        type: [String],
        default: [],
    },
    totalPurchases: {
        type: Number,
        default: 0,
    },
    totalActiveUsers: {
        type: Number,
        default: 0,
    },
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
    },
    totalRatings: {
        type: Number,
        default: 0,
    },
    tags: {
        type: [String],
        default: [],
    },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'very_high'],
        default: 'medium',
    },
    riskWarning: String,
    createdBy: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});
// Indexes
// Note: slug already has unique index from schema definition (unique: true)
MarketplaceItemSchema.index({ category: 1, isPublished: 1, status: 1 });
MarketplaceItemSchema.index({ tags: 1 });
MarketplaceItemSchema.index({ isFeatured: 1 });
exports.MarketplaceItem = mongoose_1.default.models.MarketplaceItem || mongoose_1.default.model('MarketplaceItem', MarketplaceItemSchema);
