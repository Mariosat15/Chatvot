/**
 * Candle Aggregator Service
 *
 * Aggregates 1-minute candles into higher timeframes (5m, 15m, 30m, 1h, etc.)
 * Uses in-memory caching to avoid recomputing for every request.
 *
 * Benefits:
 * - 100% consistency: All timeframes derived from same 1m source
 * - No external API calls needed
 * - In-memory cache: ~1ms response for 1000 users
 * - Single source of truth: Server-built 1m candles
 *
 * Architecture:
 * - Query 1m candles from MongoDB
 * - Aggregate into requested timeframe
 * - Cache result in memory (TTL based on timeframe)
 * - Return cached data for subsequent requests
 */

import { connectToDatabase } from "@/database/mongoose";
import Candle1m, { CandleData } from "@/database/models/candle-1m.model";
import TradingSymbol from "@/database/models/trading/symbol-settings.model";
import {
  getFormingCandle,
  FormingCandle,
} from "@/lib/services/websocket-price-streamer";

// ============================================
// TYPES
// ============================================

export interface AggregatedCandle {
  time: number; // Unix timestamp in SECONDS (start of candle)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CacheEntry {
  candles: AggregatedCandle[];
  formingCandle: AggregatedCandle | null;
  cachedAt: number;
  symbol: string;
  timeframe: string;
}

// ============================================
// CONFIGURATION
// ============================================

// Timeframe in minutes
const TIMEFRAME_MINUTES: Record<string, number> = {
  "5m": 5,
  "5": 5,
  "15m": 15,
  "15": 15,
  "30m": 30,
  "30": 30,
  "1h": 60,
  "60": 60,
  "4h": 240,
  "240": 240,
  "1d": 1440,
  "1D": 1440,
  D: 1440,
  "1440": 1440,
  "1w": 10080, // 7 days * 24 hours * 60 minutes
  "1W": 10080,
  W: 10080,
  "10080": 10080,
  "1M": 43200, // 30 days * 24 hours * 60 minutes (approx)
  M: 43200,
  "43200": 43200,
};

// Cache TTL in milliseconds (shorter = more up-to-date, longer = less computation)
const CACHE_TTL_MS: Record<string, number> = {
  "5m": 30000, // 30 seconds - forming candle updates frequently
  "5": 30000,
  "15m": 60000, // 1 minute
  "15": 60000,
  "30m": 60000, // 1 minute
  "30": 60000,
  "1h": 120000, // 2 minutes
  "60": 120000,
  "4h": 300000, // 5 minutes
  "240": 300000,
  "1d": 600000, // 10 minutes for daily
  "1D": 600000,
  D: 600000,
  "1440": 600000,
  "1w": 900000, // 15 minutes for weekly
  "1W": 900000,
  W: 900000,
  "10080": 900000,
  "1M": 1800000, // 30 minutes for monthly
  M: 1800000,
  "43200": 1800000,
};

// ============================================
// IN-MEMORY CACHE (same pattern as priceCache)
// ============================================

const aggregatedCandleCache = new Map<string, CacheEntry>();

// Cache stats for monitoring
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Get cache key for a symbol/timeframe combination
 */
function getCacheKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry, timeframe: string): boolean {
  const ttl = CACHE_TTL_MS[timeframe] || 60000;
  return Date.now() - entry.cachedAt < ttl;
}

// ============================================
// AGGREGATION LOGIC
// ============================================

/**
 * Aggregate 1-minute candles into a higher timeframe
 *
 * @param candles1m - Array of 1-minute candles (sorted ascending by time)
 * @param timeframeMinutes - Target timeframe in minutes (e.g., 5 for 5m)
 * @returns Aggregated candles
 */
function aggregateCandles(
  candles1m: CandleData[],
  timeframeMinutes: number,
): AggregatedCandle[] {
  if (candles1m.length === 0) return [];

  const aggregated: AggregatedCandle[] = [];
  const intervalSeconds = timeframeMinutes * 60;

  // Group candles by timeframe boundary
  const groups = new Map<number, CandleData[]>();

  for (const candle of candles1m) {
    // Floor to timeframe boundary
    const groupTime =
      Math.floor(candle.time / intervalSeconds) * intervalSeconds;

    if (!groups.has(groupTime)) {
      groups.set(groupTime, []);
    }
    groups.get(groupTime)!.push(candle);
  }

  // Convert groups to aggregated candles
  const sortedTimes = Array.from(groups.keys()).sort((a, b) => a - b);

  for (const groupTime of sortedTimes) {
    const groupCandles = groups.get(groupTime)!;

    // Sort by time to ensure correct open/close
    groupCandles.sort((a, b) => a.time - b.time);

    const aggregatedCandle: AggregatedCandle = {
      time: groupTime,
      open: groupCandles[0].open,
      high: Math.max(...groupCandles.map((c) => c.high)),
      low: Math.min(...groupCandles.map((c) => c.low)),
      close: groupCandles[groupCandles.length - 1].close,
      volume: groupCandles.reduce((sum, c) => sum + (c.volume || 0), 0),
    };

    aggregated.push(aggregatedCandle);
  }

  return aggregated;
}

