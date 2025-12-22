"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const DeviceFingerprintSchema = new mongoose_1.Schema({
    fingerprintId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    // Device information
    deviceType: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'unknown'
    },
    browser: { type: String, default: 'Unknown' },
    browserVersion: { type: String, default: 'Unknown' },
    os: { type: String, default: 'Unknown' },
    osVersion: { type: String, default: 'Unknown' },
    // Display information
    screenResolution: { type: String, default: 'Unknown' },
    colorDepth: { type: Number, default: 24 },
    timezone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' },
    // Network information
    ipAddress: { type: String, default: 'unknown' },
    country: String,
    city: String,
    // Additional metadata
    userAgent: { type: String, default: 'Unknown' },
    canvas: String,
    webgl: String,
    webglVendor: String,
    webglRenderer: String,
    gpuInfo: String,
    fonts: [String],
    confidence: Number,
    // Enhanced Hardware Information
    hardware: {
        cpuCores: Number,
        deviceMemory: Number,
        maxTouchPoints: Number,
        hardwareConcurrency: Number,
        screenOrientation: String,
        pixelRatio: Number,
        touchSupport: Boolean,
        battery: {
            charging: Boolean,
            level: Number
        }
    },
    // Media Capabilities
    media: {
        audioFormats: [String],
        videoFormats: [String],
        mediaDevices: Number
    },
    // Browser Plugins
    plugins: [String],
    // Storage Capabilities
    storage: {
        localStorage: Boolean,
        sessionStorage: Boolean,
        indexedDB: Boolean,
        cookiesEnabled: Boolean
    },
    // Browser Features
    features: {
        webgl2: Boolean,
        webrtc: Boolean,
        geolocation: Boolean,
        notifications: Boolean,
        serviceWorker: Boolean,
        webAssembly: Boolean
    },
    // Tracking
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    timesUsed: { type: Number, default: 1 },
    // Linked accounts
    linkedUserIds: { type: [String], default: [] },
    // Flags
    isVPN: { type: Boolean, default: false },
    isProxy: { type: Boolean, default: false },
    isTor: { type: Boolean, default: false },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
}, {
    timestamps: true
});
// Indexes for fast queries
// Compound unique index: same fingerprintId can exist for different users (fraud detection)
// but same user can't have duplicate fingerprintIds
DeviceFingerprintSchema.index({ fingerprintId: 1, userId: 1 }, { unique: true });
DeviceFingerprintSchema.index({ ipAddress: 1 });
DeviceFingerprintSchema.index({ linkedUserIds: 1 });
DeviceFingerprintSchema.index({ riskScore: -1 });
const DeviceFingerprint = (mongoose_1.models.DeviceFingerprint || (0, mongoose_1.model)('DeviceFingerprint', DeviceFingerprintSchema));
exports.default = DeviceFingerprint;
