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

/**
 * GET - Detect gaps in candle data
 * Scans ALL candles to find gaps, including large multi-day gaps
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const symbol = request.nextUrl.searchParams.get('symbol');
    const symbols = symbol ? [symbol] : FOREX_PAIRS;
    
    const allGaps: Gap[] = [];
    const symbolSummaries: Array<{
      symbol: string;
      count: number;
      oldest: string | null;
      newest: string | null;
      daysOfData: number;
      largestGap: { start: string; end: string; minutes: number } | null;
    }> = [];
    
    for (const sym of symbols) {
      // Get ALL candles for this symbol (sorted by time)
      const candles = await Candle1m.find({ symbol: sym })
        .sort({ t: 1 })
        .select({ t: 1 })  // Only fetch timestamps to reduce memory
        .lean() as Array<{ t: number }>;
      
      if (candles.length === 0) {
        symbolSummaries.push({
          symbol: sym,
          count: 0,
          oldest: null,
          newest: null,
          daysOfData: 0,
          largestGap: null,
        });
        continue;
      }
      
      let largestGap: { start: string; end: string; minutes: number } | null = null;
      
      // Check for gaps (should be 60 seconds apart for 1m candles)
      // Skip expected gaps: weekends (Fri 5pm - Sun 5pm ET)
      for (let i = 1; i < candles.length; i++) {
        const timeDiff = candles[i].t - candles[i - 1].t;
        
        // More than 1 minute gap
        if (timeDiff > 60) {
          const missingMinutes = Math.floor(timeDiff / 60) - 1;
          
          // Check if this is a weekend gap (expected, not an error)
          const prevDate = new Date(candles[i - 1].t * 1000);
          const nextDate = new Date(candles[i].t * 1000);
          const prevDay = prevDate.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
          
          // Skip if it's a typical weekend gap (Fri to Sun/Mon)
          // Weekend gaps are typically 2-3 days (~2880-4320 minutes)
          const isWeekendGap = (prevDay === 5 || prevDay === 6) && missingMinutes >= 1440 && missingMinutes <= 4500;
          
          if (!isWeekendGap) {
            allGaps.push({
              symbol: sym,
              startTime: candles[i - 1].t,
              endTime: candles[i].t,
              missingMinutes,
            });
            
            // Track largest gap
            if (!largestGap || missingMinutes > largestGap.minutes) {
              largestGap = {
                start: prevDate.toISOString(),
                end: nextDate.toISOString(),
                minutes: missingMinutes,
              };
            }
          }
        }
      }
      
      const oldestTime = candles[0].t;
      const newestTime = candles[candles.length - 1].t;
      
      symbolSummaries.push({
        symbol: sym,
        count: candles.length,
        oldest: new Date(oldestTime * 1000).toISOString(),
        newest: new Date(newestTime * 1000).toISOString(),
        daysOfData: Math.round((newestTime - oldestTime) / 86400),
        largestGap,
      });
    }
    
    // Sort gaps by size (largest first)
    allGaps.sort((a, b) => b.missingMinutes - a.missingMinutes);
    
    return NextResponse.json({
      success: true,
      gaps: allGaps.slice(0, 50), // Return top 50 largest gaps
      totalGaps: allGaps.length,
      totalMissingMinutes: allGaps.reduce((sum, g) => sum + g.missingMinutes, 0),
      symbolsChecked: symbols.length,
      symbolSummaries,  // NEW: Show data range per symbol
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
