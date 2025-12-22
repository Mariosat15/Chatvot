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
const PriceCacheSchema = new mongoose_1.Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
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
    spread: {
        type: Number,
        required: true,
    },
    timestamp: {
        type: Number,
        required: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: { createdAt: false, updatedAt: true },
});
// TTL index - auto-remove prices older than 5 minutes (stale data cleanup)
PriceCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 300 });
// Static method to update price (upsert)
PriceCacheSchema.statics.updatePrice = async function (symbol, bid, ask, timestamp) {
    const spread = ask - bid;
    await this.updateOne({ symbol }, {
        $set: {
            bid,
            ask,
            spread,
            timestamp,
            updatedAt: new Date(),
        },
    }, { upsert: true });
};
// Static method to get price for a symbol
PriceCacheSchema.statics.getPrice = async function (symbol) {
    const price = await this.findOne({ symbol }).lean();
    if (!price)
        return null;
    return {
        bid: price.bid,
        ask: price.ask,
        spread: price.spread,
        timestamp: price.timestamp,
    };
};
// Static method to get all prices
PriceCacheSchema.statics.getAllPrices = async function () {
    const prices = await this.find({}).lean();
    const priceMap = new Map();
    for (const price of prices) {
        priceMap.set(price.symbol, {
            bid: price.bid,
            ask: price.ask,
            spread: price.spread,
            timestamp: price.timestamp,
        });
    }
    return priceMap;
};
// Static method to bulk update prices (more efficient for multiple symbols)
PriceCacheSchema.statics.bulkUpdatePrices = async function (prices) {
    if (prices.length === 0)
        return;
    const bulkOps = prices.map((price) => ({
        updateOne: {
            filter: { symbol: price.symbol },
            update: {
                $set: {
                    bid: price.bid,
                    ask: price.ask,
                    spread: price.ask - price.bid,
                    timestamp: price.timestamp,
                    updatedAt: new Date(),
                },
            },
            upsert: true,
        },
    }));
    await this.bulkWrite(bulkOps, { ordered: false });
};
const PriceCache = mongoose_1.default.models.PriceCache ||
    mongoose_1.default.model('PriceCache', PriceCacheSchema);
exports.default = PriceCache;
