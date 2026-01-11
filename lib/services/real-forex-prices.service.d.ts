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
import { ForexSymbol } from './pnl-calculator.service';
export interface PriceQuote {
    symbol: ForexSymbol;
    bid: number;
    ask: number;
    mid: number;
    spread: number;
    timestamp: number;
    isFallback?: boolean;
    isStale?: boolean;
}
/**
 * Normalize a price quote - ensures mid and spread are ALWAYS calculated from bid/ask
 * This prevents mid from lagging behind bid/ask updates
 */
export declare function normalizePriceQuote(quote: PriceQuote): PriceQuote;
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
/**
 * Update the cached spread for a symbol based on actual bid/ask data
 * Uses exponential smoothing to prevent wild spread jumps from bad data
 * Called whenever we receive real bid/ask prices
 */
export declare function updateCachedSpread(symbol: ForexSymbol, bid: number, ask: number): void;
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
export declare function fetchRealForexPrices(symbols: ForexSymbol[]): Promise<Map<ForexSymbol, PriceQuote>>;
/**
 * Fetch market status from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-status
 * Endpoint: GET /v1/marketstatus/now
 */
export declare function getMarketStatusFromAPI(): Promise<MarketStatus>;
/**
 * Fetch upcoming market holidays from Massive.com API
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-holidays
 */
export declare function getUpcomingHolidays(): Promise<MarketHoliday[]>;
/**
 * Check if Forex market is open using Massive.com API
 * Uses real-time market status from Massive.com
 * Documentation: https://massive.com/docs/rest/forex/market-operations/market-status
 */
export declare function isForexMarketOpen(): Promise<boolean>;
/**
 * Synchronous version for components (uses cache or fallback)
 */
export declare function isMarketOpenSync(): boolean;
/**
 * Get next market open/close time
 */
export declare function getNextMarketChange(): {
    type: 'open' | 'close';
    time: Date;
} | null;
/**
 * Get market status message (synchronous version using cache)
 */
export declare function getMarketStatus(): string;
/**
 * Get current price for a single symbol (for order execution)
 * Used by server actions when placing/closing orders
 *
 * CRITICAL: This is used for TRADE EXECUTION - must be as fresh as possible!
 * Uses 1 second max cache to ensure execution at current market price.
 */
export declare function getRealPrice(symbol: ForexSymbol): Promise<PriceQuote | null>;
/**
 * Get prices from cache only (no API calls)
 * Returns null for symbols not in cache
 * Checks: Redis → WebSocket → In-memory
 */
export declare function getPriceFromCacheOnly(symbol: ForexSymbol): Promise<PriceQuote | null>;
/**
 * Get prices from cache only (sync version - no Redis, no API calls)
 * For use in hot paths where async is not acceptable
 */
export declare function getPriceFromCacheOnlySync(symbol: ForexSymbol): PriceQuote | null;
/**
 * Get all prices from cache (no API calls)
 * Used by margin monitoring to avoid API calls
 * Checks: Redis → WebSocket → In-memory
 */
export declare function getAllPricesFromCache(symbols: ForexSymbol[]): Promise<Map<ForexSymbol, PriceQuote>>;
/**
 * Get all prices from cache (sync version - no Redis, no API calls)
 * For use in hot paths where async is not acceptable
 */
export declare function getAllPricesFromCacheSync(symbols: ForexSymbol[]): Map<ForexSymbol, PriceQuote>;
