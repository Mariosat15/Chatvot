import { Schema, model, models, Document } from "mongoose";

/**
 * Game Master Earning Model
 * Tracks individual earnings from competitions and challenges
 * where referred users participated
 */

export type EarningSource = "competition" | "challenge";
export type EarningStatus = "pending" | "paid" | "cancelled";

export interface IGameMasterEarning extends Document {
  gameMasterId: string; // Reference to userId (game master)
  gameMasterEmail: string; // Cached for quick lookups

  // Source of earning
  sourceType: EarningSource;
  sourceId: string; // Competition or Challenge ID
  sourceName: string; // Cached name for display

  // Referred user who generated this earning
  referredUserId: string;
  referredUserEmail: string;
  referredUserName: string;

  // Earning calculation
  entryFeeAmount: number; // What the referred user paid as entry fee
  earningPercentage: number; // The % at time of calculation
  grossEarning: number; // Raw earning (entryFee * percentage)
  platformFee: number; // Platform cut (if any)
  netEarning: number; // Final amount credited to game master

  // Status & Payment
  status: EarningStatus;
  paidAt?: Date;
  transactionId?: string; // Reference to WalletTransaction

  // Event details
  eventStartTime: Date; // When competition/challenge started
  eventEndTime: Date; // When it ended
  participantCount: number; // Total participants in the event
  referredUserRank?: number; // Final rank of referred user (if applicable)

  // Notes
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const GameMasterEarningSchema = new Schema<IGameMasterEarning>(
  {
    gameMasterId: {
      type: String,
      required: true,
      index: true,
    },
    gameMasterEmail: {
      type: String,
      required: true,
    },
    sourceType: {
      type: String,
      required: true,
      enum: ["competition", "challenge"],
      index: true,
    },
    sourceId: {
      type: String,
      required: true,
      index: true,
    },
    sourceName: {
      type: String,
      required: true,
    },
    referredUserId: {
      type: String,
      required: true,
      index: true,
    },
    referredUserEmail: {
      type: String,
      required: true,
    },
    referredUserName: {
      type: String,
      required: true,
    },
    entryFeeAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    earningPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    grossEarning: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    netEarning: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
      index: true,
    },
    paidAt: Date,
    transactionId: String,
    eventStartTime: {
      type: Date,
      required: true,
    },
    eventEndTime: {
      type: Date,
      required: true,
    },
    participantCount: {
      type: Number,
      required: true,
      default: 0,
    },
    referredUserRank: Number,
    notes: String,
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common queries
GameMasterEarningSchema.index({ gameMasterId: 1, createdAt: -1 }); // GM's earnings history
GameMasterEarningSchema.index({ gameMasterId: 1, status: 1 }); // GM's pending earnings
GameMasterEarningSchema.index({ sourceType: 1, sourceId: 1 }); // Find earnings by event
GameMasterEarningSchema.index({ referredUserId: 1, gameMasterId: 1 }); // Find GM for user

const GameMasterEarning =
  models?.GameMasterEarning ||
  model<IGameMasterEarning>("GameMasterEarning", GameMasterEarningSchema);

export default GameMasterEarning;
