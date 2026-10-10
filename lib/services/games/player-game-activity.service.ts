import { connectToDatabase } from "@/database/mongoose";
import GameRound from "@/database/models/games/game-round.model";
import { SCORE_PRODUCING_ROUND_STATUSES } from "@/lib/services/games/round-types";

/**
 * Per-day ranked game activity for the Performance tab trend and card sparklines.
 *
 * Main-app only, deliberately separate from `player-game-performance.service.ts`, whose
 * aggregation is pinned against the admin copy. This answers a different question - how
 * much did the player play on each day - and nothing in the admin app asks it.
 *
 * Counts SCORED rounds only (same status list ranking reads), so a voided round is not
 * reported as activity the player earned. No score values are combined: summing or
 * averaging raw scores across titles with different units and directions is meaningless.
 */
export interface PlayerGameActivityDay {
  gameKey: string;
  /** YYYY-MM-DD, UTC. */
  date: string;
  rounds: number;
}

/** Days of history returned. Covers the page's longest fixed range (90D). */
export const GAME_ACTIVITY_WINDOW_DAYS = 120;

export async function getPlayerGameActivity(
  userId: string,
): Promise<PlayerGameActivityDay[]> {
  if (typeof userId !== "string" || userId.trim() === "") return [];

  await connectToDatabase();

  const since = new Date(Date.now() - GAME_ACTIVITY_WINDOW_DAYS * 86_400_000);

  const rows = await GameRound.aggregate<{
    _id: { gameKey: string; date: string };
    rounds: number;
  }>([
    {
      $match: {
        userId: userId.trim(),
        mode: "ranked",
        status: { $in: SCORE_PRODUCING_ROUND_STATUSES },
        rawScore: { $type: "number" },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          gameKey: "$gameKey",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        rounds: { $sum: 1 },
      },
    },
  ]);

  return rows
    .filter((row) => Boolean(row._id?.gameKey))
    .map((row) => ({
      gameKey: row._id.gameKey,
      date: row._id.date,
      rounds: row.rounds,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
