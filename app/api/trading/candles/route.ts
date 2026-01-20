import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Candle1m from '@/database/models/candle-1m.model';
import { getRecentCandles, fetchCandlesForRange, Timeframe } from '@/lib/services/forex-historical.service';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { 
  getFormingCandle, 
  getForming1hCandle,
  getForming4hCandle,
  getFormingDailyCandle,
  getFormingWeeklyCandle,
  getFormingMonthlyCandle
} from '@/lib/services/websocket-price-streamer';
import { getAggregatedCandles, isAggregatorSupported } from '@/lib/services/candle-aggregator.service';
import { 
  getHistoricalCandles, 
  getOldestHistoricalCandle,
  getHistoricalModel,
  IHistoricalCandle 
} from '@/database/models/candle-historical.model';
import mongoose from 'mongoose';

// Track which symbols are currently being seeded (prevent duplicate seeding)
const seedingInProgress = new Set<string>();

// Track gap fill operations (prevent duplicates, run occasionally)
const gapFillInProgress = new Set<string>();
const lastGapFillCheck = new Map<string, number>();
const GAP_FILL_CHECK_INTERVAL = 60000; // Check for gaps every 60 seconds per symbol

// Default settings (fallback if DB settings not available)
const DEFAULT_INITIAL_CANDLE_COUNT = 500;
const DEFAULT_LAZY_LOAD_BATCH_SIZE = 500;

// MarketDataSettings schema (must match admin app)
const MarketDataSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'market_data_settings' },
  useLocalHistory: { type: Boolean, default: true },
  autoFetchHistory: { type: Boolean, default: false },
  chartHistoryLimitEnabled: { type: Boolean, default: false },
  chartHistoryLimitDays: { type: Number, default: 365 },
  initialCandleCount: { type: Number, default: 500 },
  lazyLoadBatchSize: { type: Number, default: 500 },
  historicalYearsToDownload: { type: Number, default: 10 },
  seedingDaysBack: { type: Number, default: 30 }, // How many days to fetch when DB is empty
}, { timestamps: true });

// Get or create the model
function getMarketDataSettingsModel() {
  return mongoose.models.MarketDataSettings || 
    mongoose.model('MarketDataSettings', MarketDataSettingsSchema);
}

// Default seeding days (when DB is empty)
const DEFAULT_SEEDING_DAYS_BACK = 30;

/**
 * Get market data settings from database
 */
