/**
 * WebSocket Price Streamer
 * 
 * Maintains a single WebSocket connection to Massive.com for real-time price streaming.
 * All forex pairs are subscribed once, and prices are cached in memory.
 * 
 * Benefits:
 * - Reduces API calls from 300+/minute to 0 (after initial connection)
 * - Real-time price updates (sub-second latency)
 * - Single connection shared across all users
 * 
 * Documentation: https://massive.com/docs/websocket/quickstart
 */

import { ForexSymbol } from './pnl-calculator.service';

export interface StreamingPriceQuote {
  symbol: ForexSymbol;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
  source: 'websocket' | 'rest' | 'cache' | 'fallback';
}

// Global price cache - accessible by all server processes
const priceCache = new Map<ForexSymbol, StreamingPriceQuote>();
let lastUpdateTime = 0;

// WebSocket state
let ws: WebSocket | null = null;
let isConnecting = false;
let isAuthenticated = false;
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;

// Configuration
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const WS_URL_REALTIME = 'wss://socket.massive.com/forex';
const WS_URL_DELAYED = 'wss://delayed.massive.com/forex'; // 15-min delayed (free tier)
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;

// All forex pairs to subscribe
const FOREX_PAIRS_TO_SUBSCRIBE: ForexSymbol[] = [
  // Major Pairs
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  // Cross Pairs
  'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/AUD', 'EUR/CAD', 'EUR/NZD',
  'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD',
  'AUD/JPY', 'AUD/CHF', 'AUD/CAD', 'AUD/NZD',
  'CAD/JPY', 'CAD/CHF', 'CHF/JPY',
  'NZD/JPY', 'NZD/CHF', 'NZD/CAD',
  // Exotic Pairs
  'USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK',
];

// Convert our symbol format to Massive.com WebSocket format
// EUR/USD -> C:EURUSD (Currency pair format)
function toMassiveSymbol(symbol: ForexSymbol): string {
  return `C:${symbol.replace('/', '')}`;
}

// Convert Massive.com symbol back to our format
// C:EURUSD -> EUR/USD
function fromMassiveSymbol(massiveSymbol: string): ForexSymbol | null {
  if (!massiveSymbol.startsWith('C:')) return null;
  const pair = massiveSymbol.substring(2); // Remove "C:"
  
  // Map back to our format
  const symbolMap: Record<string, ForexSymbol> = {
    'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY',
    'USDCHF': 'USD/CHF', 'AUDUSD': 'AUD/USD', 'USDCAD': 'USD/CAD',
    'NZDUSD': 'NZD/USD', 'EURGBP': 'EUR/GBP', 'EURJPY': 'EUR/JPY',
    'EURCHF': 'EUR/CHF', 'EURAUD': 'EUR/AUD', 'EURCAD': 'EUR/CAD',
    'EURNZD': 'EUR/NZD', 'GBPJPY': 'GBP/JPY', 'GBPCHF': 'GBP/CHF',
    'GBPAUD': 'GBP/AUD', 'GBPCAD': 'GBP/CAD', 'GBPNZD': 'GBP/NZD',
    'AUDJPY': 'AUD/JPY', 'AUDCHF': 'AUD/CHF', 'AUDCAD': 'AUD/CAD',
    'AUDNZD': 'AUD/NZD', 'CADJPY': 'CAD/JPY', 'CADCHF': 'CAD/CHF',
    'CHFJPY': 'CHF/JPY', 'NZDJPY': 'NZD/JPY', 'NZDCHF': 'NZD/CHF',
    'NZDCAD': 'NZD/CAD', 'USDMXN': 'USD/MXN', 'USDZAR': 'USD/ZAR',
    'USDTRY': 'USD/TRY', 'USDSEK': 'USD/SEK', 'USDNOK': 'USD/NOK',
  };
  
  return symbolMap[pair] || null;
}

/**
 * Initialize WebSocket connection to Massive.com
 */
export function initializeWebSocket(): void {
  if (typeof window !== 'undefined') {
    console.warn('⚠️ WebSocket streamer should only run on server side');
    return;
  }

  if (!MASSIVE_API_KEY) {
    console.error('❌ MASSIVE_API_KEY not set - WebSocket streaming disabled');
    return;
  }

  if (ws || isConnecting) {
    console.log('🔄 WebSocket already connected or connecting');
    return;
  }

  connectWebSocket();
}

