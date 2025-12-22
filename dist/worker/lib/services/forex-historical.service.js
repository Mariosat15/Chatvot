"use strict";
/**
 * Forex Historical Data Service
 * Fetches OHLC (Open, High, Low, Close) candle data from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/aggregates/custom-bars
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchHistoricalCandles = fetchHistoricalCandles;
exports.getRecentCandles = getRecentCandles;
exports.priceToCandle = priceToCandle;
// Disable debug logging in production
const DEBUG = process.env.NODE_ENV === 'development' && false;
const log = (...args) => { if (DEBUG)
    console.log(...args); };
const warn = (...args) => { if (DEBUG)
    console.warn(...args); };
const error = (...args) => { if (DEBUG)
    console.error(...args); };
const MASSIVE_API_BASE_URL = 'https://api.massive.com';
const MASSIVE_API_KEY = process.env.NEXT_PUBLIC_MASSIVE_API_KEY || process.env.MASSIVE_API_KEY;
// Map timeframes to Massive.com format
const TIMEFRAME_MAP = {
    '1': { multiplier: 1, timespan: 'minute' },
    '5': { multiplier: 5, timespan: 'minute' },
    '15': { multiplier: 15, timespan: 'minute' },
    '30': { multiplier: 30, timespan: 'minute' },
    '60': { multiplier: 1, timespan: 'hour' },
    '120': { multiplier: 2, timespan: 'hour' },
    '240': { multiplier: 4, timespan: 'hour' },
    'D': { multiplier: 1, timespan: 'day' },
    'W': { multiplier: 1, timespan: 'week' },
    'M': { multiplier: 1, timespan: 'month' },
};
// Convert our symbol format (EUR/USD) to Massive.com format (C:EURUSD)
function symbolToMassiveFormat(symbol) {
    const cleanSymbol = symbol.replace('/', '');
    return `C:${cleanSymbol}`;
}
/**
 * Fetch historical OHLC candles from Massive.com
 */
async function fetchHistoricalCandles(symbol, timeframe, from, to) {
    if (!MASSIVE_API_KEY) {
        error('❌ MASSIVE_API_KEY is not set');
        throw new Error('MASSIVE_API_KEY is required for historical data');
    }
    const ticker = symbolToMassiveFormat(symbol);
    const { multiplier, timespan } = TIMEFRAME_MAP[timeframe];
    // Format dates as YYYY-MM-DD
    const fromDate = from.toISOString().split('T')[0];
    const toDate = to.toISOString().split('T')[0];
    const endpoint = `/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`;
    const url = `${MASSIVE_API_BASE_URL}${endpoint}?adjusted=true&sort=asc&limit=5000&apiKey=${MASSIVE_API_KEY}`;
    log(`📊 Fetching historical candles: ${symbol} (${timeframe})`);
    log(`📡 URL: ${endpoint}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            // @ts-expect-error -- Next.js specific fetch option
            next: { revalidate: 60 } // Cache for 1 minute
        });
        if (!response.ok) {
            const errorText = await response.text();
            error(`❌ Historical data fetch failed: ${response.status} - ${errorText}`);
            throw new Error(`Failed to fetch historical data: ${response.status}`);
        }
        const data = await response.json();
        // Handle empty response (common when market is closed on weekends)
        if (!data.results || data.results.length === 0) {
            warn(`⚠️ No historical data available for ${symbol} - market may be closed (weekend)`);
            warn(`   Response:`, JSON.stringify(data).substring(0, 200));
            // Return empty array instead of throwing - UI will show "No data available"
            return [];
        }
        if (data.status !== 'OK') {
            error('❌ Invalid response status from Massive.com:', data.status);
            warn(`⚠️ Returning empty data - market may be closed`);
            return [];
        }
        // Transform to lightweight-charts format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candles = data.results.map((bar) => ({
            time: Math.floor(bar.t / 1000), // Convert milliseconds to seconds
            open: Number(bar.o.toFixed(5)),
            high: Number(bar.h.toFixed(5)),
            low: Number(bar.l.toFixed(5)),
            close: Number(bar.c.toFixed(5)),
            volume: bar.v || 0,
        }));
        log(`✅ Fetched ${candles.length} candles for ${symbol}`);
        return candles;
    }
    catch (err) {
        error('❌ Error fetching historical candles:', err instanceof Error ? err.message : 'Unknown error');
        // Return empty array on error instead of crashing - more graceful for UI
        warn(`⚠️ Returning empty data due to error - market may be closed`);
        return [];
    }
}
/**
 * Get recent candles for initial chart load
 * Fetches last N days/hours depending on timeframe
 */
async function getRecentCandles(symbol, timeframe, bars = 300) {
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
        case '30':
            from.setHours(from.getHours() - Math.ceil((bars * 30) / 60));
            break;
        case '60':
            from.setHours(from.getHours() - bars);
            break;
        case '120':
            from.setHours(from.getHours() - bars * 2);
            break;
        case '240':
            from.setHours(from.getHours() - bars * 4);
            break;
        case 'D':
            from.setDate(from.getDate() - bars);
            break;
        case 'W':
            from.setDate(from.getDate() - bars * 7);
            break;
        case 'M':
            from.setMonth(from.getMonth() - bars);
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
        case '30':
            // Intraday: Max 2 days back
            minDaysBack.setDate(minDaysBack.getDate() - 2);
            break;
        case '60':
        case '120':
            // 1h/2h: Max 7 days back
            minDaysBack.setDate(minDaysBack.getDate() - 7);
            break;
        case '240':
            // 4h: Max 30 days back
            minDaysBack.setDate(minDaysBack.getDate() - 30);
            break;
        case 'D':
            // Daily: Max 2 years back
            minDaysBack.setDate(minDaysBack.getDate() - 730);
            break;
        case 'W':
            // Weekly: Max 5 years back
            minDaysBack.setDate(minDaysBack.getDate() - 1825);
            break;
        case 'M':
            // Monthly: Max 10 years back
            minDaysBack.setDate(minDaysBack.getDate() - 3650);
            break;
    }
    // Don't fetch older than the minimum for this timeframe
    if (from < minDaysBack) {
        from.setTime(minDaysBack.getTime());
    }
    log(`📅 Fetching from ${from.toISOString()} to ${now.toISOString()} (${timeframe})`);
    return fetchHistoricalCandles(symbol, timeframe, from, now);
}
/**
 * Convert real-time price quote to candle format
 * Used to append real-time data to chart
 */
function priceToCandle(bid, ask, timestamp) {
    const mid = (bid + ask) / 2;
    return {
        time: Math.floor(timestamp / 1000), // Convert to seconds
        close: Number(mid.toFixed(5)),
    };
}
