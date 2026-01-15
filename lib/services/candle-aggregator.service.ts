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

import { connectToDatabase } from '@/database/mongoose';
import Candle1m, { CandleData } from '@/database/models/candle-1m.model';
import { getFormingCandle, FormingCandle } from '@/lib/services/websocket-price-streamer';
import { getRecentCandles, fetchCandlesForRange, Timeframe } from '@/lib/services/forex-historical.service';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { 
  getHistoricalCandles, 
  saveHistoricalCandles, 
  hasHistoricalData,
  normalizeTimeframe,
  HistoricalTimeframe 
} from '@/database/models/candle-historical.model';

// ============================================
// TYPES
// ============================================

export interface AggregatedCandle {
  time: number;    // Unix timestamp in SECONDS (start of candle)
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
  '5m': 5,
  '5': 5,
  '15m': 15,
  '15': 15,
  '30m': 30,
  '30': 30,
  '1h': 60,
  '60': 60,
  '4h': 240,
  '240': 240,
};

// Cache TTL in milliseconds (shorter = more up-to-date, longer = less computation)
const CACHE_TTL_MS: Record<string, number> = {
  '5m': 30000,    // 30 seconds - forming candle updates frequently
  '5': 30000,
  '15m': 60000,   // 1 minute
  '15': 60000,
  '30m': 60000,   // 1 minute
  '30': 60000,
  '1h': 120000,   // 2 minutes
  '60': 120000,
  '4h': 300000,   // 5 minutes
  '240': 300000,
};

// ============================================
// IN-MEMORY CACHE (same pattern as priceCache)
// ============================================

const aggregatedCandleCache = new Map<string, CacheEntry>();

// Cache stats for monitoring
let cacheHits = 0;
let cacheMisses = 0;

// Progressive loading: Track background fetches to avoid duplicate API calls
const backgroundFetchInProgress = new Set<string>();

// Track which symbol/timeframe combinations have already had historical data fetched
// This prevents re-fetching on every request even if there's still a gap
const historicalFetchCompleted = new Set<string>();

