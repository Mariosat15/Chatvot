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
import Candle1m from '@/database/models/candle-1m.model';
import { connectToDatabase } from '@/database/mongoose';
import { getHistoricalModel } from '@/database/models/candle-historical.model';

export interface StreamingPriceQuote {
  symbol: ForexSymbol;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
  source: 'websocket' | 'rest' | 'cache' | 'fallback';
}

// ============================================
// GLOBAL SINGLETON STATE (survives Next.js HMR)
// ============================================
// IMPORTANT: In Turbopack, different server contexts may have different globalThis
// We use a STRICT singleton pattern with connection state tracking
// The priceCache/dynamicSpreadCache are per-context but that's OK - they get populated from WebSocket

// Structure for forming candles (current minute being built)
export interface FormingCandle {
  symbol: string;
  time: number;    // Unix timestamp in SECONDS (start of minute)
  open: number;
  high: number;
  low: number;
  close: number;
  tickCount: number;
}

// Symbol settings for fixed spread (loaded from database)
interface SymbolSpreadSettings {
  useFixedSpread: boolean;
  defaultSpread: number;  // in pips
  pip: number;            // pip value (0.0001 or 0.01)
}

// Completed 1m candle for buffering (used to build 5m forming candles)
interface CompletedCandle {
  symbol: string;
  time: number;    // Unix timestamp in SECONDS
  open: number;
  high: number;
  low: number;
  close: number;
}

// Cached forming candle for higher timeframes (updated incrementally)
interface CachedFormingCandle {
  symbol: string;
  periodStart: number;  // Unix timestamp in SECONDS (start of period)
  open: number;
  high: number;
  low: number;
  close: number;
}

interface WebSocketGlobalState {
  ws: import('ws').WebSocket | null;
  isConnecting: boolean;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
  heartbeatTimer: NodeJS.Timeout | null;
  priceCache: Map<ForexSymbol, StreamingPriceQuote>;
  dynamicSpreadCache: Map<ForexSymbol, number>;
  symbolSpreadSettings: Map<string, SymbolSpreadSettings>; // Fixed spread settings per symbol
  formingCandles: Map<string, FormingCandle>; // Current minute candles being built
  completedCandlesBuffer: Map<string, CompletedCandle[]>; // Recent completed 1m candles per symbol (for 5m aggregation)
  // Cached forming candles for higher timeframes (updated incrementally, not recalculated)
  formingCandles5m: Map<string, CachedFormingCandle>;
  formingCandles15m: Map<string, CachedFormingCandle>;
  formingCandles30m: Map<string, CachedFormingCandle>;
  formingCandles1h: Map<string, CachedFormingCandle>;
  formingCandles4h: Map<string, CachedFormingCandle>;
  formingCandlesD: Map<string, CachedFormingCandle>;
  formingCandlesW: Map<string, CachedFormingCandle>;
  formingCandlesM: Map<string, CachedFormingCandle>;
  changedSymbols: Set<string>; // Track symbols that changed since last broadcast
  lastUpdateTime: number;
  initialized: boolean;
  connectionId: string;
  initializationTime: number; // Track when this context was initialized
}

// Use globalThis to persist state across HMR in Next.js
const GLOBAL_KEY = '__MASSIVE_WEBSOCKET_SINGLETON__';

// Track if THIS context has already logged initialization (reduce log spam)
let hasLoggedInit = false;

function getGlobalState(): WebSocketGlobalState {
  if (!(globalThis as Record<string, unknown>)[GLOBAL_KEY]) {
    // Only log once per context to reduce spam
    if (!hasLoggedInit) {
      console.log('🔧 [WebSocket] Initializing WebSocket state');
      hasLoggedInit = true;
    }
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = {
      ws: null,
      isConnecting: false,
      isAuthenticated: false,
      isSubscribed: false,
      reconnectAttempts: 0,
      reconnectTimer: null,
      heartbeatTimer: null,
      priceCache: new Map<ForexSymbol, StreamingPriceQuote>(),
      dynamicSpreadCache: new Map<ForexSymbol, number>(),
      symbolSpreadSettings: new Map<string, SymbolSpreadSettings>(),
      formingCandles: new Map<string, FormingCandle>(),
      completedCandlesBuffer: new Map<string, CompletedCandle[]>(), // For 5m aggregation
      formingCandles5m: new Map<string, CachedFormingCandle>(),
      formingCandles15m: new Map<string, CachedFormingCandle>(),
      formingCandles30m: new Map<string, CachedFormingCandle>(),
      formingCandles1h: new Map<string, CachedFormingCandle>(),
      formingCandles4h: new Map<string, CachedFormingCandle>(),
      formingCandlesD: new Map<string, CachedFormingCandle>(),
      formingCandlesW: new Map<string, CachedFormingCandle>(),
      formingCandlesM: new Map<string, CachedFormingCandle>(),
      changedSymbols: new Set<string>(),
      lastUpdateTime: 0,
      initialized: false,
      connectionId: Math.random().toString(36).substring(7),
      initializationTime: Date.now(),
    };
  }
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as WebSocketGlobalState;
}

// Helper accessor for cleaner code
function getState() { return getGlobalState(); }

// Price caches reference the global state
const priceCache = getGlobalState().priceCache;
const dynamicSpreadCache = getGlobalState().dynamicSpreadCache;

// Configuration
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const WS_URL = 'wss://socket.massive.com/forex'; // Real-time
// const WS_URL = 'wss://delayed.massive.com/forex'; // 15-min delayed (if needed)
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 30000;

// ⚡ Real-time TP/SL checking - throttled per symbol
const lastTPSLCheck = new Map<string, number>();
const TPSL_CHECK_THROTTLE_MS = 500; // Check max every 500ms per symbol

// 📦 MongoDB Price Cache - for sharing prices with Worker
// Batches price updates and writes to MongoDB periodically
const pendingPriceUpdates = new Map<string, { bid: number; ask: number; timestamp: number }>();
let mongoPriceWriteTimer: NodeJS.Timeout | null = null;
const MONGO_PRICE_WRITE_INTERVAL_MS = 1000; // Write to MongoDB every 1 second (batched)

/**
 * Check TP/SL when price updates - throttled to prevent resource overload
 * This is the INSTANT trigger - worker is just backup
 */
function checkTPSLOnPriceUpdate(symbol: ForexSymbol, bid: number, ask: number): void {
  const now = Date.now();
  const lastCheck = lastTPSLCheck.get(symbol) || 0;
  
  // Throttle checks per symbol (500ms minimum between checks)
  if (now - lastCheck < TPSL_CHECK_THROTTLE_MS) return;
  lastTPSLCheck.set(symbol, now);
  
  // Fire and forget - don't block price updates
  import('./tpsl-realtime.service')
    .then(({ checkTPSLForSymbol }) => checkTPSLForSymbol(symbol, bid, ask))
    .catch(() => {
      // Silently ignore - worker will catch it
    });
}

/**
 * Queue price update for MongoDB cache (batched writes)
 * Called on every price update, but only writes to MongoDB periodically
 */
function queuePriceForMongoCache(symbol: string, bid: number, ask: number, timestamp: number): void {
  pendingPriceUpdates.set(symbol, { bid, ask, timestamp });
  
  // Start write timer if not already running
  if (!mongoPriceWriteTimer) {
    mongoPriceWriteTimer = setTimeout(flushPricesToMongo, MONGO_PRICE_WRITE_INTERVAL_MS);
  }
}

/**
 * Flush pending price updates to MongoDB (batched)
 * This writes all queued prices in a single bulk operation
 */