async function getMarketDataSettings(): Promise<{
  useLocalHistory: boolean;
  autoFetchHistory: boolean;
  chartHistoryLimitEnabled: boolean;
  chartHistoryLimitMinutesTotal: number; // Total minutes for history limit
  initialCandleCount: number;
  lazyLoadBatchSize: number;
  seedingMinutesTotal: number; // Total minutes for seeding
}> {
  try {
    // Use raw MongoDB query to bypass Mongoose schema caching issues
    const db = mongoose.connection.db;
    const settings = await db?.collection('marketdatasettings').findOne({ key: 'market_data_settings' });
    
    // Debug: Log raw database values
    console.log(`🔍 [Settings Debug] Raw DB values: initialCandleCount=${settings?.initialCandleCount}, seedingDaysBack=${settings?.seedingDaysBack}, seedingHours=${settings?.seedingHours}, seedingMinutes=${settings?.seedingMinutes}, chartHistoryLimitEnabled=${settings?.chartHistoryLimitEnabled}`);
    
    if (!settings) {
      console.log('📋 [Settings] No settings found, using defaults');
      return {
        useLocalHistory: true,
        autoFetchHistory: false,
        chartHistoryLimitEnabled: false,
        chartHistoryLimitMinutesTotal: (3650 * 24 * 60) + (23 * 60) + 59, // 10 years max in minutes
        initialCandleCount: DEFAULT_INITIAL_CANDLE_COUNT,
        lazyLoadBatchSize: DEFAULT_LAZY_LOAD_BATCH_SIZE,
        seedingMinutesTotal: DEFAULT_SEEDING_DAYS_BACK * 24 * 60, // 30 days in minutes
      };
    }
    
    // Calculate total minutes for seeding (days + hours + minutes)
    const seedingDays = settings.seedingDaysBack ?? DEFAULT_SEEDING_DAYS_BACK;
    const seedingHours = settings.seedingHours ?? 0;
    const seedingMinutes = settings.seedingMinutes ?? 0;
    const seedingMinutesTotal = (seedingDays * 24 * 60) + (seedingHours * 60) + seedingMinutes;
    
    // Calculate total minutes for history limit (days + hours + minutes)
    const historyDays = settings.chartHistoryLimitDays ?? 3650;
    const historyHours = settings.chartHistoryLimitHours ?? 23;
    const historyMinutes = settings.chartHistoryLimitMinutes ?? 59;
    const chartHistoryLimitMinutesTotal = (historyDays * 24 * 60) + (historyHours * 60) + historyMinutes;
    
    const result = {
      useLocalHistory: settings.useLocalHistory ?? true,
      autoFetchHistory: settings.autoFetchHistory ?? false,
      chartHistoryLimitEnabled: settings.chartHistoryLimitEnabled ?? false,
      chartHistoryLimitMinutesTotal,
      initialCandleCount: settings.initialCandleCount ?? DEFAULT_INITIAL_CANDLE_COUNT,
      lazyLoadBatchSize: settings.lazyLoadBatchSize ?? DEFAULT_LAZY_LOAD_BATCH_SIZE,
      seedingMinutesTotal,
    };
    
    // Format time for logging
    const formatTime = (totalMinutes: number) => {
      const d = Math.floor(totalMinutes / (24 * 60));
      const h = Math.floor((totalMinutes % (24 * 60)) / 60);
      const m = totalMinutes % 60;
      return `${d}d ${h}h ${m}m`;
    };
    
    console.log(`📋 [Settings] Loaded: limit=${result.chartHistoryLimitEnabled ? formatTime(result.chartHistoryLimitMinutesTotal) : 'OFF'}, initial=${result.initialCandleCount}, batch=${result.lazyLoadBatchSize}, seeding=${formatTime(result.seedingMinutesTotal)}`);
    
    return result;
  } catch (error) {
    console.error('❌ [Settings] Error loading settings:', error);
    return {
      useLocalHistory: true,
      autoFetchHistory: false,
      chartHistoryLimitEnabled: false,
      chartHistoryLimitMinutesTotal: 365 * 24 * 60, // 365 days in minutes
      initialCandleCount: DEFAULT_INITIAL_CANDLE_COUNT,
      lazyLoadBatchSize: DEFAULT_LAZY_LOAD_BATCH_SIZE,
      seedingMinutesTotal: DEFAULT_SEEDING_DAYS_BACK * 24 * 60, // 30 days in minutes
    };
  }
}

/**
 * Get Candles API - SERVER SOURCE OF TRUTH
 * 
 * For 1m timeframe: Returns candles from MongoDB (saved by websocket-price-streamer)
 * For other timeframes: 
 *   - Recent data: Aggregated from 1m candles
 *   - Historical data: From candles_historical_* collections OR Massive.com API
 * 
 * Supports lazy loading via `before` parameter for pagination.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, timeframe, count, before } = body;

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { error: 'Symbol and timeframe are required' },
        { status: 400 }
      );
    }

    return await handleCandleRequest(symbol, timeframe, count, before);
  } catch (error) {
    console.error('Error fetching candles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candles' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for simple candle requests
 * Usage: GET /api/trading/candles?symbol=EUR/USD&timeframe=1m&count=100&before=1234567890
 * Note: If count is not provided, uses admin settings (initialCandleCount)
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol') || 'EUR/USD';
  const timeframe = request.nextUrl.searchParams.get('timeframe') || '1m';
  const countParam = request.nextUrl.searchParams.get('count');
  const count = countParam ? parseInt(countParam) : undefined; // Use admin settings if not specified
  const beforeParam = request.nextUrl.searchParams.get('before');
  const before = beforeParam ? parseInt(beforeParam) : undefined;

  try {
    return await handleCandleRequest(symbol, timeframe, count, before);
  } catch (error) {
    console.error('Error in GET /api/trading/candles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candles' },
      { status: 500 }
    );
  }
}

/**
 * Seed historical candles from Massive.com to MongoDB
 * This is called ONCE per symbol when MongoDB is empty
 * @param seedingMinutes - Total minutes of data to fetch (from admin settings)
 */
