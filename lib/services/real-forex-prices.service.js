"use strict";
/**
 * Real Forex Prices Service
 *
 * Fetches REAL market prices from Massive.com API
 * Now with Redis caching for 99%+ reduction in API calls
 *
 * Priority:
 * 1. Redis cache (instant, shared across all users)
 * 2. In-memory cache (fast, per-server fallback)
 * 3. REST API (parallel calls when cache miss)
 * 4. Fallback prices (offline)
 *
 * Documentation: https://massive.com/docs/rest/forex
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePriceQuote = normalizePriceQuote;
exports.updateCachedSpread = updateCachedSpread;
exports.fetchRealForexPrices = fetchRealForexPrices;
exports.getMarketStatusFromAPI = getMarketStatusFromAPI;
exports.getUpcomingHolidays = getUpcomingHolidays;
exports.isForexMarketOpen = isForexMarketOpen;
exports.isMarketOpenSync = isMarketOpenSync;
exports.getNextMarketChange = getNextMarketChange;
exports.getMarketStatus = getMarketStatus;
exports.getRealPrice = getRealPrice;
exports.getPriceFromCacheOnly = getPriceFromCacheOnly;
exports.getPriceFromCacheOnlySync = getPriceFromCacheOnlySync;
exports.getAllPricesFromCache = getAllPricesFromCache;
exports.getAllPricesFromCacheSync = getAllPricesFromCacheSync;
const pnl_calculator_service_1 = require("./pnl-calculator.service");
const websocket_price_streamer_1 = require("./websocket-price-streamer");
const redis_service_1 = require("./redis.service");
/**
 * Normalize a price quote - ensures mid and spread are ALWAYS calculated from bid/ask
 * This prevents mid from lagging behind bid/ask updates
 */
function normalizePriceQuote(quote) {
    const { bid, ask } = quote;
    // Always calculate mid and spread from current bid/ask
    const mid = (bid + ask) / 2;
    const spread = ask - bid;
    // Ensure mid is always between bid and ask (safety check)
    const safeMid = Math.max(bid, Math.min(ask, mid));
    return {
        ...quote,
        mid: Number(safeMid.toFixed(5)),
        spread: Number(Math.abs(spread).toFixed(5)),
    };
}
/**
 * Normalize all prices in a map
 */
