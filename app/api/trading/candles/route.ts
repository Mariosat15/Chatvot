import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Candle1m from '@/database/models/candle-1m.model';
import { getRecentCandles, fetchCandlesForRange, Timeframe } from '@/lib/services/forex-historical.service';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';
import { getFormingCandle } from '@/lib/services/websocket-price-streamer';
import { getAggregatedCandles, isAggregatorSupported } from '@/lib/services/candle-aggregator.service';
import mongoose from 'mongoose';

// Track which symbols are currently being seeded (prevent duplicate seeding)
const seedingInProgress = new Set<string>();

// Track gap fill operations (prevent duplicates, run occasionally)
const gapFillInProgress = new Set<string>();
const lastGapFillCheck = new Map<string, number>();
const GAP_FILL_CHECK_INTERVAL = 60000; // Check for gaps every 60 seconds per symbol

/**
 * Get Candles API - SERVER SOURCE OF TRUTH
 * 
 * For 1m timeframe: Returns candles from MongoDB (saved by websocket-price-streamer)
 * For other timeframes: Fetches from Massive.com REST API (with caching)
 * 
 * This ensures ALL users see IDENTICAL candles - no local building!
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, timeframe, count } = body;

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { error: 'Symbol and timeframe are required' },
        { status: 400 }
      );
    }

    return await handleCandleRequest(symbol, timeframe, count || 500);
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
 * Usage: GET /api/trading/candles?symbol=EUR/USD&timeframe=1m&count=500
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol') || 'EUR/USD';
  const timeframe = request.nextUrl.searchParams.get('timeframe') || '1m';
  const count = parseInt(request.nextUrl.searchParams.get('count') || '500');

  try {
    return await handleCandleRequest(symbol, timeframe, count);
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
 */
async function seedHistoricalCandles(symbol: string, limit: number): Promise<void> {
  // Prevent duplicate seeding for same symbol
  if (seedingInProgress.has(symbol)) {
    console.log(`⏳ [Candles API] Seeding already in progress for ${symbol}, waiting...`);
    // Wait a bit for the other request to finish
    await new Promise(resolve => setTimeout(resolve, 2000));
    return;
  }
  
  seedingInProgress.add(symbol);
  
  try {
    console.log(`🌱 [Candles API] Seeding historical candles for ${symbol}...`);
    
    // Fetch from Massive.com REST API
    const candles = await getRecentCandles(symbol as ForexSymbol, '1' as Timeframe, limit);
    
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
    
    console.log(`✅ [Candles API] Seeded ${candles.length} historical candles for ${symbol} to MongoDB`);
  } catch (error) {
    console.error(`❌ [Candles API] Failed to seed candles for ${symbol}:`, error);
  } finally {
    seedingInProgress.delete(symbol);
  }
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
    const gaps: Array<{ startTime: number; endTime: number; missing: number }> = [];
    for (let i = 1; i < candles.length; i++) {
      const timeDiff = candles[i].time - candles[i - 1].time;
      const missingMinutes = Math.floor(timeDiff / 60) - 1;
      
      // Detect all gaps, no limit - fill attempt will get what Massive.com has
      if (missingMinutes > 0) {
        gaps.push({
          startTime: candles[i - 1].time + 60,
          endTime: candles[i].time - 60,
          missing: missingMinutes,
        });
      }
    }
    
    if (gaps.length === 0) return;
    
    // Fill gaps in background (fire and forget)
    // Using Massive.com Custom Bars API with exact from/to timestamps
    // Supports up to 2 years history (Basic) or all history (Starter/Business)
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

// Track boundary gap fill operations (prevent duplicates)
const boundaryGapFillInProgress = new Set<string>();

/**
 * Fill the gap between Massive.com API data and MongoDB data
 * This runs in background and saves candles to MongoDB for future requests
 */
async function fillBoundaryGap(symbol: string, apiEndTime: number, mongoStartTime: number): Promise<void> {
  const gapKey = `${symbol}:${apiEndTime}:${mongoStartTime}`;
  
  // Prevent duplicate fills
  if (boundaryGapFillInProgress.has(gapKey)) {
    console.log(`⏳ [Boundary Gap] Already filling gap for ${symbol}, skipping...`);
    return;
  }
  
  boundaryGapFillInProgress.add(gapKey);
  
  try {
    // Calculate the gap range (add 60 seconds buffer on each side)
    const gapStartMs = (apiEndTime + 60) * 1000;
    const gapEndMs = (mongoStartTime - 60) * 1000;
    
    console.log(`🔧 [Boundary Gap] Filling gap for ${symbol} from ${new Date(gapStartMs).toISOString()} to ${new Date(gapEndMs).toISOString()}`);
    
    // Fetch 1m candles for the gap range from Massive.com
    const gapCandles = await fetchCandlesForRange(
      symbol as ForexSymbol,
      '1' as Timeframe,
      gapStartMs,
      gapEndMs
    );
    
    if (gapCandles.length === 0) {
      console.log(`⚠️ [Boundary Gap] No candles available from Massive.com for gap period (likely market closed)`);
      return;
    }
    
    // Save to MongoDB
    let savedCount = 0;
    for (const candle of gapCandles) {
      const timeInSeconds = Math.floor(candle.time / 1000);
      
      // Check if already exists
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
        savedCount++;
      }
    }
    
    console.log(`✅ [Boundary Gap] Filled ${savedCount} candles for ${symbol} (fetched ${gapCandles.length} from API)`);
  } catch (error) {
    console.error(`❌ [Boundary Gap] Failed to fill gap for ${symbol}:`, error);
  } finally {
    boundaryGapFillInProgress.delete(gapKey);
  }
}

