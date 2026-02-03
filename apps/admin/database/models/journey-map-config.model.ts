import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Zone definition within the journey map
 */
export interface IJourneyZone {
  id: string;
  name: string;
  description: string;
  order: number;
  position: { x: number; y: number };
  color: string;
  icon: string;
  isUnlockable: boolean;
  unlockCondition?: {
    type: "milestone_complete" | "zone_complete" | "xp_threshold";
    value: string | number;
  };
}

/**
 * Journey Map Configuration
 * Stores the overall map structure and zones
 */
export interface IJourneyMapConfig extends Document {
  mapId: string;
  name: string;
  description: string;
  zones: IJourneyZone[];
  defaultStartNode: string;
  backgroundColor: string;
  backgroundImage?: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const JourneyZoneSchema = new Schema<IJourneyZone>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    order: { type: Number, required: true, default: 0 },
    position: {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
    },
    color: { type: String, default: "#3B82F6" },
    icon: { type: String, default: "flag" },
    isUnlockable: { type: Boolean, default: true },
    unlockCondition: {
      type: { type: String, enum: ["milestone_complete", "zone_complete", "xp_threshold"] },
      value: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const JourneyMapConfigSchema = new Schema<IJourneyMapConfig>(
  {
    mapId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: "traders_journey",
    },
    name: {
      type: String,
      required: true,
      default: "Trader's Journey",
    },
    description: {
      type: String,
      default: "Your path from novice to master trader",
    },
    zones: {
      type: [JourneyZoneSchema],
      default: [],
    },
    defaultStartNode: {
      type: String,
      required: true,
      default: "account_created",
    },
    backgroundColor: {
      type: String,
      default: "#0F172A",
    },
    backgroundImage: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

const JourneyMapConfig: Model<IJourneyMapConfig> =
  mongoose.models.JourneyMapConfig ||
  mongoose.model<IJourneyMapConfig>("JourneyMapConfig", JourneyMapConfigSchema);

export default JourneyMapConfig;
