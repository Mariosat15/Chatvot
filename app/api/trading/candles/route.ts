import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Candle1m from '@/database/models/candle-1m.model';
import { getRecentCandles, Timeframe } from '@/lib/services/forex-historical.service';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

// Track which symbols are currently being seeded (prevent duplicate seeding)
const seedingInProgress = new Set<string>();

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
 * Shared handler for both GET and POST
 */
async function handleCandleRequest(symbol: string, timeframe: string, count: number) {
  const limit = count || 500;

  // For 1-minute timeframe: Get from MongoDB (server source of truth)
  if (timeframe === '1m' || timeframe === '1') {
    try {
      await connectToDatabase();
      let candles = await Candle1m.getCandles(symbol, limit);
      
      // If MongoDB has enough candles, return them
      if (candles && candles.length >= 50) {
        console.log(`🕯️ [Candles API] Returning ${candles.length} candles from MongoDB for ${symbol}`);
        return NextResponse.json({ 
          candles,
          source: 'mongodb',
          lastUpdate: Date.now(),
        });
      }
      
      // MongoDB empty or too few candles - SEED historical data first
      console.log(`⚠️ [Candles API] MongoDB has only ${candles?.length || 0} candles for ${symbol}, seeding historical data...`);
      
      // Seed historical candles (fetches from Massive.com and saves to MongoDB)
      await seedHistoricalCandles(symbol, limit);
      
      // Now fetch from MongoDB again (should have data now)
      candles = await Candle1m.getCandles(symbol, limit);
      
      if (candles && candles.length > 0) {
        console.log(`✅ [Candles API] After seeding: Returning ${candles.length} candles from MongoDB for ${symbol}`);
        return NextResponse.json({ 
          candles,
          source: 'mongodb_seeded',
          lastUpdate: Date.now(),
        });
      }
      
      // Still no candles - return empty with error message
      console.error(`❌ [Candles API] Failed to get candles for ${symbol} after seeding`);
      return NextResponse.json({ 
        candles: [],
        source: 'error',
        error: 'Failed to fetch historical candles',
        lastUpdate: Date.now(),
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

  // For other timeframes: Fetch from Massive.com REST API
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
