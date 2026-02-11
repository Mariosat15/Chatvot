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
  minLevel: number; // Badge visible but locked until user reaches this level (0 = no requirement)
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
      // These were previously missing -- badge-specific minimums were lost on seed
      minTrades: Number,
      minCompletedCompetitions: Number,
    },
    // Level-gated badge visibility: badge is visible but locked until user reaches this level
    minLevel: {
      type: Number,
      default: 0, // 0 = no level requirement
      min: 0,
      max: 20,
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
