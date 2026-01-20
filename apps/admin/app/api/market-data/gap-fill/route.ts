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
  timeframe: string;
  startTime: number;
  endTime: number;
  missingMinutes: number;
}

// Top forex pairs to check
const FOREX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD',
  'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/CHF',
];

// All timeframes with their collection names and interval in minutes
const TIMEFRAME_CONFIG: Record<string, { collection: string; minutes: number }> = {
  '1m': { collection: 'candles_historical_1m', minutes: 1 },
  '5m': { collection: 'candles_historical_5m', minutes: 5 },
  '15m': { collection: 'candles_historical_15m', minutes: 15 },
  '30m': { collection: 'candles_historical_30m', minutes: 30 },
  '1h': { collection: 'candles_historical_1h', minutes: 60 },
  '4h': { collection: 'candles_historical_4h', minutes: 240 },
  '1d': { collection: 'candles_historical_1d', minutes: 1440 },      // Daily = 24*60 minutes
  '1w': { collection: 'candles_historical_1w', minutes: 10080 },     // Weekly = 7*24*60 minutes
  '1M': { collection: 'candles_historical_1M', minutes: 43200 },     // Monthly = 30*24*60 minutes
};

// Historical candle schema (same structure for all timeframes)
const HistoricalCandleSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, default: 0 },
}, { timestamps: false });

HistoricalCandleSchema.index({ symbol: 1, timestamp: 1 }, { unique: true });

// Get or create model for a specific collection
function getHistoricalModel(collectionName: string) {
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  return mongoose.model(collectionName, HistoricalCandleSchema, collectionName);
}

// Backward compatible alias
const HistoricalCandle1m = getHistoricalModel('candles_historical_1m');

