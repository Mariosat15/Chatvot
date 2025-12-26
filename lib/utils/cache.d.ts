/**
 * In-Memory LRU Cache
 *
 * A simple, fast, and FREE alternative to Redis for caching frequently accessed data.
 * No external dependencies, no network latency, just pure in-memory speed.
 *
 * Trade-offs vs Redis:
 * - ✅ Free (no cost at any scale)
 * - ✅ Faster (~0.1ms vs ~5-20ms for Redis)
 * - ✅ No setup required
 * - ❌ Data lost on app restart (fine for caches)
 * - ❌ Not shared between server instances (fine for single-server)
 */
interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
}
declare class LRUCache<T> {
    private cache;
    private maxSize;
    private defaultTTL;
    private stats;
    constructor(options?: {
        maxSize?: number;
        defaultTTL?: number;
    });
    /**
     * Get a value from the cache
     */
    get(key: string): T | undefined;
    /**
     * Set a value in the cache
     */
    set(key: string, value: T, ttlMs?: number): void;
    /**
     * Get or set with a factory function
     * The most useful method - tries cache first, falls back to factory
     */
    getOrSet(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T>;
    /**
     * Delete a specific key
     */
    delete(key: string): boolean;
    /**
     * Delete all keys matching a pattern
     */
    deletePattern(pattern: string | RegExp): number;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats & {
        hitRate: string;
    };
    /**
     * Evict the least recently used entry
     */
    private evictLRU;
    /**
     * Clean up expired entries (call periodically)
     */
    cleanup(): number;
}
export declare const userCache: LRUCache<{
    id: string;
    email: string;
    name: string;
    profileImage?: string;
    role?: string;
}>;
export declare const competitionCache: LRUCache<unknown>;
export declare const leaderboardCache: LRUCache<unknown[]>;
export declare const genericCache: LRUCache<unknown>;
/**
 * Invalidate all caches related to a user
 */
export declare function invalidateUserCaches(userId: string): void;
/**
 * Invalidate all caches related to a competition
 */
export declare function invalidateCompetitionCaches(competitionId: string): void;
/**
 * Get all cache statistics
 */
export declare function getAllCacheStats(): {
    user: CacheStats & {
        hitRate: string;
    };
    competition: CacheStats & {
        hitRate: string;
    };
    leaderboard: CacheStats & {
        hitRate: string;
    };
    generic: CacheStats & {
        hitRate: string;
    };
};
/**
 * Clear all caches
 */
export declare function clearAllCaches(): void;
/**
 * Hybrid Cache
 *
 * Automatically uses Redis when available, falls back to in-memory cache.
 * This provides the best of both worlds:
 * - Use Redis for shared cache across multiple servers
 * - Fall back to in-memory when Redis is disabled (single server)
 *
 * Usage:
 *   const value = await hybridCache.get('key');
 *   await hybridCache.set('key', value, 60); // 60 second TTL
 */
declare class HybridCache {
    private memoryCache;
    /**
     * Get a value from cache (Redis first, then memory)
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set a value in cache (Redis + memory)
     */
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
    /**
     * Delete a value from cache
     */
    delete(key: string): Promise<boolean>;
    /**
     * Get or set with a factory function
     */
    getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>;
    /**
     * Check if Redis is available
     */
    isRedisAvailable(): Promise<boolean>;
}
export declare const hybridCache: HybridCache;
export { LRUCache };
//# sourceMappingURL=cache.d.ts.map