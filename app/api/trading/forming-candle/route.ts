import { NextRequest, NextResponse } from "next/server";
import {
  getFormingCandle,
  getCachedPrice,
} from "@/lib/services/websocket-price-streamer";
import { ForexSymbol } from "@/lib/services/pnl-calculator.service";

/**
 * Get the current forming candle for a symbol
 * This endpoint is polled frequently (200ms) for real-time candle updates
 *
 * Response is tiny (single candle) so it's efficient to poll often
 *
 * NOW INCLUDES: bid/ask prices from same source for perfect sync!
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") || "EUR/USD";

  const formingCandle = getFormingCandle(symbol);
  const price = getCachedPrice(symbol as ForexSymbol);

  if (!formingCandle) {
    return NextResponse.json({
      candle: null,
      price: price
        ? {
            bid: price.bid,
            ask: price.ask,
            mid: price.mid,
            spread: price.spread,
          }
        : null,
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
    // Include bid/ask from same cache for perfect sync!
    price: price
      ? {
          bid: price.bid,
          ask: price.ask,
          mid: price.mid,
          spread: price.spread,
        }
      : null,
    timestamp: Date.now(),
  });
}
