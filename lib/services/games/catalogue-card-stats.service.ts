import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { TRADING_GAME_TYPE } from "@/lib/games";

/**
 * Real per-game figures for the `/games` launcher cards.
 *
 * Reason (8 Oct 2026, owner Rebuild theGame Area): Image 1 shows players / contests /
 * positive. Invented numbers are forbidden — when a count is zero the metric is omitted
 * by the card, never shown as a fake total.
 *
 * MAIN-APP ONLY. Discovery path; does not call getEnabledGameTypes() for the read (R29).
 */

export interface CatalogueCardStats {
  playerCount: number;
  contestCount: number;
  /**
   * 0–100 inclusive when we have scored seats; absent when none.
   * Share of scored seats with score > 0 or pnl > 0 — not a star / review rating.
   */
  positiveRate?: number;
}

type ContestAgg = { _id: string; count: number };
type SeatAgg = {
  _id: string;
  players: string[];
  scored: number;
  positive: number;
};

function emptyStats(): CatalogueCardStats {
  return { playerCount: 0, contestCount: 0 };
}

/**
 * Aggregate seat + contest counts for the supplied gameKeys in one pass each.
 * Trading also matches pre-X1 rows with a missing gameKey (invariant 5).
 */
export async function loadCatalogueCardStats(
  gameKeys: string[],
): Promise<Map<string, CatalogueCardStats>> {
  const out = new Map<string, CatalogueCardStats>();
  const keys = [...new Set(gameKeys.filter((k) => typeof k === "string" && k.trim()))];
  for (const key of keys) out.set(key, emptyStats());
  if (keys.length === 0) return out;

  await connectToDatabase();

  const includesTrading = keys.includes(TRADING_GAME_TYPE);
  const contestMatch: Record<string, unknown> = includesTrading
    ? {
        $or: [
          { gameKey: { $in: keys } },
          { gameKey: { $exists: false } },
          { gameKey: null },
          { gameKey: "" },
        ],
      }
    : { gameKey: { $in: keys } };

  const [contestRows, seatRows] = await Promise.all([
    Competition.aggregate<ContestAgg>([
      { $match: contestMatch },
      {
        $group: {
          // Reason: absent label → trading so pre-X1 contests land on the trading card.
          _id: { $ifNull: [{ $cond: [{ $eq: ["$gameKey", ""] }, null, "$gameKey"] }, TRADING_GAME_TYPE] },
          count: { $sum: 1 },
        },
      },
    ]),
    CompetitionParticipant.aggregate<SeatAgg>([
      {
        $match: includesTrading
          ? {
              $or: [
                { gameKey: { $in: keys } },
                { gameKey: { $exists: false } },
                { gameKey: null },
                { gameKey: "" },
              ],
            }
          : { gameKey: { $in: keys } },
      },
      {
        $group: {
          _id: {
            $ifNull: [
              { $cond: [{ $eq: ["$gameKey", ""] }, null, "$gameKey"] },
              TRADING_GAME_TYPE,
            ],
          },
          players: { $addToSet: "$userId" },
          scored: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: [{ $type: "$score" }, ["double", "int", "long", "decimal"]] },
                    { $gt: ["$totalTrades", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          positive: {
            $sum: {
              $cond: [{ $or: [{ $gt: ["$score", 0] }, { $gt: ["$pnl", 0] }] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  for (const row of contestRows) {
    const key = row._id || TRADING_GAME_TYPE;
    if (!out.has(key)) continue;
    out.get(key)!.contestCount = row.count;
  }

  for (const row of seatRows) {
    const key = row._id || TRADING_GAME_TYPE;
    if (!out.has(key)) continue;
    const stats = out.get(key)!;
    stats.playerCount = Array.isArray(row.players) ? row.players.length : 0;
    if (row.scored > 0) {
      stats.positiveRate = Math.round((row.positive / row.scored) * 100);
    }
  }

  return out;
}
