/**
 * Game-scoped milestone condition types and UserGameStats field mapping.
 *
 * Reason: journey milestones must accept trading OR gaming paths. These types
 * read the `_overall` UserGameStats row by default so a games-only player
 * progresses without placing a trade. Never sums the enabled set (R29).
 */

import UserGameStats, {
  OVERALL_GAME_KEY,
} from "@/database/models/games/user-game-stats.model";

export type JourneyGameStatField =
  | "contestsEntered"
  | "contestsCompleted"
  | "wins"
  | "podiums"
  | "totalPoints"
  | "seasonPoints"
  | "rating"
  | "bestRank"
  | "bestScore"
  | "currentStreak";

/** Condition type → UserGameStats field. */
export const JOURNEY_GAME_CONDITION_FIELDS: Readonly<
  Record<string, JourneyGameStatField>
> = {
  game_contests_entered: "contestsEntered",
  game_contests_completed: "contestsCompleted",
  game_wins: "wins",
  game_podiums: "podiums",
  game_total_points: "totalPoints",
  game_season_points: "seasonPoints",
  game_rating: "rating",
  game_best_rank: "bestRank",
  game_best_score: "bestScore",
  game_current_streak: "currentStreak",
};

export function isJourneyGameConditionType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(JOURNEY_GAME_CONDITION_FIELDS, type);
}

/**
 * Read a game condition value for journey evaluation.
 * Defaults to `_overall` so dual-path milestones stay cross-game.
 */
export async function readJourneyGameConditionValue(
  userId: string,
  type: string,
  gameKey: string = OVERALL_GAME_KEY,
): Promise<number> {
  // Reason: type is checked via hasOwnProperty; map values are a closed field union.
  // eslint-disable-next-line security/detect-object-injection
  const field = JOURNEY_GAME_CONDITION_FIELDS[type];
  if (!field) return 0;
  const row = await UserGameStats.findOne({ userId, gameKey })
    .select(
      "contestsEntered contestsCompleted wins podiums totalPoints seasonPoints rating bestRank bestScore currentStreak",
    )
    .lean();
  if (!row) return 0;
  // Reason: field is a closed keyof union from our own map — not caller input.
  // eslint-disable-next-line security/detect-object-injection
  const raw = row[field];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

/** Default comparison: bestRank is lower-is-better; everything else gte. */
export function defaultGameComparison(type: string): "gte" | "lte" {
  return type === "game_best_rank" ? "lte" : "gte";
}
