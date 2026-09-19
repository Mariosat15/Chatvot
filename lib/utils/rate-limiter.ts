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
  config: RateLimitConfig,
): RateLimitResult {
  const key = config.keyPrefix
    ? `${config.keyPrefix}:${identifier}`
    : identifier;
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
  deposit: (userId: string) =>
    checkRateLimit(userId, {
      maxRequests: 5,
      windowMs: 60 * 1000,
      keyPrefix: "deposit",
    }),

  // Per-IP deposit limit: 10 per minute per IP
  // Reason: Defends against the per-userId limit being bypassed by attackers
  // cycling multiple accounts from the same IP (classic card-testing pattern).
  depositByIp: (ipAddress: string) =>
    checkRateLimit(ipAddress, {
      maxRequests: 10,
      windowMs: 60 * 1000,
      keyPrefix: "deposit_ip",
    }),

  // Strict limit for withdrawals: 3 attempts per minute per user
  withdrawal: (userId: string) =>
    checkRateLimit(userId, {
      maxRequests: 3,
      windowMs: 60 * 1000,
      keyPrefix: "withdrawal",
    }),

  // Login attempts: 5 per minute per IP
  login: (ipAddress: string) =>
    checkRateLimit(ipAddress, {
      maxRequests: 5,
      windowMs: 60 * 1000,
      keyPrefix: "login",
    }),

  // API general: 60 requests per minute per user
  apiGeneral: (userId: string) =>
    checkRateLimit(userId, {
      maxRequests: 60,
      windowMs: 60 * 1000,
      keyPrefix: "api",
    }),

  // Payment webhooks: 100 per minute per IP (for legitimate webhook traffic)
  webhook: (ipAddress: string) =>
    checkRateLimit(ipAddress, {
      maxRequests: 100,
      windowMs: 60 * 1000,
      keyPrefix: "webhook",
    }),
};

// =============================================================================
// Decline-velocity tracker (Redis-backed with in-memory fallback)
// =============================================================================
// Tracks consecutive declined payment attempts per user/IP. When thresholds are
// crossed, deposits are blocked for a cooldown window. This defends against
// "card testing" — an attacker burning through stolen cards on a single
// account incurs no penalty from normal rate limiting because those attempts
// succeed at the API level (they fail at the PSP).
//
// Reason: Mastercard-style card testing requires many declined attempts in a
// short window. Successful deposits clear the counter; declined declines
// increment it and eventually trip a cooldown.
//
// Redis is preferred so the counter is shared across all processes (Next.js
// app, worker, api-server). When Redis is disabled, the in-memory Map acts
// as a per-process fallback — correct on a single-instance deploy but
// degrades to N× threshold on N processes. The graceful fallback is
// intentional (see lib/services/redis.service.ts).

export interface DeclineVelocityConfig {
  maxDeclinesPerWindow: number;
  windowMs: number;
  blockDurationMs: number;
  keyPrefix: string;
}

interface DeclineEntry {
  declines: number[]; // timestamps of recent declines
  blockedUntil?: number;
}

const declineStore = new Map<string, DeclineEntry>();

const DEFAULT_DECLINE_CONFIG: DeclineVelocityConfig = {
  maxDeclinesPerWindow: 3,
  windowMs: 10 * 60 * 1000, // 10 minutes
  blockDurationMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: "decline",
};

function getDeclineKey(identifier: string, config: DeclineVelocityConfig) {
  return `${config.keyPrefix}:${identifier}`;
}

function getBlockKey(identifier: string, config: DeclineVelocityConfig) {
  return `${config.keyPrefix}:block:${identifier}`;
}

function getEventsKey(identifier: string, config: DeclineVelocityConfig) {
  return `${config.keyPrefix}:events:${identifier}`;
}

/**
 * Lazy import of the Redis client. Kept dynamic so:
 *  - This util stays importable from non-server contexts (it won't blow up
 *    at module-resolve time).
 *  - Redis failures degrade to in-memory silently.
 */
async function getRedisSafe(): Promise<import("ioredis").default | null> {
  try {
    const { getRedis } = await import("@/lib/services/redis.service");
    return await getRedis();
  } catch {
    return null;
  }
}

/**
 * Check whether the identifier is currently blocked due to too many declines.
 * Call this BEFORE creating a pending payment/order.
 */
export async function isDeclineBlocked(
  identifier: string,
  config: DeclineVelocityConfig = DEFAULT_DECLINE_CONFIG,
): Promise<{
  blocked: boolean;
  retryAfterMs?: number;
  blockedUntil?: number;
}> {
  const redis = await getRedisSafe();

  if (redis) {
    try {
      const blockKey = getBlockKey(identifier, config);
      const pttl = await redis.pttl(blockKey);
      // pttl semantics: -2 = key missing, -1 = no expiry set, >=0 = ms remaining
      if (pttl > 0) {
        return {
          blocked: true,
          retryAfterMs: pttl,
          blockedUntil: Date.now() + pttl,
        };
      }
      return { blocked: false };
    } catch (err) {
      // Silent fallback to in-memory
      console.warn("⚠️ Redis decline-block check failed; using in-memory:", err);
    }
  }

  // In-memory fallback
  const key = getDeclineKey(identifier, config);
  const entry = declineStore.get(key);
  if (!entry?.blockedUntil) return { blocked: false };

  const now = Date.now();
  if (entry.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterMs: entry.blockedUntil - now,
      blockedUntil: entry.blockedUntil,
    };
  }
  declineStore.delete(key);
  return { blocked: false };
}

