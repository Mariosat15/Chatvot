/**
 * Real-Time TP/SL Trigger Service
 *
 * This service provides INSTANT TP/SL triggering when prices update.
 * Instead of polling every minute, it reacts to price changes in real-time.
 *
 * Architecture:
 * 1. Maintains in-memory cache of positions with TP/SL, indexed by symbol
 * 2. Called on every price update from WebSocket
 * 3. Only checks positions for the updated symbol (very fast!)
 * 4. Closes positions instantly when TP/SL is hit
 * 5. Worker runs as backup sweep to catch any missed closures
 *
 * Performance:
 * - Checking 1000 positions for 1 symbol = ~1ms
 * - No database queries on hot path (uses cache)
 * - Positions are refreshed periodically and on-demand
 */
import { ForexSymbol } from './pnl-calculator.service';
/**
 * Check TP/SL for a symbol when price updates
 * Called from WebSocket price handler - must be FAST!
 */
export declare function checkTPSLForSymbol(symbol: ForexSymbol, bid: number, ask: number): Promise<void>;
/**
 * Refresh the positions cache from database
 * Called periodically and on-demand
 */
export declare function refreshPositionsCache(): Promise<void>;
/**
 * Add or update a position in the cache
 * Called when a new position is opened or TP/SL is modified
 */
export declare function updatePositionInCache(positionId: string, symbol: string, side: 'long' | 'short', takeProfit: number | null, stopLoss: number | null, entryPrice: number, quantity: number, userId: string, competitionId: string): void;
/**
 * Get cache statistics
 */
export declare function getTPSLCacheStats(): {
    totalPositions: number;
    symbols: number;
    lastRefresh: number;
};
/**
 * Initialize the cache (call on startup)
 */
export declare function initializeTPSLCache(): Promise<void>;
//# sourceMappingURL=tpsl-realtime.service.d.ts.map