"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const WalletTransactionSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
    },
    transactionType: {
        type: String,
        required: true,
        enum: [
            'deposit',
            'withdrawal',
            'withdrawal_fee',
            'competition_entry',
            'competition_win',
            'competition_refund',
            'challenge_entry',
            'challenge_win',
            'challenge_refund',
            'platform_fee',
            'admin_adjustment',
            'marketplace_purchase',
        ],
    },
    amount: {
        type: Number,
        required: true,
    },
    balanceBefore: {
        type: Number,
        required: true,
        min: 0,
    },
    balanceAfter: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        required: true,
        default: 'EUR',
    },
    exchangeRate: {
        type: Number,
        required: true,
        default: 1,
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed', 'cancelled', 'expired'],
        default: 'pending',
    },
    paymentMethod: {
        type: String,
    },
    paymentId: {
        type: String,
    },
    paymentIntentId: {
        type: String,
    },
    competitionId: {
        type: String,
    },
    description: {
        type: String,
        required: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    failureReason: {
        type: String,
    },
    processedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Indexes for fast queries
WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ competitionId: 1 });
WalletTransactionSchema.index({ status: 1, createdAt: -1 });
WalletTransactionSchema.index({ transactionType: 1, createdAt: -1 });
const WalletTransaction = (mongoose_1.models.WalletTransaction || (0, mongoose_1.model)('WalletTransaction', WalletTransactionSchema));
exports.default = WalletTransaction;
