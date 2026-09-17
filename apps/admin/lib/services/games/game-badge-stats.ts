/**
 * Per-game stats slice for badge evaluation (R96b).
 * Reads UserGameStats only — never recomputes from enabled games (R29).
 */

import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import { normalizeBadgeGameTypes } from "@/lib/services/games/badge-game-scope";

export interface GameBadgeStatsRow {
  contestsEntered: number;
  contestsCompleted: number;
  wins: number;
  podiums: number;
  totalPoints: number;
  rating: number;
  bestRank: number;
  currentStreak: number;
}

const EMPTY: GameBadgeStatsRow = {
  contestsEntered: 0,
  contestsCompleted: 0,
  wins: 0,
  podiums: 0,
  totalPoints: 0,
  rating: 0,
  bestRank: 0,
  currentStreak: 0,
};

function rowFromDoc(doc: {
  contestsEntered?: number;
  contestsCompleted?: number;
  wins?: number;
  podiums?: number;
  totalPoints?: number;
  rating?: number;
  bestRank?: number;
  currentStreak?: number;
} | null): GameBadgeStatsRow {
  if (!doc) return { ...EMPTY };
  return {
    contestsEntered: doc.contestsEntered || 0,
    contestsCompleted: doc.contestsCompleted || 0,
    wins: doc.wins || 0,
    podiums: doc.podiums || 0,
    totalPoints: doc.totalPoints || 0,
    rating: doc.rating || 0,
    bestRank: doc.bestRank || 0,
    currentStreak: doc.currentStreak || 0,
  };
}

/**
 * Which UserGameStats row a game-scoped badge reads.
 *
 * Reason: a badge scoped to one provider key reads that key; trading-only
 * reads `trading`; empty / platform reads `_overall` so cross-game progress
 * counts. Never sums the enabled set (R29).
 */
export function resolveGameStatsKey(
  gameTypes: string[] | null | undefined,
): string {
  const types = normalizeBadgeGameTypes(gameTypes);
  const providers = types.filter(
    (t) => t !== TRADING_GAME_TYPE && t !== "*" && t !== "all",
  );
  if (providers.length === 1) return providers[0];
  if (types.length === 1 && types[0] === TRADING_GAME_TYPE) {
    return TRADING_GAME_TYPE;
  }
  return OVERALL_GAME_KEY;
}

/**
 * Load one player's game stats keyed by gameKey (including `_overall`).
 */
export async function loadGameBadgeStatsMap(
  userId: string,
): Promise<Map<string, GameBadgeStatsRow>> {
  const map = new Map<string, GameBadgeStatsRow>();
  if (!userId) return map;
  const rows = await UserGameStats.find({ userId }).lean();
  for (const row of rows) {
    if (!row.gameKey) continue;
    map.set(row.gameKey, rowFromDoc(row));
  }
  return map;
}

export function gameStatValue(
  map: Map<string, GameBadgeStatsRow>,
  gameKey: string,
  field: keyof GameBadgeStatsRow,
): number {
  // Reason: `field` is a keyof union, so the lookup cannot reach the prototype
  // chain — there is no narrower typing to reach for, and the row is a plain
  // object built by `rowFromDoc`, never the caller's.
  // eslint-disable-next-line security/detect-object-injection
  return map.get(gameKey)?.[field] ?? 0;
}
