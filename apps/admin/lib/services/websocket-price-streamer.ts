/**
 * WebSocket Price Streamer for Massive.com
 * 
 * Documentation:
 * - https://massive.com/docs/websocket/quickstart
 * - https://massive.com/docs/websocket/forex/quotes
 * - https://massive.com/docs/websocket/forex/aggregates-per-second
 * 
 * Benefits:
 * - Real-time price updates (sub-second latency)
 * - Single connection for all forex pairs
 * - Reduces API calls to zero after connection
 */

import { ForexSymbol, FOREX_PAIRS } from './pnl-calculator.service';

export interface StreamingPriceQuote {
  symbol: ForexSymbol;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
  source: 'websocket' | 'rest' | 'cache' | 'fallback';
}

// Global price cache
const priceCache = new Map<ForexSymbol, StreamingPriceQuote>();
let lastUpdateTime = 0;

// Dynamic spread cache - learns from real bid/ask data
// NOT hardcoded - populated from actual WebSocket quote messages!
const dynamicSpreadCache = new Map<ForexSymbol, number>();

// WebSocket state
let ws: import('ws').WebSocket | null = null;
let isConnecting = false;
let isAuthenticated = false;
let isSubscribed = false;
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

// Configuration
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const WS_URL = 'wss://socket.massive.com/forex'; // Real-time
// const WS_URL = 'wss://delayed.massive.com/forex'; // 15-min delayed (if needed)
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 30000;

// Symbol mapping: Our format (EUR/USD) -> Massive format (EURUSD)
const SYMBOL_TO_MASSIVE: Record<string, string> = {
  'EUR/USD': 'EURUSD', 'GBP/USD': 'GBPUSD', 'USD/JPY': 'USDJPY',
  'USD/CHF': 'USDCHF', 'AUD/USD': 'AUDUSD', 'USD/CAD': 'USDCAD',
  'NZD/USD': 'NZDUSD', 'EUR/GBP': 'EURGBP', 'EUR/JPY': 'EURJPY',
  'EUR/CHF': 'EURCHF', 'EUR/AUD': 'EURAUD', 'EUR/CAD': 'EURCAD',
  'EUR/NZD': 'EURNZD', 'GBP/JPY': 'GBPJPY', 'GBP/CHF': 'GBPCHF',
  'GBP/AUD': 'GBPAUD', 'GBP/CAD': 'GBPCAD', 'GBP/NZD': 'GBPNZD',
  'AUD/JPY': 'AUDJPY', 'AUD/CHF': 'AUDCHF', 'AUD/CAD': 'AUDCAD',
  'AUD/NZD': 'AUDNZD', 'CAD/JPY': 'CADJPY', 'CAD/CHF': 'CADCHF',
  'CHF/JPY': 'CHFJPY', 'NZD/JPY': 'NZDJPY', 'NZD/CHF': 'NZDCHF',
  'NZD/CAD': 'NZDCAD', 'USD/MXN': 'USDMXN', 'USD/ZAR': 'USDZAR',
  'USD/TRY': 'USDTRY', 'USD/SEK': 'USDSEK', 'USD/NOK': 'USDNOK',
};

// Reverse mapping: Massive format -> Our format
const MASSIVE_TO_SYMBOL: Record<string, ForexSymbol> = {};
for (const [symbol, massive] of Object.entries(SYMBOL_TO_MASSIVE)) {
  MASSIVE_TO_SYMBOL[massive] = symbol as ForexSymbol;
}

/**
 * Initialize WebSocket connection
 */
export async function initializeWebSocket(): Promise<void> {
  // Only run on server
  if (typeof window !== 'undefined') {
    console.warn('⚠️ WebSocket streamer only runs on server');
    return;
  }

  if (!MASSIVE_API_KEY) {
    console.error('❌ MASSIVE_API_KEY not set - WebSocket disabled');
    return;
  }

  if (ws || isConnecting) {
    console.log('🔄 WebSocket already connected or connecting');
    return;
  }

  await connectWebSocket();
}

/**
 * Connect to Massive.com WebSocket
 */
async function connectWebSocket(): Promise<void> {
  if (isConnecting) return;
  isConnecting = true;

  console.log('🔌 Connecting to Massive.com WebSocket...');

  try {
    // Dynamic import ws module (only on server)
    const WebSocket = (await import('ws')).default;
    
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      isConnecting = false;
      reconnectAttempts = 0;
      
      // Start heartbeat to keep connection alive
      startHeartbeat();
      
      // Server sends a welcome message first, then we authenticate
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = data.toString();
        handleMessage(message);
      } catch (err) {
        console.error('❌ Error handling message:', err);
      }
    });

    ws.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason.toString() || 'No reason';
      console.log(`🔌 WebSocket closed: ${code} - ${reasonStr}`);
      
      cleanup();
      scheduleReconnect();
    });

    ws.on('ping', () => {
      ws?.pong();
    });

  } catch (error) {
    console.error('❌ Failed to create WebSocket:', error);
    isConnecting = false;
    scheduleReconnect();
  }
}