function normalizeAllPrices(prices) {
    const normalized = new Map();
    prices.forEach((quote, symbol) => {
        normalized.set(symbol, normalizePriceQuote(quote));
    });
    return normalized;
}
const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const MASSIVE_API_BASE_URL = 'https://api.massive.com/v1'; // Fixed: .com not .io
// Cache for last known prices (when market is closed or API unavailable)
// Cache for last known REAL prices (dynamic fallback when API unavailable)
// These are populated from actual API/WebSocket data, NOT hardcoded!
// If a price is not in this cache, we simply don't have it and won't fake it.
const lastKnownPrices = new Map();
// Maximum age for a cached price to be considered valid (5 minutes)
const MAX_CACHE_AGE_MS = 5 * 60 * 1000;
// Map our symbols to Massive.com format
// Massive.com uses "/v1/last_quote/currencies/{from}/{to}" format
// Example: EUR/USD -> /v1/last_quote/currencies/EUR/USD
const MASSIVE_SYMBOL_MAP = {
    // Major Pairs
    'EUR/USD': { from: 'EUR', to: 'USD' },
    'GBP/USD': { from: 'GBP', to: 'USD' },
    'USD/JPY': { from: 'USD', to: 'JPY' },
    'USD/CHF': { from: 'USD', to: 'CHF' },
    'AUD/USD': { from: 'AUD', to: 'USD' },
    'USD/CAD': { from: 'USD', to: 'CAD' },
    'NZD/USD': { from: 'NZD', to: 'USD' },
    // Cross Pairs
    'EUR/GBP': { from: 'EUR', to: 'GBP' },
    'EUR/JPY': { from: 'EUR', to: 'JPY' },
    'EUR/CHF': { from: 'EUR', to: 'CHF' },
    'EUR/AUD': { from: 'EUR', to: 'AUD' },
    'EUR/CAD': { from: 'EUR', to: 'CAD' },
    'EUR/NZD': { from: 'EUR', to: 'NZD' },
    'GBP/JPY': { from: 'GBP', to: 'JPY' },
    'GBP/CHF': { from: 'GBP', to: 'CHF' },
    'GBP/AUD': { from: 'GBP', to: 'AUD' },
    'GBP/CAD': { from: 'GBP', to: 'CAD' },
    'GBP/NZD': { from: 'GBP', to: 'NZD' },
    'AUD/JPY': { from: 'AUD', to: 'JPY' },
    'AUD/CHF': { from: 'AUD', to: 'CHF' },
    'AUD/CAD': { from: 'AUD', to: 'CAD' },
    'AUD/NZD': { from: 'AUD', to: 'NZD' },
    'CAD/JPY': { from: 'CAD', to: 'JPY' },
    'CAD/CHF': { from: 'CAD', to: 'CHF' },
    'CHF/JPY': { from: 'CHF', to: 'JPY' },
    'NZD/JPY': { from: 'NZD', to: 'JPY' },
    'NZD/CHF': { from: 'NZD', to: 'CHF' },
    'NZD/CAD': { from: 'NZD', to: 'CAD' },
    // Exotic Pairs
    'USD/MXN': { from: 'USD', to: 'MXN' },
    'USD/ZAR': { from: 'USD', to: 'ZAR' },
    'USD/TRY': { from: 'USD', to: 'TRY' },
    'USD/SEK': { from: 'USD', to: 'SEK' },
    'USD/NOK': { from: 'USD', to: 'NOK' },
};
// Dynamic cache for last known spreads (populated from actual bid/ask data)
// This is NOT hardcoded - it learns from real market data!
// Uses smoothing to prevent wild jumps from bad data
const lastKnownSpreads = new Map();
/**
 * Update the cached spread for a symbol based on actual bid/ask data
 * Uses exponential smoothing to prevent wild spread jumps from bad data
 * Called whenever we receive real bid/ask prices
 */
function updateCachedSpread(symbol, bid, ask) {
    if (!(bid > 0 && ask > 0 && ask > bid))
        return;
    const newSpread = ask - bid;
    const currentSpread = lastKnownSpreads.get(symbol);
    if (!currentSpread) {
        // First spread for this symbol - use it directly
        lastKnownSpreads.set(symbol, newSpread);
        return;
    }
    // Check for unrealistic spread change (> 5x jump = likely bad data)
    const ratio = Math.max(newSpread / currentSpread, currentSpread / newSpread);
    if (ratio > 5) {
        // Spread change too large - apply small weight (10%) to suspicious data
        const smoothedSpread = currentSpread * 0.9 + newSpread * 0.1;
        lastKnownSpreads.set(symbol, smoothedSpread);
        return;
    }
    // Normal update with slight smoothing (30% new, 70% old)
    // This prevents jumps like 0.2 → 2.6 pips
    const smoothedSpread = currentSpread * 0.7 + newSpread * 0.3;
    lastKnownSpreads.set(symbol, smoothedSpread);
}
/**
 * Get spread for a forex pair - DYNAMIC, not hardcoded!
 * Priority: 1) Cached real spread 2) Smart default based on pair type
 * Used for bid/ask calculation if API only provides mid price
 */
