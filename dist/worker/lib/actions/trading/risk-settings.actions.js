'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarginThresholds = getMarginThresholds;
exports.getTradingRiskSettings = getTradingRiskSettings;
const cache_1 = require("next/cache");
const mongoose_1 = require("@/database/mongoose");
const trading_risk_settings_model_1 = __importDefault(require("@/database/models/trading-risk-settings.model"));
const margin_safety_service_1 = require("@/lib/services/margin-safety.service");
/**
 * Load margin thresholds from database (SERVER ACTION)
 * This must be called from server components or as a server action
 *
 * IMPORTANT: Always returns valid thresholds (defaults on error)
 * This ensures admin settings failures don't break the trading platform
 *
 * NO CACHE: Always fetches fresh data to apply admin changes immediately
 */
async function getMarginThresholds() {
    (0, cache_1.unstable_noStore)(); // Disable caching - always fetch fresh data
    try {
        await (0, mongoose_1.connectToDatabase)();
        const settings = await trading_risk_settings_model_1.default.getSingleton();
        // Validate that settings are valid numbers
        if (typeof settings.marginLiquidation !== 'number' ||
            typeof settings.marginCall !== 'number' ||
            typeof settings.marginWarning !== 'number' ||
            typeof settings.marginSafe !== 'number') {
            console.error('⚠️ Invalid margin threshold values in database, using defaults');
            return margin_safety_service_1.DEFAULT_MARGIN_THRESHOLDS;
        }
        return {
            LIQUIDATION: settings.marginLiquidation,
            MARGIN_CALL: settings.marginCall,
            WARNING: settings.marginWarning,
            SAFE: settings.marginSafe,
        };
    }
    catch (error) {
        console.error('⚠️ Failed to load margin thresholds from database, using defaults:', error);
        return margin_safety_service_1.DEFAULT_MARGIN_THRESHOLDS;
    }
}
/**
 * Load all trading risk settings from database (SERVER ACTION)
 *
 * IMPORTANT: Always returns valid settings (defaults on error)
 * This ensures admin settings failures don't break the trading platform
 *
 * NO CACHE: Always fetches fresh data to apply admin changes immediately
 */
async function getTradingRiskSettings() {
    (0, cache_1.unstable_noStore)(); // Disable caching - always fetch fresh data
    try {
        await (0, mongoose_1.connectToDatabase)();
        const settings = await trading_risk_settings_model_1.default.getSingleton();
        return {
            // Margin Levels
            marginLiquidation: settings.marginLiquidation,
            marginCall: settings.marginCall,
            marginWarning: settings.marginWarning,
            marginSafe: settings.marginSafe,
            // Position Limits
            maxOpenPositions: settings.maxOpenPositions,
            maxPositionSize: settings.maxPositionSize,
            // Leverage Limits
            minLeverage: settings.minLeverage,
            maxLeverage: settings.maxLeverage,
            defaultLeverage: settings.defaultLeverage,
            // Risk Limits
            maxDrawdownPercent: settings.maxDrawdownPercent,
            dailyLossLimit: settings.dailyLossLimit,
        };
    }
    catch (error) {
        console.error('⚠️ Failed to load trading risk settings from database, using defaults:', error);
        return {
            marginLiquidation: 50,
            marginCall: 100,
            marginWarning: 150,
            marginSafe: 200,
            maxOpenPositions: 10,
            maxPositionSize: 100,
            minLeverage: 1,
            maxLeverage: 500,
            defaultLeverage: 10,
            maxDrawdownPercent: 50,
            dailyLossLimit: 20,
        };
    }
}
