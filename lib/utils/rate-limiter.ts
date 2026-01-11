/**
 * Simple in-memory rate limiter for API routes
 * 
 * SECURITY: Prevents brute force attacks and API abuse
 * 
 * Note: For production at scale, consider using Redis-based rate limiting
 * This implementation works for single-server deployments
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limits
// Key: identifier (e.g., userId, IP address)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  
  // Don't keep the process alive just for cleanup
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

startCleanup();

export interface RateLimitConfig {
  // Maximum number of requests allowed in the window
  maxRequests: number;
  // Time window in milliseconds
  windowMs: number;
  // Optional: Key prefix for grouping rate limits
  keyPrefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

/**
 * Check if a request should be rate limited
 * 
 * @param identifier - Unique identifier (e.g., userId, IP + endpoint)
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
  const now = Date.now();
  
  const entry = rateLimitStore.get(key);
  
  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const RateLimiters = {
  // Strict limit for deposits: 5 attempts per minute per user
  deposit: (userId: string) => checkRateLimit(userId, {
    maxRequests: 5,
    windowMs: 60 * 1000,
    keyPrefix: 'deposit',
  }),
  
  // Strict limit for withdrawals: 3 attempts per minute per user
  withdrawal: (userId: string) => checkRateLimit(userId, {
    maxRequests: 3,
    windowMs: 60 * 1000,
    keyPrefix: 'withdrawal',
  }),
  
  // Login attempts: 5 per minute per IP
  login: (ipAddress: string) => checkRateLimit(ipAddress, {
    maxRequests: 5,
    windowMs: 60 * 1000,
    keyPrefix: 'login',
  }),
  
  // API general: 60 requests per minute per user
  apiGeneral: (userId: string) => checkRateLimit(userId, {
    maxRequests: 60,
    windowMs: 60 * 1000,
    keyPrefix: 'api',
  }),
  
  // Payment webhooks: 100 per minute per IP (for legitimate webhook traffic)
  webhook: (ipAddress: string) => checkRateLimit(ipAddress, {
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'webhook',
  }),
};

/**
 * Get client IP from request headers
 * Handles proxied requests (Cloudflare, nginx, etc.)
 */
export function getClientIP(request: Request): string {
  // Try various headers in order of priority
  const headers = [
    'cf-connecting-ip',      // Cloudflare
    'x-real-ip',             // Nginx
    'x-forwarded-for',       // Standard proxy header
    'x-client-ip',           // Some load balancers
  ];
  
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }
  
  // Fallback to unknown
  return 'unknown';
}

/**
 * Create rate limit response headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    ...(result.retryAfterMs ? { 'Retry-After': Math.ceil(result.retryAfterMs / 1000).toString() } : {}),
  };
}