async function flushPricesToMongo(): Promise<void> {
  mongoPriceWriteTimer = null;
  
  if (pendingPriceUpdates.size === 0) return;
  
  // Copy and clear pending updates
  const updates = Array.from(pendingPriceUpdates.entries()).map(([symbol, data]) => ({
    symbol,
    bid: data.bid,
    ask: data.ask,
    timestamp: data.timestamp,
  }));
  pendingPriceUpdates.clear();
  
  try {
    // Dynamic import to avoid circular dependencies
    const { connectToDatabase } = await import('@/database/mongoose');
    const PriceCache = (await import('@/database/models/price-cache.model')).default;
    
    await connectToDatabase();
    await PriceCache.bulkUpdatePrices(updates);
    
    // Debug: Log occasionally (every ~10 seconds)
    if (Math.random() < 0.1) {
      // Log only occasionally (1% of writes)
      if (Math.random() < 0.01) {
        console.log(`📦 MongoDB cache: ${updates.length} prices`);
      }
    }
  } catch (error) {
    // Don't log every error - just occasionally
    if (Math.random() < 0.1) {
      console.error('⚠️ [MongoDB Cache] Failed to write prices:', error);
    }
  }
}

/**
 * Load symbol spread settings from database
 * Called periodically to pick up admin changes
 */
let symbolSettingsLoaded = false;
let symbolSettingsLoadTime = 0;
const SYMBOL_SETTINGS_CACHE_MS = 60000; // Reload every 60 seconds

async function loadSymbolSpreadSettings(): Promise<void> {
  const now = Date.now();
  
  // Skip if recently loaded
  if (symbolSettingsLoaded && now - symbolSettingsLoadTime < SYMBOL_SETTINGS_CACHE_MS) {
    return;
  }
  
  try {
    const { connectToDatabase } = await import('@/database/mongoose');
    const mongoose = await import('mongoose');
    
    await connectToDatabase();
    
    // Get TradingSymbol collection directly (it's in the main database)
    const db = mongoose.default.connection.db;
    if (!db) {
      return;
    }
    
    // Try different collection names
    let symbols: unknown[] = [];
    const tryCollections = ['tradingsymbols', 'TradingSymbols', 'trading_symbols'];
    
    for (const collName of tryCollections) {
      try {
        symbols = await db.collection(collName).find({}).toArray();
        if (symbols.length > 0) {
          break;
        }
      } catch {
        // Collection doesn't exist, try next
      }
    }
    
    if (symbols.length === 0) {
      console.warn(`⚠️ [Symbol Settings] No symbols found in any collection`);
      return;
    }
    
    const state = getState();
    for (const sym of symbols as Record<string, unknown>[]) {
      if (sym.symbol) {
        state.symbolSpreadSettings.set(sym.symbol as string, {
          useFixedSpread: (sym.useFixedSpread as boolean) || false,
          defaultSpread: (sym.defaultSpread as number) || 1.5,
          pip: (sym.pip as number) || 0.0001,
        });
        
      }
    }
    
    symbolSettingsLoaded = true;
    symbolSettingsLoadTime = now;
  } catch (error) {
    // ALWAYS log errors for debugging
    console.error('⚠️ [Symbol Settings] Failed to load:', error);
  }
}

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
 * Initialize WebSocket connection and TP/SL cache
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

  const state = getState();
  const existingWs = state.ws;
  
  // Check if we already have an active connection
  if (existingWs && existingWs.readyState <= 1) { // CONNECTING (0) or OPEN (1)
    console.log(`🔄 WebSocket already ${existingWs.readyState === 1 ? 'connected' : 'connecting'} (ID: ${state.connectionId})`);
    return;
  }
  
  if (state.isConnecting) {
    console.log(`🔄 WebSocket connection already in progress (ID: ${state.connectionId})`);
    return;
  }

  // ⚡ Initialize TP/SL cache for real-time triggering
  try {
    const { initializeTPSLCache } = await import('./tpsl-realtime.service');
    await initializeTPSLCache();
  } catch (error) {
    console.error('⚠️ Failed to initialize TP/SL cache:', error);
  }

  await connectWebSocket();
}

/**
 * Connect to Massive.com WebSocket
 */
async function connectWebSocket(): Promise<void> {
  const state = getState();
  
  if (state.isConnecting) return;
  state.isConnecting = true;

  // Generate new connection ID for debugging
  state.connectionId = Math.random().toString(36).substring(7);
  console.log(`🔌 Connecting to Massive.com WebSocket... (ID: ${state.connectionId})`);

  try {
    // Dynamic import ws module (only on server)
    const WebSocket = (await import('ws')).default;
    
    const newWs = new WebSocket(WS_URL);
    state.ws = newWs;

    newWs.on('open', () => {
      console.log(`✅ WebSocket connected (ID: ${state.connectionId})`);
      state.isConnecting = false;
      state.reconnectAttempts = 0;
      
      // Start heartbeat to keep connection alive
      startHeartbeat();
      
      // Server sends a welcome message first, then we authenticate
    });

    newWs.on('message', (data: Buffer) => {
      try {
        const message = data.toString();
        handleMessage(message);
      } catch (err) {
        console.error('❌ Error handling message:', err);
      }
    });

    newWs.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    newWs.on('close', (code: number, reason: Buffer) => {
      const reasonStr = reason.toString() || 'No reason';
      console.log(`🔌 WebSocket closed: ${code} - ${reasonStr} (ID: ${state.connectionId})`);
      
      cleanup();
      scheduleReconnect();
    });

    newWs.on('ping', () => {
      newWs.pong();
    });

  } catch (error) {
    console.error('❌ Failed to create WebSocket:', error);
    state.isConnecting = false;
    scheduleReconnect();
  }
}

/**
 * Start heartbeat to keep connection alive
 */
