import { NextRequest, NextResponse } from 'next/server';
import { fetchRealForexPrices, isForexMarketOpen, getMarketStatusFromAPI, isMarketOpenSync } from '@/lib/services/real-forex-prices.service';
import { ForexSymbol } from '@/lib/services/pnl-calculator.service';

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

    // Get REAL market prices from Massive.com
    const pricesMap = await fetchRealForexPrices(symbols as ForexSymbol[]);
    
    // Convert Map to array for JSON response
    const prices = Array.from(pricesMap.values());

    // Get market status from Massive.com API
    let marketOpen = true;
    let status = '🟢 Market Open';
    
    try {
      const marketStatusData = await getMarketStatusFromAPI();
      marketOpen = marketStatusData.isOpen;
      status = marketStatusData.isOpen ? '🟢 Market Open' : '🔴 Market Closed';
    } catch (error) {
      console.warn('Using fallback market status detection');
      marketOpen = isMarketOpenSync();
      status = marketOpen ? '🟢 Market Open' : '🔴 Market Closed';
    }

    return NextResponse.json({ 
      prices,
      marketOpen,
      status,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching REAL prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch real market prices' },
      { status: 500 }
    );
  }
}

export async function GET() {
  let marketOpen = true;
  let status = 'Checking...';
  
  try {
    const marketStatusData = await getMarketStatusFromAPI();
    marketOpen = marketStatusData.isOpen;
    status = marketStatusData.isOpen ? '🟢 Market Open' : '🔴 Market Closed';
  } catch (error) {
    marketOpen = isMarketOpenSync();
    status = marketOpen ? '🟢 Market Open' : '🔴 Market Closed';
  }
  
  return NextResponse.json({
    marketOpen,
    status,
    message: 'Use POST /api/trading/prices with { symbols: [...] } to fetch prices',
  });
}

