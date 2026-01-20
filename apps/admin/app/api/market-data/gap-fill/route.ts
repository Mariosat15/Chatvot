import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

// Define the Candle1m schema locally to avoid cross-app imports
const Candle1mSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  t: { type: Number, required: true },
  o: { type: Number, required: true },
  h: { type: Number, required: true },
  l: { type: Number, required: true },
  c: { type: Number, required: true },
  v: { type: Number, default: 0 },
}, {
  timestamps: false,
  collection: 'candles_1m',
});

Candle1mSchema.index({ symbol: 1, t: 1 }, { unique: true });

const Candle1m = mongoose.models.Candle1m || mongoose.model('Candle1m', Candle1mSchema);

interface Gap {
  symbol: string;
  startTime: number;
  endTime: number;
  missingMinutes: number;
}

// Top forex pairs to check
const FOREX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD',
  'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/CHF',
];

// Historical candle schema
const HistoricalCandle1mSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, default: 0 },
}, { timestamps: false, collection: 'candles_historical_1m' });

HistoricalCandle1mSchema.index({ symbol: 1, timestamp: 1 }, { unique: true });

const HistoricalCandle1m = mongoose.models.candles_historical_1m || 
  mongoose.model('candles_historical_1m', HistoricalCandle1mSchema, 'candles_historical_1m');

