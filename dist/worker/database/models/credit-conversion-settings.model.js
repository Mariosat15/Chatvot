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
const CreditConversionSettingsSchema = new mongoose_1.Schema({
    _id: {
        type: String,
        default: 'global-credit-conversion',
    },
    eurToCreditsRate: {
        type: Number,
        required: true,
        default: 100, // 100 credits = 1 EUR
        min: 1,
        max: 10000,
    },
    minimumDeposit: {
        type: Number,
        required: true,
        default: 10, // 10 EUR minimum
        min: 1,
    },
    minimumWithdrawal: {
        type: Number,
        required: true,
        default: 20, // 20 EUR minimum
        min: 1,
    },
    // Platform Fees (what platform charges users)
    platformDepositFeePercentage: {
        type: Number,
        required: true,
        default: 2, // 2% platform deposit fee
        min: 0,
        max: 50,
    },
    platformWithdrawalFeePercentage: {
        type: Number,
        required: true,
        default: 2, // 2% platform withdrawal fee
        min: 0,
        max: 50,
    },
    // Bank/Provider Fees (what payment providers charge platform)
    bankDepositFeePercentage: {
        type: Number,
        required: true,
        default: 2.9, // Stripe typically charges 2.9%
        min: 0,
        max: 20,
    },
    bankDepositFeeFixed: {
        type: Number,
        required: true,
        default: 0.30, // Stripe charges €0.30 fixed
        min: 0,
        max: 10,
    },
    bankWithdrawalFeePercentage: {
        type: Number,
        required: true,
        default: 0.25, // Bank payout fees
        min: 0,
        max: 20,
    },
    bankWithdrawalFeeFixed: {
        type: Number,
        required: true,
        default: 0.25, // Fixed per payout
        min: 0,
        max: 10,
    },
    // Legacy field for backward compatibility
    withdrawalFeePercentage: {
        type: Number,
        required: true,
        default: 2, // Deprecated - use platformWithdrawalFeePercentage
        min: 0,
        max: 20,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
    updatedBy: {
        type: String,
        default: 'system',
    },
}, {
    timestamps: true,
});
// Static method to get or create singleton
CreditConversionSettingsSchema.statics.getSingleton = async function () {
    let settings = await this.findById('global-credit-conversion');
    if (!settings) {
        settings = await this.create({
            _id: 'global-credit-conversion',
            eurToCreditsRate: 100,
            minimumDeposit: 10,
            minimumWithdrawal: 20,
            // Platform fees
            platformDepositFeePercentage: 2,
            platformWithdrawalFeePercentage: 2,
            // Bank fees (Stripe defaults)
            bankDepositFeePercentage: 2.9,
            bankDepositFeeFixed: 0.30,
            bankWithdrawalFeePercentage: 0.25,
            bankWithdrawalFeeFixed: 0.25,
            // Legacy
            withdrawalFeePercentage: 2,
        });
    }
    return settings;
};
const CreditConversionSettings = mongoose_1.default.models?.CreditConversionSettings ||
    mongoose_1.default.model('CreditConversionSettings', CreditConversionSettingsSchema);
exports.default = CreditConversionSettings;