async function seedHistoricalCandles(symbol: string, limit: number, seedingMinutes: number = DEFAULT_SEEDING_DAYS_BACK * 24 * 60): Promise<void> {
  // Prevent duplicate seeding for same symbol
  if (seedingInProgress.has(symbol)) {
    console.log(`⏳ [Candles API] Seeding already in progress for ${symbol}, waiting...`);
    // Wait a bit for the other request to finish
    await new Promise(resolve => setTimeout(resolve, 2000));
    return;
  }
  
  seedingInProgress.add(symbol);
  
  // Format time for logging
  const formatTime = (totalMinutes: number) => {
    const d = Math.floor(totalMinutes / (24 * 60));
    const h = Math.floor((totalMinutes % (24 * 60)) / 60);
    const m = totalMinutes % 60;
    return `${d}d ${h}h ${m}m`;
  };
  
  // Convert minutes to days for the API call (with ceiling to not lose minutes)
  const seedingDays = Math.ceil(seedingMinutes / (24 * 60)) || 1; // At least 1 day
  
  try {
    console.log(`🌱 [Candles API] Seeding ${formatTime(seedingMinutes)} of candles for ${symbol}...`);
    
    // Fetch from Massive.com REST API with configurable days back
    const candles = await getRecentCandles(symbol as ForexSymbol, '1' as Timeframe, limit, seedingDays);
    
    // Debug: Log what Massive.com actually returned
    if (candles.length > 0) {
      const oldestTime = new Date(candles[0].time * 1000).toISOString();
      const newestTime = new Date(candles[candles.length - 1].time * 1000).toISOString();
      console.log(`🔍 [Seeding Debug] Massive.com returned ${candles.length} candles, range: ${oldestTime} to ${newestTime}`);
    }
    
    if (candles.length === 0) {
      console.log(`⚠️ [Candles API] No candles returned from Massive.com for ${symbol}`);
      return;
    }
    
    // Convert to format expected by bulkUpsertCandles
    // NOTE: getRecentCandles returns time in SECONDS, but bulkUpsertCandles expects MILLISECONDS
    // (because it divides by 1000 internally)
    const candlesToSave = candles.map(c => ({
      symbol,
      time: c.time * 1000, // Convert seconds to ms (bulkUpsertCandles will divide by 1000)
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 0,
    }));
    
    // Save ALL candles to MongoDB
    await Candle1m.bulkUpsertCandles(candlesToSave);
    
    console.log(`✅ [Candles API] Seeded ${candles.length} candles (${formatTime(seedingMinutes)}) for ${symbol} to MongoDB`);
  } catch (error) {
    console.error(`❌ [Candles API] Failed to seed candles for ${symbol}:`, error);
  } finally {
    seedingInProgress.delete(symbol);
  }
}

/**
 * Check if a timestamp falls on a weekend (forex market closed)
 */
function isWeekend(timestamp: number): boolean {
  const date = new Date(timestamp * 1000);
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  
  // Forex market closes Friday 22:00 UTC and opens Sunday 22:00 UTC
  if (day === 6) return true; // Saturday - always closed
  if (day === 0 && hour < 22) return true; // Sunday before 22:00 UTC - closed
  if (day === 5 && hour >= 22) return true; // Friday after 22:00 UTC - closed
  
  return false;
}

/**
 * Auto-fill gaps in candle data (runs in background)
 * Only runs if gap fill is enabled in settings
 */
