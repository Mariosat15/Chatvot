/**
 * Player profile read of `UserGameStats` (X7 step 3).
 *
 * Reads only — never recomputes totals (must agree with the leaderboard).
 * Main-app only: the player profile lives here; admin has its own performance tab.
 */

import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import { TRADING_GAME_TYPE } from "@/lib/games/types";
import {
  CROSS_GAME_SCORING_STARTED_CAPTION,
  labelForGameKey,
} from "@/lib/services/games/game-leaderboard.service";

export interface PlayerGameRow {
  gameKey: string;
  label: string;
  isTrading: boolean;
  contestsEntered: number;
  contestsCompleted: number;
  wins: number;
  podiums: number;
  totalPoints: number;
  seasonPoints: number;
  rating: number;
  bestRank: number;
  bestScore: number;
  currentStreak: number;
  lastPlayedAt?: string;
}

export interface PlayerGameProfile {
  overall: {
    contestsEntered: number;
    contestsCompleted: number;
    wins: number;
    podiums: number;
    totalPoints: number;
    seasonPoints: number;
    bestRank: number;
    currentStreak: number;
  } | null;
  perGame: PlayerGameRow[];
  startsFromCaption: string;
}

const EMPTY_OVERALL = {
  contestsEntered: 0,
  contestsCompleted: 0,
  wins: 0,
  podiums: 0,
  totalPoints: 0,
  seasonPoints: 0,
  bestRank: 0,
  currentStreak: 0,
};

/**
 * Profile standing for one player. Absent overall row → zeros with the
 * question-14 caption still attached (aggregates start empty, not missing).
 */
export async function getPlayerGameProfile(
  userId: string,
): Promise<PlayerGameProfile> {
  if (!userId) {
    return {
      overall: { ...EMPTY_OVERALL },
      perGame: [],
      startsFromCaption: CROSS_GAME_SCORING_STARTED_CAPTION,
    };
  }

  const rows = await UserGameStats.find({ userId })
    .select(
      "gameKey contestsEntered contestsCompleted wins podiums totalPoints seasonPoints rating bestRank bestScore currentStreak lastPlayedAt",
    )
    .lean();

  let overall: PlayerGameProfile["overall"] = { ...EMPTY_OVERALL };
  const gameRows = [];

  for (const row of rows) {
    if (!row.gameKey) continue;
    if (row.gameKey === OVERALL_GAME_KEY) {
      overall = {
        contestsEntered: row.contestsEntered ?? 0,
        contestsCompleted: row.contestsCompleted ?? 0,
        wins: row.wins ?? 0,
        podiums: row.podiums ?? 0,
        totalPoints: row.totalPoints ?? 0,
        seasonPoints: row.seasonPoints ?? 0,
        bestRank: row.bestRank ?? 0,
        currentStreak: row.currentStreak ?? 0,
      };
      continue;
    }
    gameRows.push(row);
  }

  // Reason: labels come from the catalogue; resolve once per key, never invent "Unknown".
  const labels = await Promise.all(
    gameRows.map((row) => labelForGameKey(row.gameKey as string)),
  );

  const perGame: PlayerGameRow[] = gameRows.map((row, i) => ({
    gameKey: row.gameKey as string,
    label: labels[i],
    isTrading: row.gameKey === TRADING_GAME_TYPE,
    contestsEntered: row.contestsEntered ?? 0,
    contestsCompleted: row.contestsCompleted ?? 0,
    wins: row.wins ?? 0,
    podiums: row.podiums ?? 0,
    totalPoints: row.totalPoints ?? 0,
    seasonPoints: row.seasonPoints ?? 0,
    rating: row.rating ?? 1200,
    bestRank: row.bestRank ?? 0,
    bestScore: row.bestScore ?? 0,
    currentStreak: row.currentStreak ?? 0,
    lastPlayedAt: row.lastPlayedAt
      ? new Date(row.lastPlayedAt).toISOString()
      : undefined,
  }));

  perGame.sort((a, b) => {
    if (a.isTrading !== b.isTrading) return a.isTrading ? -1 : 1;
    return b.totalPoints - a.totalPoints;
  });

  return {
    overall,
    perGame,
    startsFromCaption: CROSS_GAME_SCORING_STARTED_CAPTION,
  };
}
