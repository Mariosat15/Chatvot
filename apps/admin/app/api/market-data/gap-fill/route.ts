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
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const symbol = request.nextUrl.searchParams.get('symbol');
    const symbols = symbol ? [symbol] : FOREX_PAIRS;
    
    const allGaps: Gap[] = [];
    
    for (const sym of symbols) {
      const candles = await Candle1m.find({ symbol: sym })
        .sort({ t: 1 })
        .limit(1000)
        .lean();
      
      if (candles.length < 2) continue;
      
      // Check for gaps (should be 60 seconds apart)
      for (let i = 1; i < candles.length; i++) {
        const timeDiff = candles[i].t - candles[i - 1].t;
        
        if (timeDiff > 60) {
          const missingMinutes = Math.floor(timeDiff / 60) - 1;
          
          // Only report recent fillable gaps (up to 8 hours)
          if (missingMinutes <= 480) {
            allGaps.push({
              symbol: sym,
              startTime: candles[i - 1].t,
              endTime: candles[i].t,
              missingMinutes,
            });
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      gaps: allGaps,
      totalGaps: allGaps.length,
      totalMissingMinutes: allGaps.reduce((sum, g) => sum + g.missingMinutes, 0),
      symbolsChecked: symbols.length,
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
