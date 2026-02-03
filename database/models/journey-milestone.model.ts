import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Milestone condition - similar to badge conditions
 */
export interface IMilestoneCondition {
  type: string;
  value?: number;
  comparison?: "gte" | "lte" | "eq" | "gt" | "lt";
  minTrades?: number;
  minCompletedCompetitions?: number;
  badgeId?: string;
  milestoneId?: string; // For milestone_complete condition type
  customCheck?: string;
}

/**
 * Rewards for completing a milestone
 */
export interface IMilestoneReward {
  xp: number;
  badgeId?: string;
  title?: string;
  unlockFeature?: string;
}

/**
 * Node types for visual differentiation
 */
export type MilestoneNodeType = 
  | "start" 
  | "milestone" 
  | "checkpoint" 
  | "branch" 
  | "legendary" 
  | "lesson"
  | "optional";

/**
 * Journey Milestone Model
 * Individual nodes/milestones on the journey map
 */
export interface IJourneyMilestone extends Document {
  id: string;
  mapId: string;
  name: string;
  description: string;
  shortDescription: string;
  zoneId: string;
  position: { x: number; y: number };
  nodeType: MilestoneNodeType;
  icon: string;
  color: string;
  size: "small" | "medium" | "large";
  unlockCondition?: IMilestoneCondition;
  completeCondition: IMilestoneCondition;
  rewards: IMilestoneReward;
  connectedTo: string[];
  connectedFrom: string[];
  isRequired: boolean;
  isAutoComplete: boolean;
  order: number;
  tooltipText?: string;
  celebrationText?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneConditionSchema = new Schema<IMilestoneCondition>(
  {
    type: { type: String, required: true },
    value: { type: Number },
    comparison: { type: String, enum: ["gte", "lte", "eq", "gt", "lt"] },
    minTrades: { type: Number },
    minCompletedCompetitions: { type: Number },
    badgeId: { type: String },
    milestoneId: { type: String },
    customCheck: { type: String },
  },
  { _id: false }
);

const MilestoneRewardSchema = new Schema<IMilestoneReward>(
  {
    xp: { type: Number, required: true, default: 10 },
    badgeId: { type: String },
    title: { type: String },
    unlockFeature: { type: String },
  },
  { _id: false }
);

const JourneyMilestoneSchema = new Schema<IJourneyMilestone>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mapId: {
      type: String,
      required: true,
      default: "traders_journey",
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
    shortDescription: {
      type: String,
      default: "",
    },
    zoneId: {
      type: String,
      required: true,
      index: true,
    },
    position: {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
    },
    nodeType: {
      type: String,
      required: true,
      enum: ["start", "milestone", "checkpoint", "branch", "legendary", "lesson", "optional"],
      default: "milestone",
    },
    icon: {
      type: String,
      required: true,
      default: "target",
    },
    color: {
      type: String,
      default: "#3B82F6",
    },
    size: {
      type: String,
      enum: ["small", "medium", "large"],
      default: "medium",
    },
    unlockCondition: {
      type: MilestoneConditionSchema,
    },
    completeCondition: {
      type: MilestoneConditionSchema,
      required: true,
    },
    rewards: {
      type: MilestoneRewardSchema,
      required: true,
      default: { xp: 10 },
    },
    connectedTo: {
      type: [String],
      default: [],
    },
    connectedFrom: {
      type: [String],
      default: [],
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    isAutoComplete: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    tooltipText: {
      type: String,
    },
    celebrationText: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
JourneyMilestoneSchema.index({ mapId: 1, zoneId: 1 });
JourneyMilestoneSchema.index({ mapId: 1, order: 1 });

const JourneyMilestone: Model<IJourneyMilestone> =
  mongoose.models.JourneyMilestone ||
  mongoose.model<IJourneyMilestone>("JourneyMilestone", JourneyMilestoneSchema);

export default JourneyMilestone;