/**
 * GET - Detect gaps in candle data
 * Now scans ALL timeframes (1m, 5m, 15m, 30m, 1h, 4h) and candles_1m
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const symbol = request.nextUrl.searchParams.get('symbol');
    const timeframe = request.nextUrl.searchParams.get('timeframe'); // Optional: specific timeframe
    const symbols = symbol ? [symbol] : FOREX_PAIRS;
    const timeframesToCheck = timeframe ? [timeframe] : Object.keys(TIMEFRAME_CONFIG);
    
    const allGaps: Gap[] = [];
    const timeframeSummaries: Array<{
      timeframe: string;
      symbol: string;
      count: number;
      oldest: string | null;
      newest: string | null;
      gapsFound: number;
      largestGapMinutes: number | null;
    }> = [];
    
    console.log(`🔍 [Gap Detection] Checking ${symbols.length} symbols × ${timeframesToCheck.length} timeframes`);
    console.log(`🔍 [Gap Detection] Current time: ${new Date().toISOString()}`);
    
    for (const sym of symbols) {
      // Check candles_1m (live data) for gaps
      const liveCandles = await Candle1m.find({ symbol: sym })
        .sort({ t: 1 })
        .select({ t: 1 })
        .lean() as Array<{ t: number }>;
      
      if (liveCandles.length > 0) {
        console.log(`📊 [Gap Detection] ${sym} candles_1m: ${liveCandles.length} candles`);
        
        // Check for gap at START of today
        const oldestLive = liveCandles[0].t;
        const oldestLiveDate = new Date(oldestLive * 1000);
        const startOfDay = new Date(oldestLiveDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const startOfDaySeconds = Math.floor(startOfDay.getTime() / 1000);
        const gapFromStartOfDay = oldestLive - startOfDaySeconds;
        const gapMinutes = Math.floor(gapFromStartOfDay / 60);
        
        if (gapMinutes > 60) {
          const dayOfWeek = oldestLiveDate.getUTCDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          if (!isWeekend) {
            console.log(`🚨 [Gap Found] ${sym} candles_1m START OF DAY: ${startOfDay.toISOString()} → ${oldestLiveDate.toISOString()} (${gapMinutes} min)`);
            allGaps.push({
              symbol: sym,
              timeframe: '1m (live)',
              startTime: startOfDaySeconds,
              endTime: oldestLive,
              missingMinutes: gapMinutes,
            });
          }
        }
        
        // Check for gaps within candles_1m
        for (let i = 1; i < liveCandles.length; i++) {
          const timeDiff = liveCandles[i].t - liveCandles[i - 1].t;
          if (timeDiff > 120) { // More than 2 minutes gap
            const missingMinutes = Math.floor(timeDiff / 60) - 1;
            const prevDate = new Date(liveCandles[i - 1].t * 1000);
            const nextDate = new Date(liveCandles[i].t * 1000);
            const prevDay = prevDate.getUTCDay();
            const isWeekendGap = (prevDay === 5 || prevDay === 6) && missingMinutes >= 1440 && missingMinutes <= 4500;
            
            if (!isWeekendGap && missingMinutes > 10) {
              console.log(`🚨 [Gap Found] ${sym} candles_1m: ${prevDate.toISOString()} → ${nextDate.toISOString()} (${missingMinutes} min)`);
              allGaps.push({
                symbol: sym,
                timeframe: '1m (live)',
                startTime: liveCandles[i - 1].t,
                endTime: liveCandles[i].t,
                missingMinutes,
              });
            }
          }
        }
      }
      
      // Check each historical timeframe
      for (const tf of timeframesToCheck) {
        const config = TIMEFRAME_CONFIG[tf];
        if (!config) continue;
        
        const Model = getHistoricalModel(config.collection);
        const candles = await Model.find({ symbol: sym })
          .sort({ timestamp: 1 })
          .select({ timestamp: 1 })
          .lean() as Array<{ timestamp: Date }>;
        
        let gapsFound = 0;
        let largestGapMinutes = 0;
        
        if (candles.length > 0) {
          const oldestDate = new Date(candles[0].timestamp);
          const newestDate = new Date(candles[candles.length - 1].timestamp);
          
          console.log(`📊 [Gap Detection] ${sym} ${tf}: ${candles.length} candles (${oldestDate.toISOString()} → ${newestDate.toISOString()})`);
          
          // Expected gap between candles in seconds
          const expectedGapSeconds = config.minutes * 60;
          
          // Check for gaps within this timeframe
          for (let i = 1; i < candles.length; i++) {
            const prevTime = new Date(candles[i - 1].timestamp).getTime() / 1000;
            const currTime = new Date(candles[i].timestamp).getTime() / 1000;
            const timeDiff = currTime - prevTime;
            
            // If gap is more than 2x the expected interval, it's a real gap
            if (timeDiff > expectedGapSeconds * 2) {
              const missingMinutes = Math.floor(timeDiff / 60);
              const prevDate = new Date(prevTime * 1000);
              const nextDate = new Date(currTime * 1000);
              const prevDay = prevDate.getUTCDay();
              
              // Weekend gap detection - different thresholds for different timeframes
              // For 1m-4h: weekend gap is ~2-3 days (2880-4500 min)
              // For 1d: weekend gap should be exactly 2-3 days (Fri→Mon = 3 days = 4320 min)
              // For 1w/1M: no weekend gaps expected
              let isWeekendGap = false;
              if (config.minutes <= 240) { // 4h or less
                isWeekendGap = (prevDay === 5 || prevDay === 6) && missingMinutes >= 2880 && missingMinutes <= 4500;
              } else if (config.minutes === 1440) { // 1d
                // For daily: only skip if it's exactly 2-3 days (Sat/Sun)
                // Gap of 4+ days on daily is a real gap
                isWeekendGap = (prevDay === 5) && missingMinutes >= 2880 && missingMinutes <= 4320;
              }
              // For 1w and 1M, no weekend gaps
              
              if (!isWeekendGap && missingMinutes > config.minutes * 2) {
                console.log(`🚨 [Gap Found] ${sym} ${tf}: ${prevDate.toISOString()} → ${nextDate.toISOString()} (${missingMinutes} min, ${Math.round(missingMinutes / 1440)} days)`);
                allGaps.push({
                  symbol: sym,
                  timeframe: tf,
                  startTime: prevTime,
                  endTime: currTime,
                  missingMinutes,
                });
                gapsFound++;
                if (missingMinutes > largestGapMinutes) {
                  largestGapMinutes = missingMinutes;
                }
              }
            }
          }
          
          timeframeSummaries.push({
            timeframe: tf,
            symbol: sym,
            count: candles.length,
            oldest: oldestDate.toISOString(),
            newest: newestDate.toISOString(),
            gapsFound,
            largestGapMinutes: largestGapMinutes || null,
          });
        } else {
          timeframeSummaries.push({
            timeframe: tf,
            symbol: sym,
            count: 0,
            oldest: null,
            newest: null,
            gapsFound: 0,
            largestGapMinutes: null,
          });
        }
      }
    }
    
    // Sort gaps by size (largest first)
    allGaps.sort((a, b) => b.missingMinutes - a.missingMinutes);
    
    console.log(`✅ [Gap Detection] Complete: ${allGaps.length} gaps found across ${symbols.length} symbols and ${timeframesToCheck.length} timeframes`);
    
    return NextResponse.json({
      success: true,
      gaps: allGaps.slice(0, 100), // Return top 100 gaps
      totalGaps: allGaps.length,
      totalMissingMinutes: allGaps.reduce((sum, g) => sum + g.missingMinutes, 0),
      symbolsChecked: symbols.length,
      timeframesChecked: timeframesToCheck,
      timeframeSummaries,
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
