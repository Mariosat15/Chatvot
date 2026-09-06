/**
 * Shared in-memory ranking cache for live competition rankings.
 *
 * Why a shared module?
 * - The live-ranking API route caches results to avoid redundant DB queries
 *   when multiple users poll the same competition.
 * - When a position is closed, we need to invalidate this cache so the next
 *   poll returns fresh data (with updated win rate, PnL, etc.).
 * - Both the API route and position actions run in the same Node.js process
 *   (self-hosted via PM2), so they share this in-memory Map.
 */

const rankingCache = new Map<
  string,
  { data: Record<string, unknown>; ts: number }
>();

// Reason: 3 seconds is short enough for near-real-time feel, long enough
// to coalesce multiple viewers polling the same competition simultaneously.
export const RANKING_CACHE_TTL = 3000;

/** Get cached ranking data if still fresh */
export function getRankingFromCache(
  competitionId: string,
): { data: Record<string, unknown>; ts: number } | null {
  const cached = rankingCache.get(competitionId);
  if (cached && Date.now() - cached.ts < RANKING_CACHE_TTL) {
    return cached;
  }
  return null;
}

/** Store ranking data in cache */
export function setRankingCache(
  competitionId: string,
  data: Record<string, unknown>,
): void {
  rankingCache.set(competitionId, { data, ts: Date.now() });
}

/**
 * Invalidate (delete) cached ranking for a specific competition.
 * Call this after any operation that changes participant stats
 * (position close, liquidation, etc.) so the next API poll returns fresh data.
 */
export function invalidateRankingCache(competitionId: string): void {
  rankingCache.delete(competitionId);
}
