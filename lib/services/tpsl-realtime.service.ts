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

// Position with TP/SL for cache
interface CachedPosition {
  _id: string;
  symbol: string;
  side: 'long' | 'short';
  takeProfit: number | null;
  stopLoss: number | null;
  entryPrice: number;
  quantity: number;
  userId: string;
  competitionId: string;
  lastChecked: number;
}

// In-memory cache: symbol -> positions with TP/SL
const positionsCache = new Map<string, CachedPosition[]>();
let lastCacheRefresh = 0;
const CACHE_REFRESH_INTERVAL = 30000; // Refresh cache every 30 seconds
const POSITION_COOLDOWN = 1000; // Don't re-check same position within 1 second (was 5s - too slow!)

// Track positions being closed to prevent double execution
const closingPositions = new Set<string>();

// Debounce closing to prevent race conditions
const recentlyTriggered = new Map<string, number>();
const TRIGGER_COOLDOWN = 10000; // 10 second cooldown after trigger

/**
 * Check TP/SL for a symbol when price updates
 * Called from WebSocket price handler - must be FAST!
 */
export async function checkTPSLForSymbol(
  symbol: ForexSymbol,
  bid: number,
  ask: number
): Promise<void> {
  // Get cached positions for this symbol
  const positions = positionsCache.get(symbol);
  if (!positions || positions.length === 0) return;

  const now = Date.now();
  const triggeredPositions: { position: CachedPosition; price: number; reason: 'take_profit' | 'stop_loss' }[] = [];

  for (const position of positions) {
    // Skip if already being closed
    if (closingPositions.has(position._id)) continue;
    
    // Skip if recently triggered (cooldown)
    const lastTrigger = recentlyTriggered.get(position._id);
    if (lastTrigger && now - lastTrigger < TRIGGER_COOLDOWN) continue;

    // Skip if checked too recently
    if (now - position.lastChecked < POSITION_COOLDOWN) continue;
    position.lastChecked = now;

    // Get market price based on position side
    // Long positions close at BID, Short positions close at ASK
    const marketPrice = position.side === 'long' ? bid : ask;

    // Check Stop Loss
    if (position.stopLoss !== null) {
      if (position.side === 'long' && marketPrice <= position.stopLoss) {
        triggeredPositions.push({ position, price: marketPrice, reason: 'stop_loss' });
        continue;
      } else if (position.side === 'short' && marketPrice >= position.stopLoss) {
        triggeredPositions.push({ position, price: marketPrice, reason: 'stop_loss' });
        continue;
      }
    }

    // Check Take Profit
    if (position.takeProfit !== null) {
      if (position.side === 'long' && marketPrice >= position.takeProfit) {
        triggeredPositions.push({ position, price: marketPrice, reason: 'take_profit' });
        continue;
      } else if (position.side === 'short' && marketPrice <= position.takeProfit) {
        triggeredPositions.push({ position, price: marketPrice, reason: 'take_profit' });
        continue;
      }
    }
  }

  // Close triggered positions (async, don't block price updates)
  if (triggeredPositions.length > 0) {
    // IMMEDIATELY mark all triggered positions as closing to prevent race conditions
    // This must happen SYNCHRONOUSLY before any async operations
    for (const { position } of triggeredPositions) {
      closingPositions.add(position._id);
      recentlyTriggered.set(position._id, Date.now());
    }
    
    // Fire and forget - don't await
    closeTriggeredPositions(triggeredPositions).catch(err => {
      console.error('Error closing triggered positions:', err);
    });
  }
}

/**
 * Close positions that hit TP/SL
 */
async function closeTriggeredPositions(
  triggers: { position: CachedPosition; price: number; reason: 'take_profit' | 'stop_loss' }[]
): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { closePositionAutomatic } = await import('@/lib/actions/trading/position.actions');
  
  // Process positions sequentially to avoid database conflicts
  for (const { position, price, reason } of triggers) {
    // Note: position was already added to closingPositions synchronously in checkTPSLForSymbol
    // This is just a safety check
    if (!closingPositions.has(position._id)) {
      console.warn(`⚠️ [REALTIME TP/SL] Position ${position._id} not in closingPositions set - skipping`);
      continue;
    }

    try {
      console.log(`⚡ [REALTIME TP/SL] Closing ${reason} for ${position.symbol} @ ${price.toFixed(5)}`);
      console.log(`   Position: ${position.side} entry=${position.entryPrice}, tp=${position.takeProfit}, sl=${position.stopLoss}`);
      
      // Remove from cache FIRST to prevent re-triggering
      removePositionFromCache(position._id, position.symbol);
      
      await closePositionAutomatic(position._id, price, reason);
      
      console.log(`✅ [REALTIME TP/SL] Closed position ${position._id}`);
    } catch (error) {
      // Log error but don't re-add to cache - the position might have been closed already
      console.error(`❌ [REALTIME TP/SL] Failed to close position ${position._id}:`, error);
      
      // If it's a WriteConflict, the position was likely closed by another process
      // Don't retry - the backup worker will handle any truly missed positions
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('WriteConflict')) {
        console.log(`   ↳ WriteConflict indicates position may already be closed`);
      }
    } finally {
      // Allow re-check after cooldown (in case close failed for non-conflict reason)
      setTimeout(() => {
        closingPositions.delete(position._id);
      }, TRIGGER_COOLDOWN);
    }
  }
}