/**
 * Calculate the forming candle for a higher timeframe
 * by aggregating the current forming 1m candle with any completed 1m candles
 * in the current timeframe period
 */
function calculateFormingCandle(
  candles1m: CandleData[],
  forming1m: FormingCandle | null,
  timeframeMinutes: number,
): AggregatedCandle | null {
  if (!forming1m) return null;

  const intervalSeconds = timeframeMinutes * 60;
  const currentPeriodStart =
    Math.floor(forming1m.time / intervalSeconds) * intervalSeconds;

  // Get all 1m candles in the current period (including forming)
  const periodCandles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }> = [];

  // Add completed 1m candles from this period
  for (const candle of candles1m) {
    if (
      candle.time >= currentPeriodStart &&
      candle.time < currentPeriodStart + intervalSeconds
    ) {
      periodCandles.push(candle);
    }
  }

  // Add the forming 1m candle
  periodCandles.push({
    time: forming1m.time,
    open: forming1m.open,
    high: forming1m.high,
    low: forming1m.low,
    close: forming1m.close,
  });

  // Sort by time
  periodCandles.sort((a, b) => a.time - b.time);

  if (periodCandles.length === 0) return null;

  return {
    time: currentPeriodStart,
    open: periodCandles[0].open,
    high: Math.max(...periodCandles.map((c) => c.high)),
    low: Math.min(...periodCandles.map((c) => c.low)),
    close: periodCandles[periodCandles.length - 1].close,
  };
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Get aggregated candles for a symbol and timeframe
 * Uses in-memory cache to avoid recomputation
 *
 * @param symbol - Trading symbol (e.g., "EUR/USD")
 * @param timeframe - Target timeframe (e.g., "5m", "15m", "1h")
 * @param count - Number of candles to return
 * @returns Aggregated candles with forming candle
 */
export async function getAggregatedCandles(
  symbol: string,
  timeframe: string,
  count: number = 100,
): Promise<{
  candles: AggregatedCandle[];
  formingCandle: AggregatedCandle | null;
  source: string;
  cached: boolean;
}> {
  const cacheKey = getCacheKey(symbol, timeframe);
  const cached = aggregatedCandleCache.get(cacheKey);

  // Check cache
  if (cached && isCacheValid(cached, timeframe)) {
    cacheHits++;

    // Even with cached historical candles, update the forming candle
    const forming1m = getFormingCandle(symbol);
    const timeframeMinutes = TIMEFRAME_MINUTES[timeframe] || 5;
    const formingCandle = calculateFormingCandle(
      cached.candles as CandleData[],
      forming1m,
      timeframeMinutes,
    );

    // Return cached candles with updated forming candle
    const result = [...cached.candles];

    // Update or append forming candle
    if (formingCandle) {
      const lastIndex = result.length - 1;
      if (lastIndex >= 0 && result[lastIndex].time === formingCandle.time) {
        result[lastIndex] = formingCandle;
      } else if (lastIndex < 0 || formingCandle.time > result[lastIndex].time) {
        result.push(formingCandle);
      }
    }

    return {
      candles: result.slice(-count),
      formingCandle,
      source: "aggregated_cached",
      cached: true,
    };
  }

  cacheMisses++;

  // Get timeframe in minutes
  const timeframeMinutes = TIMEFRAME_MINUTES[timeframe];
  if (!timeframeMinutes) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  // Calculate how many 1m candles we need
  // For 500 5m candles, we need 500 * 5 = 2500 1m candles
  const candles1mNeeded = count * timeframeMinutes;

  // Fetch 1m candles from MongoDB
  await connectToDatabase();
  const candles1m = await Candle1m.getCandles(symbol, candles1mNeeded);

  if (candles1m.length === 0) {
    return {
      candles: [],
      formingCandle: null,
      source: "aggregated_empty",
      cached: false,
    };
  }

  // Aggregate into target timeframe
  const aggregated = aggregateCandles(candles1m, timeframeMinutes);

  // Get forming candle
  const forming1m = getFormingCandle(symbol);
  const formingCandle = calculateFormingCandle(
    candles1m,
    forming1m,
    timeframeMinutes,
  );

  // Store in cache (without forming candle - that's calculated fresh)
  aggregatedCandleCache.set(cacheKey, {
    candles: aggregated,
    formingCandle: null, // We recalculate this on each request
    cachedAt: Date.now(),
    symbol,
    timeframe,
  });

  // Prepare result with forming candle
  const result = [...aggregated];

  if (formingCandle) {
    const lastIndex = result.length - 1;
    if (lastIndex >= 0 && result[lastIndex].time === formingCandle.time) {
      result[lastIndex] = formingCandle;
    } else if (lastIndex < 0 || formingCandle.time > result[lastIndex].time) {
      result.push(formingCandle);
    }
  }

  // Aggregation complete (logging removed for performance)

  return {
    candles: result.slice(-count),
    formingCandle,
    source: "aggregated_fresh",
    cached: false,
  };
}

