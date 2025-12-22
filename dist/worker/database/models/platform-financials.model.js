"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformBalanceSnapshot = exports.PlatformTransaction = void 0;
const mongoose_1 = require("mongoose");
const PlatformTransactionSchema = new mongoose_1.Schema({
    transactionType: {
        type: String,
        required: true,
        enum: [
            'unclaimed_pool',
            'platform_fee',
            'challenge_platform_fee',
            'deposit_fee',
            'withdrawal_fee',
            'admin_withdrawal',
            'admin_adjustment',
            'refund_clawback',
        ],
        index: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    amountEUR: {
        type: Number,
        required: true,
    },
    sourceType: {
        type: String,
        enum: ['competition', 'challenge', 'user_deposit', 'user_withdrawal', 'manual'],
    },
    sourceId: String,
    sourceName: String,
    unclaimedReason: {
        type: String,
        enum: [
            'no_participants',
            'all_disqualified',
            'no_qualified_winners',
            'partial_unclaimed',
            'competition_cancelled',
        ],
    },
    originalPoolAmount: Number,
    winnersCount: Number,
    expectedWinnersCount: Number,
    bankDetails: {
        accountNumber: String,
        bankName: String,
        reference: String,
        withdrawnBy: String,
    },
    userId: {
        type: String,
        index: true,
    },
    feeDetails: {
        depositAmount: Number,
        withdrawalAmount: Number,
        platformFee: Number,
        bankFee: Number,
        netEarning: Number,
    },
    description: {
        type: String,
        required: true,
    },
    notes: String,
    processedBy: String,
    processedByEmail: String,
}, {
    timestamps: true,
});
const PlatformBalanceSnapshotSchema = new mongoose_1.Schema({
    snapshotDate: {
        type: Date,
        required: true,
        index: true,
    },
    totalUserCredits: {
        type: Number,
        required: true,
        default: 0,
    },
    totalUserCreditsEUR: {
        type: Number,
        required: true,
        default: 0,
    },
    totalUnclaimedPools: {
        type: Number,
        required: true,
        default: 0,
    },
    totalPlatformFees: {
        type: Number,
        required: true,
        default: 0,
    },
    totalDepositFees: {
        type: Number,
        required: true,
        default: 0,
    },
    totalWithdrawalFees: {
        type: Number,
        required: true,
        default: 0,
    },
    totalAdminWithdrawals: {
        type: Number,
        required: true,
        default: 0,
    },
    platformNetBalance: {
        type: Number,
        required: true,
        default: 0,
    },
    theoreticalBankBalance: {
        type: Number,
        required: true,
        default: 0,
    },
    coverageRatio: {
        type: Number,
        required: true,
        default: 1,
    },
}, {
    timestamps: true,
});
// Indexes
PlatformTransactionSchema.index({ transactionType: 1, createdAt: -1 });
PlatformTransactionSchema.index({ sourceType: 1, sourceId: 1 });
PlatformTransactionSchema.index({ createdAt: -1 });
PlatformBalanceSnapshotSchema.index({ snapshotDate: -1 });
exports.PlatformTransaction = (mongoose_1.models.PlatformTransaction || (0, mongoose_1.model)('PlatformTransaction', PlatformTransactionSchema));
exports.PlatformBalanceSnapshot = (mongoose_1.models.PlatformBalanceSnapshot || (0, mongoose_1.model)('PlatformBalanceSnapshot', PlatformBalanceSnapshotSchema));
exports.default = exports.PlatformTransaction;
