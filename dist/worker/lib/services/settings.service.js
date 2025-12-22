'use server';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.getPaymentProviders = getPaymentProviders;
exports.getSetting = getSetting;
exports.getPaymentProviderCredentials = getPaymentProviderCredentials;
exports.clearSettingsCache = clearSettingsCache;
exports.getStripeCredentials = getStripeCredentials;
exports.getEnv = getEnv;
const mongoose_1 = require("@/database/mongoose");
const whitelabel_model_1 = require("@/database/models/whitelabel.model");
const payment_provider_model_1 = __importDefault(require("@/database/models/payment-provider.model"));
// Cache for settings to avoid repeated database queries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let settingsCache = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let paymentProvidersCache = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute cache
/**
 * Get all application settings from database
 */
async function getSettings() {
    try {
        const now = Date.now();
        // Return cached settings if still valid
        if (settingsCache && (now - lastFetch) < CACHE_TTL) {
            return settingsCache;
        }
        await (0, mongoose_1.connectToDatabase)();
        let settings = await whitelabel_model_1.WhiteLabel.findOne();
        // Create default settings if none exist
        if (!settings) {
            settings = await whitelabel_model_1.WhiteLabel.create({
                companyName: 'ChartVolt',
                nodeEnv: 'development',
                nextPublicBaseUrl: 'http://localhost:3000',
            });
        }
        settingsCache = settings;
        lastFetch = now;
        return settings;
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        // Return minimal fallback settings
        return {
            companyName: 'ChartVolt',
            nodeEnv: process.env.NODE_ENV || 'development',
            nextPublicBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
            nodemailerEmail: process.env.NODEMAILER_EMAIL || '',
            nodemailerPassword: process.env.NODEMAILER_PASSWORD || '',
            massiveApiKey: process.env.MASSIVE_API_KEY || '',
            openaiApiKey: process.env.OPENAI_API_KEY || '',
            openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            openaiEnabled: process.env.OPENAI_ENABLED === 'true',
            openaiForEmails: process.env.OPENAI_FOR_EMAILS === 'true',
            nextPublicMassiveApiKey: process.env.NEXT_PUBLIC_MASSIVE_API_KEY || '',
            mongodbUri: process.env.MONGODB_URI || '',
            betterAuthSecret: process.env.BETTER_AUTH_SECRET || '',
            betterAuthUrl: process.env.BETTER_AUTH_URL || '',
        };
    }
}
/**
 * Get payment provider settings from database
 */
async function getPaymentProviders() {
    try {
        const now = Date.now();
        // Return cached providers if still valid
        if (paymentProvidersCache && (now - lastFetch) < CACHE_TTL) {
            return paymentProvidersCache;
        }
        await (0, mongoose_1.connectToDatabase)();
        const providers = await payment_provider_model_1.default.find({ isActive: true });
        paymentProvidersCache = providers;
        lastFetch = now;
        return providers;
    }
    catch (error) {
        console.error('Error fetching payment providers:', error);
        return [];
    }
}
/**
 * Get a specific setting value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSetting(key, fallback = '') {
    try {
        const settings = await getSettings();
        return settings[key] || fallback;
    }
    catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return fallback;
    }
}
/**
 * Get payment provider credentials by slug
 */
async function getPaymentProviderCredentials(slug) {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const provider = await payment_provider_model_1.default.findOne({ slug, isActive: true });
        if (!provider) {
            return null;
        }
        // Convert credentials array to object for easy access
        const credentials = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provider.credentials.forEach((cred) => {
            credentials[cred.key] = cred.value;
        });
        return {
            ...credentials,
            webhookUrl: provider.webhookUrl,
            testMode: provider.testMode,
            displayName: provider.displayName,
        };
    }
    catch (error) {
        console.error(`Error getting payment provider ${slug}:`, error);
        return null;
    }
}
/**
 * Clear settings cache (call after updating settings)
 */
async function clearSettingsCache() {
    'use server';
    settingsCache = null;
    paymentProvidersCache = null;
    lastFetch = 0;
}
/**
 * Get Stripe credentials (helper function)
 */
async function getStripeCredentials() {
    return await getPaymentProviderCredentials('stripe');
}
/**
 * Get environment variable with database fallback
 */
async function getEnv(key, fallback = '') {
    // Essential variables that must come from .env (for app startup)
    const essentialEnvVars = [
        'MONGODB_URI',
        'BETTER_AUTH_SECRET',
        'BETTER_AUTH_URL',
        'NODE_ENV',
        'ADMIN_EMAIL',
        'ADMIN_PASSWORD',
        'ADMIN_JWT_SECRET',
    ];
    // If it's an essential variable, read from process.env
    if (essentialEnvVars.includes(key)) {
        return process.env[key] || fallback;
    }
    // For all other variables, try database first, then fall back to process.env
    try {
        const settings = await getSettings();
        // Map environment variable names to database field names
        const dbKeyMap = {
            'NODEMAILER_EMAIL': 'nodemailerEmail',
            'NODEMAILER_PASSWORD': 'nodemailerPassword',
            'MASSIVE_API_KEY': 'massiveApiKey',
            'NEXT_PUBLIC_MASSIVE_API_KEY': 'nextPublicMassiveApiKey',
            'NEXT_PUBLIC_BASE_URL': 'nextPublicBaseUrl',
            'OPENAI_API_KEY': 'openaiApiKey',
            'OPENAI_MODEL': 'openaiModel',
            'OPENAI_ENABLED': 'openaiEnabled',
            'OPENAI_FOR_EMAILS': 'openaiForEmails',
        };
        const dbKey = dbKeyMap[key];
        if (dbKey && settings[dbKey]) {
            return settings[dbKey];
        }
        // Fall back to process.env
        return process.env[key] || fallback;
    }
    catch (error) {
        // If database is unavailable, fall back to process.env
        return process.env[key] || fallback;
    }
}
