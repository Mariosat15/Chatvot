"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const PaymentFingerprintSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    paymentProvider: {
        type: String,
        required: true,
        enum: ['stripe', 'paypal', 'custom'],
        default: 'stripe',
        index: true
    },
    paymentFingerprint: {
        type: String,
        required: true,
        index: true // Important: Index for fast lookup of shared payments
    },
    // Card Details
    cardLast4: String,
    cardBrand: String,
    cardCountry: String,
    cardFunding: String,
    // PayPal Details
    paypalEmail: String,
    paypalAccountId: String,
    // Other Provider Details
    providerAccountId: String,
    providerMetadata: mongoose_1.Schema.Types.Mixed,
    // Fraud Detection
    linkedUserIds: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'user'
        }],
    isShared: {
        type: Boolean,
        default: false,
        index: true
    },
    riskScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    firstUsed: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastUsed: {
        type: Date,
        default: Date.now
    },
    timesUsed: {
        type: Number,
        default: 1
    },
    fraudAlertIds: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'FraudAlert'
        }]
}, {
    timestamps: true,
    collection: 'paymentfingerprints'
});
// Compound Indexes for Performance
PaymentFingerprintSchema.index({ paymentFingerprint: 1, paymentProvider: 1 }); // Find same payment across providers
PaymentFingerprintSchema.index({ userId: 1, paymentProvider: 1 }); // User's payment methods
PaymentFingerprintSchema.index({ isShared: 1, riskScore: -1 }); // High-risk shared payments
PaymentFingerprintSchema.index({ linkedUserIds: 1 }); // Find users sharing payment
// Methods
PaymentFingerprintSchema.methods.addLinkedUser = function (linkedUserId) {
    // Check if already linked
    const exists = this.linkedUserIds.some((id) => id.toString() === linkedUserId.toString());
    if (!exists && linkedUserId.toString() !== this.userId.toString()) {
        this.linkedUserIds.push(linkedUserId);
        this.isShared = this.linkedUserIds.length > 0;
        // Calculate risk score based on number of linked accounts
        this.riskScore = Math.min(30 + (this.linkedUserIds.length * 10), 100);
    }
};
PaymentFingerprintSchema.methods.updateUsage = function () {
    this.lastUsed = new Date();
    this.timesUsed += 1;
};
// Statics
PaymentFingerprintSchema.statics.findSharedPayments = function () {
    return this.find({ isShared: true }).sort({ riskScore: -1 });
};
PaymentFingerprintSchema.statics.findByFingerprint = function (fingerprint, provider) {
    return this.find({
        paymentFingerprint: fingerprint,
        paymentProvider: provider
    });
};
PaymentFingerprintSchema.statics.findHighRisk = function () {
    return this.find({
        isShared: true,
        riskScore: { $gte: 50 }
    }).sort({ riskScore: -1 });
};
const PaymentFingerprint = (mongoose_1.models.PaymentFingerprint || (0, mongoose_1.model)('PaymentFingerprint', PaymentFingerprintSchema));
exports.default = PaymentFingerprint;
