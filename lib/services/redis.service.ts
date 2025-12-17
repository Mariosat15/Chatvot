'use server';

import { Redis } from '@upstash/redis';
import { connectToDatabase } from '@/database/mongoose';
import { WhiteLabel } from '@/database/models/whitelabel.model';

// Singleton Redis instance
let redisInstance: Redis | null = null;
let redisDisabled = false; // Track if Redis was explicitly disabled
let lastConfigCheck = 0;
const CONFIG_CHECK_INTERVAL = 60000; // Check config every minute

export interface RedisConfig {
  url: string;
  token: string;
  enabled: boolean;
}

/**
 * Get Redis configuration from database
 */
export async function getRedisConfig(): Promise<RedisConfig | null> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    
    if (!settings?.upstashRedisUrl || !settings?.upstashRedisToken) {
      return null;
    }

    return {
      url: settings.upstashRedisUrl,
      token: settings.upstashRedisToken,
      enabled: settings.redisEnabled ?? false,
    };
  } catch (error) {
    console.error('Error getting Redis config:', error);
    return null;
  }
}

/**
 * Get or create Redis instance
 * Returns null immediately if Redis is disabled (no database call)
 */
export async function getRedis(): Promise<Redis | null> {
  const now = Date.now();

  // If we already have a Redis instance and config is fresh, return it
  if (redisInstance && (now - lastConfigCheck) < CONFIG_CHECK_INTERVAL) {
    return redisInstance;
  }

  // If Redis was disabled and config is fresh, return null immediately
  if (redisDisabled && (now - lastConfigCheck) < CONFIG_CHECK_INTERVAL) {
    return null;
  }

  // Need to check config (either first time or config expired)
  const config = await getRedisConfig();
  lastConfigCheck = now;
  
  if (!config || !config.enabled) {
    redisInstance = null;
    redisDisabled = true;
    return null;
  }

  // Redis is enabled, create instance
  redisDisabled = false;
  
  try {
    redisInstance = new Redis({
      url: config.url,
      token: config.token,
    });
    return redisInstance;
  } catch (error) {
    console.error('Failed to create Redis instance:', error);
    redisInstance = null;
    return null;
  }
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(url: string, token: string): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  try {
    const redis = new Redis({ url, token });
    const start = Date.now();
    
    // Test basic operations
    await redis.set('test:connection', 'ok', { ex: 10 });
    const result = await redis.get('test:connection');
    await redis.del('test:connection');
    
    const latency = Date.now() - start;

    if (result === 'ok') {
      return {
        success: true,
        message: `Connection successful! Latency: ${latency}ms`,
        latency,
      };
    }

    return {
      success: false,
      message: 'Connection established but read/write test failed',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// PRICE CACHE FUNCTIONS
// ============================================

const PRICE_KEY_PREFIX = 'price:';
const PRICE_TTL = 10; // 10 seconds

export interface CachedPrice {
  bid: number;
  ask: number;
  mid: number;
  timestamp: number;
}

/**
 * Set price in Redis cache
 */
export async function setPrice(symbol: string, price: CachedPrice): Promise<boolean> {
  const redis = await getRedis();
  
  if (!redis) {
    return false;
  }

  try {
    await redis.set(
      `${PRICE_KEY_PREFIX}${symbol}`,
      JSON.stringify(price),
      { ex: PRICE_TTL }
    );
    return true;
  } catch (error) {
    console.error(`Failed to set price for ${symbol}:`, error);
    return false;
  }
}

/**
 * Set multiple prices in Redis cache (pipeline for performance)
 */
export async function setPrices(prices: Map<string, CachedPrice>): Promise<boolean> {
  const redis = await getRedis();
  
  if (!redis) {
    return false;
  }

  try {
    const pipeline = redis.pipeline();
    
    prices.forEach((price, symbol) => {
      pipeline.set(
        `${PRICE_KEY_PREFIX}${symbol}`,
        JSON.stringify(price),
        { ex: PRICE_TTL }
      );
    });

    await pipeline.exec();
    return true;
  } catch (error) {
    console.error('Failed to set prices:', error);
    return false;
  }
}

/**
 * Get price from Redis cache
 */
export async function getPrice(symbol: string): Promise<CachedPrice | null> {
  const redis = await getRedis();
  
  if (!redis) {
    return null;
  }

  try {
    const data = await redis.get<string>(`${PRICE_KEY_PREFIX}${symbol}`);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to get price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get multiple prices from Redis cache
 */
export async function getPrices(symbols: string[]): Promise<Map<string, CachedPrice>> {
  const redis = await getRedis();
  const result = new Map<string, CachedPrice>();
  
  if (!redis) {
    return result;
  }

  try {
    const keys = symbols.map(s => `${PRICE_KEY_PREFIX}${s}`);
    const values = await redis.mget<string[]>(...keys);

    values.forEach((value, index) => {
      if (value) {
        try {
          result.set(symbols[index], JSON.parse(value));
        } catch {
          // Skip invalid JSON
        }
      }
    });
  } catch (error) {
    console.error('Failed to get prices:', error);
  }

  return result;
}

/**
 * Get all cached prices
 */
export async function getAllPrices(): Promise<Map<string, CachedPrice>> {
  const redis = await getRedis();
  const result = new Map<string, CachedPrice>();
  
  if (!redis) {
    return result;
  }

  try {
    // Get all price keys
    const keys = await redis.keys(`${PRICE_KEY_PREFIX}*`);
    
    if (keys.length === 0) {
      return result;
    }

    const values = await redis.mget<string[]>(...keys);

    keys.forEach((key, index) => {
      if (values[index]) {
        try {
          const symbol = key.replace(PRICE_KEY_PREFIX, '');
          result.set(symbol, JSON.parse(values[index]));
        } catch {
          // Skip invalid JSON
        }
      }
    });
  } catch (error) {
    console.error('Failed to get all prices:', error);
  }

  return result;
}

// ============================================
// TRADE QUEUE FUNCTIONS
// ============================================

const TRADE_QUEUE_KEY = 'queue:trades';
const TRADE_QUEUE_PROCESSING = 'queue:trades:processing';

export interface QueuedTrade {
  id: string;
  userId: string;
  positionId: string;
  action: 'close' | 'open' | 'modify';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

/**
 * Add trade to queue
 */
export async function queueTrade(trade: Omit<QueuedTrade, 'timestamp' | 'retries'>): Promise<boolean> {
  const redis = await getRedis();
  
  if (!redis) {
    return false;
  }

  try {
    const queuedTrade: QueuedTrade = {
      ...trade,
      timestamp: Date.now(),
      retries: 0,
    };

    await redis.lpush(TRADE_QUEUE_KEY, JSON.stringify(queuedTrade));
    return true;
  } catch (error) {
    console.error('Failed to queue trade:', error);
    return false;
  }
}

/**
 * Get next trade from queue
 */
export async function dequeueTradeForProcessing(): Promise<QueuedTrade | null> {
  const redis = await getRedis();
  
  if (!redis) {
    return null;
  }

  try {
    // Pop from end of queue
    const data = await redis.rpop<string>(TRADE_QUEUE_KEY);
    
    if (!data) {
      return null;
    }

    // Add to processing list
    await redis.lpush(TRADE_QUEUE_PROCESSING, data);
    
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to dequeue trade:', error);
    return null;
  }
}

/**
 * Mark trade as completed (remove from processing)
 */
export async function completeQueuedTrade(trade: QueuedTrade): Promise<boolean> {
  const redis = await getRedis();
  
  if (!redis) {
    return false;
  }

  try {
    await redis.lrem(TRADE_QUEUE_PROCESSING, 1, JSON.stringify(trade));
    return true;
  } catch (error) {
    console.error('Failed to complete queued trade:', error);
    return false;
  }
}

/**
 * Re-queue failed trade (with retry count)
 */
export async function requeueFailedTrade(trade: QueuedTrade): Promise<boolean> {
  const redis = await getRedis();
  
  if (!redis) {
    return false;
  }

  try {
    // Remove from processing
    await redis.lrem(TRADE_QUEUE_PROCESSING, 1, JSON.stringify(trade));

    // Re-add to queue with incremented retry count
    if (trade.retries < 3) {
      const updatedTrade: QueuedTrade = {
        ...trade,
        retries: trade.retries + 1,
      };
      await redis.lpush(TRADE_QUEUE_KEY, JSON.stringify(updatedTrade));
    } else {
      // Max retries reached - log and discard
      console.error('Trade exceeded max retries:', trade);
    }

    return true;
  } catch (error) {
    console.error('Failed to requeue trade:', error);
    return false;
  }
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
} | null> {
  const redis = await getRedis();
  
  if (!redis) {
    return null;
  }

  try {
    const [pending, processing] = await Promise.all([
      redis.llen(TRADE_QUEUE_KEY),
      redis.llen(TRADE_QUEUE_PROCESSING),
    ]);

    return { pending, processing };
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return null;
  }
}

// ============================================
// RATE LIMITING FUNCTIONS
// ============================================

const RATE_LIMIT_PREFIX = 'ratelimit:';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds
}

/**
 * Check and increment rate limit
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = await getRedis();
  
  // If Redis is not available, allow the request
  if (!redis) {
    return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
  }

  const fullKey = `${RATE_LIMIT_PREFIX}${key}`;

  try {
    const multi = redis.multi();
    multi.incr(fullKey);
    multi.ttl(fullKey);
    
    const results = await multi.exec();
    
    const count = results[0] as number;
    let ttl = results[1] as number;

    // Set expiry if key is new
    if (ttl === -1) {
      await redis.expire(fullKey, windowSeconds);
      ttl = windowSeconds;
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return {
      allowed,
      remaining,
      resetIn: ttl,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request
    return { allowed: true, remaining: limit - 1, resetIn: windowSeconds };
  }
}

// ============================================
// CACHE STATS
// ============================================

export async function getCacheStats(): Promise<{
  connected: boolean;
  pricesCached: number;
  queuePending: number;
  queueProcessing: number;
} | null> {
  const redis = await getRedis();
  
  if (!redis) {
    return {
      connected: false,
      pricesCached: 0,
      queuePending: 0,
      queueProcessing: 0,
    };
  }

  try {
    const [priceKeys, pending, processing] = await Promise.all([
      redis.keys(`${PRICE_KEY_PREFIX}*`),
      redis.llen(TRADE_QUEUE_KEY),
      redis.llen(TRADE_QUEUE_PROCESSING),
    ]);

    return {
      connected: true,
      pricesCached: priceKeys.length,
      queuePending: pending,
      queueProcessing: processing,
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return null;
  }
}

/**
 * Clear all price cache
 */
export async function clearPriceCache(): Promise<boolean> {
  const redis = await getRedis();
  
  if (!redis) {
    return false;
  }

  try {
    const keys = await redis.keys(`${PRICE_KEY_PREFIX}*`);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return true;
  } catch (error) {
    console.error('Failed to clear price cache:', error);
    return false;
  }
}

/**
 * Force reconnect to Redis (clear cached instance)
 */
export async function reconnectRedis(): Promise<void> {
  redisInstance = null;
  redisDisabled = false;
  lastConfigCheck = 0;
}