// NOTE: Historical data is now stored in MongoDB permanently (candles_historical_*)
// No more RAM cache that gets lost on restart!

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
  timeframeMinutes: number
): AggregatedCandle[] {
  if (candles1m.length === 0) return [];
  
  const aggregated: AggregatedCandle[] = [];
  const intervalSeconds = timeframeMinutes * 60;
  
  // Group candles by timeframe boundary
  const groups = new Map<number, CandleData[]>();
  
  for (const candle of candles1m) {
    // Floor to timeframe boundary
    const groupTime = Math.floor(candle.time / intervalSeconds) * intervalSeconds;
    
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
      high: Math.max(...groupCandles.map(c => c.high)),
      low: Math.min(...groupCandles.map(c => c.low)),
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
  timeframeMinutes: number
): AggregatedCandle | null {
  if (!forming1m) return null;
  
  const intervalSeconds = timeframeMinutes * 60;
  const currentPeriodStart = Math.floor(forming1m.time / intervalSeconds) * intervalSeconds;
  
  // Get all 1m candles in the current period (including forming)
  const periodCandles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  
  // Add completed 1m candles from this period
  for (const candle of candles1m) {
    if (candle.time >= currentPeriodStart && candle.time < currentPeriodStart + intervalSeconds) {
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
    high: Math.max(...periodCandles.map(c => c.high)),
    low: Math.min(...periodCandles.map(c => c.low)),
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
  count: number = 500
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
    const formingCandle = calculateFormingCandle(cached.candles as CandleData[], forming1m, timeframeMinutes);
    
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
      source: 'aggregated_cached',
      cached: true,
    };
  }
  
  cacheMisses++;
  
  // Get timeframe in minutes
  const timeframeMinutes = TIMEFRAME_MINUTES[timeframe];
  if (!timeframeMinutes) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }
  
  // Map timeframe to Massive.com API format
  const apiTimeframeMap: Record<number, Timeframe> = {
    5: '5',
    15: '15',
    30: '30',
    60: '60',
    240: '240',
  };
  
  // Calculate how many 1m candles we need
  // For 500 5m candles, we need 500 * 5 = 2500 1m candles
  const candles1mNeeded = count * timeframeMinutes;
  
  // Fetch 1m candles from MongoDB
  await connectToDatabase();
  const candles1m = await Candle1m.getCandles(symbol, candles1mNeeded);
  
  // Aggregate into target timeframe from MongoDB data
  const aggregatedFromMongo = aggregateCandles(candles1m, timeframeMinutes);
  
  // ==== HISTORICAL DATA: Stored permanently in MongoDB ====
  let finalAggregated: AggregatedCandle[] = [];
  let source = 'aggregated_fresh';
  
  const apiTimeframe = apiTimeframeMap[timeframeMinutes];
  const normalizedTf = normalizeTimeframe(timeframe);
  const backgroundKey = `${symbol}:${timeframe}:fetch`;
  
  const oldestMongoTime = aggregatedFromMongo.length > 0 
    ? Math.min(...aggregatedFromMongo.map(c => c.time))
    : Math.floor(Date.now() / 1000);
  
  // DEBUG: Log what we're working with
  console.log(`🔍 [Aggregator DEBUG] ${symbol} ${timeframe}: normalizedTf=${normalizedTf}, apiTimeframe=${apiTimeframe}, aggregatedFromMongo=${aggregatedFromMongo.length}, oldestMongoTime=${new Date(oldestMongoTime * 1000).toISOString()}`);
  
  // Check if we have historical data in MongoDB (permanent storage)
  if (normalizedTf && apiTimeframe) {
    try {
      // Get historical candles from MongoDB (before oldest aggregated candle)
      const historicalCandles = await getHistoricalCandles(
        normalizedTf,
        symbol,
        oldestMongoTime,
        count
      );
      
      console.log(`🔍 [Aggregator DEBUG] ${symbol} ${timeframe}: Found ${historicalCandles.length} historical candles in MongoDB`);
      
      // Check if there's a GAP between historical data and recent data
      const newestHistoricalTime = historicalCandles.length > 0 
        ? Math.max(...historicalCandles.map(c => c.time))
        : 0;
      const gapMinutes = newestHistoricalTime > 0 
        ? Math.floor((oldestMongoTime - newestHistoricalTime) / 60)
        : Infinity;
      
      console.log(`🔍 [Aggregator DEBUG] ${symbol} ${timeframe}: newestHistorical=${newestHistoricalTime > 0 ? new Date(newestHistoricalTime * 1000).toISOString() : 'none'}, gap=${gapMinutes} minutes`);
      
      // Check if we've already completed a historical fetch for this symbol/timeframe
      const fetchCompletedKey = `${symbol}:${normalizedTf}`;
      const alreadyFetched = historicalFetchCompleted.has(fetchCompletedKey);
      
      // If we have ANY historical data, use it (merge with MongoDB aggregated)
      // Only trigger background fetch if no historical data AND not already fetched
      if (historicalCandles.length > 0) {
        // Merge historical (old) + aggregated (recent)
        const mongoTimeSet = new Set(aggregatedFromMongo.map(c => c.time));
        const uniqueOlderCandles = historicalCandles.filter(c => !mongoTimeSet.has(c.time));
        
        finalAggregated = [...uniqueOlderCandles, ...aggregatedFromMongo].sort((a, b) => a.time - b.time);
        source = 'hybrid_mongodb';
        
        console.log(`✅ [Aggregator] ${symbol} ${timeframe}: Merged ${uniqueOlderCandles.length} historical + ${aggregatedFromMongo.length} recent = ${finalAggregated.length} total`);
        
        // Mark as fetched since we have data
        historicalFetchCompleted.add(fetchCompletedKey);
      } else if (alreadyFetched) {
        // We've already tried fetching but got no data - just use MongoDB data
        finalAggregated = aggregatedFromMongo;
        source = 'mongodb_only_no_history_available';
        console.log(`📊 [Aggregator] ${symbol} ${timeframe}: No historical data available (already fetched), using ${aggregatedFromMongo.length} aggregated candles`);
      } else {
        // No historical data and haven't fetched yet - return MongoDB data and fetch in background
        finalAggregated = aggregatedFromMongo;
        source = 'mongodb_only';
        
        // Start background fetch if not already running
        if (!backgroundFetchInProgress.has(backgroundKey) && candles1m.length > 0) {
          backgroundFetchInProgress.add(backgroundKey);
          
          // Fetch 10 years of history from Massive.com API
          const YEARS_OF_HISTORY = 10;
          const fromTimestampMs = (oldestMongoTime * 1000) - (YEARS_OF_HISTORY * 365 * 24 * 60 * 60 * 1000);
          const toTimestampMs = (oldestMongoTime - 60) * 1000;
          
          console.log(`📅 [Background] Fetching historical ${timeframe} for ${symbol} from ${new Date(fromTimestampMs).toISOString()} to ${new Date(toTimestampMs).toISOString()}`);
          
          // Background async fetch and SAVE TO MONGODB (permanent!)
          (async () => {
            try {
              const apiCandles = await fetchCandlesForRange(
                symbol as ForexSymbol, 
                apiTimeframe, 
                fromTimestampMs, 
                toTimestampMs
              );
              
              console.log(`📥 [Background] Received ${apiCandles.length} candles from API for ${symbol} ${timeframe}`);
              
              if (apiCandles.length > 0) {
                const candlesToSave = apiCandles.map(c => ({
                  time: Math.floor(c.time / 1000),
                  open: c.open,
                  high: c.high,
                  low: c.low,
                  close: c.close,
                  volume: c.volume,
                }));
                
                // SAVE TO MONGODB PERMANENTLY (not RAM!)
                const savedCount = await saveHistoricalCandles(normalizedTf, symbol, candlesToSave);
                
                console.log(`💾 [Background] Saved ${savedCount} NEW historical ${timeframe} candles for ${symbol} to MongoDB (total received: ${candlesToSave.length})`);
              } else {
                console.log(`⚠️ [Background] No historical data from Massive.com for ${symbol} ${timeframe}`);
              }
              
              // Mark as completed regardless of result
              historicalFetchCompleted.add(fetchCompletedKey);
            } catch (error) {
              console.error(`❌ [Background] Failed to fetch/save ${symbol} ${timeframe}:`, error);
              // Still mark as completed to avoid infinite retries
              historicalFetchCompleted.add(fetchCompletedKey);
            } finally {
              backgroundFetchInProgress.delete(backgroundKey);
            }
          })();
        } else if (backgroundFetchInProgress.has(backgroundKey)) {
          console.log(`⏳ [Aggregator] ${symbol} ${timeframe}: Background fetch already in progress`);
        }
      }
    } catch (error) {
      console.error(`❌ [Aggregator] Error reading historical data for ${symbol} ${timeframe}:`, error);
      finalAggregated = aggregatedFromMongo;
      source = 'mongodb_fallback';
    }
  } else if (candles1m.length > 0) {
    // Timeframe doesn't support historical storage, use aggregated only
    finalAggregated = aggregatedFromMongo;
    source = 'aggregated_only';
  } else if (candles1m.length === 0) {
    // No MongoDB data at all - fetch entirely from Massive.com API using getRecentCandles
    console.log(`⚠️ [Aggregator] ${symbol} ${timeframe}: No MongoDB data, fetching from Massive.com API...`);
    
    try {
      if (apiTimeframe) {
        const apiCandles = await getRecentCandles(symbol as ForexSymbol, apiTimeframe, count);
        finalAggregated = apiCandles.map(c => ({
          time: c.time, // getRecentCandles returns seconds
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        })).sort((a, b) => a.time - b.time);
        source = 'massive_api_only';
      }
    } catch (apiError) {
      console.error(`❌ [Aggregator] Failed to fetch from Massive.com for ${symbol} ${timeframe}:`, apiError);
      return {
        candles: [],
        formingCandle: null,
        source: 'error',
        cached: false,
      };
    }
  }
  
  // Final fallback: if still empty, use whatever MongoDB has
  if (finalAggregated.length === 0 && aggregatedFromMongo.length > 0) {
    finalAggregated = aggregatedFromMongo;
    source = 'mongodb_fallback';
  }
  
  // Get forming candle
  const forming1m = getFormingCandle(symbol);
  const formingCandle = calculateFormingCandle(candles1m, forming1m, timeframeMinutes);
  
  // Store in cache (without forming candle - that's calculated fresh)
  aggregatedCandleCache.set(cacheKey, {
    candles: finalAggregated,
    formingCandle: null, // We recalculate this on each request
    cachedAt: Date.now(),
    symbol,
    timeframe,
  });
  
  // Prepare result with forming candle
  const result = [...finalAggregated];
  
  if (formingCandle) {
    const lastIndex = result.length - 1;
    if (lastIndex >= 0 && result[lastIndex].time === formingCandle.time) {
      result[lastIndex] = formingCandle;
    } else if (lastIndex < 0 || formingCandle.time > result[lastIndex].time) {
      result.push(formingCandle);
    }
  }
  
  // Log occasionally
  if (Math.random() < 0.1) {
    console.log(`📊 [Aggregator] ${symbol} ${timeframe}: ${finalAggregated.length} candles (source: ${source}, cache: ${cacheHits} hits, ${cacheMisses} misses)`);
  }
  
  return {
    candles: result.slice(-count),
    formingCandle,
    source,
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
    hitRate: total > 0 ? `${((cacheHits / total) * 100).toFixed(1)}%` : '0%',
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
    keysToDelete.forEach(key => aggregatedCandleCache.delete(key));
  } else {
    aggregatedCandleCache.clear();
  }
}
