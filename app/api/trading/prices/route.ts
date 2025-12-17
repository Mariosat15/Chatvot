import { NextRequest, NextResponse } from 'next/server';
import { fetchRealForexPrices, isMarketOpenSync } from '@/lib/services/real-forex-prices.service';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

// Cache market status for 30 seconds (don't check on every request)
let cachedMarketOpen = true;
let cachedMarketStatus = '🟢 Market Open';
let lastMarketCheck = 0;
const MARKET_CHECK_INTERVAL = 30000; // 30 seconds

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
    const body = await request.json();
    const { symbols } = body;

    if (!symbols || !Array.isArray(symbols)) {
      return NextResponse.json(
        { error: 'Invalid symbols array' },
        { status: 400 }
      );
    }

    // Get prices from Redis cache (instant) or Massive.com API (fallback)
    const pricesMap = await fetchRealForexPrices(symbols as ForexSymbol[]);
    
    // Convert Map to array for JSON response
    const prices = Array.from(pricesMap.values());

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

