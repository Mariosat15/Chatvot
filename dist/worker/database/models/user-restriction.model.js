"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserRestrictionSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    restrictionType: {
        type: String,
        required: true,
        enum: ['banned', 'suspended']
    },
    reason: {
        type: String,
        required: true,
        enum: [
            'multi_accounting',
            'fraud',
            'terms_violation',
            'payment_fraud',
            'suspicious_activity',
            'admin_decision',
            'automated_fraud_detection',
            'other'
        ]
    },
    customReason: String,
    // What actions are blocked
    canTrade: { type: Boolean, default: false },
    canEnterCompetitions: { type: Boolean, default: false },
    canDeposit: { type: Boolean, default: false },
    canWithdraw: { type: Boolean, default: false },
    // Time-based restrictions
    restrictedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    // Admin tracking
    restrictedBy: { type: String, required: true },
    relatedFraudAlertId: String,
    relatedUserIds: [String],
    // Status
    isActive: { type: Boolean, default: true },
    unrestrictedAt: Date,
    unrestrictedBy: String,
}, {
    timestamps: true
});
// Indexes for fast queries
UserRestrictionSchema.index({ userId: 1, isActive: 1 });
UserRestrictionSchema.index({ expiresAt: 1, isActive: 1 });
UserRestrictionSchema.index({ restrictedBy: 1 });
UserRestrictionSchema.index({ relatedFraudAlertId: 1 });
const UserRestriction = (mongoose_1.models.UserRestriction || (0, mongoose_1.model)('UserRestriction', UserRestrictionSchema));
exports.default = UserRestriction;
