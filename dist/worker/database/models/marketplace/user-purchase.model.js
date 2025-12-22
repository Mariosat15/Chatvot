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
exports.UserPurchase = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserPurchaseSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    itemId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'MarketplaceItem',
        required: true,
    },
    pricePaid: {
        type: Number,
        required: true,
        min: 0,
    },
    purchasedAt: {
        type: Date,
        default: Date.now,
    },
    transactionId: String,
    isEnabled: {
        type: Boolean,
        default: true,
    },
    customSettings: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    totalUsageTime: {
        type: Number,
        default: 0,
    },
    lastUsedAt: Date,
    totalTradesExecuted: {
        type: Number,
        default: 0,
    },
    userRating: {
        type: Number,
        min: 1,
        max: 5,
    },
    userReview: {
        type: String,
        maxlength: 1000,
    },
    reviewedAt: Date,
}, {
    timestamps: true,
});
// Compound index for user + item (each user can only purchase an item once)
UserPurchaseSchema.index({ userId: 1, itemId: 1 }, { unique: true });
UserPurchaseSchema.index({ userId: 1, isEnabled: 1 });
exports.UserPurchase = mongoose_1.default.models.UserPurchase || mongoose_1.default.model('UserPurchase', UserPurchaseSchema);