/**
 * Remove a position from cache (after close or TP/SL removed)
 */
function removePositionFromCache(positionId: string, symbol: string): void {
  const positions = positionsCache.get(symbol);
  if (!positions) return;
  
  const index = positions.findIndex(p => p._id === positionId);
  if (index !== -1) {
    positions.splice(index, 1);
  }
}

/**
 * Refresh the positions cache from database
 * Called periodically and on-demand
 */
export async function refreshPositionsCache(): Promise<void> {
  const now = Date.now();
  
  // Don't refresh too frequently
  if (now - lastCacheRefresh < CACHE_REFRESH_INTERVAL / 2) return;
  lastCacheRefresh = now;

  try {
    const { connectToDatabase } = await import('@/database/mongoose');
    const TradingPosition = (await import('@/database/models/trading/trading-position.model')).default;
    
    await connectToDatabase();

    // Find all open positions with TP or SL set
    interface PositionDoc {
      _id: { toString(): string };
      symbol: string;
      side: 'long' | 'short';
      takeProfit?: number;
      stopLoss?: number;
      entryPrice: number;
      quantity: number;
      userId: { toString(): string };
      competitionId: { toString(): string };
    }
    
    const positions = await TradingPosition.find({
      status: 'open',
      $or: [
        { takeProfit: { $exists: true, $ne: null } },
        { stopLoss: { $exists: true, $ne: null } },
      ],
    }).select('_id symbol side takeProfit stopLoss entryPrice quantity userId competitionId').lean() as unknown as PositionDoc[];

    // Clear and rebuild cache
    positionsCache.clear();

    for (const pos of positions) {
      const symbol = pos.symbol;
      
      if (!positionsCache.has(symbol)) {
        positionsCache.set(symbol, []);
      }

      positionsCache.get(symbol)!.push({
        _id: pos._id.toString(),
        symbol: pos.symbol,
        side: pos.side,
        takeProfit: pos.takeProfit ?? null,
        stopLoss: pos.stopLoss ?? null,
        entryPrice: pos.entryPrice,
        quantity: pos.quantity,
        userId: pos.userId.toString(),
        competitionId: pos.competitionId.toString(),
        lastChecked: 0,
      });
    }

    const totalPositions = Array.from(positionsCache.values()).reduce((sum, arr) => sum + arr.length, 0);
    const symbolCount = positionsCache.size;
    
    if (totalPositions > 0) {
      console.log(`📊 [TP/SL Cache] Refreshed: ${totalPositions} positions across ${symbolCount} symbols`);
    }
  } catch (error) {
    console.error('❌ [TP/SL Cache] Failed to refresh:', error);
  }
}

/**
 * Add or update a position in the cache
 * Called when a new position is opened or TP/SL is modified
 */
export function updatePositionInCache(
  positionId: string,
  symbol: string,
  side: 'long' | 'short',
  takeProfit: number | null,
  stopLoss: number | null,
  entryPrice: number,
  quantity: number,
  userId: string,
  competitionId: string
): void {
  // If no TP/SL, remove from cache
  if (takeProfit === null && stopLoss === null) {
    removePositionFromCache(positionId, symbol);
    return;
  }

  if (!positionsCache.has(symbol)) {
    positionsCache.set(symbol, []);
  }

  const positions = positionsCache.get(symbol)!;
  const existingIndex = positions.findIndex(p => p._id === positionId);

  const cached: CachedPosition = {
    _id: positionId,
    symbol,
    side,
    takeProfit,
    stopLoss,
    entryPrice,
    quantity,
    userId,
    competitionId,
    lastChecked: 0,
  };

  if (existingIndex !== -1) {
    positions[existingIndex] = cached;
  } else {
    positions.push(cached);
  }
}

/**
 * Get cache statistics
 */
export function getTPSLCacheStats(): { totalPositions: number; symbols: number; lastRefresh: number } {
  const totalPositions = Array.from(positionsCache.values()).reduce((sum, arr) => sum + arr.length, 0);
  return {
    totalPositions,
    symbols: positionsCache.size,
    lastRefresh: lastCacheRefresh,
  };
}

/**
 * Initialize the cache (call on startup)
 */
export async function initializeTPSLCache(): Promise<void> {
  console.log('🚀 [TP/SL Cache] Initializing real-time TP/SL service...');
  await refreshPositionsCache();
  
  // Set up periodic refresh
  setInterval(() => {
    refreshPositionsCache().catch(console.error);
  }, CACHE_REFRESH_INTERVAL);
  
  console.log('✅ [TP/SL Cache] Ready for real-time TP/SL triggering');
}

