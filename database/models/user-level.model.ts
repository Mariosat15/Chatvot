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