function startHeartbeat(): void {
  const state = getState();
  stopHeartbeat();
  state.heartbeatTimer = setInterval(() => {
    const ws = state.ws;
    if (ws && ws.readyState === 1) { // OPEN
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat
 */
function stopHeartbeat(): void {
  const state = getState();
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

/**
 * Authenticate with API key
 */
function authenticate(): void {
  const state = getState();
  const ws = state.ws;
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
  const state = getState();
  const ws = state.ws;
  if (!ws || ws.readyState !== 1 || !state.isAuthenticated) return;

  console.log('📊 Subscribing to forex feeds...');
  
  // Subscribe to:
  // - C.* = All forex quotes (bid/ask)
  // - CAS.* = All forex second aggregates (OHLC per second)
  // - CA.* = All forex MINUTE aggregates (OHLC per minute) - FOR SERVER CANDLE STORAGE!
  // Format: {"action":"subscribe","params":"C.*,CAS.*,CA.*"}
  
  ws.send(JSON.stringify({
    action: 'subscribe',
    params: 'C.*,CAS.*,CA.*', // All forex quotes + second aggregates + MINUTE aggregates
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
          // NOTE: We NO LONGER save CA.* to MongoDB!
          // Our server builds candles from C.* quotes instead (for consistency)
          // CA.* is only used for price updates now
          handleAggregateMessage(msg, false);  // false = don't save to MongoDB
          break;
        case 'CAS':
          // Forex Aggregate (second): same format as CA but per second
          // Note: We DON'T save CAS to MongoDB - only CA (minute) aggregates
          handleAggregateMessage(msg, false);  // false = is second aggregate, don't save
          break;
        case 'auth_success': {
          const state = getState();
          console.log('✅ Authentication successful');
          state.isAuthenticated = true;
          subscribeToFeeds();
          break;
        }
        case 'auth_failed': {
          const state = getState();
          console.error('❌ Authentication failed:', msg.message);
          state.ws?.close();
          break;
        }
        default: {
          const state = getState();
          // Check if it's a status update
          if (msg.status === 'auth_success') {
            console.log('✅ Authentication successful');
            state.isAuthenticated = true;
            subscribeToFeeds();
          } else if (msg.status === 'success' && msg.message?.includes('subscribed')) {
            console.log('✅ Subscribed to feeds:', msg.message);
            state.isSubscribed = true;
          } else if (msg.message) {
            console.log('📨 Server message:', msg.message);
          }
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
  const state = getState();
  const status = msg.status || msg.ev;
  
  if (status === 'auth_success') {
    console.log('✅ Authenticated with Massive.com');
    state.isAuthenticated = true;
    subscribeToFeeds();
  } else if (status === 'auth_failed') {
    console.error('❌ Auth failed:', msg.message);
    state.ws?.close();
  } else if (status === 'connected') {
    console.log('📡 Connected, authenticating...');
    authenticate();
  } else if (msg.message?.includes('subscribed')) {
    console.log('✅ Subscription confirmed');
    state.isSubscribed = true;
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

  const rawBid = msg.b;
  const rawAsk = msg.a;
  
  if (rawBid === undefined || rawAsk === undefined) return;

  // CRITICAL: Validate bid < ask (reject invalid data silently)
  if (rawBid >= rawAsk) {
    return; // Skip invalid quotes without logging
  }

  // Calculate mid price (always from real data)
  const mid = (rawBid + rawAsk) / 2;
  
  // Load symbol settings periodically (non-blocking)
  loadSymbolSpreadSettings().catch(() => {});
  
  // Check if fixed spread is enabled for this symbol
  const state = getState();
  const spreadSettings = state.symbolSpreadSettings.get(symbol);
  
  let bid: number;
  let ask: number;
  let spread: number;
  
  if (spreadSettings?.useFixedSpread) {
    // FIXED SPREAD: Calculate bid/ask from mid using admin-defined spread
    const halfSpread = (spreadSettings.defaultSpread * spreadSettings.pip) / 2;
    bid = mid - halfSpread;
    ask = mid + halfSpread;
    spread = spreadSettings.defaultSpread * spreadSettings.pip;
    
    // Debug log (occasionally)
    if (Math.random() < 0.01) {
      // Fixed spread applied (no logging - too noisy)
    }
  } else {
    // VARIABLE SPREAD: Use raw bid/ask from Massive.com
    bid = rawBid;
    ask = rawAsk;
    spread = rawAsk - rawBid;
  }

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
  getState().lastUpdateTime = Date.now();
  
  // ⚡ REAL-TIME TP/SL CHECK - Triggers INSTANTLY when price hits levels!
  // This is fire-and-forget, doesn't block price updates
  checkTPSLOnPriceUpdate(symbol, roundedBid, roundedAsk);
  
  // 📦 Queue price for MongoDB cache (Worker reads from here)
  queuePriceForMongoCache(symbol, roundedBid, roundedAsk, quote.timestamp);
  
  // 🕯️ UPDATE FORMING CANDLE using BID price (like MT4/MT5)
  // This ensures candle close = BID line, candles never go above ASK line
  updateFormingCandle(symbol, roundedBid);
}

/**
 * Update the forming candle for a symbol using BID price
 * 
 * WHY BID PRICE? (Like MT4/MT5 and professional brokers)
 * - Candle O/H/L/C = BID prices
 * - BID line matches candle close exactly
 * - ASK line = BID + spread (always above candle)
 * - Candles never go above ASK line
 * - All users see identical charts (server is single source of truth)
 * 
 * When a new minute starts, SAVE the completed candle to MongoDB
 */
function updateFormingCandle(symbol: ForexSymbol, bidPrice: number): void {
  const state = getState();
  const now = Date.now();
  
  // Get current minute timestamp (floored to minute boundary) in SECONDS
  const minuteTime = Math.floor(now / 60000) * 60;
  
  const existing = state.formingCandles.get(symbol);
  
  if (!existing || existing.time !== minuteTime) {
    // New minute started!
    
    // SAVE the previous forming candle to MongoDB (if it exists and has ticks)
    if (existing && existing.tickCount > 0) {
      saveCompletedCandleToMongoDB(existing);
    }
    
    // Create new forming candle for the new minute
    state.formingCandles.set(symbol, {
      symbol,
      time: minuteTime,
      open: bidPrice,
      high: bidPrice,
      low: bidPrice,
      close: bidPrice,
      tickCount: 1,
    });
  } else {
    // Same minute - update OHLC from BID price
    existing.high = Math.max(existing.high, bidPrice);
    existing.low = Math.min(existing.low, bidPrice);
    existing.close = bidPrice;
    existing.tickCount++;
  }
  
  // Mark symbol as changed for delta broadcast
  state.changedSymbols.add(symbol);
  
  // Update higher timeframe caches (fast - no recalculation)
  updateHigherTimeframeCaches(symbol, bidPrice, minuteTime);
}

/**
 * Update cached forming candles for higher timeframes
 * This is FAST - just updates high/low/close, no iteration needed
 */
function updateHigherTimeframeCaches(symbol: string, price: number, currentTime: number): void {
  const state = getState();
  
  // Update 5m cache
  const period5m = Math.floor(currentTime / 300) * 300; // 5 min = 300 sec
  const existing5m = state.formingCandles5m.get(symbol);
  
  if (!existing5m || existing5m.periodStart !== period5m) {
    // ⭐ SAVE COMPLETED CANDLE before starting new period (if it exists)
    if (existing5m) {
      // Fire and forget - don't block price updates
      saveCompletedHigherTimeframeCandle('5m', { ...existing5m });
    }
    // New 5m period - start fresh
    state.formingCandles5m.set(symbol, {
      symbol,
      periodStart: period5m,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else {
    // Same period - just update high/low/close
    existing5m.high = Math.max(existing5m.high, price);
    existing5m.low = Math.min(existing5m.low, price);
    existing5m.close = price;
  }
  
  // Update 15m cache
  const period15m = Math.floor(currentTime / 900) * 900; // 15 min = 900 sec
  const existing15m = state.formingCandles15m.get(symbol);
  
  if (!existing15m || existing15m.periodStart !== period15m) {
    // ⭐ SAVE COMPLETED CANDLE
    if (existing15m) {
      saveCompletedHigherTimeframeCandle('15m', { ...existing15m });
    }
    // New 15m period - start fresh
    state.formingCandles15m.set(symbol, {
      symbol,
      periodStart: period15m,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else {
    // Same period - just update high/low/close
    existing15m.high = Math.max(existing15m.high, price);
    existing15m.low = Math.min(existing15m.low, price);
    existing15m.close = price;
  }
  
  // Update 30m cache
  const period30m = Math.floor(currentTime / 1800) * 1800; // 30 min = 1800 sec
  const existing30m = state.formingCandles30m.get(symbol);
  
  if (!existing30m || existing30m.periodStart !== period30m) {
    // ⭐ SAVE COMPLETED CANDLE
    if (existing30m) {
      saveCompletedHigherTimeframeCandle('30m', { ...existing30m });
    }
    // New 30m period - start fresh
    state.formingCandles30m.set(symbol, {
      symbol,
      periodStart: period30m,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else {
    // Same period - just update high/low/close
    existing30m.high = Math.max(existing30m.high, price);
    existing30m.low = Math.min(existing30m.low, price);
    existing30m.close = price;
  }
  
  // Update 1h cache
  const period1h = Math.floor(currentTime / 3600) * 3600; // 1 hour = 3600 sec
  const existing1h = state.formingCandles1h.get(symbol);
  
  if (!existing1h || existing1h.periodStart !== period1h) {
    // ⭐ SAVE COMPLETED CANDLE
    if (existing1h) {
      saveCompletedHigherTimeframeCandle('1h', { ...existing1h });
    }
    state.formingCandles1h.set(symbol, {
      symbol,
      periodStart: period1h,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else {
    existing1h.high = Math.max(existing1h.high, price);
    existing1h.low = Math.min(existing1h.low, price);
    existing1h.close = price;
  }
  
  // Update 4h cache
  const period4h = Math.floor(currentTime / 14400) * 14400; // 4 hours = 14400 sec
  const existing4h = state.formingCandles4h.get(symbol);
  
  if (!existing4h || existing4h.periodStart !== period4h) {
    // ⭐ SAVE COMPLETED CANDLE
    if (existing4h) {
      saveCompletedHigherTimeframeCandle('4h', { ...existing4h });
    }
    state.formingCandles4h.set(symbol, {
      symbol,
      periodStart: period4h,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else {
    existing4h.high = Math.max(existing4h.high, price);
    existing4h.low = Math.min(existing4h.low, price);
    existing4h.close = price;
  }
  
  // Update Daily cache (day starts at 00:00 UTC)
  const now = new Date(currentTime * 1000);
  const periodD = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
  const existingD = state.formingCandlesD.get(symbol);
  
  if (!existingD || existingD.periodStart !== periodD) {
    // ⭐ SAVE COMPLETED CANDLE
    if (existingD) {
      saveCompletedHigherTimeframeCandle('1d', { ...existingD });
    }
    state.formingCandlesD.set(symbol, {
      symbol,
      periodStart: periodD,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else {
    existingD.high = Math.max(existingD.high, price);
    existingD.low = Math.min(existingD.low, price);
    existingD.close = price;
  }
  
  // Update Weekly cache (week starts at SUNDAY 00:00 UTC - forex market open)
  // Calculate Sunday 00:00 UTC of the current week
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  // Sunday = 0 days back, Monday = 1 day back, ... Saturday = 6 days back
  const daysFromSunday = dayOfWeek;
  const sundayDate = new Date(now);
  sundayDate.setUTCDate(now.getUTCDate() - daysFromSunday);
  sundayDate.setUTCHours(0, 0, 0, 0);
  const periodW = Math.floor(sundayDate.getTime() / 1000);
  const existingW = state.formingCandlesW.get(symbol);
  
  if (!existingW || existingW.periodStart !== periodW) {
    // ⭐ SAVE COMPLETED CANDLE
    if (existingW) {
      saveCompletedHigherTimeframeCandle('1w', { ...existingW });
    }
    state.formingCandlesW.set(symbol, {
      symbol,
      periodStart: periodW,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else {
    existingW.high = Math.max(existingW.high, price);
    existingW.low = Math.min(existingW.low, price);
    existingW.close = price;
  }
  
  // Update Monthly cache (month starts at 1st day 00:00 UTC)
  const periodM = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
  const existingM = state.formingCandlesM.get(symbol);
  
  if (!existingM || existingM.periodStart !== periodM) {
    // ⭐ SAVE COMPLETED CANDLE
    if (existingM) {
      saveCompletedHigherTimeframeCandle('1M', { ...existingM });
    }
    state.formingCandlesM.set(symbol, {
      symbol,
      periodStart: periodM,
      open: price,
      high: price,
      low: price,
      close: price,
    });
  } else {
    existingM.high = Math.max(existingM.high, price);
    existingM.low = Math.min(existingM.low, price);
    existingM.close = price;
  }
}

/**
 * Save a completed forming candle to MongoDB AND add to in-memory buffer
 * This is called when a new minute starts - we save the PREVIOUS minute's candle
 * 
 * The buffer is used for building 5m forming candles without querying MongoDB
 */
async function saveCompletedCandleToMongoDB(candle: FormingCandle): Promise<void> {
  const state = getState();
  
  // Add to in-memory buffer for 5m aggregation
  const completedCandle: CompletedCandle = {
    symbol: candle.symbol,
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
  
  if (!state.completedCandlesBuffer.has(candle.symbol)) {
    state.completedCandlesBuffer.set(candle.symbol, []);
  }
  
  const buffer = state.completedCandlesBuffer.get(candle.symbol)!;
  buffer.push(completedCandle);
  
  // Keep only last 15 candles (enough for 15m aggregation, could extend later)
  // 5m needs max 5 candles, 15m needs max 15 candles
  const MAX_BUFFER_SIZE = 15;
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer.shift(); // Remove oldest
  }
  
  // Save to MongoDB
  try {
    await connectToDatabase();
    
    // Convert time from seconds to milliseconds for the model (it divides by 1000 internally)
    await Candle1m.upsertCandle(
      candle.symbol,
      candle.time * 1000, // Seconds to milliseconds
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      0 // Volume - we don't track this from C.* quotes
    );
    
    // Log only EUR/USD as sample (not all 33 symbols)
    if (candle.symbol === 'EUR/USD') {
      console.log(`💾 1m candles saved (33 symbols) | EUR/USD: ${candle.close.toFixed(5)} (${candle.tickCount} ticks)`);
    }
  } catch (error) {
    console.error(`❌ [Candle Save Error] ${candle.symbol}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Save a completed higher timeframe candle to the historical collection
 * This is called when we detect a new period has started (e.g., at :05, :10, :15 for 5m)
 * 
 * KEY INSIGHT: This creates a SINGLE SOURCE OF TRUTH
 * - Completed candles go to historical collections
 * - Historical collections are what the candles API queries
 * - No more mixing aggregator + historical = consistent data for all users
 * 
 * IMPORTANT: We AUGMENT the candle with 1m data to ensure completeness
 * This fixes the issue where server restarts mid-candle cause incomplete candles
 */
async function saveCompletedHigherTimeframeCandle(
  timeframe: string, 
  candle: CachedFormingCandle
): Promise<void> {
  try {
    const historicalModel = getHistoricalModel(timeframe);
    if (!historicalModel) {
      console.error(`❌ [Auto-Save] No historical model for timeframe: ${timeframe}`);
      return;
    }
    
    await connectToDatabase();
    
    // Calculate the timeframe interval in seconds
    const tfSecondsMap: Record<string, number> = {
      '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800, '1M': 2592000
    };
    const tfSeconds = tfSecondsMap[timeframe] || 3600;
    
    // ================================================================
    // AUGMENT WITH 1m DATA to ensure completeness after server restart
    // Query 1m candles from this completed period to get full OHLC
    // ================================================================
    let finalOpen = candle.open;
    let finalHigh = candle.high;
    let finalLow = candle.low;
    let finalClose = candle.close;
    
    try {
      const candles1m = await Candle1m.find({
        symbol: candle.symbol,
        t: { 
          $gte: candle.periodStart, 
          $lt: candle.periodStart + tfSeconds 
        }
      }).sort({ t: 1 }).lean();
      
      if (candles1m.length > 0) {
        // Merge 1m data with cached candle
        const open1m = candles1m[0].o;
        const high1m = Math.max(...candles1m.map(c => c.h));
        const low1m = Math.min(...candles1m.map(c => c.l));
        const close1m = candles1m[candles1m.length - 1].c;
        
        // Use 1m open (start of period is more accurate)
        finalOpen = open1m;
        // Merge high/low (take the extreme values from both sources)
        finalHigh = Math.max(finalHigh, high1m);
        finalLow = Math.min(finalLow, low1m);
        // Use 1m close if it's more recent (based on timestamp)
        const lastCachedTime = candle.periodStart;
        const last1mTime = candles1m[candles1m.length - 1].t;
        if (last1mTime >= lastCachedTime) {
          finalClose = close1m;
        }
        
        if (candle.symbol === 'EUR/USD') {
          console.log(`🔄 [${timeframe}] Augmented with ${candles1m.length} 1m candles | O:${candle.open.toFixed(5)}→${finalOpen.toFixed(5)} H:${candle.high.toFixed(5)}→${finalHigh.toFixed(5)} L:${candle.low.toFixed(5)}→${finalLow.toFixed(5)}`);
        }
      }
    } catch (err) {
      // If 1m query fails, use cached values (better than nothing)
      console.warn(`⚠️ [Auto-Save ${timeframe}] Failed to augment with 1m:`, err instanceof Error ? err.message : err);
    }
    
    const timestamp = new Date(candle.periodStart * 1000);
    
    // Use upsert to avoid duplicates (in case of race conditions)
    // If candle already exists, UPDATE it with merged data (in case we have better data now)
    await historicalModel.updateOne(
      { 
        symbol: candle.symbol, 
        timestamp 
      },
      {
        $set: {
          symbol: candle.symbol,
          timestamp,
          open: finalOpen,
          high: finalHigh,
          low: finalLow,
          close: finalClose,
          volume: 0,
        }
      },
      { upsert: true }
    );
    
    // Log only EUR/USD as sample (to avoid log spam)
    if (candle.symbol === 'EUR/USD') {
      console.log(`💾 [${timeframe}] Completed candle saved: ${timestamp.toISOString()} | O:${finalOpen.toFixed(5)} H:${finalHigh.toFixed(5)} L:${finalLow.toFixed(5)} C:${finalClose.toFixed(5)}`);
    }
  } catch (error) {
    // Don't crash on save errors - just log and continue
    console.error(`❌ [Auto-Save ${timeframe}] ${candle.symbol}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Generic function to calculate forming candle for any timeframe from 1m candles
 * @param symbol - Trading symbol
 * @param timeframeMinutes - Target timeframe in minutes (5, 15, 30, 60)
 * Returns null if 1m forming candle doesn't exist
 */
function calculateFormingCandleForTimeframe(symbol: string, timeframeMinutes: number): FormingCandle | null {
  const state = getState();
  const forming1m = state.formingCandles.get(symbol);
  
  if (!forming1m) return null;
  
  // Calculate period boundary (seconds)
  const periodSeconds = timeframeMinutes * 60;
  const currentPeriodStart = Math.floor(forming1m.time / periodSeconds) * periodSeconds;
  
  // Get all 1m candles in the current period from buffer
  const buffer = state.completedCandlesBuffer.get(symbol) || [];
  const periodCandles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  
  // Add completed 1m candles from this period
  for (const candle of buffer) {
    if (candle.time >= currentPeriodStart && candle.time < currentPeriodStart + periodSeconds) {
      periodCandles.push(candle);
    }
  }
  
  // Add the current forming 1m candle
  periodCandles.push({
    time: forming1m.time,
    open: forming1m.open,
    high: forming1m.high,
    low: forming1m.low,
    close: forming1m.close,
  });
  
  // Sort by time
  periodCandles.sort((a, b) => a.time - b.time);
  
  if (periodCandles.length === 0) return null;
  
  return {
    symbol,
    time: currentPeriodStart,
    open: periodCandles[0].open,
    high: Math.max(...periodCandles.map(c => c.high)),
    low: Math.min(...periodCandles.map(c => c.low)),
    close: periodCandles[periodCandles.length - 1].close,
    tickCount: periodCandles.length, // Number of 1m candles aggregated
  };
}

/**
 * Calculate 5m forming candle from 1m candles
 */
function calculate5mFormingCandle(symbol: string): FormingCandle | null {
  return calculateFormingCandleForTimeframe(symbol, 5);
}

/**
 * Calculate 15m forming candle from 1m candles
 */
function calculate15mFormingCandle(symbol: string): FormingCandle | null {
  return calculateFormingCandleForTimeframe(symbol, 15);
}

/**
 * Handle aggregate messages (per-second or per-minute bars)
 * Format: {"ev":"CA","pair":"EUR-USD","o":1.05,"h":1.051,"l":1.049,"c":1.0505,"v":1000,"s":..,"e":..}
 * 
 * @param msg - The aggregate message from Massive.com WebSocket
 * @param isMinuteAggregate - If true (CA.*), save to MongoDB for candle source of truth
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
  s?: number;      // start timestamp (milliseconds)
  e?: number;      // end timestamp (milliseconds)
}, isMinuteAggregate: boolean = false): void {
  let symbolKey = msg.pair || msg.p || '';
  symbolKey = symbolKey.replace('-', '').replace('/', '').toUpperCase();
  
  const symbol = MASSIVE_TO_SYMBOL[symbolKey];
  if (!symbol || msg.c === undefined) return;

  // ❌ DO NOT update priceCache from aggregate messages!
  // Aggregate messages only have close price - deriving bid/ask causes flickering
  // Let C.* quote messages be the ONLY source for real-time prices (they have real bid/ask)
  
  // ⚡ BUT DO trigger TP/SL checks using CACHED bid/ask (from C.* quotes)
  // This ensures TP/SL checks happen frequently (on every aggregate), 
  // but use the real bid/ask from the last quote instead of derived values
  const cachedQuote = priceCache.get(symbol);
  if (cachedQuote && cachedQuote.bid && cachedQuote.ask) {
    checkTPSLOnPriceUpdate(symbol, cachedQuote.bid, cachedQuote.ask);
  }
  
  // 🕯️ SAVE CANDLE TO MONGODB (only for minute aggregates, not second)
  // This is the SERVER SOURCE OF TRUTH for candle data
  // All browsers will poll /api/candles to get this data
  if (isMinuteAggregate && msg.o !== undefined && msg.h !== undefined && 
      msg.l !== undefined && msg.s !== undefined) {
    saveCandleToMongoDB(symbol, msg.s, msg.o, msg.h, msg.l, msg.c, msg.v || 0);
  }
}

/**
 * Save minute candle to MongoDB - SERVER SOURCE OF TRUTH
 * 
 * This is the ONLY place candles are saved. All browsers poll /api/candles
 * to get this data, ensuring everyone sees identical charts.
 * 
 * Fire-and-forget: Errors are logged but don't block price processing
 */
let dbConnected = false;
let candleSaveQueue: Array<{
  symbol: string;
  time: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}> = [];
let candleSaveTimer: NodeJS.Timeout | null = null;

async function saveCandleToMongoDB(
  symbol: string,
  startTime: number,  // milliseconds from Massive
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): Promise<void> {
  // Queue the candle for batch save (more efficient than individual saves)
  candleSaveQueue.push({ symbol, time: startTime, o: open, h: high, l: low, c: close, v: volume });
  
  // Debounce: Save every 500ms to batch multiple candles together
  if (!candleSaveTimer) {
    candleSaveTimer = setTimeout(async () => {
      const candlesToSave = [...candleSaveQueue];
      candleSaveQueue = [];
      candleSaveTimer = null;
      
      if (candlesToSave.length === 0) return;
      
      try {
        // Ensure DB connection
        if (!dbConnected) {
          await connectToDatabase();
          dbConnected = true;
          console.log('🔌 [Candle DB] Connected to MongoDB for candle storage');
        }
        
        // Bulk upsert all queued candles
        await Candle1m.bulkUpsertCandles(
          candlesToSave.map(c => ({
            symbol: c.symbol,
            time: c.time,
            open: c.o,
            high: c.h,
            low: c.l,
            close: c.c,
            volume: c.v,
          }))
        );
        
        // Log occasionally (not every batch to reduce noise)
        if (Math.random() < 0.1) {  // 10% of the time
          console.log(`🕯️ [Candle DB] Saved ${candlesToSave.length} candles to MongoDB`);
        }
      } catch (error) {
        // Log error but don't crash - candle storage failure shouldn't break price updates
        console.error('❌ [Candle DB] Failed to save candles:', error instanceof Error ? error.message : error);
        dbConnected = false;  // Reset connection flag to retry next time
      }
    }, 500);
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
  const state = getState();
  state.ws = null;
  state.isConnecting = false;
  state.isAuthenticated = false;
  state.isSubscribed = false;
  stopHeartbeat();
}

/**
 * Schedule reconnection
 */
function scheduleReconnect(): void {
  const state = getState();
  if (state.reconnectTimer) return;

  if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('❌ Max reconnect attempts reached');
    return;
  }

  state.reconnectAttempts++;
  const delay = RECONNECT_BASE_DELAY_MS * Math.pow(1.5, state.reconnectAttempts - 1);

  console.log(`🔄 Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${state.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
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
  const state = getState();
  const ws = state.ws;
  return ws !== null && ws.readyState === 1 && state.isAuthenticated;
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
  const state = getState();
  const ws = state.ws;
  return {
    connected: ws !== null && ws.readyState === 1,
    authenticated: state.isAuthenticated,
    subscribed: state.isSubscribed,
    cachedPairs: priceCache.size,
    lastUpdate: state.lastUpdateTime,
    reconnectAttempts: state.reconnectAttempts,
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
    getState().lastUpdateTime = Date.now();
  }
}

/**
 * Close WebSocket connection
 */
export function closeWebSocket(): void {
  const state = getState();
  
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  stopHeartbeat();

  if (state.ws) {
    try {
      state.ws.close(1000, 'Client closing');
    } catch {
      // Ignore close errors
    }
    state.ws = null;
  }

  cleanup();
  console.log('🔌 WebSocket closed');
}

/**
 * Reset and reconnect
 */
export function resetWebSocket(): void {
  closeWebSocket();
  getState().reconnectAttempts = 0;
  initializeWebSocket();
}

/**
 * Get the forming candle for a symbol (current minute being built)
 * This is the SERVER's authoritative forming candle - all browsers should use this!
 */
export function getFormingCandle(symbol: string): FormingCandle | null {
  const state = getState();
  return state.formingCandles.get(symbol) || null;
}

/**
 * Get 5m forming candle (from cache - fast!)
 */
export function getForming5mCandle(symbol: string): FormingCandle | null {
  const state = getState();
  const cached = state.formingCandles5m.get(symbol);
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    time: cached.periodStart,
    open: cached.open,
    high: cached.high,
    low: cached.low,
    close: cached.close,
    tickCount: 0,
  };
}

/**
 * Get 15m forming candle (from cache - fast!)
 */
export function getForming15mCandle(symbol: string): FormingCandle | null {
  const state = getState();
  const cached = state.formingCandles15m.get(symbol);
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    time: cached.periodStart,
    open: cached.open,
    high: cached.high,
    low: cached.low,
    close: cached.close,
    tickCount: 0,
  };
}

/**
 * Get 30m forming candle (from cache - fast!)
 */
export function getForming30mCandle(symbol: string): FormingCandle | null {
  const state = getState();
  const cached = state.formingCandles30m.get(symbol);
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    time: cached.periodStart,
    open: cached.open,
    high: cached.high,
    low: cached.low,
    close: cached.close,
    tickCount: 0,
  };
}

/**
 * Get 1h forming candle (from cache - fast!)
 */
export function getForming1hCandle(symbol: string): FormingCandle | null {
  const state = getState();
  const cached = state.formingCandles1h.get(symbol);
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    time: cached.periodStart,
    open: cached.open,
    high: cached.high,
    low: cached.low,
    close: cached.close,
    tickCount: 0,
  };
}

/**
 * Get 4h forming candle (from cache - fast!)
 */
export function getForming4hCandle(symbol: string): FormingCandle | null {
  const state = getState();
  const cached = state.formingCandles4h.get(symbol);
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    time: cached.periodStart,
    open: cached.open,
    high: cached.high,
    low: cached.low,
    close: cached.close,
    tickCount: 0,
  };
}

/**
 * Get Daily forming candle (from cache - fast!)
 */
export function getFormingDailyCandle(symbol: string): FormingCandle | null {
  const state = getState();
  const cached = state.formingCandlesD.get(symbol);
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    time: cached.periodStart,
    open: cached.open,
    high: cached.high,
    low: cached.low,
    close: cached.close,
    tickCount: 0,
  };
}

/**
 * Get Weekly forming candle (from cache - fast!)
 */
export function getFormingWeeklyCandle(symbol: string): FormingCandle | null {
  const state = getState();
  const cached = state.formingCandlesW.get(symbol);
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    time: cached.periodStart,
    open: cached.open,
    high: cached.high,
    low: cached.low,
    close: cached.close,
    tickCount: 0,
  };
}

/**
 * Get Monthly forming candle (from cache - fast!)
 */
export function getFormingMonthlyCandle(symbol: string): FormingCandle | null {
  const state = getState();
  const cached = state.formingCandlesM.get(symbol);
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    time: cached.periodStart,
    open: cached.open,
    high: cached.high,
    low: cached.low,
    close: cached.close,
    tickCount: 0,
  };
}

/**
 * Get all forming candles (current minute candles being built)
 */
export function getAllFormingCandles(): Map<string, FormingCandle> {
  const state = getState();
  return new Map(state.formingCandles);
}

/**
 * Broadcast "data updated" event to all clients viewing a specific symbol
 * Called when: seeding completes, gap fill completes, historical download completes
 * This tells clients to refresh their chart data
 */
export async function broadcastDataUpdated(
  symbol: string, 
  timeframe: string, 
  reason: 'seeding_complete' | 'gap_fill_complete' | 'history_download_complete' | 'data_updated' = 'data_updated'
): Promise<void> {
  const wsInternalUrl = process.env.WEBSOCKET_INTERNAL_URL || 'http://localhost:3003';
  
  try {
    await fetch(`${wsInternalUrl}/internal/data_updated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        timeframe,
        reason,
      }),
    });
    console.log(`🔄 [Broadcast] Data updated: ${symbol} ${timeframe} (${reason})`);
  } catch (error) {
    // Don't fail if WebSocket server is not running
    console.warn(`⚠️ [Broadcast] Failed to notify data update: ${error instanceof Error ? error.message : error}`);
  }
}

// ============================================
// AUTO-INITIALIZATION ON SERVER STARTUP
// ============================================
// This ensures the WebSocket and TP/SL cache are initialized
// when the module is first imported on the server

/**
 * Detect if we're running in the Worker process
 * Checks multiple signals to reliably detect Worker context
 */
function isWorkerProcess(): boolean {
  // Check 1: Environment variable (set via PM2 or cross-env)
  // PM2 sets this in ecosystem.config.js: IS_WORKER: 'true'
  const isWorkerEnv = process.env.IS_WORKER === 'true';
  if (isWorkerEnv) {
    console.log('✅ [WEBSOCKET] IS_WORKER=true detected from environment');
    return true;
  }
  
  // Check 2: Process arguments contain "worker" or "dist/worker"
  const args = process.argv.join(' ').toLowerCase();
  if (args.includes('worker/index') || args.includes('worker\\index') || 
      args.includes('dist/worker') || args.includes('dist\\worker')) {
    console.log('✅ [WEBSOCKET] Worker detected from process.argv:', args.substring(0, 100));
    return true;
  }
  
  // Check 3: npm_lifecycle_event (if running via npm run worker)
  if (process.env.npm_lifecycle_event === 'worker') {
    console.log('✅ [WEBSOCKET] Worker detected from npm_lifecycle_event');
    return true;
  }
  
  // Debug: Log what we found (only on first check)
  if (!hasLoggedInit) {
    console.log('ℹ️ [WEBSOCKET] Worker detection: IS_WORKER=' + process.env.IS_WORKER + 
                ', argv=' + args.substring(0, 80));
  }
  
  return false;
}

/**
 * Detect if we're running in the ADMIN app (port 3001)
 * ADMIN app should NOT connect to WebSocket - only WEB app should
 */
function isAdminProcess(): boolean {
  // Check 1: Environment variable
  if (process.env.IS_ADMIN === 'true') return true;
  
  // Check 2: PORT is 3001 (admin default port)
  if (process.env.PORT === '3001') return true;
  
  // Check 3: Process arguments contain "apps/admin" or "apps\\admin"
  const args = process.argv.join(' ').toLowerCase();
  if (args.includes('apps/admin') || args.includes('apps\\admin')) return true;
  
  // Check 4: Current working directory contains apps/admin
  const cwd = process.cwd().toLowerCase();
  if (cwd.includes('apps/admin') || cwd.includes('apps\\admin')) return true;
  
  // Check 5: npm_lifecycle_event for admin scripts
  const lifecycle = process.env.npm_lifecycle_event || '';
  if (lifecycle.includes('admin')) return true;
  
  return false;
}

/**
 * Check if this process should skip WebSocket initialization
 * Only the main WEB app (port 3000) should connect to WebSocket
 */
function shouldSkipWebSocket(): boolean {
  if (isWorkerProcess()) return true;
  if (isAdminProcess()) return true;
  return false;
}

// ============================================
// BROADCAST FORMING CANDLES TO WEBSOCKET SERVER
// ============================================
// This sends forming candles to all connected browsers via WebSocket
// Browsers just display - no local candle building needed!

let broadcastTimer: NodeJS.Timeout | null = null;
let currentBroadcastIntervalMs = 200; // Default, can be changed by admin
let lastBroadcastSettingsCheck = 0;
const BROADCAST_SETTINGS_CHECK_INTERVAL = 30000; // Check admin settings every 30 seconds

/**
 * Load broadcast interval from admin settings
 * NOTE: Query MongoDB directly to bypass Mongoose model caching issues
 */
async function loadBroadcastInterval(): Promise<number> {
  try {
    await connectToDatabase();
    
    // Import mongoose
    const mongoose = await import('mongoose');
    
    // Query MongoDB collection directly (bypasses Mongoose model cache)
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('⚠️ [Broadcast] Database not connected, using default interval');
      return 200;
    }
    
    const settings = await db.collection('marketdatasettings').findOne({ key: 'market_data_settings' });
    const interval = settings?.websocketIntervalMs || 200;
    
    // Validate range (50-2000ms)
    return Math.max(50, Math.min(2000, interval));
  } catch (error) {
    console.warn('⚠️ [Broadcast] Failed to load interval setting, using default:', error instanceof Error ? error.message : error);
    return 200;
  }
}

/**
 * Check if broadcast interval has changed and restart timer if needed
 */
async function checkAndUpdateBroadcastInterval(): Promise<void> {
  const now = Date.now();
  if (now - lastBroadcastSettingsCheck < BROADCAST_SETTINGS_CHECK_INTERVAL) return;
  
  lastBroadcastSettingsCheck = now;
  
  const newInterval = await loadBroadcastInterval();
  
  if (newInterval !== currentBroadcastIntervalMs) {
    console.log(`📡 [Broadcast] Interval changed: ${currentBroadcastIntervalMs}ms → ${newInterval}ms`);
    currentBroadcastIntervalMs = newInterval;
    
    // Restart timer with new interval
    if (broadcastTimer) {
      stopBroadcastTimer();
      await startBroadcastTimer();
    }
  }
}

async function broadcastFormingCandles(): Promise<void> {
  // Periodically check if admin changed the interval
  checkAndUpdateBroadcastInterval().catch(() => {});
  const state = getState();
  
  // Get only CHANGED symbols for delta broadcast
  const changedSymbols = state.changedSymbols;
  
  // Skip if nothing changed
  if (changedSymbols.size === 0) return;
  
  // Filter to only changed symbols
  const formingCandles = Array.from(state.formingCandles.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const formingCandles5m = Array.from(state.formingCandles5m.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const formingCandles15m = Array.from(state.formingCandles15m.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const formingCandles30m = Array.from(state.formingCandles30m.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const formingCandles1h = Array.from(state.formingCandles1h.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const formingCandles4h = Array.from(state.formingCandles4h.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const formingCandlesD = Array.from(state.formingCandlesD.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const formingCandlesW = Array.from(state.formingCandlesW.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const formingCandlesM = Array.from(state.formingCandlesM.values())
    .filter(c => changedSymbols.has(c.symbol));
  
  const prices = Array.from(state.priceCache.values())
    .filter(p => changedSymbols.has(p.symbol));
  
  // Clear changed symbols BEFORE sending (so new changes during send are tracked)
  state.changedSymbols = new Set<string>();
  
  if (formingCandles.length === 0 && prices.length === 0) return;
  
  // Get WebSocket internal URL
  const wsInternalUrl = process.env.WEBSOCKET_INTERNAL_URL || 'http://localhost:3003';
  
  try {
    const response = await fetch(`${wsInternalUrl}/internal/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prices: prices.map(p => ({
          symbol: p.symbol,
          bid: p.bid,
          ask: p.ask,
          mid: p.mid,
          timestamp: p.timestamp,
        })),
        // 1m forming candles
        formingCandles: formingCandles.map(c => ({
          symbol: c.symbol,
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: '1m',
        })),
        // 5m forming candles (from cache - no calculation)
        formingCandles5m: formingCandles5m.map(c => ({
          symbol: c.symbol,
          time: c.periodStart,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: '5m',
        })),
        // 15m forming candles (from cache - no calculation)
        formingCandles15m: formingCandles15m.map(c => ({
          symbol: c.symbol,
          time: c.periodStart,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: '15m',
        })),
        // 30m forming candles (from cache - no calculation)
        formingCandles30m: formingCandles30m.map(c => ({
          symbol: c.symbol,
          time: c.periodStart,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: '30m',
        })),
        // 1h forming candles (from cache - no calculation)
        formingCandles1h: formingCandles1h.map(c => ({
          symbol: c.symbol,
          time: c.periodStart,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: '1h',
        })),
        // 4h forming candles (from cache - no calculation)
        formingCandles4h: formingCandles4h.map(c => ({
          symbol: c.symbol,
          time: c.periodStart,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: '4h',
        })),
        // Daily forming candles (from cache - no calculation)
        formingCandlesD: formingCandlesD.map(c => ({
          symbol: c.symbol,
          time: c.periodStart,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: 'D',
        })),
        // Weekly forming candles (from cache - no calculation)
        formingCandlesW: formingCandlesW.map(c => ({
          symbol: c.symbol,
          time: c.periodStart,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: 'W',
        })),
        // Monthly forming candles (from cache - no calculation)
        formingCandlesM: formingCandlesM.map(c => ({
          symbol: c.symbol,
          time: c.periodStart,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          timeframe: 'M',
        })),
      }),
    });
    
    if (!response.ok && Math.random() < 0.01) {
      console.warn(`⚠️ [Broadcast] WebSocket server returned ${response.status}`);
    }
  } catch (error) {
    // Log only occasionally to avoid spam
    if (Math.random() < 0.01) {
      console.warn('⚠️ [Broadcast] Failed to send to WebSocket server:', error instanceof Error ? error.message : error);
    }
  }
}

async function startBroadcastTimer(): Promise<void> {
  if (broadcastTimer) return; // Already running
  
  // Load interval from admin settings
  currentBroadcastIntervalMs = await loadBroadcastInterval();
  
  broadcastTimer = setInterval(broadcastFormingCandles, currentBroadcastIntervalMs);
  console.log(`📡 [Broadcast] Started broadcasting forming candles every ${currentBroadcastIntervalMs}ms`);
}

function stopBroadcastTimer(): void {
  if (broadcastTimer) {
    clearInterval(broadcastTimer);
    broadcastTimer = null;
    console.log('📡 [Broadcast] Stopped broadcasting');
  }
}

/**
 * Seed the completed candles buffer from MongoDB
 * This ensures 5m forming candles work immediately after server restart
 */
async function seedCompletedCandlesBuffer(): Promise<void> {
  const state = getState();
  
  try {
    await connectToDatabase();
    
    // Get symbols from FOREX_PAIRS
    const symbols = Object.keys(FOREX_PAIRS);
    
    console.log(`🌱 [Buffer Seed] Seeding completed candles buffer for ${symbols.length} symbols...`);
    
    for (const symbol of symbols) {
      // Get last 15 completed 1m candles for each symbol (enough for 15m aggregation)
      const candles = await Candle1m.getCandles(symbol, 15);
      
      if (candles.length > 0) {
        // Store in buffer (skip the most recent one as it might be the current forming candle)
        const completedCandles = candles.slice(0, -1).map(c => ({
          symbol,
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        
        if (completedCandles.length > 0) {
          state.completedCandlesBuffer.set(symbol, completedCandles);
        }
      }
    }
    
    console.log(`✅ [Buffer Seed] Seeded ${state.completedCandlesBuffer.size} symbols with completed candles`);
  } catch (error) {
    console.warn('⚠️ [Buffer Seed] Failed to seed buffer:', error instanceof Error ? error.message : error);
  }
}

/**
 * Seed higher timeframe forming candle caches from historical 1m data
 * This ensures forming candles for 4h, D, W, M have accurate OHLC from period start
 * Without this, forming candles only have data from server restart time!
 */
async function seedHigherTimeframeCaches(): Promise<void> {
  const state = getState();
  
  try {
    await connectToDatabase();
    
    const symbols = Object.keys(FOREX_PAIRS);
    const now = Date.now();
    const currentTime = Math.floor(now / 1000);
    
    console.log(`🌱 [HT Seed] Seeding higher timeframe caches for ${symbols.length} symbols...`);
    
    // Calculate period boundaries for each timeframe
    const nowDate = new Date(now);
    
    // Shorter timeframes
    const period5m = Math.floor(currentTime / 300) * 300;
    const period15m = Math.floor(currentTime / 900) * 900;
    const period30m = Math.floor(currentTime / 1800) * 1800;
    const period1h = Math.floor(currentTime / 3600) * 3600;
    const period4h = Math.floor(currentTime / 14400) * 14400;
    
    // Daily period start (00:00 UTC)
    const periodD = Math.floor(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()) / 1000);
    
    // Weekly period start (Sunday 00:00 UTC)
    const dayOfWeek = nowDate.getUTCDay();
    const sundayDate = new Date(nowDate);
    sundayDate.setUTCDate(nowDate.getUTCDate() - dayOfWeek);
    sundayDate.setUTCHours(0, 0, 0, 0);
    const periodW = Math.floor(sundayDate.getTime() / 1000);
    
    // Monthly period start (1st of month 00:00 UTC)
    const periodM = Math.floor(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1) / 1000);
    
    // Process each symbol
    for (const symbol of symbols) {
      try {
        // Determine how many 1m candles we need for the longest period (monthly)
        const minutesSinceMonthStart = Math.floor((currentTime - periodM) / 60);
        const candlesToFetch = Math.min(minutesSinceMonthStart + 1, 50000); // Cap at 50k to avoid memory issues
        
        if (candlesToFetch <= 0) continue;
        
        // Fetch 1m candles from MongoDB
        const candles1m = await Candle1m.find({ symbol })
          .sort({ time: -1 })
          .limit(candlesToFetch)
          .lean()
          .exec();
        
        if (candles1m.length === 0) continue;
        
        // Helper to aggregate candles for a period
        // Note: candles1m uses short names: t=time, o=open, h=high, l=low, c=close
        const aggregateForPeriod = (periodStart: number, periodEnd: number) => {
          const periodCandles = candles1m.filter(c => c.t >= periodStart && c.t < periodEnd);
          if (periodCandles.length === 0) return null;
          
          // Sort by time ascending
          periodCandles.sort((a, b) => a.t - b.t);
          
          return {
            symbol,
            periodStart,
            open: periodCandles[0].o,
            high: Math.max(...periodCandles.map(c => c.h)),
            low: Math.min(...periodCandles.map(c => c.l)),
            close: periodCandles[periodCandles.length - 1].c,
          };
        };
        
        // Seed shorter timeframe caches
        const candle5m = aggregateForPeriod(period5m, period5m + 300);
        if (candle5m) state.formingCandles5m.set(symbol, candle5m);
        
        const candle15m = aggregateForPeriod(period15m, period15m + 900);
        if (candle15m) state.formingCandles15m.set(symbol, candle15m);
        
        const candle30m = aggregateForPeriod(period30m, period30m + 1800);
        if (candle30m) state.formingCandles30m.set(symbol, candle30m);
        
        const candle1h = aggregateForPeriod(period1h, period1h + 3600);
        if (candle1h) state.formingCandles1h.set(symbol, candle1h);
        
        // Seed 4h cache
        const candle4h = aggregateForPeriod(period4h, period4h + 14400);
        if (candle4h) state.formingCandles4h.set(symbol, candle4h);
        
        // Seed Daily cache
        const candleD = aggregateForPeriod(periodD, periodD + 86400);
        if (candleD) state.formingCandlesD.set(symbol, candleD);
        
        // Seed Weekly cache
        const candleW = aggregateForPeriod(periodW, periodW + 604800);
        if (candleW) state.formingCandlesW.set(symbol, candleW);
        
        // Seed Monthly cache
        const nextMonth = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() + 1, 1));
        const periodMEnd = Math.floor(nextMonth.getTime() / 1000);
        const candleM = aggregateForPeriod(periodM, periodMEnd);
        if (candleM) state.formingCandlesM.set(symbol, candleM);
        
      } catch (err) {
        // Skip symbol on error, don't crash entire seeding
        console.warn(`⚠️ [HT Seed] Failed for ${symbol}:`, err instanceof Error ? err.message : err);
      }
    }
    
    console.log(`✅ [HT Seed] Seeded: 5m=${state.formingCandles5m.size}, 15m=${state.formingCandles15m.size}, 30m=${state.formingCandles30m.size}, 1h=${state.formingCandles1h.size}, 4h=${state.formingCandles4h.size}, D=${state.formingCandlesD.size}, W=${state.formingCandlesW.size}, M=${state.formingCandlesM.size}`);
  } catch (error) {
    console.warn('⚠️ [HT Seed] Failed to seed higher timeframe caches:', error instanceof Error ? error.message : error);
  }
}

async function autoInitialize(): Promise<void> {
  const state = getState();
  
  // Use global state to prevent re-initialization across HMR
  if (state.initialized) {
    console.log(`ℹ️ [AUTO-INIT] Already initialized (ID: ${state.connectionId})`);
    return;
  }
  state.initialized = true;
  
  // Only initialize on server-side
  if (typeof window !== 'undefined') return;
  
  // ⚠️ IMPORTANT: Only WEB app (port 3000) connects to WebSocket
  // Worker and ADMIN use MongoDB cache for prices (written by WEB)
  // This prevents the "1 connection per asset class" conflict with Massive.com
  if (isWorkerProcess()) {
    console.log('ℹ️ [WEBSOCKET] Worker detected - skipping WebSocket init');
    console.log('   Worker will read prices from MongoDB cache (written by WEB app)');
    return;
  }
  
  if (isAdminProcess()) {
    console.log('ℹ️ [WEBSOCKET] Admin app detected - skipping WebSocket init');
    console.log('   Admin will read WebSocket status from WEB app via API');
    return;
  }
  
  console.log('🚀 [AUTO-INIT] Starting WebSocket and TP/SL cache initialization...');
  
  try {
    await initializeWebSocket();
    
    // Seed the completed candles buffer from MongoDB for 5m aggregation
    await seedCompletedCandlesBuffer();
    
    // Seed higher timeframe caches (4h, D, W, M) from historical 1m data
    // This ensures forming candles have accurate OHLC from period start, not just server start
    await seedHigherTimeframeCaches();
    
    // Start broadcasting forming candles to WebSocket server
    await startBroadcastTimer();
    
    console.log('✅ [AUTO-INIT] WebSocket, TP/SL cache, and broadcast ready');
  } catch (error) {
    console.error('❌ [AUTO-INIT] Failed:', error);
  }
}

// Trigger auto-initialization
autoInitialize();
