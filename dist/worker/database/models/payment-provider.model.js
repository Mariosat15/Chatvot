"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const PaymentProviderSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true, // Explicitly set index here, remove duplicate below
    },
    displayName: {
        type: String,
        required: true,
    },
    logo: {
        type: String,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: false,
    },
    isBuiltIn: {
        type: Boolean,
        default: false,
    },
    saveToEnv: {
        type: Boolean,
        default: true,
    },
    credentials: [
        {
            key: { type: String, required: true },
            value: { type: String, default: '' },
            isSecret: { type: Boolean, default: true },
            description: { type: String, default: '' },
        },
    ],
    webhookUrl: {
        type: String,
        default: '',
    },
    testMode: {
        type: Boolean,
        default: true,
    },
    processingFee: {
        type: Number,
        default: 0,
        min: 0,
        max: 100, // Max 100%
    },
    priority: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});
// Compound index only (slug index is already created by unique: true)
PaymentProviderSchema.index({ isActive: 1, priority: -1 });
const PaymentProvider = (mongoose_1.models.PaymentProvider || (0, mongoose_1.model)('PaymentProvider', PaymentProviderSchema));
exports.default = PaymentProvider;