/**
 * Record a declined payment attempt. When the threshold is crossed within the
 * rolling window, the identifier is blocked for the configured cooldown.
 * Safe to call for every PSP decline/error webhook.
 */
export async function recordDecline(
  identifier: string,
  config: DeclineVelocityConfig = DEFAULT_DECLINE_CONFIG,
): Promise<{ blocked: boolean; declineCount: number; blockedUntil?: number }> {
  const now = Date.now();
  const redis = await getRedisSafe();

  if (redis) {
    try {
      const eventsKey = getEventsKey(identifier, config);
      const blockKey = getBlockKey(identifier, config);
      // Use a rolling-window sorted set: score = timestamp, member = unique id.
      // Prune first, then add, then count.
      const memberId = `${now}-${Math.random().toString(36).slice(2, 10)}`;
      const windowStart = now - config.windowMs;

      const pipeline = redis.multi();
      pipeline.zremrangebyscore(eventsKey, 0, windowStart);
      pipeline.zadd(eventsKey, now, memberId);
      pipeline.zcard(eventsKey);
      // Keep the sorted set no longer than it needs to live
      pipeline.pexpire(eventsKey, config.windowMs + 1000);
      const results = await pipeline.exec();

      const count = results?.[2]?.[1] as number;

      if (count >= config.maxDeclinesPerWindow) {
        const blockedUntil = now + config.blockDurationMs;
        await redis.set(
          blockKey,
          "1",
          "PX",
          config.blockDurationMs,
        );
        return { blocked: true, declineCount: count, blockedUntil };
      }

      return { blocked: false, declineCount: count };
    } catch (err) {
      console.warn("⚠️ Redis decline record failed; using in-memory:", err);
    }
  }

  // In-memory fallback
  const key = getDeclineKey(identifier, config);
  const entry: DeclineEntry = declineStore.get(key) ?? { declines: [] };
  entry.declines = entry.declines.filter((t) => now - t < config.windowMs);
  entry.declines.push(now);

  if (entry.declines.length >= config.maxDeclinesPerWindow) {
    entry.blockedUntil = now + config.blockDurationMs;
    declineStore.set(key, entry);
    return {
      blocked: true,
      declineCount: entry.declines.length,
      blockedUntil: entry.blockedUntil,
    };
  }

  declineStore.set(key, entry);
  return { blocked: false, declineCount: entry.declines.length };
}

/**
 * Clear any decline history for this identifier. Call this after a successful
 * payment so a single past failure doesn't haunt legitimate users.
 */
export async function clearDeclines(
  identifier: string,
  config: DeclineVelocityConfig = DEFAULT_DECLINE_CONFIG,
): Promise<void> {
  const redis = await getRedisSafe();
  if (redis) {
    try {
      await redis.del(
        getEventsKey(identifier, config),
        getBlockKey(identifier, config),
      );
      // Also clear any in-memory entry from a previous Redis-down window
      declineStore.delete(getDeclineKey(identifier, config));
      return;
    } catch (err) {
      console.warn("⚠️ Redis decline clear failed; clearing in-memory:", err);
    }
  }
  declineStore.delete(getDeclineKey(identifier, config));
}

// Periodic cleanup of stale in-memory entries (Redis handles its own TTLs)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of declineStore.entries()) {
      const hasActiveBlock = !!entry.blockedUntil && entry.blockedUntil > now;
      const hasRecentDeclines = entry.declines.some(
        (t) => now - t < DEFAULT_DECLINE_CONFIG.windowMs,
      );
      if (!hasActiveBlock && !hasRecentDeclines) {
        declineStore.delete(key);
      }
    }
  },
  CLEANUP_INTERVAL,
).unref?.();

/**
 * Get client IP from request headers
 * Handles proxied requests (Cloudflare, nginx, etc.)
 */
export function getClientIP(request: Request): string {
  // Try various headers in order of priority
  const headers = [
    "cf-connecting-ip", // Cloudflare
    "x-real-ip", // Nginx
    "x-forwarded-for", // Standard proxy header
    "x-client-ip", // Some load balancers
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(",")[0].trim();
      if (ip) return ip;
    }
  }

  // Fallback to unknown
  return "unknown";
}

/**
 * Create rate limit response headers
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetAt / 1000).toString(),
    ...(result.retryAfterMs
      ? { "Retry-After": Math.ceil(result.retryAfterMs / 1000).toString() }
      : {}),
  };
}
