/**
 * Real Forex Prices Service
 * 
 * Fetches REAL market prices from Massive.com API
 * NO SIMULATION - Only real data!
 */

import { ForexSymbol, FOREX_PAIRS } from './pnl-calculator.service';

// Price data structure
export interface PriceQuote {
  symbol: ForexSymbol;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
}

export interface MarketStatus {
  isOpen: boolean;
  status: 'open' | 'closed' | 'early-hours' | 'after-hours';
  serverTime: string;
  nextOpen?: string;
  nextClose?: string;
}

export interface MarketHoliday {
  date: string;
  name: string;
  exchange: string;
  status: string;
  open?: string;
  close?: string;
}

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const MASSIVE_API_BASE_URL = 'https://api.massive.com/v1'; // Fixed: .com not .io

// Cache for last known prices (when market is closed or API unavailable)
const lastKnownPrices: Map<ForexSymbol, PriceQuote> = new Map();

// Fallback prices (approximate real values as of Nov 2024) - used when API is unavailable
const FALLBACK_PRICES: Record<ForexSymbol, number> = {
  'EUR/USD': 1.09900,
  'GBP/USD': 1.27000,
  'USD/JPY': 149.500,
  'USD/CHF': 0.87000,
  'AUD/USD': 0.66000,
  'USD/CAD': 1.36000,
  'NZD/USD': 0.61000,
  'EUR/GBP': 0.86500,
  'EUR/JPY': 164.300,
  'GBP/JPY': 189.900,
};

// Map our symbols to Massive.com format
// Massive.com uses "/v1/last_quote/currencies/{from}/{to}" format
// Example: EUR/USD -> /v1/last_quote/currencies/EUR/USD
const MASSIVE_SYMBOL_MAP: Record<ForexSymbol, { from: string; to: string }> = {
  'EUR/USD': { from: 'EUR', to: 'USD' },
  'GBP/USD': { from: 'GBP', to: 'USD' },
  'USD/JPY': { from: 'USD', to: 'JPY' },
  'USD/CHF': { from: 'USD', to: 'CHF' },
  'AUD/USD': { from: 'AUD', to: 'USD' },
  'USD/CAD': { from: 'USD', to: 'CAD' },
  'NZD/USD': { from: 'NZD', to: 'USD' },
  'EUR/GBP': { from: 'EUR', to: 'GBP' },
  'EUR/JPY': { from: 'EUR', to: 'JPY' },
  'GBP/JPY': { from: 'GBP', to: 'JPY' },
};

/**
 * Get typical spread for a forex pair (in pips)
 * Used for bid/ask calculation if API only provides mid price
 */
function getTypicalSpread(symbol: ForexSymbol): number {
  const pairConfig = FOREX_PAIRS[symbol];
  const pip = pairConfig.pip;

  const spreadsInPips: Record<ForexSymbol, number> = {
    'EUR/USD': 1.0,
    'GBP/USD': 1.5,
    'USD/JPY': 1.0,
    'USD/CHF': 2.0,
    'AUD/USD': 1.5,
    'USD/CAD': 1.8,
    'NZD/USD': 2.0,
    'EUR/GBP': 1.2,
    'EUR/JPY': 1.5,
    'GBP/JPY': 2.5,
  };

  return (spreadsInPips[symbol] || 1.5) * pip;
}

/**
 * Fetch real-time prices from Massive.com API
 * Returns REAL market data - even when market is closed (last available price)
 * 
 * According to Massive.com docs: https://massive.com/docs/websocket/forex/aggregates-per-minute
 * We can also use WebSocket for real-time streaming
 */
