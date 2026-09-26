/**
 * Which games a player has actually played (X7 step 4).
 * Used to hide unearnable per-game badges without recomputing stats.
 */

import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import TradeHistory from "@/database/models/trading/trade-history.model";

export interface PlayedGamesSnapshot {
  gameKeys: Set<string>;
  hasTradingActivity: boolean;
}

/**
 * Played set = UserGameStats rows (minus `_overall`) plus trading if any
 * TradeHistory row exists. Does not call getEnabledGameTypes (R29).
 */
export async function getPlayedGamesSnapshot(
  userId: string,
): Promise<PlayedGamesSnapshot> {
  const gameKeys = new Set<string>();
  if (!userId) {
    return { gameKeys, hasTradingActivity: false };
  }

  const rows = await UserGameStats.find({ userId })
    .select("gameKey")
    .lean();

  for (const row of rows) {
    if (!row.gameKey || row.gameKey === OVERALL_GAME_KEY) continue;
    gameKeys.add(row.gameKey);
  }

  let hasTradingActivity = gameKeys.has(TRADING_GAME_TYPE);
  if (!hasTradingActivity) {
    const anyTrade = await TradeHistory.exists({ userId });
    hasTradingActivity = Boolean(anyTrade);
    if (hasTradingActivity) gameKeys.add(TRADING_GAME_TYPE);
  }

  return { gameKeys, hasTradingActivity };
}
