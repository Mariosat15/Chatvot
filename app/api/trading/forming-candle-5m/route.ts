import { NextRequest, NextResponse } from 'next/server';
import { getForming5mCandle, getCachedPrice } from '@/lib/services/websocket-price-streamer';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

/**
 * GET /api/trading/forming-candle-5m
 * 
 * Returns the current forming 5m candle for a symbol
 * Built from completed 1m candles buffer + current 1m forming candle
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol') || 'EUR/USD';
  
  try {
    // Get 5m forming candle from websocket-price-streamer
    const formingCandle = getForming5mCandle(symbol);
    
    // Get current price for bid/ask lines
    const price = getCachedPrice(symbol as ForexSymbol);
    
    if (!formingCandle) {
      return NextResponse.json({
        candle: null,
        price: price ? {
          bid: price.bid,
          ask: price.ask,
          mid: price.mid,
          spread: price.spread,
        } : null,
        message: '5m forming candle not yet available (buffer warming up)',
      });
    }
    
    return NextResponse.json({
      candle: {
        time: formingCandle.time,
        open: formingCandle.open,
        high: formingCandle.high,
        low: formingCandle.low,
        close: formingCandle.close,
      },
      price: price ? {
        bid: price.bid,
        ask: price.ask,
        mid: price.mid,
        spread: price.spread,
      } : null,
    });
  } catch (error) {
    console.error('Error getting 5m forming candle:', error);
    return NextResponse.json(
      { error: 'Failed to get 5m forming candle' },
      { status: 500 }
    );
  }
}