/**
 * Connect to WebSocket server
 */
function connectWebSocket(): void {
  if (isConnecting) return;
  isConnecting = true;

  console.log('🔌 Connecting to Massive.com WebSocket...');

  try {
    // Use real-time feed (requires paid plan) or delayed feed
    const wsUrl = WS_URL_REALTIME;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ WebSocket connected to Massive.com');
      isConnecting = false;
      reconnectAttempts = 0;
      
      // Authenticate
      authenticate();
    };

    ws.onmessage = (event) => {
      handleMessage(event.data);
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log(`🔌 WebSocket closed: ${event.code} ${event.reason}`);
      ws = null;
      isConnecting = false;
      isAuthenticated = false;
      
      // Attempt reconnection
      scheduleReconnect();
    };
  } catch (error) {
    console.error('❌ Failed to create WebSocket:', error);
    isConnecting = false;
    scheduleReconnect();
  }
}

/**
 * Authenticate with API key
 */
function authenticate(): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  console.log('🔐 Authenticating with Massive.com...');
  
  ws.send(JSON.stringify({
    action: 'auth',
    params: MASSIVE_API_KEY,
  }));
}

/**
 * Subscribe to forex price feeds
 */
function subscribeToFeeds(): void {
  if (!ws || ws.readyState !== WebSocket.OPEN || !isAuthenticated) return;

  // Subscribe to forex quotes
  // Format: CQ.* for all currency quotes or CQ.EURUSD for specific pairs
  const symbols = FOREX_PAIRS_TO_SUBSCRIBE.map(toMassiveSymbol);
  
  console.log(`📊 Subscribing to ${symbols.length} forex pairs...`);
  
  ws.send(JSON.stringify({
    action: 'subscribe',
    params: symbols.join(','),
  }));
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(data: string): void {
  try {
    const messages = JSON.parse(data);
    
    // Handle array of messages (Massive.com can batch them)
    const messageArray = Array.isArray(messages) ? messages : [messages];
    
    for (const msg of messageArray) {
      switch (msg.ev) {
        case 'status':
          handleStatusMessage(msg);
          break;
        case 'CQ': // Currency Quote
          handleQuoteMessage(msg);
          break;
        case 'CA': // Currency Aggregate
          handleAggregateMessage(msg);
          break;
        default:
          // Unknown event type, ignore
          break;
      }
    }
  } catch (error) {
    console.error('❌ Error parsing WebSocket message:', error);
  }
}

/**
 * Handle status messages (auth success/failure)
 */
function handleStatusMessage(msg: { status: string; message: string }): void {
  if (msg.status === 'auth_success') {
    console.log('✅ WebSocket authenticated successfully');
    isAuthenticated = true;
    subscribeToFeeds();
  } else if (msg.status === 'auth_failed') {
    console.error('❌ WebSocket authentication failed:', msg.message);
    ws?.close();
  } else if (msg.status === 'success' && msg.message?.includes('subscribed')) {
    console.log('✅ Subscribed to forex feeds');
  }
}

/**
 * Handle real-time quote messages
 * Format: { ev: "CQ", pair: "EUR/USD", b: 1.05000, a: 1.05010, t: 1702000000000 }
 */
function handleQuoteMessage(msg: {
  ev: string;
  pair?: string;
  sym?: string;
  b?: number;  // bid
  a?: number;  // ask
  t?: number;  // timestamp
}): void {
  const symbolStr = msg.pair || msg.sym;
  if (!symbolStr) return;
  
  // Convert symbol format
  const symbol = symbolStr.includes('/') 
    ? symbolStr as ForexSymbol 
    : fromMassiveSymbol(`C:${symbolStr}`);
  
  if (!symbol || !msg.b || !msg.a) return;

  const bid = msg.b;
  const ask = msg.a;
  const mid = (bid + ask) / 2;
  const spread = ask - bid;

  const quote: StreamingPriceQuote = {
    symbol,
    bid: Number(bid.toFixed(5)),
    ask: Number(ask.toFixed(5)),
    mid: Number(mid.toFixed(5)),
    spread: Number(spread.toFixed(5)),
    timestamp: msg.t || Date.now(),
    source: 'websocket',
  };

  priceCache.set(symbol, quote);
  lastUpdateTime = Date.now();
}

/**
 * Handle aggregate messages (per-second or per-minute bars)
 * Format: { ev: "CA", pair: "EUR/USD", o: 1.05, h: 1.051, l: 1.049, c: 1.0505, ... }
 */
function handleAggregateMessage(msg: {
  ev: string;
  pair?: string;
  sym?: string;
  o?: number;  // open
  h?: number;  // high
  l?: number;  // low
  c?: number;  // close
  t?: number;  // timestamp
}): void {
  const symbolStr = msg.pair || msg.sym;
  if (!symbolStr || !msg.c) return;

  const symbol = symbolStr.includes('/') 
    ? symbolStr as ForexSymbol 
    : fromMassiveSymbol(`C:${symbolStr}`);
  
  if (!symbol) return;

  // Use close price to estimate bid/ask
  const mid = msg.c;
  const spread = getTypicalSpread(symbol);
  const bid = mid - spread / 2;
  const ask = mid + spread / 2;

  const quote: StreamingPriceQuote = {
    symbol,
    bid: Number(bid.toFixed(5)),
    ask: Number(ask.toFixed(5)),
    mid: Number(mid.toFixed(5)),
    spread: Number(spread.toFixed(5)),
    timestamp: msg.t || Date.now(),
    source: 'websocket',
  };

  priceCache.set(symbol, quote);
  lastUpdateTime = Date.now();
}

/**
 * Get typical spread for a forex pair
 */
function getTypicalSpread(symbol: ForexSymbol): number {
  const spreads: Partial<Record<ForexSymbol, number>> = {
    'EUR/USD': 0.00010, 'GBP/USD': 0.00015, 'USD/JPY': 0.010,
    'USD/CHF': 0.00020, 'AUD/USD': 0.00015, 'USD/CAD': 0.00018,
    'NZD/USD': 0.00020,
  };
  return spreads[symbol] || 0.00025;
}

/**
 * Schedule reconnection attempt
 */
function scheduleReconnect(): void {
  if (reconnectTimer) return;
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('❌ Max reconnect attempts reached. WebSocket streaming disabled.');
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1);
  
  console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
  
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, delay);
}

