'use server';

import { connectToDatabase } from '@/database/mongoose';
import { WhiteLabel } from '@/database/models/whitelabel.model';
import PaymentProvider from '@/database/models/payment-provider.model';

// Cache for settings to avoid repeated database queries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let settingsCache: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let paymentProvidersCache: any = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get all application settings from database
 */
export async function getSettings() {
  try {
    const now = Date.now();
    
    // Return cached settings if still valid
    if (settingsCache && (now - lastFetch) < CACHE_TTL) {
      return settingsCache;
    }

    await connectToDatabase();
    
    let settings = await WhiteLabel.findOne();
    
    // Create default settings if none exist
    if (!settings) {
      settings = await WhiteLabel.create({
        companyName: 'ChartVolt',
        nodeEnv: 'development',
        nextPublicBaseUrl: 'http://localhost:3000',
      });
    }

    settingsCache = settings;
    lastFetch = now;
    
    return settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    // Return minimal fallback settings
    return {
      companyName: 'ChartVolt',
      nodeEnv: process.env.NODE_ENV || 'development',
      nextPublicBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      nodemailerEmail: process.env.NODEMAILER_EMAIL || '',
      nodemailerPassword: process.env.NODEMAILER_PASSWORD || '',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      massiveApiKey: process.env.MASSIVE_API_KEY || '',
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
export async function getPaymentProviders() {
  try {
    const now = Date.now();
    
    // Return cached providers if still valid
    if (paymentProvidersCache && (now - lastFetch) < CACHE_TTL) {
      return paymentProvidersCache;
    }

    await connectToDatabase();
    
    const providers = await PaymentProvider.find({ isActive: true });
    
    paymentProvidersCache = providers;
    lastFetch = now;
    
    return providers;
  } catch (error) {
    console.error('Error fetching payment providers:', error);
    return [];
  }
}

/**
 * Get a specific setting value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSetting(key: string, fallback: any = '') {
  try {
    const settings = await getSettings();
    return settings[key] || fallback;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return fallback;
  }
}

/**
 * Get payment provider credentials by slug
 */
export async function getPaymentProviderCredentials(slug: string) {
  try {
    await connectToDatabase();
    
    const provider = await PaymentProvider.findOne({ slug, isActive: true });
    
    if (!provider) {
      return null;
    }

    // Convert credentials array to object for easy access
    const credentials: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider.credentials.forEach((cred: any) => {
      credentials[cred.key] = cred.value;
    });

    return {
      ...credentials,
      webhookUrl: provider.webhookUrl,
      testMode: provider.testMode,
      displayName: provider.displayName,
    };
  } catch (error) {
    console.error(`Error getting payment provider ${slug}:`, error);
    return null;
  }
}

/**
 * Clear settings cache (call after updating settings)
 */
export async function clearSettingsCache() {
  'use server';
  settingsCache = null;
  paymentProvidersCache = null;
  lastFetch = 0;
}

/**
 * Get Stripe credentials (helper function)
 */
export async function getStripeCredentials() {
  return await getPaymentProviderCredentials('stripe');
}

/**
 * Get environment variable with database fallback
 */
export async function getEnv(key: string, fallback: string = ''): Promise<string> {
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
    const dbKeyMap: Record<string, string> = {
      'NODEMAILER_EMAIL': 'nodemailerEmail',
      'NODEMAILER_PASSWORD': 'nodemailerPassword',
      'GEMINI_API_KEY': 'geminiApiKey',
      'MASSIVE_API_KEY': 'massiveApiKey',
      'NEXT_PUBLIC_MASSIVE_API_KEY': 'nextPublicMassiveApiKey',
      'NEXT_PUBLIC_BASE_URL': 'nextPublicBaseUrl',
    };

    const dbKey = dbKeyMap[key];
    if (dbKey && settings[dbKey]) {
      return settings[dbKey];
    }

    // Fall back to process.env
    return process.env[key] || fallback;
  } catch (error) {
    // If database is unavailable, fall back to process.env
    return process.env[key] || fallback;
  }
}

