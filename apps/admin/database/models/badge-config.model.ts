import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBadgeConfig extends Document {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  condition: {
    type: string;
    value?: number;
    minValue?: number;
    maxValue?: number;
    comparison?: string;
    minTrades?: number;
    minCompletedCompetitions?: number;
  };
  minLevel: number;
  /** Which games this badge can be earned in. Backfill 3, chapter 18 section 1. */
  gameTypes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BadgeConfigSchema = new Schema<IBadgeConfig>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Competition",
        "Trading",
        "Profit",
        "Risk",
        "Speed",
        "Consistency",
        "Strategy",
        "Social",
        "Legendary",
      ],
    },
    icon: {
      type: String,
      required: true,
      default: "🏆",
    },
    rarity: {
      type: String,
      required: true,
      enum: ["common", "rare", "epic", "legendary"],
      default: "common",
    },
    condition: {
      type: {
        type: String,
        required: true,
      },
      value: Number,
      minValue: Number,
      maxValue: Number,
      comparison: String,
      minTrades: Number,
      minCompletedCompetitions: Number,
    },
    minLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 20,
    },
    // Which games this badge can be earned in (X1 backfill 3, chapter 18 section 1).
    //
    // Reason: this is NOT the game-type enumeration invariant 8 forbids. Invariant 8 bans
    // the ENGINE from branching on game type; scoping an individual badge to the games it
    // makes sense in is content, set per badge by an operator. "100 trades" genuinely
    // cannot be earned at chess.
    //
    // Defaults to trading so every badge that exists today keeps its current meaning, and
    // an empty array is read as "every game" rather than "no game" - a misconfiguration
    // that silently makes a badge unearnable is worse than one that makes it broad.
    gameTypes: {
      type: [String],
      default: ["trading"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Create or get the model
const BadgeConfig: Model<IBadgeConfig> =
  mongoose.models.BadgeConfig ||
  mongoose.model<IBadgeConfig>("BadgeConfig", BadgeConfigSchema);

export default BadgeConfig;