async function autoFillGaps(symbol: string, candles: Array<{ time: number }>): Promise<void> {
  // Check if we should run gap fill
  const now = Date.now();
  const lastCheck = lastGapFillCheck.get(symbol) || 0;
  
  if (now - lastCheck < GAP_FILL_CHECK_INTERVAL) return;
  if (gapFillInProgress.has(symbol)) return;
  
  lastGapFillCheck.set(symbol, now);
  
  // Check if auto gap fill is enabled
  try {
    const MarketDataSettings = mongoose.models.MarketDataSettings;
    if (!MarketDataSettings) return;
    
    const settings = await MarketDataSettings.findOne({ key: 'market_data_settings' });
    if (!settings?.gapFill?.enabled || settings?.gapFill?.mode !== 'auto') return;
    
    // Detect gaps - try to fill any gaps, Massive.com will return what it can
    // Skip weekend gaps as they are expected
    const gaps: Array<{ startTime: number; endTime: number; missing: number }> = [];
    for (let i = 1; i < candles.length; i++) {
      const timeDiff = candles[i].time - candles[i - 1].time;
      const missingMinutes = Math.floor(timeDiff / 60) - 1;
      
      // Detect gaps > 1 minute but skip weekend gaps
      if (missingMinutes > 0) {
        // Check if this gap spans a weekend
        const gapStartTime = candles[i - 1].time + 60;
        const gapEndTime = candles[i].time - 60;
        
        // Skip if gap is entirely within a weekend
        if (isWeekend(gapStartTime) && isWeekend(gapEndTime)) {
          continue;
        }
        
        gaps.push({
          startTime: gapStartTime,
          endTime: gapEndTime,
          missing: missingMinutes,
        });
      }
    }
    
    if (gaps.length === 0) return;
    
    // Fill gaps in background (fire and forget)
    gapFillInProgress.add(symbol);
    
    (async () => {
      try {
        console.log(`🔧 [Auto Gap Fill] Filling ${gaps.length} gaps for ${symbol}...`);
        let filledCount = 0;
        
        for (const gap of gaps) {
          // Convert gap times to milliseconds for Massive.com API
          const gapStartMs = gap.startTime * 1000;
          const gapEndMs = gap.endTime * 1000;
          
          // Fetch EXACT range - no filtering needed
          const candlesToFill = await fetchCandlesForRange(
            symbol as ForexSymbol,
            '1' as Timeframe,
            gapStartMs,
            gapEndMs
          );
          
          for (const candle of candlesToFill) {
            const timeInSeconds = Math.floor(candle.time / 1000);
            
            // Skip weekend candles
            if (isWeekend(timeInSeconds)) continue;
            
            // Check if exists
            const existing = await mongoose.connection.db?.collection('candles_1m').findOne({
              symbol,
              t: timeInSeconds,
            });
            
            if (!existing) {
              await Candle1m.upsertCandle(
                symbol,
                candle.time, // milliseconds
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume || 0
              );
              filledCount++;
            }
          }
        }
        
        console.log(`✅ [Auto Gap Fill] Completed for ${symbol} - filled ${filledCount} candles`);
      } catch (error) {
        console.error(`❌ [Auto Gap Fill] Failed for ${symbol}:`, error);
      } finally {
        gapFillInProgress.delete(symbol);
      }
    })();
  } catch {
    // Settings not available, skip gap fill
  }
}

/**
 * Shared handler for both GET and POST
 * @param before - Timestamp in SECONDS for lazy loading (get candles before this time)
 */