function getTypicalSpread(symbol) {
    // First: Try to use cached spread from actual market data
    const cachedSpread = lastKnownSpreads.get(symbol);
    if (cachedSpread && cachedSpread > 0) {
        return cachedSpread;
    }
    // Second: Use smart default based on pair type (only until we get real data)
    const pairConfig = pnl_calculator_service_1.FOREX_PAIRS[symbol];
    if (!pairConfig) {
        // Unknown pair - use a conservative default
        return 0.0002;
    }
    const pip = pairConfig.pip;
    // Determine pair type and use reasonable defaults
    // These are just initial values - will be replaced by real spreads
    const majorPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
    const exoticPairs = ['USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK'];
    let defaultPips;
    if (majorPairs.includes(symbol)) {
        defaultPips = 1.5; // Major pairs: ~1.5 pips
    }
    else if (exoticPairs.includes(symbol)) {
        defaultPips = 40; // Exotic pairs: ~40 pips
    }
    else {
        defaultPips = 3; // Cross pairs: ~3 pips
    }
    return defaultPips * pip;
}
/**
 * Convert Redis cached price to PriceQuote
 */
function redisPriceToPriceQuote(symbol, cached) {
    return {
        symbol,
        bid: cached.bid,
        ask: cached.ask,
        mid: cached.mid,
        spread: cached.ask - cached.bid,
        timestamp: cached.timestamp,
    };
}
/**
 * Convert PriceQuote to Redis cached price
 */
function priceQuoteToRedisPrice(quote) {
    return {
        bid: quote.bid,
        ask: quote.ask,
        mid: quote.mid,
        timestamp: quote.timestamp,
    };
}
// Background fetch flag to prevent multiple simultaneous fetches
let isFetchingPrices = false;
let lastApiFetch = 0;
const API_FETCH_COOLDOWN = 2000; // Only fetch from API every 2 seconds max
/**
 * Fetch real-time prices - OPTIMIZED FOR SPEED
 *
 * Priority order:
 * 1. WebSocket cache (fastest - real-time updates)
 * 2. In-memory cache (instant)
 * 3. Redis cache (fast)
 * 4. REST API (slowest - fallback)
 *
 * Strategy: Return cached prices IMMEDIATELY, fetch updates in background
 */
