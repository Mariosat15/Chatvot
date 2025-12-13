/**
 * Forex Historical Data Service
 * Fetches OHLC (Open, High, Low, Close) candle data from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/aggregates/custom-bars
 */

import { ForexSymbol } from './pnl-calculator.service';

export interface OHLCCandle {
  time: number; // Unix timestamp in seconds (required by lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Timeframe = '1' | '5' | '15' | '60' | '240' | 'D';

const MASSIVE_API_BASE_URL = 'https://api.massive.com';
const MASSIVE_API_KEY = process.env.NEXT_PUBLIC_MASSIVE_API_KEY || process.env.MASSIVE_API_KEY;

// Map timeframes to Massive.com format
const TIMEFRAME_MAP: Record<Timeframe, { multiplier: number; timespan: string }> = {
  '1': { multiplier: 1, timespan: 'minute' },
  '5': { multiplier: 5, timespan: 'minute' },
  '15': { multiplier: 15, timespan: 'minute' },
  '60': { multiplier: 1, timespan: 'hour' },
  '240': { multiplier: 4, timespan: 'hour' },
  'D': { multiplier: 1, timespan: 'day' },
};

// Convert our symbol format (EUR/USD) to Massive.com format (C:EURUSD)
function symbolToMassiveFormat(symbol: ForexSymbol): string {
  const cleanSymbol = symbol.replace('/', '');
  return `C:${cleanSymbol}`;
}

/**
 * Fetch historical OHLC candles from Massive.com
 */
export async function fetchHistoricalCandles(
  symbol: ForexSymbol,
  timeframe: Timeframe,
  from: Date,
  to: Date
): Promise<OHLCCandle[]> {
  if (!MASSIVE_API_KEY) {
    console.error('❌ MASSIVE_API_KEY is not set');
    throw new Error('MASSIVE_API_KEY is required for historical data');
  }

  const ticker = symbolToMassiveFormat(symbol);
  const { multiplier, timespan } = TIMEFRAME_MAP[timeframe];
  
  // Format dates as YYYY-MM-DD
  const fromDate = from.toISOString().split('T')[0];
  const toDate = to.toISOString().split('T')[0];

  const endpoint = `/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`;
  const url = `${MASSIVE_API_BASE_URL}${endpoint}?adjusted=true&sort=asc&limit=5000&apiKey=${MASSIVE_API_KEY}`;

  console.log(`📊 Fetching historical candles: ${symbol} (${timeframe})`);
  console.log(`📡 URL: ${endpoint}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      next: { revalidate: 60 } // Cache for 1 minute
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Historical data fetch failed: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch historical data: ${response.status}`);
    }

    const data = await response.json();

    // Handle empty response (common when market is closed on weekends)
    if (!data.results || data.results.length === 0) {
      console.warn(`⚠️ No historical data available for ${symbol} - market may be closed (weekend)`);
      console.warn(`   Response:`, JSON.stringify(data).substring(0, 200));
      // Return empty array instead of throwing - UI will show "No data available"
      return [];
    }

    if (data.status !== 'OK') {
      console.error('❌ Invalid response status from Massive.com:', data.status);
      console.warn(`⚠️ Returning empty data - market may be closed`);
      return [];
    }

    // Transform to lightweight-charts format
    const candles: OHLCCandle[] = data.results.map((bar: any) => ({
      time: Math.floor(bar.t / 1000), // Convert milliseconds to seconds
      open: Number(bar.o.toFixed(5)),
      high: Number(bar.h.toFixed(5)),
      low: Number(bar.l.toFixed(5)),
      close: Number(bar.c.toFixed(5)),
      volume: bar.v || 0,
    }));

    console.log(`✅ Fetched ${candles.length} candles for ${symbol}`);
    return candles;
  } catch (error: any) {
    console.error('❌ Error fetching historical candles:', error.message);
    // Return empty array on error instead of crashing - more graceful for UI
    console.warn(`⚠️ Returning empty data due to error - market may be closed`);
    return [];
  }
}

/**
 * Get recent candles for initial chart load
 * Fetches last N days/hours depending on timeframe
 */
export async function getRecentCandles(
  symbol: ForexSymbol,
  timeframe: Timeframe,
  bars: number = 300
): Promise<OHLCCandle[]> {
  const now = new Date();
  const from = new Date(now);

  // Calculate how far back to fetch based on timeframe and desired bar count
  switch (timeframe) {
    case '1':
      from.setHours(from.getHours() - Math.ceil(bars / 60)); // bars in minutes
      break;
    case '5':
      from.setHours(from.getHours() - Math.ceil((bars * 5) / 60));
      break;
    case '15':
      from.setHours(from.getHours() - Math.ceil((bars * 15) / 60));
      break;
    case '60':
      from.setHours(from.getHours() - bars);
      break;
    case '240':
      from.setHours(from.getHours() - bars * 4);
      break;
    case 'D':
      from.setDate(from.getDate() - bars);
      break;
  }

  // Apply minimum lookback based on timeframe
  // Intraday data: Only go back 1-2 days (API limitation)
  // Daily data: Can go back much further
  const minDaysBack = new Date(now);
  
  switch (timeframe) {
    case '1':
    case '5':
    case '15':
      // Intraday (1m, 5m, 15m): Max 1 day back (API typically only has 24-48 hours of intraday data)
      minDaysBack.setDate(minDaysBack.getDate() - 1);
      break;
    case '60':
      // 1h: Max 2 days back
      minDaysBack.setDate(minDaysBack.getDate() - 2);
      break;
    case '240':
      // 4h: Max 7 days back
      minDaysBack.setDate(minDaysBack.getDate() - 7);
      break;
    case 'D':
      // Daily: Max 365 days back
      minDaysBack.setDate(minDaysBack.getDate() - 365);
      break;
  }
  
  // Don't fetch older than the minimum for this timeframe
  if (from < minDaysBack) {
    from.setTime(minDaysBack.getTime());
  }

  console.log(`📅 Fetching from ${from.toISOString()} to ${now.toISOString()} (${timeframe})`);
  return fetchHistoricalCandles(symbol, timeframe, from, now);
}

/**
 * Convert real-time price quote to candle format
 * Used to append real-time data to chart
 */
export function priceToCandle(
  bid: number,
  ask: number,
  timestamp: number
): Pick<OHLCCandle, 'time' | 'close'> {
  const mid = (bid + ask) / 2;
  return {
    time: Math.floor(timestamp / 1000), // Convert to seconds
    close: Number(mid.toFixed(5)),
  };
}