/**
 * Get cached price for a symbol
 */
export function getCachedPrice(symbol: ForexSymbol): StreamingPriceQuote | null {
  return priceCache.get(symbol) || null;
}

/**
 * Get all cached prices
 */
export function getAllCachedPrices(): Map<ForexSymbol, StreamingPriceQuote> {
  return new Map(priceCache);
}

/**
 * Get multiple cached prices
 */
export function getCachedPrices(symbols: ForexSymbol[]): Map<ForexSymbol, StreamingPriceQuote> {
  const result = new Map<ForexSymbol, StreamingPriceQuote>();
  for (const symbol of symbols) {
    const cached = priceCache.get(symbol);
    if (cached) {
      result.set(symbol, cached);
    }
  }
  return result;
}

/**
 * Check if WebSocket is connected and streaming
 */
export function isWebSocketConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN && isAuthenticated;
}

/**
 * Get WebSocket connection status
 */
export function getConnectionStatus(): {
  connected: boolean;
  authenticated: boolean;
  cachedPairs: number;
  lastUpdate: number;
  reconnectAttempts: number;
} {
  return {
    connected: ws !== null && ws.readyState === WebSocket.OPEN,
    authenticated: isAuthenticated,
    cachedPairs: priceCache.size,
    lastUpdate: lastUpdateTime,
    reconnectAttempts,
  };
}

/**
 * Update cache with price from REST API (fallback)
 */
export function updateCacheFromRest(symbol: ForexSymbol, quote: Omit<StreamingPriceQuote, 'source'>): void {
  priceCache.set(symbol, { ...quote, source: 'rest' });
  lastUpdateTime = Date.now();
}

/**
 * Close WebSocket connection
 */
export function closeWebSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  isConnecting = false;
  isAuthenticated = false;
  console.log('🔌 WebSocket connection closed');
}

// NOTE: Auto-init disabled - WebSocket requires paid Massive.com plan
// Enable this manually after confirming your plan supports WebSocket
// Error code 1008 = "Policy Violation" typically means WebSocket not available on your plan
//
// To enable manually, call initializeWebSocket() from your code or Inngest job
// if (typeof window === 'undefined' && MASSIVE_API_KEY) {
//   setTimeout(() => {
//     console.log('🚀 Auto-initializing WebSocket price streamer...');
//     initializeWebSocket();
//   }, 2000);
// }

