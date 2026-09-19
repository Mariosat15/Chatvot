import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Per-player, per-game standing. Materialised at settlement and never recomputed on read
 * (invariant 8 / R29). `"_overall"` is a stored row for the cross-game headline, not a
 * sum over currently-enabled games.
 *
 * Added at X7 step 1 (16 Sep 2026). Nothing is backfilled into it — aggregates start at
 * zero (owner decision, question 14). Trading history stays in TradeHistory / the trading
 * card.
 *
 * MIRRORED into apps/admin: settlement runs in both apps (awardContestRewards), so both
 * need the model. Unlike user-game-preference, which admin never reads.
 */
export interface IUserGameStats extends Document {
  userId: string;
  /** Immutable join key, or the literal `"_overall"` for the cross-game rollup. */
  gameKey: string;
  contestsEntered: number;
  contestsCompleted: number;
  wins: number;
  podiums: number;
  totalPoints: number;
  seasonPoints: number;
  /** Per-game skill rating. Never aggregated across games. 1200 on first insert. */
  rating: number;
  bestRank: number;
  /** Raw score in that game's units — never negated. */
  bestScore: number;
  currentStreak: number;
  lastPlayedAt: Date;
  /** Per-game additions (e.g. trading profit factor). Kept out of the shared shape. */
  extra: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const UserGameStatsSchema = new Schema<IUserGameStats>(
  {
    userId: { type: String, required: true, index: true },
    gameKey: { type: String, required: true },
    contestsEntered: { type: Number, required: true, default: 0 },
    contestsCompleted: { type: Number, required: true, default: 0 },
    wins: { type: Number, required: true, default: 0 },
    podiums: { type: Number, required: true, default: 0 },
    totalPoints: { type: Number, required: true, default: 0 },
    seasonPoints: { type: Number, required: true, default: 0 },
    rating: { type: Number, required: true, default: 1200 },
    bestRank: { type: Number, required: true, default: 0 },
    bestScore: { type: Number, required: true, default: 0 },
    currentStreak: { type: Number, required: true, default: 0 },
    lastPlayedAt: { type: Date },
    extra: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "user_game_stats",
  },
);

UserGameStatsSchema.index({ userId: 1, gameKey: 1 }, { unique: true });
UserGameStatsSchema.index({ gameKey: 1, totalPoints: -1 });
UserGameStatsSchema.index({ gameKey: 1, rating: -1 });

const UserGameStats: Model<IUserGameStats> =
  mongoose.models.UserGameStats ||
  mongoose.model<IUserGameStats>("UserGameStats", UserGameStatsSchema);

export default UserGameStats;

/** Literal gameKey of the cross-game rollup row. Not a real game. */
export const OVERALL_GAME_KEY = "_overall" as const;
