import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalCandles, ForexSymbol } from '@/lib/services/market-data.service';

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

    // Get historical candles (now async for real API calls)
    const candles = await getHistoricalCandles(
      symbol as ForexSymbol,
      timeframe as '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
      count || 100
    );

    return NextResponse.json({ candles });
  } catch (error) {
    console.error('Error fetching candles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candles' },
      { status: 500 }
    );
  }
}

