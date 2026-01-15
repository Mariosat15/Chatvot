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
  formingCandles: Map<string, FormingCandle>; // Current minute candles being built
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
      formingCandles: new Map<string, FormingCandle>(),
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
      console.log(`📦 [MongoDB Cache] Wrote ${updates.length} prices to cache`);
    }
  } catch (error) {
    // Don't log every error - just occasionally
    if (Math.random() < 0.1) {
      console.error('⚠️ [MongoDB Cache] Failed to write prices:', error);
    }
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
  getState().lastUpdateTime = Date.now();
  
  // ⚡ REAL-TIME TP/SL CHECK - Triggers INSTANTLY when price hits levels!
  // This is fire-and-forget, doesn't block price updates
  checkTPSLOnPriceUpdate(symbol, roundedBid, roundedAsk);
  
  // 📦 Queue price for MongoDB cache (Worker reads from here)
  queuePriceForMongoCache(symbol, roundedBid, roundedAsk, quote.timestamp);
  
  // 🕯️ UPDATE FORMING CANDLE (current minute) - Server is authoritative source
  updateFormingCandle(symbol, safeMid);
}

/**
 * Update the forming candle for a symbol
 * This builds the current minute candle from real-time quotes
 * All browsers get this data = identical charts!
 * 
 * When a new minute starts, SAVE the completed candle to MongoDB
 */
function updateFormingCandle(symbol: ForexSymbol, price: number): void {
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
      open: price,
      high: price,
      low: price,
      close: price,
      tickCount: 1,
    });
  } else {
    // Same minute - update OHLC
    existing.high = Math.max(existing.high, price);
    existing.low = Math.min(existing.low, price);
    existing.close = price;
    existing.tickCount++;
  }
}

/**
 * Save a completed forming candle to MongoDB
 * This is called when a new minute starts - we save the PREVIOUS minute's candle
 */
async function saveCompletedCandleToMongoDB(candle: FormingCandle): Promise<void> {
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
    
    console.log(`💾 [Candle Saved] ${candle.symbol} @ ${new Date(candle.time * 1000).toISOString()} | O:${candle.open.toFixed(5)} H:${candle.high.toFixed(5)} L:${candle.low.toFixed(5)} C:${candle.close.toFixed(5)} (${candle.tickCount} ticks)`);
  } catch (error) {
    console.error(`❌ [Candle Save Error] ${candle.symbol}:`, error instanceof Error ? error.message : error);
  }
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
 * Get all forming candles (current minute candles being built)
 */
export function getAllFormingCandles(): Map<string, FormingCandle> {
  const state = getState();
  return new Map(state.formingCandles);
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
const BROADCAST_INTERVAL_MS = 200; // Broadcast every 200ms for smooth updates

async function broadcastFormingCandles(): Promise<void> {
  const state = getState();
  
  // Get all forming candles
  const formingCandles = Array.from(state.formingCandles.values());
  
  // Get all prices
  const prices = Array.from(state.priceCache.values());
  
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
        formingCandles: formingCandles.map(c => ({
          symbol: c.symbol,
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
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

function startBroadcastTimer(): void {
  if (broadcastTimer) return; // Already running
  
  broadcastTimer = setInterval(broadcastFormingCandles, BROADCAST_INTERVAL_MS);
  console.log(`📡 [Broadcast] Started broadcasting forming candles every ${BROADCAST_INTERVAL_MS}ms`);
}

function stopBroadcastTimer(): void {
  if (broadcastTimer) {
    clearInterval(broadcastTimer);
    broadcastTimer = null;
    console.log('📡 [Broadcast] Stopped broadcasting');
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
    
    // Start broadcasting forming candles to WebSocket server
    startBroadcastTimer();
    
    console.log('✅ [AUTO-INIT] WebSocket, TP/SL cache, and broadcast ready');
  } catch (error) {
    console.error('❌ [AUTO-INIT] Failed:', error);
  }
}

// Trigger auto-initialization
autoInitialize();
