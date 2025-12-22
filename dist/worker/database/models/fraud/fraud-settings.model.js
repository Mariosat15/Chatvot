"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FRAUD_SETTINGS = void 0;
const mongoose_1 = require("mongoose");
const FraudSettingsSchema = new mongoose_1.Schema({
    // Device Fingerprinting
    deviceFingerprintingEnabled: { type: Boolean, default: true },
    deviceFingerprintBlockThreshold: { type: Number, default: 70, min: 0, max: 100 },
    // VPN/Proxy Detection
    vpnDetectionEnabled: { type: Boolean, default: true },
    blockVPN: { type: Boolean, default: false }, // Don't auto-block VPNs by default
    blockProxy: { type: Boolean, default: true },
    blockTor: { type: Boolean, default: true },
    vpnRiskScore: { type: Number, default: 30, min: 0, max: 100 },
    proxyRiskScore: { type: Number, default: 25, min: 0, max: 100 },
    torRiskScore: { type: Number, default: 50, min: 0, max: 100 },
    // Multi-Account Detection
    multiAccountDetectionEnabled: { type: Boolean, default: true },
    maxAccountsPerDevice: { type: Number, default: 3, min: 1 },
    // Risk Scoring
    entryBlockThreshold: { type: Number, default: 70, min: 0, max: 100 },
    alertThreshold: { type: Number, default: 40, min: 0, max: 100 },
    // Auto-Actions
    autoSuspendEnabled: { type: Boolean, default: false },
    autoSuspendThreshold: { type: Number, default: 90, min: 0, max: 100 },
    // Rate Limiting
    maxSignupsPerHour: { type: Number, default: 10, min: 1 },
    maxEntriesPerHour: { type: Number, default: 50, min: 1 },
    // Whitelisting
    whitelistedIPs: { type: [String], default: [] },
    whitelistedFingerprints: { type: [String], default: [] },
    // Metadata
    updatedAt: { type: Date, default: Date.now },
    updatedBy: String,
}, {
    timestamps: true
});
const FraudSettings = (mongoose_1.models.FraudSettings || (0, mongoose_1.model)('FraudSettings', FraudSettingsSchema));
exports.default = FraudSettings;
// Default settings
exports.DEFAULT_FRAUD_SETTINGS = {
    deviceFingerprintingEnabled: true,
    deviceFingerprintBlockThreshold: 70,
    vpnDetectionEnabled: true,
    blockVPN: false,
    blockProxy: true,
    blockTor: true,
    vpnRiskScore: 30,
    proxyRiskScore: 25,
    torRiskScore: 50,
    multiAccountDetectionEnabled: true,
    maxAccountsPerDevice: 3,
    entryBlockThreshold: 70,
    alertThreshold: 40,
    autoSuspendEnabled: false,
    autoSuspendThreshold: 90,
    maxSignupsPerHour: 10,
    maxEntriesPerHour: 50,
    whitelistedIPs: [],
    whitelistedFingerprints: [],
};
