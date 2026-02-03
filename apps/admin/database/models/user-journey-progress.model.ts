import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Record of a completed milestone
 */
export interface ICompletedMilestone {
  milestoneId: string;
  completedAt: Date;
  rewards: {
    xp: number;
    badgeId?: string;
    title?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * User Journey Progress Model
 * Tracks individual user's progress on the journey map
 */
export interface IUserJourneyProgress extends Document {
  userId: string;
  mapId: string;
  currentZone: string;
  currentMilestone: string;
  completedMilestones: ICompletedMilestone[];
  unlockedMilestones: string[];
  activePath?: string;
  totalXPFromJourney: number;
  totalMilestonesCompleted: number;
  journeyStartedAt: Date;
  lastProgressAt: Date;
  selectedBranches: Record<string, string>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const CompletedMilestoneSchema = new Schema<ICompletedMilestone>(
  {
    milestoneId: { type: String, required: true },
    completedAt: { type: Date, required: true, default: Date.now },
    rewards: {
      xp: { type: Number, required: true, default: 0 },
      badgeId: { type: String },
      title: { type: String },
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const UserJourneyProgressSchema = new Schema<IUserJourneyProgress>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    mapId: {
      type: String,
      required: true,
      default: "traders_journey",
      index: true,
    },
    currentZone: {
      type: String,
      required: true,
      default: "starting_dock",
    },
    currentMilestone: {
      type: String,
      required: true,
      default: "account_created",
    },
    completedMilestones: {
      type: [CompletedMilestoneSchema],
      default: [],
    },
    unlockedMilestones: {
      type: [String],
      default: ["account_created"],
    },
    activePath: {
      type: String,
    },
    totalXPFromJourney: {
      type: Number,
      default: 0,
    },
    totalMilestonesCompleted: {
      type: Number,
      default: 0,
    },
    journeyStartedAt: {
      type: Date,
      default: Date.now,
    },
    lastProgressAt: {
      type: Date,
      default: Date.now,
    },
    selectedBranches: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for userId + mapId to ensure one progress per user per map
UserJourneyProgressSchema.index({ userId: 1, mapId: 1 }, { unique: true });

// Index for leaderboard queries
UserJourneyProgressSchema.index({ totalMilestonesCompleted: -1 });
UserJourneyProgressSchema.index({ totalXPFromJourney: -1 });

const UserJourneyProgress: Model<IUserJourneyProgress> =
  mongoose.models.UserJourneyProgress ||
  mongoose.model<IUserJourneyProgress>("UserJourneyProgress", UserJourneyProgressSchema);

export default UserJourneyProgress;
