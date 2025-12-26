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

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, maxSize: 0 };

  constructor(options: { maxSize?: number; defaultTTL?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 60000; // 60 seconds default
    this.stats.maxSize = this.maxSize;
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
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
  set(key: string, value: T, ttlMs?: number): void {
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
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
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
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string | RegExp): number {
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
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : '0%';
    return { ...this.stats, hitRate };
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
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
  cleanup(): number {
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

// =============================================================================
// GLOBAL CACHE INSTANCES
// =============================================================================

// User cache - for getUserById lookups (30 second TTL)
export const userCache = new LRUCache<{
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  role?: string;
}>({
  maxSize: 500,
  defaultTTL: 30000, // 30 seconds
});

// Competition cache - for frequently accessed competitions (10 second TTL)
export const competitionCache = new LRUCache<unknown>({
  maxSize: 100,
  defaultTTL: 10000, // 10 seconds
});

// Leaderboard cache - for expensive leaderboard queries (5 second TTL)
export const leaderboardCache = new LRUCache<unknown[]>({
  maxSize: 50,
  defaultTTL: 5000, // 5 seconds
});

// Generic cache for miscellaneous data
export const genericCache = new LRUCache<unknown>({
  maxSize: 200,
  defaultTTL: 60000, // 60 seconds
});

// =============================================================================
// CACHE UTILITIES
// =============================================================================

/**
 * Invalidate all caches related to a user
 */
export function invalidateUserCaches(userId: string): void {
  userCache.delete(`user:${userId}`);
  leaderboardCache.deletePattern(new RegExp(`.*${userId}.*`));
}

/**
 * Invalidate all caches related to a competition
 */
export function invalidateCompetitionCaches(competitionId: string): void {
  competitionCache.delete(`comp:${competitionId}`);
  leaderboardCache.delete(`leaderboard:${competitionId}`);
}

/**
 * Get all cache statistics
 */
export function getAllCacheStats() {
  return {
    user: userCache.getStats(),
    competition: competitionCache.getStats(),
    leaderboard: leaderboardCache.getStats(),
    generic: genericCache.getStats(),
  };
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  userCache.clear();
  competitionCache.clear();
  leaderboardCache.clear();
  genericCache.clear();
}

// =============================================================================
// AUTO CLEANUP
// =============================================================================

// Clean up expired entries every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    userCache.cleanup();
    competitionCache.cleanup();
    leaderboardCache.cleanup();
    genericCache.cleanup();
  }, 60000);
}

export { LRUCache };

