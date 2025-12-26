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
/**
 * Initialize WebSocket connection and TP/SL cache
 */
export declare function initializeWebSocket(): Promise<void>;
/**
 * Get cached price for a symbol (normalized)
 */
export declare function getCachedPrice(symbol: ForexSymbol): StreamingPriceQuote | null;
/**
 * Get all cached prices (normalized)
 */
export declare function getAllCachedPrices(): Map<ForexSymbol, StreamingPriceQuote>;
/**
 * Get multiple cached prices (normalized)
 */
export declare function getCachedPrices(symbols: ForexSymbol[]): Map<ForexSymbol, StreamingPriceQuote>;
/**
 * Check if WebSocket is connected and streaming
 */
export declare function isWebSocketConnected(): boolean;
/**
 * Get WebSocket status
 */
export declare function getConnectionStatus(): {
    connected: boolean;
    authenticated: boolean;
    subscribed: boolean;
    cachedPairs: number;
    lastUpdate: number;
    reconnectAttempts: number;
};
/**
 * Update cache from REST API (fallback)
 */
export declare function updateCacheFromRest(symbol: ForexSymbol, quote: Omit<StreamingPriceQuote, 'source'>): void;
/**
 * Close WebSocket connection
 */
export declare function closeWebSocket(): void;
/**
 * Reset and reconnect
 */
export declare function resetWebSocket(): void;
