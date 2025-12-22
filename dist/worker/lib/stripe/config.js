"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.centsToEur = exports.eurToCents = exports.STRIPE_CONFIG = exports.stripe = void 0;
exports.getStripeClient = getStripeClient;
const stripe_1 = __importDefault(require("stripe"));
const settings_service_1 = require("@/lib/services/settings.service");
/**
 * Get Stripe client with credentials from database
 * Falls back to environment variables if database is unavailable
 */
async function getStripeClient() {
    try {
        const stripeConfig = await (0, settings_service_1.getPaymentProviderCredentials)('stripe');
        if (stripeConfig && stripeConfig.secret_key) {
            return new stripe_1.default(stripeConfig.secret_key, {
                apiVersion: '2024-11-20.acacia',
                typescript: true,
            });
        }
    }
    catch (error) {
        console.error('⚠️ Error getting Stripe config from database:', error);
    }
    // Fallback to environment variables
    const envKey = process.env.STRIPE_SECRET_KEY;
    if (!envKey) {
        throw new Error('Stripe is not configured. Please configure it in the admin panel.');
    }
    return new stripe_1.default(envKey, {
        apiVersion: '2024-11-20.acacia',
        typescript: true,
    });
}
// Legacy export for backward compatibility (deprecated - use getStripeClient() instead)
// This will fail if STRIPE_SECRET_KEY is not in .env, which is expected
exports.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
});
// Stripe configuration
exports.STRIPE_CONFIG = {
    currency: 'eur',
    minimumDeposit: 5, // Minimum €5
    maximumDeposit: 10000, // Maximum €10,000
    minimumWithdrawal: 10, // Minimum €10
    processingFee: 0, // No fee (can add later)
};
// Convert EUR to cents for Stripe
const eurToCents = (amount) => {
    return Math.round(amount * 100);
};
exports.eurToCents = eurToCents;
// Convert cents to EUR
const centsToEur = (amount) => {
    return amount / 100;
};
exports.centsToEur = centsToEur;