/**
 * Start heartbeat to keep connection alive
 */
function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === 1) { // OPEN
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat
 */
function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Authenticate with API key
 */
function authenticate(): void {
  if (!ws || ws.readyState !== 1) return;

  console.log('🔐 Authenticating...');
  
  // Send auth message
  // Format: {"action":"auth","params":"YOUR_API_KEY"}
  ws.send(JSON.stringify({
    action: 'auth',
    params: MASSIVE_API_KEY,
  }));
}

/**
 * Subscribe to forex feeds
 */
function subscribeToFeeds(): void {
  if (!ws || ws.readyState !== 1 || !isAuthenticated) return;

  console.log('📊 Subscribing to forex feeds...');
  
  // Subscribe to:
  // - C.* = All forex quotes (bid/ask)
  // - CAS.* = All forex second aggregates (OHLC per second)
  // Format: {"action":"subscribe","params":"C.*,CAS.*"}
  
  ws.send(JSON.stringify({
    action: 'subscribe',
    params: 'C.*,CAS.*', // All forex quotes and second aggregates
  }));
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(data: string): void {
  try {
    // Massive.com can send arrays of messages
    const parsed = JSON.parse(data);
    const messages = Array.isArray(parsed) ? parsed : [parsed];

    for (const msg of messages) {
      // Check event type
      const eventType = msg.ev || msg.status;

      switch (eventType) {
        case 'status':
          handleStatusMessage(msg);
          break;
        case 'connected':
          // Initial connection message - now authenticate
          console.log('📡 Received connected status');
          authenticate();
          break;
        case 'C':
          // Forex Quote: {"ev":"C","p":"EUR-USD","x":1,"a":1.0510,"b":1.0509,"t":1234567890}
          handleQuoteMessage(msg);
          break;
        case 'CA':
          // Forex Aggregate (minute): {"ev":"CA","pair":"EUR-USD","o":1.05,"h":1.051,"l":1.049,"c":1.0505}
          handleAggregateMessage(msg);
          break;
        case 'CAS':
          // Forex Aggregate (second): same format as CA but per second
          handleAggregateMessage(msg);
          break;
        case 'auth_success':
          console.log('✅ Authentication successful');
          isAuthenticated = true;
          subscribeToFeeds();
          break;
        case 'auth_failed':
          console.error('❌ Authentication failed:', msg.message);
          ws?.close();
          break;
        default:
          // Check if it's a status update
          if (msg.status === 'auth_success') {
            console.log('✅ Authentication successful');
            isAuthenticated = true;
            subscribeToFeeds();
          } else if (msg.status === 'success' && msg.message?.includes('subscribed')) {
            console.log('✅ Subscribed to feeds:', msg.message);
            isSubscribed = true;
          } else if (msg.message) {
            console.log('📨 Server message:', msg.message);
          }
      }
    }
  } catch (error) {
    // Sometimes Massive sends non-JSON status messages
    if (data.includes('connected')) {
      console.log('📡 Connected to Massive.com');
      authenticate();
    }
  }
}

/**
 * Handle status messages
 */
function handleStatusMessage(msg: { status?: string; message?: string; ev?: string }): void {
  const status = msg.status || msg.ev;
  
  if (status === 'auth_success') {
    console.log('✅ Authenticated with Massive.com');
    isAuthenticated = true;
    subscribeToFeeds();
  } else if (status === 'auth_failed') {
    console.error('❌ Auth failed:', msg.message);
    ws?.close();
  } else if (status === 'connected') {
    console.log('📡 Connected, authenticating...');
    authenticate();
  } else if (msg.message?.includes('subscribed')) {
    console.log('✅ Subscription confirmed');
    isSubscribed = true;
  }
}

/**
 * Handle forex quote messages
 * Format: {"ev":"C","p":"EUR-USD","x":1,"a":1.0510,"b":1.0509,"t":1702000000000}
 * OR: {"ev":"C","pair":"EURUSD","a":1.0510,"b":1.0509,"t":1702000000000}
 */
function handleQuoteMessage(msg: {
  ev: string;
  p?: string;      // pair like "EUR-USD"
  pair?: string;   // pair like "EURUSD"
  a?: number;      // ask
  b?: number;      // bid
  t?: number;      // timestamp (milliseconds)
  x?: number;      // exchange
}): void {
  // Get symbol - handle different formats
  let symbolKey = msg.p || msg.pair || '';
  
  // Handle different formats: "EUR-USD", "EUR/USD", "EURUSD"
  symbolKey = symbolKey.replace('-', '').replace('/', '').toUpperCase();
  
  const symbol = MASSIVE_TO_SYMBOL[symbolKey];
  if (!symbol) {
    // Unknown symbol, skip
    return;
  }

  const bid = msg.b;
  const ask = msg.a;
  
  if (bid === undefined || ask === undefined) return;

  // CRITICAL: Validate bid < ask (reject invalid data)
  if (bid >= ask) {
    console.warn(`⚠️ Invalid quote for ${symbol}: bid (${bid}) >= ask (${ask}) - skipping`);
    return;
  }

  const mid = (bid + ask) / 2;
  const spread = ask - bid;

  // Round values
  const roundedBid = Number(bid.toFixed(5));
  const roundedAsk = Number(ask.toFixed(5));
  const roundedMid = Number(mid.toFixed(5));
  const roundedSpread = Number(spread.toFixed(5));

  // CRITICAL: Ensure mid is between bid and ask after rounding
  const safeMid = Math.max(roundedBid, Math.min(roundedAsk, roundedMid));

  // Cache the spread with basic smoothing to prevent wild jumps
  if (spread > 0) {
    const currentSpread = dynamicSpreadCache.get(symbol);
    if (currentSpread) {
      // Check for unrealistic spread change (> 5x jump = likely bad data)
      const ratio = Math.max(spread / currentSpread, currentSpread / spread);
      if (ratio > 5) {
        // Apply small weight to suspicious data (10%)
        const smoothedSpread = currentSpread * 0.9 + spread * 0.1;
        dynamicSpreadCache.set(symbol, smoothedSpread);
      } else {
        // Normal update with slight smoothing (30% new, 70% old)
        const smoothedSpread = currentSpread * 0.7 + spread * 0.3;
        dynamicSpreadCache.set(symbol, smoothedSpread);
      }
    } else {
      // First spread for this symbol
      dynamicSpreadCache.set(symbol, spread);
    }
  }

  const quote: StreamingPriceQuote = {
    symbol,
    bid: roundedBid,
    ask: roundedAsk,
    mid: safeMid,
    spread: roundedSpread,
    timestamp: msg.t || Date.now(),
    source: 'websocket',
  };

  priceCache.set(symbol, quote);
  lastUpdateTime = Date.now();
}

/**
 * Handle aggregate messages (per-second or per-minute bars)
 * Format: {"ev":"CA","pair":"EUR-USD","o":1.05,"h":1.051,"l":1.049,"c":1.0505,"v":1000,"s":..,"e":..}
 */
function handleAggregateMessage(msg: {
  ev: string;
  pair?: string;
  p?: string;
  o?: number;      // open
  h?: number;      // high
  l?: number;      // low
  c?: number;      // close
  v?: number;      // volume
  s?: number;      // start timestamp
  e?: number;      // end timestamp
}): void {
  let symbolKey = msg.pair || msg.p || '';
  symbolKey = symbolKey.replace('-', '').replace('/', '').toUpperCase();
  
  const symbol = MASSIVE_TO_SYMBOL[symbolKey];
  if (!symbol || msg.c === undefined) return;

  // Use close price to derive bid/ask with typical spread
  const mid = msg.c;
  const spread = getTypicalSpread(symbol);
  const bid = mid - spread / 2;
  const ask = mid + spread / 2;

  // Round values
  const roundedBid = Number(bid.toFixed(5));
  const roundedAsk = Number(ask.toFixed(5));
  const roundedMid = Number(mid.toFixed(5));
  const roundedSpread = Number(spread.toFixed(5));

  // CRITICAL: Ensure mid is between bid and ask after rounding
  const safeMid = Math.max(roundedBid, Math.min(roundedAsk, roundedMid));

  const quote: StreamingPriceQuote = {
    symbol,
    bid: roundedBid,
    ask: roundedAsk,
    mid: safeMid,
    spread: roundedSpread,
    timestamp: msg.e || msg.s || Date.now(),
    source: 'websocket',
  };

  // Only update if we don't have a more recent quote
  const existing = priceCache.get(symbol);
  if (!existing || existing.timestamp <= quote.timestamp) {
    priceCache.set(symbol, quote);
    lastUpdateTime = Date.now();
  }
}

/**
 * Get spread for a forex pair - DYNAMIC, not hardcoded!
 * Priority: 1) Cached real spread from quote messages 2) Smart default based on pair type
 * Used when aggregate messages only provide close price
 */
function getTypicalSpread(symbol: ForexSymbol): number {
  // First: Try to use cached spread from actual quote messages
  const cachedSpread = dynamicSpreadCache.get(symbol);
  if (cachedSpread && cachedSpread > 0) {
    return cachedSpread;
  }
  
  // Second: Use smart default based on pair type (only until we get real data)
  const pairConfig = FOREX_PAIRS[symbol];
  if (!pairConfig) {
    return 0.0002; // Conservative default for unknown pairs
  }
  
  const pip = pairConfig.pip;
  
  // Determine pair type and use reasonable defaults
  const majorPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
  const exoticPairs = ['USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK'];
  
  let defaultPips: number;
  if (majorPairs.includes(symbol)) {
    defaultPips = 1.5; // Major pairs: ~1.5 pips
  } else if (exoticPairs.includes(symbol)) {
    defaultPips = 40; // Exotic pairs: ~40 pips
  } else {
    defaultPips = 3; // Cross pairs: ~3 pips
  }
  
  return defaultPips * pip;
}

/**
 * Cleanup resources
 */
function cleanup(): void {
  ws = null;
  isConnecting = false;
  isAuthenticated = false;
  isSubscribed = false;
  stopHeartbeat();
}

/**
 * Schedule reconnection
 */
function scheduleReconnect(): void {
  if (reconnectTimer) return;

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('❌ Max reconnect attempts reached');
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_BASE_DELAY_MS * Math.pow(1.5, reconnectAttempts - 1);

  console.log(`🔄 Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, delay);
}

// ============================================
// Public API
// ============================================

/**
 * Normalize a price quote - ensures mid = (bid + ask) / 2
 * Prevents mid from lagging behind bid/ask updates
 */
function normalizeQuote(quote: StreamingPriceQuote): StreamingPriceQuote {
  const mid = (quote.bid + quote.ask) / 2;
  const spread = quote.ask - quote.bid;
  const safeMid = Math.max(quote.bid, Math.min(quote.ask, mid));
  
  return {
    ...quote,
    mid: Number(safeMid.toFixed(5)),
    spread: Number(Math.abs(spread).toFixed(5)),
  };
}

/**
 * Get cached price for a symbol (normalized)
 */
export function getCachedPrice(symbol: ForexSymbol): StreamingPriceQuote | null {
  const cached = priceCache.get(symbol);
  return cached ? normalizeQuote(cached) : null;
}

/**
 * Get all cached prices (normalized)
 */
export function getAllCachedPrices(): Map<ForexSymbol, StreamingPriceQuote> {
  const result = new Map<ForexSymbol, StreamingPriceQuote>();
  priceCache.forEach((quote, symbol) => {
    result.set(symbol, normalizeQuote(quote));
  });
  return result;
}

/**
 * Get multiple cached prices (normalized)
 */
export function getCachedPrices(symbols: ForexSymbol[]): Map<ForexSymbol, StreamingPriceQuote> {
  const result = new Map<ForexSymbol, StreamingPriceQuote>();
  for (const symbol of symbols) {
    const cached = priceCache.get(symbol);
    if (cached) {
      result.set(symbol, normalizeQuote(cached));
    }
  }
  return result;
}

/**
 * Check if WebSocket is connected and streaming
 */
export function isWebSocketConnected(): boolean {
  return ws !== null && ws.readyState === 1 && isAuthenticated;
}

/**
 * Get WebSocket status
 */
export function getConnectionStatus(): {
  connected: boolean;
  authenticated: boolean;
  subscribed: boolean;
  cachedPairs: number;
  lastUpdate: number;
  reconnectAttempts: number;
} {
  return {
    connected: ws !== null && ws.readyState === 1,
    authenticated: isAuthenticated,
    subscribed: isSubscribed,
    cachedPairs: priceCache.size,
    lastUpdate: lastUpdateTime,
    reconnectAttempts,
  };
}

/**
 * Update cache from REST API (fallback)
 */
export function updateCacheFromRest(symbol: ForexSymbol, quote: Omit<StreamingPriceQuote, 'source'>): void {
  // Only update if WebSocket hasn't provided a more recent price
  const existing = priceCache.get(symbol);
  if (!existing || existing.source !== 'websocket' || existing.timestamp < quote.timestamp) {
    priceCache.set(symbol, { ...quote, source: 'rest' });
    lastUpdateTime = Date.now();
  }
}

/**
 * Close WebSocket connection
 */
export function closeWebSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  stopHeartbeat();

  if (ws) {
    try {
      ws.close(1000, 'Client closing');
    } catch {
      // Ignore close errors
    }
    ws = null;
  }

  cleanup();
  console.log('🔌 WebSocket closed');
}

/**
 * Reset and reconnect
 */
export function resetWebSocket(): void {
  closeWebSocket();
  reconnectAttempts = 0;
  initializeWebSocket();
}
