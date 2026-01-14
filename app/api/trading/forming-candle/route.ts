import { NextRequest, NextResponse } from 'next/server';
import { getFormingCandle } from '@/lib/services/websocket-price-streamer';

/**
 * Get the current forming candle for a symbol
 * This endpoint is polled frequently (200ms) for real-time candle updates
 * 
 * Response is tiny (single candle) so it's efficient to poll often
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol') || 'EUR/USD';
  
  const formingCandle = getFormingCandle(symbol);
  
  if (!formingCandle) {
    return NextResponse.json({ 
      candle: null,
      timestamp: Date.now(),
    });
  }
  
  return NextResponse.json({
    candle: {
      symbol: formingCandle.symbol,
      time: formingCandle.time,
      open: formingCandle.open,
      high: formingCandle.high,
      low: formingCandle.low,
      close: formingCandle.close,
      tickCount: formingCandle.tickCount,
    },
    timestamp: Date.now(),
  });
}