/**
 * Check if a timeframe is supported by the aggregator
 */
export function isAggregatorSupported(timeframe: string): boolean {
  return timeframe in TIMEFRAME_MINUTES;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  entries: number;
  hits: number;
  misses: number;
  hitRate: string;
} {
  const total = cacheHits + cacheMisses;
  return {
    entries: aggregatedCandleCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? `${((cacheHits / total) * 100).toFixed(1)}%` : "0%",
  };
}

/**
 * Clear cache for a specific symbol/timeframe or all
 */
export function clearCache(symbol?: string, timeframe?: string): void {
  if (symbol && timeframe) {
    aggregatedCandleCache.delete(getCacheKey(symbol, timeframe));
  } else if (symbol) {
    const keysToDelete: string[] = [];
    aggregatedCandleCache.forEach((_, key) => {
      if (key.startsWith(`${symbol}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => aggregatedCandleCache.delete(key));
  } else {
    aggregatedCandleCache.clear();
  }
}

// ============================================
// CACHE PRE-WARMING (Server Startup)
// ============================================

// Timeframes that use aggregator (excluding 1d/W/M which don't use it)
const WARM_TIMEFRAMES = ["5m", "15m", "30m", "1h", "4h"];

let cacheWarmingComplete = false;
let cacheWarmingInProgress = false;

/**
 * Fetch enabled symbols from admin configuration
 */
async function getEnabledSymbols(): Promise<string[]> {
  try {
    const symbols = await TradingSymbol.find({ enabled: true })
      .select("symbol")
      .lean();
    return symbols.map((s) => s.symbol);
  } catch (err) {
    console.warn(
      "⚠️ [Aggregator] Failed to fetch symbols, using fallback:",
      err,
    );
    // Fallback to common symbols if DB query fails
    return [
      "EUR/USD",
      "GBP/USD",
      "USD/JPY",
      "USD/CAD",
      "USD/CHF",
      "AUD/USD",
      "NZD/USD",
      "EUR/GBP",
      "EUR/JPY",
      "GBP/JPY",
      "EUR/CHF",
      "EUR/AUD",
      "EUR/CAD",
      "EUR/NZD",
      "GBP/CHF",
      "GBP/AUD",
      "GBP/CAD",
      "GBP/NZD",
      "AUD/JPY",
      "AUD/CHF",
      "AUD/CAD",
      "AUD/NZD",
      "CAD/JPY",
      "CAD/CHF",
      "CHF/JPY",
      "NZD/JPY",
      "NZD/CHF",
    ];
  }
}

/**
 * Pre-warm the aggregator cache for all enabled symbols and timeframes
 * Call this on server startup to ensure first users don't hit cold cache
 * Uses parallel warming for faster completion
 */
export async function warmCache(): Promise<void> {
  if (cacheWarmingComplete || cacheWarmingInProgress) {
    return;
  }

  cacheWarmingInProgress = true;
  console.log("🔥 [Aggregator] Starting cache pre-warming (parallel mode)...");
  const startTime = Date.now();

  try {
    await connectToDatabase();

    // Fetch enabled symbols from admin configuration
    const enabledSymbols = await getEnabledSymbols();
    console.log(
      `📊 [Aggregator] Found ${enabledSymbols.length} enabled symbols to warm`,
    );

    // Build list of all symbol/timeframe combinations to warm
    const warmTasks: Array<{ symbol: string; timeframe: string }> = [];
    for (const symbol of enabledSymbols) {
      for (const timeframe of WARM_TIMEFRAMES) {
        warmTasks.push({ symbol, timeframe });
      }
    }

    // Process in parallel batches of 10 for faster warming
    const BATCH_SIZE = 10;
    let completed = 0;

    for (let i = 0; i < warmTasks.length; i += BATCH_SIZE) {
      const batch = warmTasks.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async ({ symbol, timeframe }) => {
          try {
            // Use full count for warming (500 candles = matches user requests)
            await getAggregatedCandles(symbol, timeframe, 500);
            completed++;
          } catch {
            // Don't fail the whole warming if one symbol fails
            completed++;
          }
        }),
      );

      // Progress log every 50 completions
      if (completed % 50 === 0 || completed === warmTasks.length) {
        console.log(
          `🔄 [Aggregator] Warming progress: ${completed}/${warmTasks.length}`,
        );
      }
    }

    cacheWarmingComplete = true;
    const duration = Date.now() - startTime;
    console.log(
      `✅ [Aggregator] Cache pre-warming complete in ${(duration / 1000).toFixed(1)}s (${enabledSymbols.length} symbols × ${WARM_TIMEFRAMES.length} timeframes = ${aggregatedCandleCache.size} entries)`,
    );
  } catch (err) {
    console.error("❌ [Aggregator] Cache pre-warming failed:", err);
  } finally {
    cacheWarmingInProgress = false;
  }
}

/**
 * Check if cache warming is complete
 */
export function isCacheWarmed(): boolean {
  return cacheWarmingComplete;
}
