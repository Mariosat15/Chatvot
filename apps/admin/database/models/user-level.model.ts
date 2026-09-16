import { Schema, model, models, Document } from "mongoose";

export interface IUserLevel extends Document {
  userId: string;
  currentXP: number;
  currentLevel: number;
  currentTitle: string;
  totalBadgesEarned: number;
  lastXPGain: Date;
  xpHistory: {
    amount: number;
    source: string; // 'badge', 'competition', 'achievement'
    badgeId?: string;
    /**
     * What the award was for, e.g. `trade_activity:trade_completed`. `awardXP` has passed
     * this since it was written and the schema did not declare it, so strict mode discarded
     * every value silently while the call reported success (risk R97). Two things depended
     * on it and neither could work: the daily trade cap, which filters the history to find
     * today's trade XP, and any attribution of a level to what earned it.
     */
    sourceId?: string;
    /**
     * The game this XP was earned in - the immutable `gameKey`, or absent for XP that is
     * not tied to one contest (a badge, a referral). Absent is NOT "trading": invariant 5
     * resolves an absent label to trading on a *contest*, and reusing that reading here
     * would file every badge award as trading XP.
     *
     * Recorded so a per-game XP total is measurable. Nothing reads it yet, deliberately -
     * it is written from the day the shared reward stage ships so that the rebalance has a
     * real base rather than a backfill nobody can compute.
     */
    gameKey?: string;
    timestamp: Date;
  }[];
}

const UserLevelSchema = new Schema<IUserLevel>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    currentXP: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentLevel: {
      type: Number,
      default: 1,
      min: 1,
      // Reason: risk R98. This copy said 10 while the ladder has had 20 levels for a long
      // time, and this app DOES write the field - `xp-level.service.ts` assigns it and then
      // save()s - so a player crossing level 10 through an admin-settled contest's badge
      // award threw a ValidationError and lost the XP outright. `check:mirrors` compares
      // field paths and enum values, never a `max`, so it was green throughout.
      max: 20, // Supports all 20 levels in TITLE_LEVELS
    },
    currentTitle: {
      type: String,
      default: "Novice Trader",
    },
    totalBadgesEarned: {
      type: Number,
      default: 0,
    },
    lastXPGain: {
      type: Date,
      default: Date.now,
    },
    xpHistory: [
      {
        amount: Number,
        source: String,
        badgeId: String,
        sourceId: String,
        gameKey: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Reason: Leaderboard queries sort/filter by level and XP across all users.
// Without these indexes, such queries would require a full collection scan.
UserLevelSchema.index({ currentLevel: -1, currentXP: -1 });
UserLevelSchema.index({ currentXP: -1 });

const UserLevel =
  models.UserLevel || model<IUserLevel>("UserLevel", UserLevelSchema);

export default UserLevel;
