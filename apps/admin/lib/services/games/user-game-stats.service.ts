/**
 * ONE writer for `UserGameStats`. Called from `awardContestRewards` after money
 * has committed. Accumulates on settlement; nothing recomputes on read (R29).
 *
 * Writes the per-gameKey row and the `"_overall"` rollup in the same pass. The
 * overall row is a stored document, never a sum over enabled games — disabling
 * a title must not demote a player who earned points in it.
 */

import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";
import {
  clampRating,
  computeNormalizedPoints,
  computeRatingDelta,
} from "@/lib/services/games/normalized-points";

export interface ContestFinishRecord {
  userId: string;
  gameKey: string;
  /** 1-based rank, or absent when the player holds no place. */
  rank?: number;
  fieldSize: number;
  entryFee: number;
  /** Raw score in the game's units. Absent when the player has none (R50). */
  rawScore?: number;
  playedAt?: Date;
}

export interface ContestFinishResult {
  points: number;
  ratingDelta: number;
}

async function upsertFinish(
  userId: string,
  gameKey: string,
  args: {
    points: number;
    rank?: number;
    fieldSize: number;
    rawScore?: number;
    playedAt: Date;
    applyRating: boolean;
  },
): Promise<number> {
  const { points, rank, fieldSize, rawScore, playedAt, applyRating } = args;

  const isWin = rank === 1;
  const isPodium = typeof rank === "number" && rank >= 1 && rank <= 3;

  const existing = await UserGameStats.findOne({ userId, gameKey })
    .select("rating currentStreak")
    .lean<{ rating?: number; currentStreak?: number }>();

  let ratingDelta = 0;
  const setFields: Record<string, unknown> = {
    lastPlayedAt: playedAt,
    // Reason: podium continues the streak; anything else resets. Cannot express
    // both with a bare $inc.
    currentStreak: isPodium ? (existing?.currentStreak ?? 0) + 1 : 0,
  };

  if (applyRating && typeof rank === "number" && rank >= 1 && fieldSize > 1) {
    const current = existing?.rating ?? 1200;
    ratingDelta = computeRatingDelta({ rank, fieldSize });
    setFields.rating = clampRating(current + ratingDelta);
  }

  const setOnInsert: Record<string, unknown> = {
    userId,
    gameKey,
    bestRank: 0,
    bestScore: 0,
    extra: {},
  };

  // Reason: Mongo forbids the same path in $set and $setOnInsert in one update
  // ("Updating the path 'rating' would create a conflict"). Put the default on
  // insert only when this call is NOT also writing a computed rating.
  if (!("rating" in setFields)) {
    setOnInsert.rating = 1200;
  }

  const update: Record<string, unknown> = {
    $setOnInsert: setOnInsert,
    $inc: {
      contestsEntered: 1,
      contestsCompleted: 1,
      wins: isWin ? 1 : 0,
      podiums: isPodium ? 1 : 0,
      totalPoints: points,
      seasonPoints: points,
    },
    $set: setFields,
  };

  if (typeof rank === "number" && rank >= 1) {
    // Reason: $min on a missing field creates it; skip the 0 insert default so
    // a first-place finish is not then min'd against an insert of 0.
    update.$min = { bestRank: rank };
    delete (update.$setOnInsert as Record<string, unknown>).bestRank;
  }

  if (typeof rawScore === "number" && Number.isFinite(rawScore)) {
    update.$max = { bestScore: rawScore };
    delete (update.$setOnInsert as Record<string, unknown>).bestScore;
  }

  await UserGameStats.findOneAndUpdate({ userId, gameKey }, update, {
    upsert: true,
  });

  return ratingDelta;
}

/**
 * Record one player's finish against their gameKey row and the `"_overall"` row.
 * Never throws — caller has already paid.
 */
export async function recordContestFinish(
  record: ContestFinishRecord,
): Promise<ContestFinishResult> {
  const playedAt = record.playedAt ?? new Date();
  const points = computeNormalizedPoints({
    rank: record.rank,
    fieldSize: record.fieldSize,
    entryFee: record.entryFee,
  });

  try {
    const ratingDelta = await upsertFinish(record.userId, record.gameKey, {
      points,
      rank: record.rank,
      fieldSize: record.fieldSize,
      rawScore: record.rawScore,
      playedAt,
      applyRating: true,
    });

    await upsertFinish(record.userId, OVERALL_GAME_KEY, {
      points,
      rank: record.rank,
      fieldSize: record.fieldSize,
      // Reason: raw score is game-unit and must not pollute the overall bestScore.
      rawScore: undefined,
      playedAt,
      applyRating: false,
    });

    return { points, ratingDelta };
  } catch (error) {
    console.error(
      `❌ [USER GAME STATS] failed to record finish for ${record.userId} / ${record.gameKey}:`,
      error,
    );
    return { points: 0, ratingDelta: 0 };
  }
}