/**
 * Shared handler for both GET and POST
 */
async function handleCandleRequest(symbol: string, timeframe: string, count: number) {
  // Calculate limit based on timeframe
  // Higher limits for aggregated timeframes to ensure hybrid merge can work
  let limit: number;
  
  if (timeframe === '1m' || timeframe === '1') {
    // 1m: up to 200k candles (~139 days)
    limit = Math.min(count || 100000, 200000);
  } else if (['5m', '5', '15m', '15', '30m', '30', '1h', '60', '4h', '240'].includes(timeframe)) {
    // Aggregated timeframes: allow up to 50k candles for hybrid merge
    // This ensures we request MORE than MongoDB has, triggering the merge
    limit = Math.min(count || 50000, 50000);
  } else {
    // D, W, M: reasonable limit
    limit = Math.min(count || 500, 5000);
  }

  // For 1-minute timeframe: HYBRID - MongoDB (recent) + Massive.com (older)
  if (timeframe === '1m' || timeframe === '1') {
    try {
      await connectToDatabase();
      
      // Get ALL candles from MongoDB (no limit - we'll merge with API data)
      const mongoCandles = await Candle1m.getCandles(symbol, 200000) || [];
      
      // Get forming candle from WebSocket streamer
      const formingCandle = getFormingCandle(symbol);
      
      // Find the oldest timestamp in MongoDB
      const oldestMongoTime = mongoCandles.length > 0 
        ? mongoCandles[0].time  // Candles are sorted newest-first, so [0] is newest
        : null;
      
      // Actually, getCandles returns sorted by time ascending, so first is oldest
      const sortedMongoCandles = [...mongoCandles].sort((a, b) => a.time - b.time);
      const oldestMongoTimestamp = sortedMongoCandles.length > 0 ? sortedMongoCandles[0].time : null;
      const newestMongoTimestamp = sortedMongoCandles.length > 0 ? sortedMongoCandles[sortedMongoCandles.length - 1].time : null;
      
      let finalCandles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
      
      // If user wants more candles than MongoDB has, fetch older data from Massive.com
      if (mongoCandles.length < limit && oldestMongoTimestamp) {
        console.log(`🔄 [Candles API] MongoDB has ${mongoCandles.length} candles, user wants ${limit}. Fetching older data from Massive.com...`);
        
        // Fetch from Massive.com API (this returns candles sorted newest first)
        const apiCandles = await getRecentCandles(symbol as ForexSymbol, '1' as Timeframe, limit);
        
        // Convert API candles to seconds (they come in seconds already from getRecentCandles)
        const apiCandlesFormatted = apiCandles.map(c => ({
          time: c.time, // Already in seconds
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        
        // MERGE: Use MongoDB for recent data (authoritative), Massive.com for older data
        // MongoDB data takes priority for any overlapping timestamps
        const mongoTimeSet = new Set(sortedMongoCandles.map(c => c.time));
        
        // Get API candles that are OLDER than our MongoDB data (no overlap)
        const olderApiCandles = apiCandlesFormatted.filter(c => 
          c.time < oldestMongoTimestamp! && !mongoTimeSet.has(c.time)
        );
        
        // Combine: [older API data] + [MongoDB data]
        finalCandles = [...olderApiCandles, ...sortedMongoCandles].sort((a, b) => a.time - b.time);
        
        console.log(`✅ [Candles API] Merged: ${olderApiCandles.length} from Massive.com + ${sortedMongoCandles.length} from MongoDB = ${finalCandles.length} total`);
        
        // ====================================================================
        // BOUNDARY GAP DETECTION & FILL
        // Check for gap between Massive.com data and MongoDB data
        // ====================================================================
        if (olderApiCandles.length > 0 && oldestMongoTimestamp) {
          const newestApiTime = Math.max(...olderApiCandles.map(c => c.time));
          const gapMinutes = Math.floor((oldestMongoTimestamp - newestApiTime) / 60) - 1;
          
          // If gap is significant (> 5 minutes) but not a weekend (> 2 days), try to fill
          if (gapMinutes > 5 && gapMinutes < 2880) { // 2880 = 2 days in minutes
            console.log(`🔍 [Boundary Gap] Detected ${gapMinutes} minute gap between API data and MongoDB for ${symbol}`);
            console.log(`   API ends at: ${new Date(newestApiTime * 1000).toISOString()}`);
            console.log(`   MongoDB starts at: ${new Date(oldestMongoTimestamp * 1000).toISOString()}`);
            
            // Fill gap in background (fire and forget)
            fillBoundaryGap(symbol, newestApiTime, oldestMongoTimestamp).catch(err =>
              console.error(`Failed to fill boundary gap for ${symbol}:`, err)
            );
          } else if (gapMinutes > 5) {
            console.log(`⏭️ [Boundary Gap] Skipping ${gapMinutes} minute gap for ${symbol} (likely weekend/holiday)`);
          }
        }
      } else if (mongoCandles.length === 0) {
        // No MongoDB data - fetch entirely from Massive.com
        console.log(`⚠️ [Candles API] No MongoDB data for ${symbol}, fetching from Massive.com...`);
        
        const apiCandles = await getRecentCandles(symbol as ForexSymbol, '1' as Timeframe, limit);
        finalCandles = apiCandles.map(c => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })).sort((a, b) => a.time - b.time);
        
        // Also seed to MongoDB for future use
        seedHistoricalCandles(symbol, limit).catch(err => 
          console.error(`Failed to seed candles for ${symbol}:`, err)
        );
      } else {
        // MongoDB has enough data
        finalCandles = sortedMongoCandles;
      }
      
      // Auto-fill gaps in background (if enabled)
      if (finalCandles.length > 0) {
        autoFillGaps(symbol, finalCandles);
      }
      
      // Add/update forming candle
      if (formingCandle) {
        const lastCandle = finalCandles[finalCandles.length - 1];
        
        if (lastCandle && lastCandle.time === formingCandle.time) {
          // Same minute - UPDATE with server's authoritative values
          finalCandles[finalCandles.length - 1] = {
            time: formingCandle.time,
            open: formingCandle.open,
            high: formingCandle.high,
            low: formingCandle.low,
            close: formingCandle.close,
          };
        } else if (!lastCandle || formingCandle.time > lastCandle.time) {
          // New minute - APPEND forming candle
          finalCandles.push({
            time: formingCandle.time,
            open: formingCandle.open,
            high: formingCandle.high,
            low: formingCandle.low,
            close: formingCandle.close,
          });
        }
      }
      
      // Limit to requested count (take most recent)
      const limitedCandles = finalCandles.slice(-limit);
      
      return NextResponse.json({ 
        candles: limitedCandles,
        formingCandle: formingCandle ? {
          time: formingCandle.time,
          open: formingCandle.open,
          high: formingCandle.high,
          low: formingCandle.low,
          close: formingCandle.close,
          tickCount: formingCandle.tickCount,
        } : null,
        source: mongoCandles.length < limit ? 'hybrid_mongodb_massive' : 'mongodb',
        mongoCount: mongoCandles.length,
        lastUpdate: Date.now(),
      });
      
    } catch (dbError) {
      console.error(`❌ [Candles API] Error for ${symbol}:`, dbError);
      
      // Fallback to Massive.com API only
      try {
        const apiCandles = await getRecentCandles(symbol as ForexSymbol, '1' as Timeframe, limit);
        return NextResponse.json({ 
          candles: apiCandles.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })),
          source: 'massive_api_fallback',
          lastUpdate: Date.now(),
        });
      } catch {
        return NextResponse.json({ 
          candles: [],
          source: 'error',
          error: 'Database and API error',
          lastUpdate: Date.now(),
        });
      }
    }
  }

  // ====================================================================
  // AGGREGATED TIMEFRAMES (built from 1m candles)
  // Currently: 5m (can be extended to 15m, 30m, 1h, 4h)
  // Benefits: 100% consistency with 1m, no external API calls, fast caching
  // ====================================================================
  if (isAggregatorSupported(timeframe)) {
    try {
      const result = await getAggregatedCandles(symbol, timeframe, limit);
      
      return NextResponse.json({
        candles: result.candles,
        formingCandle: result.formingCandle,
        source: result.source,
        cached: result.cached,
        lastUpdate: Date.now(),
      });
    } catch (error) {
      console.error(`❌ [Candles API] Aggregation failed for ${symbol} ${timeframe}:`, error);
      // Fall through to Massive.com API as fallback
    }
  }

  // ====================================================================
  // OTHER TIMEFRAMES: Fetch from Massive.com REST API
  // Used for: D, W, M (or as fallback if aggregation fails)
  // ====================================================================
  const timeframeMap: Record<string, Timeframe> = {
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '4h': '240',
    '1d': 'D',
    'D': 'D',
    'W': 'W',
    'M': 'M',
    '5': '5',
    '15': '15',
    '30': '30',
    '60': '60',
    '120': '120',
    '240': '240',
  };

  const tf = timeframeMap[timeframe];
  if (!tf) {
    return NextResponse.json(
      { error: `Invalid timeframe: ${timeframe}. Valid: 1m, 5m, 15m, 30m, 1h, 4h, 1d, D, W, M` },
      { status: 400 }
    );
  }

  // Fetch from Massive.com REST API
  const candles = await getRecentCandles(symbol as ForexSymbol, tf, limit);

  // Convert to standard format for chart (time in seconds)
  const formattedCandles = candles.map(c => ({
    time: Math.floor(c.time / 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  return NextResponse.json({ 
    candles: formattedCandles,
    source: 'massive_api',
    lastUpdate: Date.now(),
  });
}
