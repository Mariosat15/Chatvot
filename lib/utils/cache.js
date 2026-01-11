"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = exports.hybridCache = exports.genericCache = exports.leaderboardCache = exports.competitionCache = exports.userCache = void 0;
exports.invalidateUserCaches = invalidateUserCaches;
exports.invalidateCompetitionCaches = invalidateCompetitionCaches;
exports.getAllCacheStats = getAllCacheStats;
exports.clearAllCaches = clearAllCaches;
class LRUCache {
    cache = new Map();
    maxSize;
    defaultTTL;
    stats = { hits: 0, misses: 0, size: 0, maxSize: 0 };
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.defaultTTL = options.defaultTTL || 60000; // 60 seconds default
        this.stats.maxSize = this.maxSize;
    }
    /**
     * Get a value from the cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.size = this.cache.size;
            this.stats.misses++;
            return undefined;
        }
        // Update access stats (for LRU)
        entry.accessCount++;
        entry.lastAccess = Date.now();
        this.stats.hits++;
        return entry.value;
    }
    /**
     * Set a value in the cache
     */
    set(key, value, ttlMs) {
        // Evict if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlMs || this.defaultTTL),
            accessCount: 1,
            lastAccess: Date.now(),
        });
        this.stats.size = this.cache.size;
    }
    /**
     * Get or set with a factory function
     * The most useful method - tries cache first, falls back to factory
     */
    async getOrSet(key, factory, ttlMs) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = await factory();
        this.set(key, value, ttlMs);
        return value;
    }
    /**
     * Delete a specific key
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        this.stats.size = this.cache.size;
        return deleted;
    }
    /**
     * Delete all keys matching a pattern
     */
    deletePattern(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        let deleted = 0;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deleted++;
            }
        }
        this.stats.size = this.cache.size;
        return deleted;
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.stats.size = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : '0%';
        return { ...this.stats, hitRate };
    }
    /**
     * Evict the least recently used entry
     */
    evictLRU() {
        let oldestKey = null;
        let oldestAccess = Infinity;
        for (const [key, entry] of this.cache) {
            if (entry.lastAccess < oldestAccess) {
                oldestAccess = entry.lastAccess;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
    /**
     * Clean up expired entries (call periodically)
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        this.stats.size = this.cache.size;
        return cleaned;
    }
}
exports.LRUCache = LRUCache;
// =============================================================================
// GLOBAL CACHE INSTANCES
// =============================================================================
// User cache - for getUserById lookups (30 second TTL)
exports.userCache = new LRUCache({
    maxSize: 500,
    defaultTTL: 30000, // 30 seconds
});
// Competition cache - for frequently accessed competitions (10 second TTL)
exports.competitionCache = new LRUCache({
    maxSize: 100,
    defaultTTL: 10000, // 10 seconds
});
// Leaderboard cache - for expensive leaderboard queries (5 second TTL)
exports.leaderboardCache = new LRUCache({
    maxSize: 50,
    defaultTTL: 5000, // 5 seconds
});
// Generic cache for miscellaneous data
exports.genericCache = new LRUCache({
    maxSize: 200,
    defaultTTL: 60000, // 60 seconds
});
// =============================================================================
// CACHE UTILITIES
// =============================================================================
/**
 * Invalidate all caches related to a user
 */
function invalidateUserCaches(userId) {
    exports.userCache.delete(`user:${userId}`);
    exports.leaderboardCache.deletePattern(new RegExp(`.*${userId}.*`));
}
/**
 * Invalidate all caches related to a competition
 */
function invalidateCompetitionCaches(competitionId) {
    exports.competitionCache.delete(`comp:${competitionId}`);
    exports.leaderboardCache.delete(`leaderboard:${competitionId}`);
}
/**
 * Get all cache statistics
 */
function getAllCacheStats() {
    return {
        user: exports.userCache.getStats(),
        competition: exports.competitionCache.getStats(),
        leaderboard: exports.leaderboardCache.getStats(),
        generic: exports.genericCache.getStats(),
    };
}
/**
 * Clear all caches
 */
function clearAllCaches() {
    exports.userCache.clear();
    exports.competitionCache.clear();
    exports.leaderboardCache.clear();
    exports.genericCache.clear();
}
// =============================================================================
// HYBRID CACHE (Redis + In-Memory Fallback)
// =============================================================================
const redis_service_1 = require("@/lib/services/redis.service");
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
class HybridCache {
    memoryCache = new LRUCache({
        maxSize: 1000,
        defaultTTL: 60000,
    });
    /**
     * Get a value from cache (Redis first, then memory)
     */
    async get(key) {
        try {
            const redis = await (0, redis_service_1.getRedis)();
            if (redis) {
                const value = await redis.get(key);
                if (value) {
                    // Also store in memory for faster subsequent access
                    this.memoryCache.set(key, typeof value === 'string' ? value : JSON.stringify(value));
                    return typeof value === 'string' ? JSON.parse(value) : value;
                }
                return null;
            }
        }
        catch (error) {
            // Redis failed, fall through to memory cache
        }
        // Fall back to memory cache
        const memValue = this.memoryCache.get(key);
        if (memValue) {
            try {
                return JSON.parse(memValue);
            }
            catch {
                return memValue;
            }
        }
        return null;
    }
    /**
     * Set a value in cache (Redis + memory)
     */
    async set(key, value, ttlSeconds = 60) {
        const stringValue = JSON.stringify(value);
        // Always set in memory cache
        this.memoryCache.set(key, stringValue, ttlSeconds * 1000);
        try {
            const redis = await (0, redis_service_1.getRedis)();
            if (redis) {
                await redis.set(key, stringValue, { ex: ttlSeconds });
                return true;
            }
        }
        catch (error) {
            // Redis failed, but memory cache is still set
        }
        return true; // Memory cache was set
    }
    /**
     * Delete a value from cache
     */
    async delete(key) {
        this.memoryCache.delete(key);
        try {
            const redis = await (0, redis_service_1.getRedis)();
            if (redis) {
                await redis.del(key);
            }
        }
        catch {
            // Ignore Redis errors
        }
        return true;
    }
    /**
     * Get or set with a factory function
     */
    async getOrSet(key, factory, ttlSeconds = 60) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await factory();
        await this.set(key, value, ttlSeconds);
        return value;
    }
    /**
     * Check if Redis is available
     */
    async isRedisAvailable() {
        try {
            const redis = await (0, redis_service_1.getRedis)();
            return redis !== null;
        }
        catch {
            return false;
        }
    }
}
// Export singleton instance
exports.hybridCache = new HybridCache();
// =============================================================================
// AUTO CLEANUP
// =============================================================================
// Clean up expired entries every 60 seconds
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        exports.userCache.cleanup();
        exports.competitionCache.cleanup();
        exports.leaderboardCache.cleanup();
        exports.genericCache.cleanup();
    }, 60000);
}
//# sourceMappingURL=cache.js.map