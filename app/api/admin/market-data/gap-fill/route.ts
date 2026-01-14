import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Candle1m from '@/database/models/candle-1m.model';
import { getRecentCandles, Timeframe } from '@/lib/services/forex-historical.service';
import { ForexSymbol, FOREX_PAIRS } from '@/lib/services/pnl-calculator.service';
import mongoose from 'mongoose';

interface Gap {
  symbol: string;
  startTime: number;
  endTime: number;
  missingMinutes: number;
}

/**
 * GET - Detect gaps in candle data
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const symbol = request.nextUrl.searchParams.get('symbol');
    const symbols = symbol ? [symbol] : FOREX_PAIRS.slice(0, 10); // Check top 10 pairs
    
    const allGaps: Gap[] = [];
    
    for (const sym of symbols) {
      const candles = await Candle1m.getCandles(sym, 1000);
      
      if (candles.length < 2) continue;
      
      // Check for gaps (should be 60 seconds apart)
      for (let i = 1; i < candles.length; i++) {
        const timeDiff = candles[i].time - candles[i - 1].time;
        
        if (timeDiff > 60) {
          const missingMinutes = Math.floor(timeDiff / 60) - 1;
          
          // Report ALL gaps - no limit
          allGaps.push({
            symbol: sym,
            startTime: candles[i - 1].time,
            endTime: candles[i].time,
            missingMinutes,
          });
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
 * POST - Fill gaps in candle data from Massive.com API
 * Note: Can only fill gaps where Massive.com still has data available
 * Older gaps will be detected but cannot be filled
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { symbol } = body;
    
    const symbols = symbol ? [symbol] : FOREX_PAIRS.slice(0, 10);
    
    let totalGapsFilled = 0;
    let totalCandlesFilled = 0;
    const fillResults: Array<{
      symbol: string;
      gapsFilled: number;
      candlesFilled: number;
    }> = [];
    
    for (const sym of symbols) {
      const candles = await Candle1m.getCandles(sym, 1000);
      
      if (candles.length < 2) continue;
      
      let symbolGapsFilled = 0;
      let symbolCandlesFilled = 0;
      
      // Find and fill gaps
      for (let i = 1; i < candles.length; i++) {
        const timeDiff = candles[i].time - candles[i - 1].time;
        const missingMinutes = Math.floor(timeDiff / 60) - 1;
        
        // Only fill gaps up to maxGapMinutes
        if (missingMinutes > 0 && missingMinutes <= maxGapMinutes) {
          try {
            // Fetch candles from Massive.com for this gap period
            // We need to get candles for the time range: startTime+60 to endTime-60
            const gapStart = candles[i - 1].time + 60;
            const gapEnd = candles[i].time - 60;
            
            // Fetch historical candles (returns milliseconds, we need seconds)
            const historicalCandles = await getRecentCandles(
              sym as ForexSymbol,
              '1' as Timeframe,
              missingMinutes + 10 // Get a few extra to ensure coverage
            );
            
            // Filter to only the gap period and save
            const candlesToFill = historicalCandles.filter(c => {
              const timeInSeconds = Math.floor(c.time / 1000);
              return timeInSeconds >= gapStart && timeInSeconds <= gapEnd;
            });
            
            for (const candle of candlesToFill) {
              // Check if candle already exists
              const existing = await mongoose.connection.db?.collection('candles_1m').findOne({
                symbol: sym,
                t: Math.floor(candle.time / 1000),
              });
              
              if (!existing) {
                await Candle1m.upsertCandle(
                  sym,
                  candle.time, // milliseconds
                  candle.open,
                  candle.high,
                  candle.low,
                  candle.close,
                  candle.volume || 0
                );
                symbolCandlesFilled++;
              }
            }
            
            if (candlesToFill.length > 0) {
              symbolGapsFilled++;
            }
          } catch (gapError) {
            console.error(`Error filling gap for ${sym}:`, gapError);
          }
        }
      }
      
      if (symbolGapsFilled > 0 || symbolCandlesFilled > 0) {
        fillResults.push({
          symbol: sym,
          gapsFilled: symbolGapsFilled,
          candlesFilled: symbolCandlesFilled,
        });
        totalGapsFilled += symbolGapsFilled;
        totalCandlesFilled += symbolCandlesFilled;
      }
    }
    
    // Update last run time in settings
    const MarketDataSettings = mongoose.models.MarketDataSettings;
    if (MarketDataSettings) {
      await MarketDataSettings.findOneAndUpdate(
        { key: 'market_data_settings' },
        { $set: { 'gapFill.lastRun': new Date() } }
      );
    }
    
    console.log(`🔧 [Gap Fill] Filled ${totalCandlesFilled} candles across ${totalGapsFilled} gaps`);
    
    return NextResponse.json({
      success: true,
      gapFill: {
        totalGapsFilled,
        totalCandlesFilled,
        symbolsProcessed: symbols.length,
        results: fillResults,
      },
    });
  } catch (error) {
    console.error('Error filling gaps:', error);
    return NextResponse.json({ error: 'Gap fill failed' }, { status: 500 });
  }
}
