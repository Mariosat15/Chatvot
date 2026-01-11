import { NextRequest, NextResponse } from 'next/server';
import { fetchRealForexPrices, isMarketOpenSync } from '@/lib/services/real-forex-prices.service';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

// Cache market status for 30 seconds (don't check on every request)
let cachedMarketOpen = true;
let cachedMarketStatus = '🟢 Market Open';
let lastMarketCheck = 0;
const MARKET_CHECK_INTERVAL = 30000; // 30 seconds

// TP/SL check throttle (don't check on every price request)
const lastTPSLCheck = new Map<string, number>();
const TPSL_CHECK_INTERVAL = 1000; // Check max once per second per symbol

// TP/SL cache initialization flag
let tpslCacheInitialized = false;

async function ensureTPSLCacheInitialized(): Promise<void> {
  if (tpslCacheInitialized) return;
  tpslCacheInitialized = true;
  
  try {
    const { initializeTPSLCache } = await import('@/lib/services/tpsl-realtime.service');
    await initializeTPSLCache();
    console.log('✅ [PRICES API] TP/SL cache initialized');
  } catch (error) {
    console.error('⚠️ [PRICES API] Failed to initialize TP/SL cache:', error);
    tpslCacheInitialized = false; // Retry next time
  }
}

function getMarketStatus(): { marketOpen: boolean; status: string } {
  const now = Date.now();
  
  if (now - lastMarketCheck > MARKET_CHECK_INTERVAL) {
    cachedMarketOpen = isMarketOpenSync();
    cachedMarketStatus = cachedMarketOpen ? '🟢 Market Open' : '🔴 Market Closed';
    lastMarketCheck = now;
  }
  
  return { marketOpen: cachedMarketOpen, status: cachedMarketStatus };
}

export async function POST(request: NextRequest) {
  try {
    // Handle potentially empty or aborted requests
    let body;
    try {
      body = await request.json();
    } catch {
      // Return empty prices if body is invalid (e.g., aborted request)
      return NextResponse.json({ 
        prices: [],
        marketOpen: cachedMarketOpen,
        status: cachedMarketStatus,
        timestamp: Date.now(),
      });
    }
    
    const { symbols } = body || {};

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ 
        prices: [],
        marketOpen: cachedMarketOpen,
        status: cachedMarketStatus,
        timestamp: Date.now(),
      });
    }

    // ⚡ Ensure TP/SL cache is initialized (first request only)
    await ensureTPSLCacheInitialized();

    // Get prices from Redis cache (instant) or Massive.com API (fallback)
    const pricesMap = await fetchRealForexPrices(symbols as ForexSymbol[]);
    
    // Convert Map to array for JSON response
    const prices = Array.from(pricesMap.values());

    // ⚡ REAL-TIME TP/SL CHECK - Trigger for each symbol (throttled)
    // This ensures TP/SL triggers even when WebSocket isn't connected
    const now = Date.now();
    for (const price of prices) {
      const lastCheck = lastTPSLCheck.get(price.symbol) || 0;
      if (now - lastCheck >= TPSL_CHECK_INTERVAL) {
        lastTPSLCheck.set(price.symbol, now);
        // Fire and forget - don't await
        import('@/lib/services/tpsl-realtime.service')
          .then(({ checkTPSLForSymbol }) => 
            checkTPSLForSymbol(price.symbol as ForexSymbol, price.bid, price.ask)
          )
          .catch(() => {/* ignore errors */});
      }
    }

    // Get cached market status (fast, no API call)
    const { marketOpen, status } = getMarketStatus();

    return NextResponse.json({ 
      prices,
      marketOpen,
      status,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { marketOpen, status } = getMarketStatus();
  
  return NextResponse.json({
    marketOpen,
    status,
    message: 'Use POST /api/trading/prices with { symbols: [...] } to fetch prices',
  });
}