async function handleCandleRequest(symbol: string, timeframe: string, count?: number, before?: number) {
  await connectToDatabase();
  
  const settings = await getMarketDataSettings();
  
  // Determine how many candles to fetch
  // If no count specified, use settings for initial load vs lazy load batch
  const limit = count || (before ? settings.lazyLoadBatchSize : settings.initialCandleCount);
  
  console.log(`📊 [Candles] Request: ${symbol} ${timeframe}, count=${count || 'none'}, limit=${limit}, before=${before || 'none'}`);
  
  // Apply history limit if enabled
  let historyLimitDate: Date | undefined;
  if (settings.chartHistoryLimitEnabled) {
    historyLimitDate = new Date();
    // Use minutes for more precision
    historyLimitDate.setTime(historyLimitDate.getTime() - (settings.chartHistoryLimitMinutesTotal * 60 * 1000));
    // Format time for logging
    const d = Math.floor(settings.chartHistoryLimitMinutesTotal / (24 * 60));
    const h = Math.floor((settings.chartHistoryLimitMinutesTotal % (24 * 60)) / 60);
    const m = settings.chartHistoryLimitMinutesTotal % 60;
    console.log(`📊 [Candles] History limit enabled: ${d}d ${h}h ${m}m (since ${historyLimitDate.toISOString()})`);
  }

  // For 1-minute timeframe: Get from MongoDB (server source of truth)
  // Recent data from candles_1m, older historical data from candles_historical_1m
  if (timeframe === '1m' || timeframe === '1') {
    try {
      // First, get candles from candles_1m (recent data for aggregation)
      let candles = await Candle1m.getCandles(symbol, limit, before);
      
      // Debug log to track what's happening
      if (candles && candles.length > 0) {
        const oldestTime = new Date(candles[0].time * 1000).toISOString();
        const newestTime = new Date(candles[candles.length - 1].time * 1000).toISOString();
        console.log(`📊 [1m Debug] Got ${candles.length} candles, range: ${oldestTime} to ${newestTime}`);
      }
      
      // Apply history limit
      if (historyLimitDate && candles) {
        const limitTimestamp = Math.floor(historyLimitDate.getTime() / 1000);
        candles = candles.filter(c => c.time >= limitTimestamp);
      }
      
      // If lazy loading and candles_1m doesn't have enough, also check candles_historical_1m
      if (before && candles.length < limit && settings.useLocalHistory) {
        const historicalModel = getHistoricalModel('1m');
        if (historicalModel) {
          const cutoffDate = new Date(before * 1000);
          const historicalCandles = await getHistoricalCandles('1m', symbol, {
            before: cutoffDate,
            limit: limit - candles.length,
          });
          
          // Convert historical candles to the same format
          const historicalFormatted = historicalCandles.map(c => ({
            time: Math.floor(new Date(c.timestamp).getTime() / 1000),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume || 0,
          }));
          
          // Combine: historical (older) + candles_1m (newer)
          const candleMap = new Map<number, typeof candles[0]>();
          for (const c of historicalFormatted) {
            candleMap.set(c.time, c);
          }
          for (const c of candles) {
            candleMap.set(c.time, c);
          }
          candles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
        }
      }
      
      // Get current forming candle from WebSocket streamer (SERVER AUTHORITATIVE!)
      // Only add forming candle for initial load, not for lazy loading
      const formingCandle = before ? null : getFormingCandle(symbol);
      
      // Create response candles, potentially adding/updating forming candle
      const responseCandles = [...(candles || [])];
      
      if (formingCandle) {
        const lastCandle = responseCandles[responseCandles.length - 1];
        
        if (lastCandle && lastCandle.time === formingCandle.time) {
          // Same minute - UPDATE with server's authoritative values
          responseCandles[responseCandles.length - 1] = {
            time: formingCandle.time,
            open: formingCandle.open,
            high: formingCandle.high,
            low: formingCandle.low,
            close: formingCandle.close,
          };
        } else if (!lastCandle || formingCandle.time > lastCandle.time) {
          // New minute - APPEND forming candle
          responseCandles.push({
            time: formingCandle.time,
            open: formingCandle.open,
            high: formingCandle.high,
            low: formingCandle.low,
            close: formingCandle.close,
          });
        }
      }
      
      // Check if we need to seed more data (< 50 candles)
      const needsSeeding = !candles || candles.length < 50;
      const isCurrentlySeeding = seedingInProgress.has(symbol);
      
      if (needsSeeding && !isCurrentlySeeding && !before) {
        // BACKGROUND SEEDING: Don't block - seed in background and return immediately
        // Format time for logging
        const d = Math.floor(settings.seedingMinutesTotal / (24 * 60));
        const h = Math.floor((settings.seedingMinutesTotal % (24 * 60)) / 60);
        const m = settings.seedingMinutesTotal % 60;
        console.log(`⚡ [Candles API] MongoDB has only ${candles?.length || 0} candles for ${symbol}, starting BACKGROUND seeding (${d}d ${h}h ${m}m)...`);
        
        // Fire and forget - don't await!
        // Pass seedingMinutesTotal from admin settings
        seedHistoricalCandles(symbol, Math.max(limit, 5000), settings.seedingMinutesTotal).then(() => {
          console.log(`✅ [Candles API] Background seeding completed for ${symbol}`);
        }).catch((err) => {
          console.error(`❌ [Candles API] Background seeding failed for ${symbol}:`, err);
        });
      }
      
      // If MongoDB has enough candles, also run gap fill in background
      if (candles && candles.length >= 50 && !before) {
        autoFillGaps(symbol, candles);
      }
      
      // For lazy loading, indicate if there's more data
      // Check both candles_1m and candles_historical_1m for more data
      let hasMore = before ? (candles?.length || 0) === limit : undefined;
      if (before && candles && candles.length < limit && settings.useLocalHistory) {
        // Check if there's more in historical
        const historicalModel = getHistoricalModel('1m');
        if (historicalModel) {
          const oldestCandle = candles[0];
          if (oldestCandle) {
            const olderExists = await historicalModel.findOne({
              symbol,
              timestamp: { $lt: new Date(oldestCandle.time * 1000) }
            }).lean();
            hasMore = !!olderExists;
          }
        }
      }
      const oldestTimestamp = candles && candles.length > 0 ? candles[0].time : undefined;
      
      // Return immediately with whatever we have
      return NextResponse.json({ 
        candles: responseCandles,
        formingCandle: formingCandle ? {
          time: formingCandle.time,
          open: formingCandle.open,
          high: formingCandle.high,
          low: formingCandle.low,
          close: formingCandle.close,
          tickCount: formingCandle.tickCount,
        } : null,
        source: needsSeeding ? (isCurrentlySeeding ? 'seeding_in_progress' : 'seeding_started') : 'mongodb',
        lastUpdate: Date.now(),
        hasMore,
        oldestTimestamp,
        // Tell client if more data is being loaded in background
        backgroundSeeding: needsSeeding,
      });
      
    } catch (dbError) {
      console.error(`❌ [Candles API] MongoDB error for ${symbol}:`, dbError);
      return NextResponse.json({ 
        candles: [],
        source: 'error',
        error: 'Database error',
        lastUpdate: Date.now(),
      });
    }
  }

  // ====================================================================
  // HIGHER TIMEFRAMES: Hybrid approach
  // 1. Get 1m-aggregated candles (recent data)
  // 2. For older data: Get from candles_historical_* OR Massive.com API
  // ====================================================================
  
  // Map timeframe strings to normalized format
  const timeframeMap: Record<string, string> = {
    '5m': '5m', '5': '5m',
    '15m': '15m', '15': '15m',
    '30m': '30m', '30': '30m',
    '1h': '1h', '60': '1h',
    '4h': '4h', '240': '4h',
    '1d': '1d', 'D': '1d', '1440': '1d',
    '1w': 'W', 'W': 'W', '10080': 'W',
    '1M': 'M', 'M': 'M', '43200': 'M',
  };
  
  const normalizedTf = timeframeMap[timeframe];
  if (!normalizedTf) {
    return NextResponse.json(
      { error: `Invalid timeframe: ${timeframe}. Valid: 1m, 5m, 15m, 30m, 1h, 4h, 1d, D, W, M` },
      { status: 400 }
    );
  }
  
  // For aggregator-supported timeframes, use hybrid approach
  // EXCEPT for daily/weekly/monthly - aggregating too many 1m candles is impractical
  const useAggregator = isAggregatorSupported(normalizedTf) && !['1d', 'W', 'M'].includes(normalizedTf);
  
  if (useAggregator || ['5m', '15m', '30m', '1h', '4h', '1d', 'W', 'M'].includes(normalizedTf)) {
    try {
      // Step 1: Get aggregated candles from 1m data (recent)
      // Skip for daily - too many 1m candles needed
      let aggregatedCandles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
      let formingCandle = null;
      
      if (useAggregator) {
        const result = await getAggregatedCandles(symbol, normalizedTf, limit);
        aggregatedCandles = result.candles;
        formingCandle = result.formingCandle;
      } else {
        // For daily/weekly/monthly (and other non-aggregated timeframes), get forming candle from WebSocket cache
        if (normalizedTf === 'M') {
          formingCandle = getFormingMonthlyCandle(symbol);
        } else if (normalizedTf === 'W') {
          formingCandle = getFormingWeeklyCandle(symbol);
        } else if (normalizedTf === '1d') {
          formingCandle = getFormingDailyCandle(symbol);
        } else if (normalizedTf === '4h') {
          formingCandle = getForming4hCandle(symbol);
        } else if (normalizedTf === '1h') {
          formingCandle = getForming1hCandle(symbol);
        }
      }
      
      // Apply history limit to aggregated candles
      if (historyLimitDate && aggregatedCandles.length > 0) {
        const limitTimestamp = Math.floor(historyLimitDate.getTime() / 1000);
        aggregatedCandles = aggregatedCandles.filter(c => c.time >= limitTimestamp);
      }
      
      // Step 2: If lazy loading (before param) or not enough candles, get historical data
      let historicalCandles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
      
      const needsHistoricalData = before || aggregatedCandles.length < limit;
      
      if (needsHistoricalData) {
        // Determine the cutoff point (oldest aggregated candle or 'before' timestamp)
        let cutoffTimestamp: number;
        
        if (before) {
          cutoffTimestamp = before;
        } else if (aggregatedCandles.length > 0) {
          cutoffTimestamp = aggregatedCandles[0].time;
        } else {
          cutoffTimestamp = Math.floor(Date.now() / 1000);
        }
        
        const cutoffDate = new Date(cutoffTimestamp * 1000);
        
        // Try to get from local database first
        if (settings.useLocalHistory) {
          const historicalModel = getHistoricalModel(normalizedTf);
          
          if (historicalModel) {
            const dbCandles = await getHistoricalCandles(normalizedTf, symbol, {
              before: cutoffDate,
              limit: limit,
            });
            
            historicalCandles = dbCandles.map(c => ({
              time: Math.floor(new Date(c.timestamp).getTime() / 1000),
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }));
          }
        }
        
        // If local DB doesn't have enough, fetch from Massive.com API
        if (historicalCandles.length < limit && !settings.useLocalHistory) {
          const massiveTimeframeMap: Record<string, Timeframe> = {
            '5m': '5', '15m': '15', '30m': '30',
            '1h': '60', '4h': '240', '1d': 'D',
            'W': 'W', 'M': 'M',
          };
          
          const massiveTf = massiveTimeframeMap[normalizedTf];
          if (massiveTf) {
            const apiCandles = await getRecentCandles(symbol as ForexSymbol, massiveTf, limit);
            
            // Filter to only candles before the cutoff
            historicalCandles = apiCandles
              .filter(c => c.time < cutoffTimestamp)
              .map(c => ({
                time: c.time, // Already in seconds
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
              }));
          }
        }
      }
      
      // Combine: historical (older) + aggregated (newer)
      // For lazy loading with 'before', only return historical
      let combinedCandles: Array<{ time: number; open: number; high: number; low: number; close: number }>;
      
      if (before) {
        // Lazy loading: return only historical candles before the cutoff
        combinedCandles = historicalCandles;
      } else {
        // Initial load: combine historical + aggregated, dedupe by timestamp
        const candleMap = new Map<number, { time: number; open: number; high: number; low: number; close: number }>();
        
        // Add historical first (older)
        for (const c of historicalCandles) {
          candleMap.set(c.time, c);
        }
        
        // Add aggregated (newer) - will overwrite if same timestamp
        for (const c of aggregatedCandles) {
          candleMap.set(c.time, c);
        }
        
        // Sort by time ascending
        combinedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
        
        // Limit to requested count
        if (combinedCandles.length > limit) {
          combinedCandles = combinedCandles.slice(-limit);
        }
      }
      
      // For lazy loading, indicate if there's more data
      const hasMore = before ? combinedCandles.length === limit : undefined;
      const oldestTimestamp = combinedCandles.length > 0 ? combinedCandles[0].time : undefined;
      
      return NextResponse.json({
        candles: combinedCandles,
        formingCandle: before ? null : formingCandle,
        source: 'hybrid',
        lastUpdate: Date.now(),
        hasMore,
        oldestTimestamp,
      });
    } catch (error) {
      console.error(`❌ [Candles API] Hybrid approach failed for ${symbol} ${timeframe}:`, error);
      // Fall through to Massive.com API as fallback
    }
  }

  // ====================================================================
  // FALLBACK: Fetch directly from Massive.com REST API
  // Used for: W, M or as fallback if hybrid approach fails
  // ====================================================================
  const massiveTimeframeMap: Record<string, Timeframe> = {
    '5m': '5', '15m': '15', '30m': '30',
    '1h': '60', '4h': '240', '1d': 'D',
    'D': 'D', 'W': 'W', 'M': 'M',
    '5': '5', '15': '15', '30': '30',
    '60': '60', '120': '120', '240': '240',
  };

  const tf = massiveTimeframeMap[timeframe] || massiveTimeframeMap[normalizedTf];
  if (!tf) {
    return NextResponse.json(
      { error: `Invalid timeframe: ${timeframe}. Valid: 1m, 5m, 15m, 30m, 1h, 4h, 1d, D, W, M` },
      { status: 400 }
    );
  }

  // Fetch from Massive.com REST API
  const candles = await getRecentCandles(symbol as ForexSymbol, tf, limit);

  // Convert to standard format for chart (time in seconds)
  let formattedCandles = candles.map(c => ({
    time: Math.floor(c.time / 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
  
  // Apply history limit
  if (historyLimitDate) {
    const limitTimestamp = Math.floor(historyLimitDate.getTime() / 1000);
    formattedCandles = formattedCandles.filter(c => c.time >= limitTimestamp);
  }
  
  // For lazy loading with 'before'
  if (before) {
    formattedCandles = formattedCandles.filter(c => c.time < before);
  }

  return NextResponse.json({ 
    candles: formattedCandles,
    source: 'massive_api',
    lastUpdate: Date.now(),
  });
}