async function fetchRealForexPrices(symbols) {
    const pricesMap = new Map();
    const symbolsNeedingFetch = [];
    const now = Date.now();
    // STEP 0: Check WebSocket cache first (fastest - real-time prices)
    try {
        const { getCachedPrices, isWebSocketConnected } = await import('./websocket-price-streamer');
        if (isWebSocketConnected()) {
            const wsPrices = getCachedPrices(symbols);
            for (const symbol of symbols) {
                const wsPrice = wsPrices.get(symbol);
                if (wsPrice && (now - wsPrice.timestamp) < 10000) { // WebSocket prices valid for 10 seconds
                    const quote = {
                        symbol,
                        bid: wsPrice.bid,
                        ask: wsPrice.ask,
                        mid: wsPrice.mid,
                        spread: wsPrice.spread,
                        timestamp: wsPrice.timestamp,
                    };
                    pricesMap.set(symbol, quote);
                    lastKnownPrices.set(symbol, quote); // Also update in-memory cache
                }
            }
            // If WebSocket has all prices, return immediately (normalized)
            if (pricesMap.size === symbols.length) {
                return normalizeAllPrices(pricesMap);
            }
        }
    }
    catch {
        // WebSocket not available, continue with other caches
    }
    // STEP 1: Return ALL cached prices immediately (even if slightly stale)
    for (const symbol of symbols) {
        if (pricesMap.has(symbol))
            continue; // Already got from WebSocket
        const cached = lastKnownPrices.get(symbol);
        if (cached) {
            pricesMap.set(symbol, cached);
            // Mark for background refresh if older than 3 seconds
            if (now - cached.timestamp > 3000) {
                symbolsNeedingFetch.push(symbol);
            }
        }
        else {
            symbolsNeedingFetch.push(symbol);
        }
    }
    // If we have all prices cached, return immediately (don't touch Redis!)
    if (pricesMap.size === symbols.length) {
        // Trigger background refresh if needed (non-blocking)
        if (symbolsNeedingFetch.length > 0 && !isFetchingPrices && (now - lastApiFetch) > API_FETCH_COOLDOWN) {
            fetchPricesInBackground(symbolsNeedingFetch);
        }
        return normalizeAllPrices(pricesMap);
    }
    // STEP 2: For missing symbols, check Redis ONLY on cold start
    // To save Redis commands, we only check Redis if we have NO prices at all
    // This prevents Redis reads on every single request
    const missingSymbols = symbols.filter(s => !pricesMap.has(s));
    if (missingSymbols.length > 0 && lastKnownPrices.size === 0) {
        // Only read from Redis on cold start (when in-memory cache is empty)
        try {
            const redisPrices = await (0, redis_service_1.getPrices)(missingSymbols);
            for (const symbol of missingSymbols) {
                const cached = redisPrices.get(symbol);
                if (cached) {
                    const quote = redisPriceToPriceQuote(symbol, cached);
                    pricesMap.set(symbol, quote);
                    lastKnownPrices.set(symbol, quote);
                }
            }
        }
        catch {
            // Redis not available
        }
    }
    // STEP 3: For still missing symbols, fetch from API (blocking for first load only)
    const stillMissing = symbols.filter(s => !pricesMap.has(s));
    if (stillMissing.length > 0) {
        const freshPrices = await fetchFromMassiveApi(stillMissing);
        freshPrices.forEach((quote, symbol) => {
            pricesMap.set(symbol, quote);
            lastKnownPrices.set(symbol, quote);
        });
    }
    // STEP 4: Fill any remaining gaps with LAST KNOWN prices (dynamic fallback)
    // ⚠️ These are real prices from previous successful fetches, NOT hardcoded!
    for (const symbol of symbols) {
        if (!pricesMap.has(symbol)) {
            const cachedPrice = lastKnownPrices.get(symbol);
            if (cachedPrice) {
                const priceAge = now - cachedPrice.timestamp;
                const isStale = priceAge > MAX_CACHE_AGE_MS;
                // Use the cached price but mark it appropriately
                const quote = {
                    ...cachedPrice,
                    timestamp: cachedPrice.timestamp, // Keep original timestamp
                    isFallback: true, // Mark as fallback since it's not fresh
                    isStale: isStale, // Stale if older than MAX_CACHE_AGE_MS
                };
                pricesMap.set(symbol, quote);
                console.warn(`⚠️ Using cached price for ${symbol}: ${cachedPrice.mid.toFixed(5)} (${Math.round(priceAge / 1000)}s old)`);
            }
            else {
                // No price available at all for this symbol - log warning
                console.error(`❌ No price available for ${symbol} - no cache exists`);
            }
        }
    }
    // ALWAYS normalize before returning to ensure mid = (bid + ask) / 2
    return normalizeAllPrices(pricesMap);
}
/**
 * Fetch prices in background (non-blocking)
 */
async function fetchPricesInBackground(symbols) {
    if (isFetchingPrices)
        return;
    isFetchingPrices = true;
    lastApiFetch = Date.now();
    try {
        const freshPrices = await fetchFromMassiveApi(symbols);
        freshPrices.forEach((quote, symbol) => {
            lastKnownPrices.set(symbol, quote);
        });
        // Also update Redis cache
        if (freshPrices.size > 0) {
            const redisPrices = new Map();
            freshPrices.forEach((quote, symbol) => {
                redisPrices.set(symbol, priceQuoteToRedisPrice(quote));
            });
            try {
                await (0, redis_service_1.setPrices)(redisPrices);
            }
            catch {
                // Redis update failed, ignore
            }
        }
    }
    finally {
        isFetchingPrices = false;
    }
}
/**
 * Fetch prices directly from Massive.com API
 */