/**
 * GET - Detect gaps in candle data
 * Now scans BOTH candles_1m AND candles_historical_1m, plus gap between them
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const symbol = request.nextUrl.searchParams.get('symbol');
    const symbols = symbol ? [symbol] : FOREX_PAIRS;
    
    const allGaps: Gap[] = [];
    const symbolSummaries: Array<{
      symbol: string;
      liveCount: number;
      historicalCount: number;
      liveOldest: string | null;
      liveNewest: string | null;
      historicalOldest: string | null;
      historicalNewest: string | null;
      collectionGap: { start: string; end: string; minutes: number } | null;
      largestGap: { start: string; end: string; minutes: number; source: string } | null;
    }> = [];
    
    for (const sym of symbols) {
      console.log(`🔍 [Gap Detection] Checking ${sym}...`);
      console.log(`🔍 [Gap Detection] Current time: ${new Date().toISOString()}`);
      
      // Get candles from candles_1m (live/recent)
      const liveCandles = await Candle1m.find({ symbol: sym })
        .sort({ t: 1 })
        .select({ t: 1 })
        .lean() as Array<{ t: number }>;
      
      // Get candles from candles_historical_1m
      const historicalCandles = await HistoricalCandle1m.find({ symbol: sym })
        .sort({ timestamp: 1 })
        .select({ timestamp: 1 })
        .lean() as Array<{ timestamp: Date }>;
      
      console.log(`📊 [Gap Detection] ${sym}: live=${liveCandles.length}, historical=${historicalCandles.length}`);
      if (liveCandles.length > 0) {
        console.log(`📊 [Gap Detection] ${sym} live range: ${new Date(liveCandles[0].t * 1000).toISOString()} to ${new Date(liveCandles[liveCandles.length-1].t * 1000).toISOString()}`);
      }
      if (historicalCandles.length > 0) {
        console.log(`📊 [Gap Detection] ${sym} historical range: ${new Date(historicalCandles[0].timestamp).toISOString()} to ${new Date(historicalCandles[historicalCandles.length-1].timestamp).toISOString()}`);
      }
      
      let largestGap: { start: string; end: string; minutes: number; source: string } | null = null;
      let collectionGap: { start: string; end: string; minutes: number } | null = null;
      
      // NEW: Check for gap at START of today (missing data from 00:00 to first candle)
      if (liveCandles.length > 0) {
        const oldestLive = liveCandles[0].t;
        const oldestLiveDate = new Date(oldestLive * 1000);
        
        // Get start of the day (00:00 UTC) for the oldest candle
        const startOfDay = new Date(oldestLiveDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const startOfDaySeconds = Math.floor(startOfDay.getTime() / 1000);
        
        // If oldest candle is NOT at start of day, there's a gap
        const gapFromStartOfDay = oldestLive - startOfDaySeconds;
        const gapMinutes = Math.floor(gapFromStartOfDay / 60);
        
        // Only flag if gap is > 60 minutes (to account for market open times)
        if (gapMinutes > 60) {
          // Check if it's a weekend (forex closes Friday 5pm EST, opens Sunday 5pm EST)
          const dayOfWeek = oldestLiveDate.getUTCDay(); // 0=Sun, 1=Mon, etc
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          if (!isWeekend) {
            console.log(`🚨 [Gap Found] ${sym} GAP AT START OF DAY: ${startOfDay.toISOString()} → ${oldestLiveDate.toISOString()} (${gapMinutes} min)`);
            
            allGaps.push({
              symbol: sym,
              startTime: startOfDaySeconds,
              endTime: oldestLive,
              missingMinutes: gapMinutes,
            });
            
            if (!largestGap || gapMinutes > largestGap.minutes) {
              largestGap = {
                start: startOfDay.toISOString(),
                end: oldestLiveDate.toISOString(),
                minutes: gapMinutes,
                source: 'start_of_day',
              };
            }
          }
        }
      }
      
      // Check for gap BETWEEN collections (historical newest → live oldest)
      if (historicalCandles.length > 0 && liveCandles.length > 0) {
        const newestHistorical = Math.floor(new Date(historicalCandles[historicalCandles.length - 1].timestamp).getTime() / 1000);
        const oldestLive = liveCandles[0].t;
        
        if (oldestLive > newestHistorical) {
          const gapMinutes = Math.floor((oldestLive - newestHistorical) / 60);
          
          // Check if it's a weekend gap
          const prevDate = new Date(newestHistorical * 1000);
          const prevDay = prevDate.getUTCDay();
          const isWeekendGap = (prevDay === 5 || prevDay === 6) && gapMinutes >= 1440 && gapMinutes <= 4500;
          
          if (!isWeekendGap && gapMinutes > 10) {
            collectionGap = {
              start: new Date(newestHistorical * 1000).toISOString(),
              end: new Date(oldestLive * 1000).toISOString(),
              minutes: gapMinutes,
            };
            
            allGaps.push({
              symbol: sym,
              startTime: newestHistorical,
              endTime: oldestLive,
              missingMinutes: gapMinutes,
            });
            
            largestGap = { ...collectionGap, source: 'between_collections' };
          }
        }
      }
      
      // Check gaps within candles_1m
      for (let i = 1; i < liveCandles.length; i++) {
        const timeDiff = liveCandles[i].t - liveCandles[i - 1].t;
        if (timeDiff > 60) {
          const missingMinutes = Math.floor(timeDiff / 60) - 1;
          const prevDate = new Date(liveCandles[i - 1].t * 1000);
          const nextDate = new Date(liveCandles[i].t * 1000);
          const prevDay = prevDate.getUTCDay();
          const isWeekendGap = (prevDay === 5 || prevDay === 6) && missingMinutes >= 1440 && missingMinutes <= 4500;
          
          if (!isWeekendGap && missingMinutes > 10) {
            console.log(`🚨 [Gap Found] ${sym} in candles_1m: ${prevDate.toISOString()} → ${nextDate.toISOString()} (${missingMinutes} min)`);
            allGaps.push({
              symbol: sym,
              startTime: liveCandles[i - 1].t,
              endTime: liveCandles[i].t,
              missingMinutes,
            });
            
            if (!largestGap || missingMinutes > largestGap.minutes) {
              largestGap = {
                start: prevDate.toISOString(),
                end: nextDate.toISOString(),
                minutes: missingMinutes,
                source: 'candles_1m',
              };
            }
          }
        }
      }
      
      // Check gaps within candles_historical_1m
      for (let i = 1; i < historicalCandles.length; i++) {
        const prevTime = Math.floor(new Date(historicalCandles[i - 1].timestamp).getTime() / 1000);
        const currTime = Math.floor(new Date(historicalCandles[i].timestamp).getTime() / 1000);
        const timeDiff = currTime - prevTime;
        
        if (timeDiff > 60) {
          const missingMinutes = Math.floor(timeDiff / 60) - 1;
          const prevDate = new Date(prevTime * 1000);
          const nextDate = new Date(currTime * 1000);
          const prevDay = prevDate.getUTCDay();
          const isWeekendGap = (prevDay === 5 || prevDay === 6) && missingMinutes >= 1440 && missingMinutes <= 4500;
          
          if (!isWeekendGap && missingMinutes > 10) {
            allGaps.push({
              symbol: sym,
              startTime: prevTime,
              endTime: currTime,
              missingMinutes,
            });
            
            if (!largestGap || missingMinutes > largestGap.minutes) {
              largestGap = {
                start: prevDate.toISOString(),
                end: nextDate.toISOString(),
                minutes: missingMinutes,
                source: 'candles_historical_1m',
              };
            }
          }
        }
      }
      
      symbolSummaries.push({
        symbol: sym,
        liveCount: liveCandles.length,
        historicalCount: historicalCandles.length,
        liveOldest: liveCandles.length > 0 ? new Date(liveCandles[0].t * 1000).toISOString() : null,
        liveNewest: liveCandles.length > 0 ? new Date(liveCandles[liveCandles.length - 1].t * 1000).toISOString() : null,
        historicalOldest: historicalCandles.length > 0 ? new Date(historicalCandles[0].timestamp).toISOString() : null,
        historicalNewest: historicalCandles.length > 0 ? new Date(historicalCandles[historicalCandles.length - 1].timestamp).toISOString() : null,
        collectionGap,
        largestGap,
      });
    }
    
    // Sort gaps by size (largest first)
    allGaps.sort((a, b) => b.missingMinutes - a.missingMinutes);
    
    return NextResponse.json({
      success: true,
      gaps: allGaps.slice(0, 50),
      totalGaps: allGaps.length,
      totalMissingMinutes: allGaps.reduce((sum, g) => sum + g.missingMinutes, 0),
      symbolsChecked: symbols.length,
      symbolSummaries,
    });
  } catch (error) {
    console.error('Error detecting gaps:', error);
    return NextResponse.json({ error: 'Failed to detect gaps' }, { status: 500 });
  }
}

/**
 * POST - Fill gaps in candle data
 * Note: This calls the main app's API to do the actual filling
 * since the main app has the Massive.com connection
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { symbol } = body;
    
    // Call the main app's gap fill endpoint
    const mainAppUrl = process.env.MAIN_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${mainAppUrl}/api/admin/market-data/gap-fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    });
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Gap fill failed on main app' }, { status: 500 });
    }
    
    const data = await response.json();
    
    // Update last run time in settings
    const MarketDataSettings = mongoose.models.MarketDataSettings;
    if (MarketDataSettings) {
      await MarketDataSettings.findOneAndUpdate(
        { key: 'market_data_settings' },
        { $set: { 'gapFill.lastRun': new Date() } }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error filling gaps:', error);
    return NextResponse.json({ error: 'Gap fill failed' }, { status: 500 });
  }
}
