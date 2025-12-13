import Stripe from 'stripe';
import { getPaymentProviderCredentials } from '@/lib/services/settings.service';

/**
 * Get Stripe client with credentials from database
 * Falls back to environment variables if database is unavailable
 */
export async function getStripeClient(): Promise<Stripe> {
  try {
    const stripeConfig = await getPaymentProviderCredentials('stripe');
    
    if (stripeConfig && stripeConfig.secret_key) {
      return new Stripe(stripeConfig.secret_key, {
        apiVersion: '2024-11-20.acacia',
        typescript: true,
      });
    }
  } catch (error) {
    console.error('⚠️ Error getting Stripe config from database:', error);
  }
  
  // Fallback to environment variables
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (!envKey) {
    throw new Error('Stripe is not configured. Please configure it in the admin panel.');
  }
  
  return new Stripe(envKey, {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
  });
}

// Legacy export for backward compatibility (deprecated - use getStripeClient() instead)
// This will fail if STRIPE_SECRET_KEY is not in .env, which is expected
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

// Stripe configuration
export const STRIPE_CONFIG = {
  currency: 'eur',
  minimumDeposit: 5, // Minimum €5
  maximumDeposit: 10000, // Maximum €10,000
  minimumWithdrawal: 10, // Minimum €10
  processingFee: 0, // No fee (can add later)
};

// Convert EUR to cents for Stripe
export const eurToCents = (amount: number): number => {
  return Math.round(amount * 100);
};

// Convert cents to EUR
export const centsToEur = (amount: number): number => {
  return amount / 100;
};