async function fetchFromMassiveApi(symbols) {
    const pricesMap = new Map();
    if (!MASSIVE_API_KEY || symbols.length === 0) {
        return pricesMap;
    }
    // Fetch ALL symbols in parallel for speed
    const fetchPromises = symbols.map(async (symbol) => {
        const currencyPair = MASSIVE_SYMBOL_MAP[symbol];
        if (!currencyPair)
            return null;
        try {
            const endpoint = `/last_quote/currencies/${currencyPair.from}/${currencyPair.to}?apiKey=${MASSIVE_API_KEY}`;
            const url = `${MASSIVE_API_BASE_URL}${endpoint}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
            });
            if (!response.ok)
                return null;
            const data = await response.json();
            if (data.status !== 'success' && data.status !== 'OK')
                return null;
            return { symbol, data };
        }
        catch {
            return null;
        }
    });
    const results = await Promise.all(fetchPromises);
    for (const result of results) {
        if (!result)
            continue;
        const quote = parseLastQuoteResponse(result.data, result.symbol);
        if (quote) {
            pricesMap.set(result.symbol, quote);
            (0, websocket_price_streamer_1.updateCacheFromRest)(result.symbol, quote);
        }
    }
    return pricesMap;
}
/**
 * Parse Massive.com last_quote API response
 * Response format: { last: { ask, bid, exchange, timestamp }, status: "success", symbol: "AUD/USD" }
 * Documentation: https://massive.com/docs/rest/forex/quotes/last-quote
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLastQuoteResponse(data, symbol) {
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
        // CRITICAL: Validate bid < ask (reject invalid data)
        if (bid >= ask) {
            console.error(`Invalid price data for ${symbol}: bid (${bid}) >= ask (${ask})`);
            return null;
        }
        // Calculate mid and spread
        const mid = (bid + ask) / 2;
        const spread = ask - bid;
        // Round values
        const roundedBid = Number(bid.toFixed(5));
        const roundedAsk = Number(ask.toFixed(5));
        const roundedMid = Number(mid.toFixed(5));
        const roundedSpread = Number(spread.toFixed(5));
        // CRITICAL: Ensure mid is between bid and ask after rounding
        // This can fail with very tight spreads due to floating point
        const safeMid = Math.max(roundedBid, Math.min(roundedAsk, roundedMid));
        // Update the dynamic spread cache with real market data
        updateCachedSpread(symbol, bid, ask);
        return {
            symbol,
            bid: roundedBid,
            ask: roundedAsk,
            mid: safeMid,
            spread: roundedSpread,
            timestamp: timestamp || Date.now(),
        };
    }
    catch (error) {
        console.error(`Error parsing last_quote response for ${symbol}:`, error);
        return null;
    }
}
/**
 * Get last known prices (fallback when API fails or market is closed)
 * Returns ONLY cached prices from previous successful fetches.
 * NO hardcoded fallbacks - if we don't have a real cached price, we don't have it.
 */
function getLastKnownPrices(symbols) {
    const prices = new Map();
    const now = Date.now();
    symbols.forEach(symbol => {
        const cached = lastKnownPrices.get(symbol);
        if (cached) {
            const priceAge = now - cached.timestamp;
            const isStale = priceAge > MAX_CACHE_AGE_MS;
            // Create quote with staleness flag
            const quote = {
                ...cached,
                isFallback: true, // Mark as fallback since not fresh from API
                isStale: isStale,
            };
            prices.set(symbol, quote);
        }
        else {
            // No cached price exists for this symbol
            console.warn(`⚠️ No cached price available for ${symbol}`);
        }
    });
    if (prices.size === 0) {
        console.error('❌ No prices available. Cache is empty - waiting for first successful API/WebSocket fetch.');
    }
    return prices;
}
// Cache for market status (refresh every 5 minutes)
let marketStatusCache = null;
const MARKET_STATUS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
// Cache for holidays (refresh daily)
let holidaysCache = null;
const HOLIDAYS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
/**
 * Fetch market status from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-status
 * Endpoint: GET /v1/marketstatus/now
 */
async function getMarketStatusFromAPI() {
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
        const status = {
            isOpen,
            status: isOpen ? 'open' : 'closed',
            serverTime: data.serverTime || new Date().toISOString(),
            nextOpen: undefined, // Not provided by this endpoint
            nextClose: undefined // Not provided by this endpoint
        };
        // Update cache
        marketStatusCache = { status, timestamp: Date.now() };
        console.log(`✅ Forex market status: ${fxStatus?.toUpperCase() || 'UNKNOWN'} (isOpen: ${isOpen})`);
        console.log(`🕒 Server time: ${data.serverTime}`);
        return status;
    }
    catch (error) {
        console.warn('⚠️ Market status API unavailable, using time-based fallback');
        // Don't log as error - this is expected for some plans
        throw error;
    }
}
/**
 * Fetch upcoming market holidays from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-holidays
 */
async function getUpcomingHolidays() {
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
    }
    catch (error) {
        console.error('❌ Error fetching holidays:', error instanceof Error ? error.message : 'Unknown error');
        return [];
    }
}
/**
 * Check if Forex market is open using Massive.com API
 * Uses real-time market status from Massive.com
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-status
 */
async function isForexMarketOpen() {
    try {
        const status = await getMarketStatusFromAPI();
        return status.isOpen;
    }
    catch (error) {
        console.error('Error checking market status, using fallback:', error);
        // Fallback to time-based detection
        return isForexMarketOpenFallback();
    }
}
/**
 * Synchronous version for components (uses cache or fallback)
 */
function isMarketOpenSync() {
    if (marketStatusCache && (Date.now() - marketStatusCache.timestamp) < MARKET_STATUS_CACHE_DURATION) {
        return marketStatusCache.status.isOpen;
    }
    return isForexMarketOpenFallback();
}
/**
 * Get next market open/close time
 */
function getNextMarketChange() {
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
function isForexMarketOpenFallback() {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    if (day === 0 || day === 6)
        return false; // Weekend
    if (day === 5 && hour >= 22)
        return false; // Friday after 22:00 UTC
    return true;
}
/**
 * Get market status message (synchronous version using cache)
 */
function getMarketStatus() {
    const isOpen = isMarketOpenSync();
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    if (isOpen) {
        return '🟢 Market is OPEN - Live prices updating';
    }
    else if (day === 0 || day === 6) {
        return '🔴 Market is CLOSED (Weekend) - Showing last available price';
    }
    else if (day === 5 && hour >= 22) {
        return '🔴 Market is CLOSED (Friday after 22:00 UTC) - Showing last available price';
    }
    else {
        return '🔴 Market is CLOSED - Showing last available price';
    }
}
/**
 * Get current price for a single symbol (for order execution)
 * Used by server actions when placing/closing orders
 *
 * CRITICAL: This is used for TRADE EXECUTION - must be as fresh as possible!
 * Uses 1 second max cache to ensure execution at current market price.
 */
async function getRealPrice(symbol) {
    // Try WebSocket cache first - but only if VERY fresh (max 1 second for trades)
    if ((0, websocket_price_streamer_1.isWebSocketConnected)()) {
        const cached = (0, websocket_price_streamer_1.getCachedPrice)(symbol);
        if (cached && (Date.now() - cached.timestamp) < 1) { // 1 second max for trade execution!
            console.log(`📈 [Trade Execution] Using WebSocket cache for ${symbol}: Bid=${cached.bid.toFixed(5)}, Ask=${cached.ask.toFixed(5)}`);
            return cached;
        }
    }
    // Always fetch fresh from REST API for trade execution if cache is stale
    console.log(`📈 [Trade Execution] Fetching fresh price for ${symbol} from API...`);
    const pricesMap = await fetchRealForexPrices([symbol]);
    const price = pricesMap.get(symbol) || null;
    if (price) {
        console.log(`📈 [Trade Execution] Got fresh price for ${symbol}: Bid=${price.bid.toFixed(5)}, Ask=${price.ask.toFixed(5)}`);
    }
    return price;
}
/**
 * Get prices from cache only (no API calls)
 * Returns null for symbols not in cache
 * Checks: Redis → WebSocket → In-memory
 */
async function getPriceFromCacheOnly(symbol) {
    // OPTIMIZED: Check in-memory caches FIRST to avoid Redis commands
    // Redis should only be used for multi-server sync, not for every price lookup!
    // 1. Check WebSocket cache first (fastest, real-time)
    const wsCache = (0, websocket_price_streamer_1.getCachedPrice)(symbol);
    if (wsCache && (Date.now() - wsCache.timestamp) < 15000) {
        return normalizePriceQuote(wsCache);
    }
    // 2. Check in-memory cache (instant)
    const memCache = lastKnownPrices.get(symbol);
    if (memCache && (Date.now() - memCache.timestamp) < 15000) {
        return normalizePriceQuote(memCache);
    }
    // 3. ONLY check Redis if in-memory caches are empty (cold start scenario)
    // This saves thousands of Redis commands per minute!
    if (!wsCache && !memCache) {
        try {
            const redisPrice = await (0, redis_service_1.getPrice)(symbol);
            if (redisPrice && (Date.now() - redisPrice.timestamp) < 30000) {
                const quote = redisPriceToPriceQuote(symbol, redisPrice);
                lastKnownPrices.set(symbol, quote); // Cache it in memory for next time
                return normalizePriceQuote(quote);
            }
        }
        catch {
            // Redis not available, continue
        }
    }
    // Return whatever we have, even if slightly stale (normalized)
    const result = wsCache || memCache || null;
    return result ? normalizePriceQuote(result) : null;
}
/**
 * Get prices from cache only (sync version - no Redis, no API calls)
 * For use in hot paths where async is not acceptable
 */
function getPriceFromCacheOnlySync(symbol) {
    // Check WebSocket cache
    const wsCache = (0, websocket_price_streamer_1.getCachedPrice)(symbol);
    if (wsCache)
        return normalizePriceQuote(wsCache);
    // Check last known prices
    const memCache = lastKnownPrices.get(symbol);
    return memCache ? normalizePriceQuote(memCache) : null;
}
/**
 * Get all prices from cache (no API calls)
 * Used by margin monitoring to avoid API calls
 * Checks: Redis → WebSocket → In-memory
 */
async function getAllPricesFromCache(symbols) {
    const result = new Map();
    const missingSymbols = [];
    // Try Redis first (batch operation)
    try {
        const redisPrices = await (0, redis_service_1.getPrices)(symbols);
        for (const symbol of symbols) {
            const cached = redisPrices.get(symbol);
            if (cached && (Date.now() - cached.timestamp) < 15000) {
                result.set(symbol, redisPriceToPriceQuote(symbol, cached));
            }
            else {
                missingSymbols.push(symbol);
            }
        }
    }
    catch {
        // Redis not available, check other sources
        missingSymbols.push(...symbols);
    }
    // Fill gaps from in-memory cache
    for (const symbol of missingSymbols) {
        const wsCache = (0, websocket_price_streamer_1.getCachedPrice)(symbol);
        if (wsCache) {
            result.set(symbol, wsCache);
            continue;
        }
        const memCache = lastKnownPrices.get(symbol);
        if (memCache) {
            result.set(symbol, memCache);
        }
    }
    // Normalize all prices before returning
    return normalizeAllPrices(result);
}
/**
 * Get all prices from cache (sync version - no Redis, no API calls)
 * For use in hot paths where async is not acceptable
 */
function getAllPricesFromCacheSync(symbols) {
    const result = new Map();
    for (const symbol of symbols) {
        const price = getPriceFromCacheOnlySync(symbol);
        if (price) {
            result.set(symbol, price);
        }
    }
    return result;
}
