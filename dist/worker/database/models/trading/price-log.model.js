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
const PriceLogSchema = new mongoose_1.Schema({
    symbol: {
        type: String,
        required: true,
        index: true,
    },
    bid: {
        type: Number,
        required: true,
    },
    ask: {
        type: Number,
        required: true,
    },
    mid: {
        type: Number,
        required: true,
    },
    spread: {
        type: Number,
        required: true,
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
    },
    // Trade reference
    tradeId: {
        type: String,
        index: true,
    },
    orderId: {
        type: String,
        index: true,
    },
    tradeType: {
        type: String,
        enum: ['entry', 'exit'],
    },
    tradeSide: {
        type: String,
        enum: ['long', 'short'],
    },
    // Execution details
    executionPrice: Number,
    expectedPrice: Number,
    priceMatchesExpected: Boolean,
    slippagePips: Number,
    // Price source
    priceSource: {
        type: String,
        enum: ['websocket', 'rest', 'cache'],
    },
}, {
    timestamps: true,
    collection: 'pricelogs',
});
// Compound indexes for efficient querying
PriceLogSchema.index({ symbol: 1, timestamp: -1 });
PriceLogSchema.index({ tradeId: 1, tradeType: 1 });
// TTL index to auto-delete old logs after 30 days (optional)
// Uncomment if you want automatic cleanup:
// PriceLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
const PriceLog = (mongoose_1.default.models.PriceLog || mongoose_1.default.model('PriceLog', PriceLogSchema));
exports.default = PriceLog;
