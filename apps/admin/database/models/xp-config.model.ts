import mongoose, { Schema, Document, Model } from "mongoose";

export interface IXPConfig extends Document {
  configType: "badge_xp" | "level_progression" | "leaderboard_weights";
  data: {
    // For badge_xp type
    common?: number;
    rare?: number;
    epic?: number;
    legendary?: number;

    // For level_progression type
    levels?: Array<{
      level: number;
      title: string;
      minXP: number;
      maxXP: number;
      icon: string;
      color: string;
      description: string;
    }>;

    // For leaderboard_weights type: the seven global-rank components, each a
    // percentage. Stored raw as the operator typed them; the reader rescales to
    // 100, so a set that does not add up is corrected rather than refused.
    // See `lib/services/leaderboard/global-score.ts` for the definition.
    weights?: Record<string, number>;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const XPConfigSchema = new Schema<IXPConfig>(
  {
    configType: {
      type: String,
      required: true,
      // Reason: a Mongoose enum is ADD-ONLY. Removing a value orphans every
      // document already storing it.
      enum: ["badge_xp", "level_progression", "leaderboard_weights"],
      unique: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
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
const XPConfig: Model<IXPConfig> =
  mongoose.models.XPConfig ||
  mongoose.model<IXPConfig>("XPConfig", XPConfigSchema);

export default XPConfig;
