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
 * Map Theme types for visual styling
 */
export type MapTheme = 
  | "pirate" 
  | "space" 
  | "medieval" 
  | "cyber" 
  | "ancient" 
  | "volcanic" 
  | "arctic" 
  | "dragon" 
  | "celestial" 
  | "legendary";

/**
 * Journey Map Configuration
 * Stores the overall map structure and zones
 * Supports multi-map sequences (10 maps in progression)
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
  // Multi-map sequence fields
  sequenceOrder: number; // Position in sequence (1-10)
  previousMapId: string | null; // Map that must be completed first
  nextMapId: string | null; // Next map in sequence
  theme: MapTheme; // Visual theme for the map
  difficulty: number; // Difficulty rating (1-10)
  estimatedXP: number; // Expected total XP from this map
  requiredLevelToStart: number; // Minimum level suggestion
  completionRequirement: number; // Percentage of milestones needed (default 100)
  totalMilestones: number; // Cached count of milestones
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
    // Multi-map sequence fields
    sequenceOrder: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
      index: true,
    },
    previousMapId: {
      type: String,
      default: null,
    },
    nextMapId: {
      type: String,
      default: null,
    },
    theme: {
      type: String,
      enum: ["pirate", "space", "medieval", "cyber", "ancient", "volcanic", "arctic", "dragon", "celestial", "legendary"],
      default: "pirate",
    },
    difficulty: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    estimatedXP: {
      type: Number,
      default: 150,
      min: 0,
    },
    requiredLevelToStart: {
      type: Number,
      default: 1,
      min: 1,
      max: 20,
    },
    completionRequirement: {
      type: Number,
      default: 100,
      min: 1,
      max: 100,
    },
    totalMilestones: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);


// Reason: Multi-map flows filter by isActive + sort by sequenceOrder.
JourneyMapConfigSchema.index({ isActive: 1, sequenceOrder: 1 });

const JourneyMapConfig: Model<IJourneyMapConfig> =
  mongoose.models.JourneyMapConfig ||
  mongoose.model<IJourneyMapConfig>("JourneyMapConfig", JourneyMapConfigSchema);

export default JourneyMapConfig;
