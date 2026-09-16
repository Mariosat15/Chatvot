/**
 * Per-game Game Master earnings rollups (X7 step 5).
 *
 * Groups on the immutable `gameKey` stamped at distribute write time.
 * Never calls `getEnabledGameTypes()` — disabling a game must not erase history (R29).
 * Absent / blank / null gameKey reads as "trading" (invariant 5).
 */

export const TRADING_GAME_KEY = "trading";

/** Normalise a stored (or missing) earning gameKey for grouping. */
export function resolveEarningGameKey(
  gameKey: string | null | undefined,
): string {
  if (typeof gameKey === "string" && gameKey.trim()) return gameKey.trim();
  return TRADING_GAME_KEY;
}

export interface EarningByGameRow {
  gameKey: string;
  netEarning: number;
  count: number;
}

/**
 * Roll up lean earning documents by gameKey.
 * Pure — no DB — so both the player earnings route and tests can use it.
 */
export function summariseEarningsByGame(
  earnings: ReadonlyArray<{ gameKey?: string | null; netEarning?: number }>,
): EarningByGameRow[] {
  const map = new Map<string, { netEarning: number; count: number }>();
  for (const row of earnings) {
    const key = resolveEarningGameKey(row.gameKey);
    const prev = map.get(key) || { netEarning: 0, count: 0 };
    prev.netEarning += Number(row.netEarning) || 0;
    prev.count += 1;
    map.set(key, prev);
  }
  return [...map.entries()]
    .map(([gameKey, v]) => ({
      gameKey,
      netEarning: v.netEarning,
      count: v.count,
    }))
    .sort((a, b) => b.netEarning - a.netEarning || a.gameKey.localeCompare(b.gameKey));
}

/**
 * Mongo aggregation stages: match already applied; group by coalesced gameKey.
 * Shared so player dashboard and admin earnings stay one spelling.
 */
export function earningsByGameGroupStages(): object[] {
  return [
    {
      $group: {
        _id: {
          $cond: [
            {
              $and: [
                { $ne: ["$gameKey", null] },
                { $ne: ["$gameKey", ""] },
              ],
            },
            "$gameKey",
            TRADING_GAME_KEY,
          ],
        },
        netEarning: { $sum: "$netEarning" },
        count: { $sum: 1 },
      },
    },
    { $sort: { netEarning: -1, _id: 1 } },
    {
      $project: {
        _id: 0,
        gameKey: "$_id",
        netEarning: 1,
        count: 1,
      },
    },
  ];
}
