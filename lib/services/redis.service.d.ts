import { Redis } from '@upstash/redis';
export interface RedisConfig {
    url: string;
    token: string;
    enabled: boolean;
}
/**
 * Get Redis configuration from database
 */
export declare function getRedisConfig(): Promise<RedisConfig | null>;
/**
 * Get or create Redis instance
 * Returns null immediately if Redis is disabled (no database call)
 */
export declare function getRedis(): Promise<Redis | null>;
/**
 * Test Redis connection
 */
export declare function testRedisConnection(url: string, token: string): Promise<{
    success: boolean;
    message: string;
    latency?: number;
}>;
export interface CachedPrice {
    bid: number;
    ask: number;
    mid: number;
    timestamp: number;
}
/**
 * Set price in Redis cache
 */
export declare function setPrice(symbol: string, price: CachedPrice): Promise<boolean>;
/**
 * Set multiple prices in Redis cache (pipeline for performance)
 */
export declare function setPrices(prices: Map<string, CachedPrice>): Promise<boolean>;
/**
 * Get price from Redis cache
 */
export declare function getPrice(symbol: string): Promise<CachedPrice | null>;
/**
 * Get multiple prices from Redis cache
 */
export declare function getPrices(symbols: string[]): Promise<Map<string, CachedPrice>>;
/**
 * Get all cached prices
 */
export declare function getAllPrices(): Promise<Map<string, CachedPrice>>;
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
export declare function queueTrade(trade: Omit<QueuedTrade, 'timestamp' | 'retries'>): Promise<boolean>;
/**
 * Get next trade from queue
 */
export declare function dequeueTradeForProcessing(): Promise<QueuedTrade | null>;
/**
 * Mark trade as completed (remove from processing)
 */
export declare function completeQueuedTrade(trade: QueuedTrade): Promise<boolean>;
/**
 * Re-queue failed trade (with retry count)
 */
export declare function requeueFailedTrade(trade: QueuedTrade): Promise<boolean>;
/**
 * Get queue stats
 */
export declare function getQueueStats(): Promise<{
    pending: number;
    processing: number;
} | null>;
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
}
/**
 * Check and increment rate limit
 */
export declare function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
export declare function getCacheStats(): Promise<{
    connected: boolean;
    pricesCached: number;
    queuePending: number;
    queueProcessing: number;
} | null>;
/**
 * Clear all price cache
 */
export declare function clearPriceCache(): Promise<boolean>;
/**
 * Force reconnect to Redis (clear cached instance)
 */
export declare function reconnectRedis(): Promise<void>;
