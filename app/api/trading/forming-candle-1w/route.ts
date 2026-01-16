import { NextRequest, NextResponse } from 'next/server';
import { getFormingWeeklyCandle, getCachedPrice } from '@/lib/services/websocket-price-streamer';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  const candle = getFormingWeeklyCandle(symbol);
  const price = getCachedPrice(symbol as ForexSymbol);

  return NextResponse.json({
    candle: candle ? {
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    } : null,
    price: price ? { bid: price.bid, ask: price.ask } : null,
  });
}
