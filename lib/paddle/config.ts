import { getPaymentProviderCredentials } from '@/lib/services/settings.service';

/**
 * Paddle Configuration
 * 
 * Paddle is a Merchant of Record - they handle taxes, refunds, and compliance.
 * Much simpler for customers to set up than Stripe!
 * 
 * Setup for customers:
 * 1. Create Paddle account at paddle.com
 * 2. Get Vendor ID and API Key from Paddle Dashboard
 * 3. Enter in Admin Panel → Payment Providers → Paddle
 * 4. Done! (No webhook configuration needed - Paddle auto-configures)
 */

export interface PaddleConfig {
  vendorId: string;
  apiKey: string;
  publicKey: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

// Paddle API endpoints
const PADDLE_SANDBOX_API = 'https://sandbox-api.paddle.com';
const PADDLE_PRODUCTION_API = 'https://api.paddle.com';

let cachedConfig: PaddleConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get Paddle configuration from database or environment
 */
export async function getPaddleConfig(): Promise<PaddleConfig | null> {
  // Check cache
  if (cachedConfig && Date.now() - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    // Try database first
    const dbConfig = await getPaymentProviderCredentials('paddle') as any;
    
    if (dbConfig?.vendor_id && dbConfig?.api_key) {
      const isTestMode = dbConfig.testMode || dbConfig.api_key?.includes('test_');
      
      cachedConfig = {
        vendorId: dbConfig.vendor_id,
        apiKey: dbConfig.api_key,
        publicKey: dbConfig.public_key || '',
        environment: isTestMode ? 'sandbox' : 'production',
        webhookSecret: dbConfig.webhook_secret,
      };
      cacheTime = Date.now();
      return cachedConfig;
    }

    // Fallback to environment variables
    if (process.env.PADDLE_VENDOR_ID && process.env.PADDLE_API_KEY) {
      const isTestMode = process.env.PADDLE_API_KEY?.includes('test_') || 
                         process.env.PADDLE_ENVIRONMENT === 'sandbox';
      
      cachedConfig = {
        vendorId: process.env.PADDLE_VENDOR_ID,
        apiKey: process.env.PADDLE_API_KEY,
        publicKey: process.env.PADDLE_PUBLIC_KEY || '',
        environment: isTestMode ? 'sandbox' : 'production',
        webhookSecret: process.env.PADDLE_WEBHOOK_SECRET,
      };
      cacheTime = Date.now();
      return cachedConfig;
    }

    return null;
  } catch (error) {
    console.error('Error getting Paddle config:', error);
    return null;
  }
}

/**
 * Get Paddle API base URL
 */
export function getPaddleApiUrl(config: PaddleConfig): string {
  return config.environment === 'sandbox' ? PADDLE_SANDBOX_API : PADDLE_PRODUCTION_API;
}

/**
 * Make authenticated request to Paddle API
 */
export async function paddleRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
  } = {}
): Promise<T> {
  const config = await getPaddleConfig();
  
  if (!config) {
    throw new Error('Paddle not configured. Add credentials in Admin Panel → Payment Providers → Paddle');
  }

  const baseUrl = getPaddleApiUrl(config);
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Paddle API error: ${error.error?.message || error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Check if Paddle is configured and active
 */
export async function isPaddleConfigured(): Promise<boolean> {
  const config = await getPaddleConfig();
  return config !== null && !!config.vendorId && !!config.apiKey;
}

/**
 * Get Paddle client-side token for checkout
 */
export async function getPaddleClientToken(): Promise<string | null> {
  const config = await getPaddleConfig();
  return config?.publicKey || null;
}

// Clear cache (useful after config update)
export function clearPaddleConfigCache(): void {
  cachedConfig = null;
  cacheTime = 0;
}