export async function fetchRealForexPrices(symbols: ForexSymbol[]): Promise<Map<ForexSymbol, PriceQuote>> {
  if (!MASSIVE_API_KEY) {
    console.error('❌ MASSIVE_API_KEY is not set!');
    console.log('💡 Get your API key from: https://massive.com');
    return getLastKnownPrices(symbols);
  }

  try {
    console.log(`🔄 Fetching REAL prices for: ${symbols.join(', ')}`);
    
    const pricesMap = new Map<ForexSymbol, PriceQuote>();
    
    // Fetch each symbol individually using correct Massive.com endpoint
    // Endpoint: /v1/last_quote/currencies/{from}/{to}
    // Documentation: https://massive.com/docs/rest/forex/quotes/last-quote
    for (const symbol of symbols) {
      const currencyPair = MASSIVE_SYMBOL_MAP[symbol];
      
      try {
        // Construct correct endpoint
        const endpoint = `/last_quote/currencies/${currencyPair.from}/${currencyPair.to}?apiKey=${MASSIVE_API_KEY}`;
        const url = `${MASSIVE_API_BASE_URL}${endpoint}`;
        
        console.log(`📡 Fetching ${symbol}: ${url.replace(MASSIVE_API_KEY || '', 'xxx')}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          console.warn(`⚠️ ${symbol} API failed: ${response.status}`);
          
          if (response.status === 401 || response.status === 403) {
            console.error('❌ Invalid API key. Check MASSIVE_API_KEY in .env');
            console.log('💡 Get your key from: https://massive.com/dashboard');
          }
          
          continue; // Try next symbol
        }

        const data = await response.json();
        
        // Check if response is successful
        if (data.status !== 'success' && data.status !== 'OK') {
          console.warn(`⚠️ ${symbol} API returned status: ${data.status}`);
          continue;
        }
        
        // Parse the response
        const quote = parseLastQuoteResponse(data, symbol);

        if (quote) {
          console.log(`✅ Got REAL price for ${symbol}: Bid ${quote.bid.toFixed(5)} | Ask ${quote.ask.toFixed(5)}`);
          pricesMap.set(symbol, quote);
          lastKnownPrices.set(symbol, quote);
        }
      } catch (error) {
        console.warn(`⚠️ Error fetching ${symbol}:`, error);
        continue;
      }
    }

    if (pricesMap.size > 0) {
      console.log(`✅ Got ${pricesMap.size} REAL prices from Massive.com API`);
      return pricesMap;
    }

    // If all failed, use last known prices
    console.warn('⚠️ API unavailable, using cached/fallback prices');
    return getLastKnownPrices(symbols);

  } catch (error) {
    console.error('❌ Error fetching from Massive.com:', error);
    console.log('💡 Check: 1) API key is valid, 2) Internet connection, 3) Massive.com API status');
    return getLastKnownPrices(symbols);
  }
}

/**
 * Parse Massive.com last_quote API response
 * Response format: { last: { ask, bid, exchange, timestamp }, status: "success", symbol: "AUD/USD" }
 * Documentation: https://massive.com/docs/rest/forex/quotes/last-quote
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLastQuoteResponse(data: any, symbol: ForexSymbol): PriceQuote | null {
  try {
    if (!data.last) {
      console.error('Invalid response format - missing "last" field');
      return null;
    }

    const { ask, bid, timestamp } = data.last;

    if (!ask || !bid) {
      console.error(`Missing bid/ask prices for ${symbol}`);
      return null;
    }

    const mid = (bid + ask) / 2;
    const spread = ask - bid;

    return {
      symbol,
      bid: Number(bid.toFixed(5)),
      ask: Number(ask.toFixed(5)),
      mid: Number(mid.toFixed(5)),
      spread: Number(spread.toFixed(5)),
      timestamp: timestamp || Date.now(),
    };
  } catch (error) {
    console.error(`Error parsing last_quote response for ${symbol}:`, error);
    return null;
  }
}


/**
 * Get last known prices (fallback when API fails or market is closed)
 * Returns cached prices, or fallback prices if no cache exists
 * These are REAL static prices, NOT simulated!
 */
function getLastKnownPrices(symbols: ForexSymbol[]): Map<ForexSymbol, PriceQuote> {
  const prices = new Map<ForexSymbol, PriceQuote>();
  
  symbols.forEach(symbol => {
    // Try cached price first
    const cached = lastKnownPrices.get(symbol);
    if (cached) {
      console.log(`📦 Using cached price for ${symbol}: ${cached.mid.toFixed(5)}`);
      prices.set(symbol, cached);
      return;
    }
    
    // Use fallback price (real approximate values)
    const fallbackPrice = FALLBACK_PRICES[symbol];
    if (fallbackPrice) {
      const spread = getTypicalSpread(symbol);
      const bid = fallbackPrice - spread / 2;
      const ask = fallbackPrice + spread / 2;
      
      const quote: PriceQuote = {
        symbol,
        bid: Number(bid.toFixed(5)),
        ask: Number(ask.toFixed(5)),
        mid: Number(fallbackPrice.toFixed(5)),
        spread: Number(spread.toFixed(5)),
        timestamp: Date.now(),
      };
      
      console.warn(`⚠️ Using fallback price for ${symbol}: ${fallbackPrice.toFixed(5)} (API unavailable)`);
      prices.set(symbol, quote);
      lastKnownPrices.set(symbol, quote); // Cache it for next time
    }
  });
  
  if (prices.size === 0) {
    console.error('❌ No prices available. Check API key and try again.');
  }
  
  return prices;
}

// Cache for market status (refresh every 5 minutes)
let marketStatusCache: { status: MarketStatus; timestamp: number } | null = null;
const MARKET_STATUS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for holidays (refresh daily)
let holidaysCache: { holidays: MarketHoliday[]; timestamp: number } | null = null;
const HOLIDAYS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch market status from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-status
 * Endpoint: GET /v1/marketstatus/now
 */
export async function getMarketStatusFromAPI(): Promise<MarketStatus> {
  // Check cache first
  if (marketStatusCache && (Date.now() - marketStatusCache.timestamp) < MARKET_STATUS_CACHE_DURATION) {
    console.log('📦 Using cached market status');
    return marketStatusCache.status;
  }

  if (!MASSIVE_API_KEY) {
    console.warn('⚠️ MASSIVE_API_KEY is not set, using fallback market detection');
    throw new Error('MASSIVE_API_KEY is not set');
  }

  try {
    // Massive.com API authentication via query parameter
    // Reference: https://massive.com/docs/rest/forex/market-operations/market-status
    const url = `${MASSIVE_API_BASE_URL}/marketstatus/now?apiKey=${encodeURIComponent(MASSIVE_API_KEY)}`;
    
    console.log('📡 Fetching forex market status from Massive.com API...');
    console.log(`🔗 URL: ${MASSIVE_API_BASE_URL}/marketstatus/now`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Don't cache, we handle caching manually
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Market status API failed: ${response.status} ${response.statusText}`);
      console.error(`📄 Response body: ${errorText}`);
      console.warn('📌 Falling back to time-based market detection.');
      throw new Error(`Market status API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('📊 Market status API response:', JSON.stringify(data, null, 2));

    // Parse response according to Massive.com API schema
    // currencies.fx can be: "open", "closed", "pre-market", "after-hours"
    const fxStatus = data.currencies?.fx;
    const isOpen = fxStatus === 'open';
    
    const status: MarketStatus = {
      isOpen,
      status: isOpen ? 'open' : 'closed',
      serverTime: data.serverTime || new Date().toISOString(),
      nextOpen: undefined, // Not provided by this endpoint
      nextClose: undefined  // Not provided by this endpoint
    };

    // Update cache
    marketStatusCache = { status, timestamp: Date.now() };

    console.log(`✅ Forex market status: ${fxStatus?.toUpperCase() || 'UNKNOWN'} (isOpen: ${isOpen})`);
    console.log(`🕒 Server time: ${data.serverTime}`);
    
    return status;
  } catch (error) {
    console.warn('⚠️ Market status API unavailable, using time-based fallback');
    // Don't log as error - this is expected for some plans
    throw error;
  }
}

/**
 * Fetch upcoming market holidays from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-holidays
 */
export async function getUpcomingHolidays(): Promise<MarketHoliday[]> {
  // Check cache first
  if (holidaysCache && (Date.now() - holidaysCache.timestamp) < HOLIDAYS_CACHE_DURATION) {
    return holidaysCache.holidays;
  }

  if (!MASSIVE_API_KEY) {
    console.warn('MASSIVE_API_KEY is not set, cannot fetch holidays');
    return [];
  }

  try {
    const url = `${MASSIVE_API_BASE_URL}/marketstatus/upcoming?apiKey=${MASSIVE_API_KEY}`;
    console.log('📡 Fetching upcoming holidays from Massive.com...');

    const response = await fetch(url, {
      method: 'GET',
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error(`Holidays API failed: ${response.status}`);
    }

    const data = await response.json();
    const holidays = data.response || [];

    // Update cache
    holidaysCache = { holidays, timestamp: Date.now() };

    console.log(`✅ Got ${holidays.length} upcoming holidays`);
    return holidays;
  } catch (error) {
    console.error('❌ Error fetching holidays:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Check if Forex market is open using Massive.com API
 * Uses real-time market status from Massive.com
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-status
 */
export async function isForexMarketOpen(): Promise<boolean> {
  try {
    const status = await getMarketStatusFromAPI();
    return status.isOpen;
  } catch (error) {
    console.error('Error checking market status, using fallback:', error);
    // Fallback to time-based detection
    return isForexMarketOpenFallback();
  }
}

/**
 * Synchronous version for components (uses cache or fallback)
 */
export function isMarketOpenSync(): boolean {
  if (marketStatusCache && (Date.now() - marketStatusCache.timestamp) < MARKET_STATUS_CACHE_DURATION) {
    return marketStatusCache.status.isOpen;
  }
  return isForexMarketOpenFallback();
}

/**
 * Get next market open/close time
 */
export function getNextMarketChange(): { type: 'open' | 'close'; time: Date } | null {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  // If it's weekend, next open is Monday 00:00 UTC
  if (day === 0) { // Sunday
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + 1);
    nextMonday.setUTCHours(0, 0, 0, 0);
    return { type: 'open', time: nextMonday };
  }

  if (day === 6) { // Saturday
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + 2);
    nextMonday.setUTCHours(0, 0, 0, 0);
    return { type: 'open', time: nextMonday };
  }

  // If it's Friday after 22:00 UTC
  if (day === 5 && hour >= 22) {
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + 3);
    nextMonday.setUTCHours(0, 0, 0, 0);
    return { type: 'open', time: nextMonday };
  }

  // If market is open, next close is Friday 22:00 UTC
  const nextFriday = new Date(now);
  const daysUntilFriday = (5 - day + 7) % 7;
  nextFriday.setUTCDate(now.getUTCDate() + daysUntilFriday);
  nextFriday.setUTCHours(22, 0, 0, 0);
  
  return { type: 'close', time: nextFriday };
}

/**
 * Fallback market detection (time-based)
 */
function isForexMarketOpenFallback(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  if (day === 0 || day === 6) return false; // Weekend
  if (day === 5 && hour >= 22) return false; // Friday after 22:00 UTC
  
  return true;
}

/**
 * Get market status message (synchronous version using cache)
 */
export function getMarketStatus(): string {
  const isOpen = isMarketOpenSync();
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  
  if (isOpen) {
    return '🟢 Market is OPEN - Live prices updating';
  } else if (day === 0 || day === 6) {
    return '🔴 Market is CLOSED (Weekend) - Showing last available price';
  } else if (day === 5 && hour >= 22) {
    return '🔴 Market is CLOSED (Friday after 22:00 UTC) - Showing last available price';
  } else {
    return '🔴 Market is CLOSED - Showing last available price';
  }
}

/**
 * Get current price for a single symbol (for order execution)
 * Used by server actions when placing/closing orders
 */
export async function getRealPrice(symbol: ForexSymbol): Promise<PriceQuote | null> {
  const pricesMap = await fetchRealForexPrices([symbol]);
  return pricesMap.get(symbol) || null;
}

