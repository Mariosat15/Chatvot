"use strict";
/**
 * Fraud Settings Service
 *
 * Centralized service to get fraud detection settings
 * with caching for performance
 */
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
exports.getFraudSettings = getFraudSettings;
exports.clearFraudSettingsCache = clearFraudSettingsCache;
exports.isDeviceFingerprintingEnabled = isDeviceFingerprintingEnabled;
exports.isVPNDetectionEnabled = isVPNDetectionEnabled;
exports.getEntryBlockThreshold = getEntryBlockThreshold;
exports.shouldBlockEntry = shouldBlockEntry;
exports.shouldCreateAlert = shouldCreateAlert;
const mongoose_1 = require("@/database/mongoose");
const fraud_settings_model_1 = __importStar(require("@/database/models/fraud/fraud-settings.model"));
// Cache settings for 5 minutes
let cachedSettings = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
/**
 * Get fraud detection settings (with caching)
 */
async function getFraudSettings() {
    const now = Date.now();
    // Return cached settings if still valid
    if (cachedSettings && (now - cacheTime) < CACHE_DURATION) {
        return cachedSettings;
    }
    try {
        await (0, mongoose_1.connectToDatabase)();
        let settings = await fraud_settings_model_1.default.findOne().lean();
        // Create default settings if none exist
        if (!settings) {
            const created = await fraud_settings_model_1.default.create(fraud_settings_model_1.DEFAULT_FRAUD_SETTINGS);
            settings = created.toObject();
        }
        // Update cache
        cachedSettings = settings;
        cacheTime = now;
        return cachedSettings;
    }
    catch (error) {
        console.error('Error fetching fraud settings, using defaults:', error);
        return fraud_settings_model_1.DEFAULT_FRAUD_SETTINGS;
    }
}
/**
 * Clear settings cache (call after updating settings)
 */
function clearFraudSettingsCache() {
    cachedSettings = null;
    cacheTime = 0;
}
/**
 * Check if device fingerprinting is enabled
 */
async function isDeviceFingerprintingEnabled() {
    const settings = await getFraudSettings();
    return settings.deviceFingerprintingEnabled;
}
/**
 * Check if VPN detection is enabled
 */
async function isVPNDetectionEnabled() {
    const settings = await getFraudSettings();
    return settings.vpnDetectionEnabled;
}
/**
 * Get entry block threshold
 */
async function getEntryBlockThreshold() {
    const settings = await getFraudSettings();
    return settings.entryBlockThreshold;
}
/**
 * Check if entry should be blocked based on risk score
 */
async function shouldBlockEntry(riskScore) {
    const settings = await getFraudSettings();
    return riskScore > settings.entryBlockThreshold;
}
/**
 * Check if alert should be created based on risk score
 */
async function shouldCreateAlert(riskScore) {
    const settings = await getFraudSettings();
    return riskScore > settings.alertThreshold;
}
