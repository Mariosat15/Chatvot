import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Whether the shipped gamification defaults may be seeded.
 *
 * Reason: `seedBadgeConfigs()` seeds the whole BADGES catalogue whenever
 * `badgeconfigs` is empty, and `seedXPConfigs()` seeds TITLE_LEVELS whenever the
 * level document is missing — both reached from ordinary reads
 * (`getBadgesFromDB`, `getXPConfigFromDB`). So deleting everything in order to
 * start from scratch is undone by the next page load, silently, and the operator
 * is told the wipe succeeded. This document is how a deliberate wipe survives.
 *
 * One row, keyed `DEFAULTS_STATE_KEY`. The booleans default to `false`, which is
 * exactly today's behaviour, so an install that has never been reset is
 * unaffected.
 */
export interface IGamificationDefaultsState extends Document {
  key: string;
  badgeDefaultsSuppressed: boolean;
  xpDefaultsSuppressed: boolean;
  suppressedAt?: Date;
  suppressedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GamificationDefaultsStateSchema = new Schema<IGamificationDefaultsState>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    badgeDefaultsSuppressed: {
      type: Boolean,
      default: false,
    },
    xpDefaultsSuppressed: {
      type: Boolean,
      default: false,
    },
    suppressedAt: {
      type: Date,
    },
    suppressedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const GamificationDefaultsState: Model<IGamificationDefaultsState> =
  mongoose.models.GamificationDefaultsState ||
  mongoose.model<IGamificationDefaultsState>(
    "GamificationDefaultsState",
    GamificationDefaultsStateSchema,
  );

export default GamificationDefaultsState;
