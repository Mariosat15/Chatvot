"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const CreditWalletSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
    },
    creditBalance: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalDeposited: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalWithdrawn: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalSpentOnCompetitions: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalWonFromCompetitions: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalSpentOnChallenges: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalWonFromChallenges: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    isActive: {
        type: Boolean,
        required: true,
        default: true,
    },
    kycVerified: {
        type: Boolean,
        required: true,
        default: false,
    },
    withdrawalEnabled: {
        type: Boolean,
        required: true,
        default: false,
    },
}, {
    timestamps: true,
});
// Indexes for fast queries
// Note: userId already has unique index from schema definition (unique: true)
CreditWalletSchema.index({ isActive: 1 });
// Virtual for total profit/loss
CreditWalletSchema.virtual('totalProfitLoss').get(function () {
    return this.totalWonFromCompetitions - this.totalSpentOnCompetitions;
});
// Virtual for ROI
CreditWalletSchema.virtual('roi').get(function () {
    if (this.totalSpentOnCompetitions === 0)
        return 0;
    return (((this.totalWonFromCompetitions - this.totalSpentOnCompetitions) /
        this.totalSpentOnCompetitions) *
        100);
});
const CreditWallet = mongoose_1.models?.CreditWallet || (0, mongoose_1.model)('CreditWallet', CreditWalletSchema);
exports.default = CreditWallet;
//# sourceMappingURL=credit-wallet.model.js.map