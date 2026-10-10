import mongoose, { Schema, Document } from "mongoose";

/**
 * Price Snapshot Model
 *
 * Stores periodic snapshots of all forex prices during active competitions.
 * Used for risk mitigation - allows admin to select a specific point in time
 * for emergency finalization when current prices are compromised.
 */

export interface IPriceSnapshotEntry {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  source: "websocket" | "api" | "cache" | "fallback" | "rest";
  isValid: boolean;
  staleDuration?: number; // How old the price was when snapshot taken (ms)
}

export interface IPriceSnapshot extends Document {
  // Reference to competition (optional - can be global)
  competitionId?: string;

  // Snapshot metadata
  timestamp: Date;
  snapshotType: "auto" | "manual" | "alert"; // auto = scheduled, manual = admin triggered, alert = triggered by health alert
  triggeredBy?: string; // Admin ID if manual

  // Price data
  prices: IPriceSnapshotEntry[];

  // Health status at time of snapshot
  healthStatus: "healthy" | "degraded" | "critical" | "market_closed";
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  healthySymbolCount: number;
  totalSymbolCount: number;

  // Flags
  isUsedForFinalization: boolean;
  usedForCompetitionId?: string;

  // Notes
  notes?: string;

  createdAt: Date;
}

const PriceSnapshotEntrySchema = new Schema(
  {
    symbol: { type: String, required: true },
    bid: { type: Number, required: true },
    ask: { type: Number, required: true },
    mid: { type: Number, required: true },
    spread: { type: Number, required: true },
    source: {
      type: String,
      enum: ["websocket", "api", "cache", "fallback", "rest"],
      required: true,
    },
    isValid: { type: Boolean, required: true },
    staleDuration: { type: Number },
  },
  { _id: false },
);

const PriceSnapshotSchema: Schema = new Schema(
  {
    competitionId: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      // Note: index is created by TTL index below (line 128), not needed here
    },
    snapshotType: {
      type: String,
      enum: ["auto", "manual", "alert"],
      required: true,
      default: "auto",
    },
    triggeredBy: {
      type: String,
    },
    prices: [PriceSnapshotEntrySchema],
    healthStatus: {
      type: String,
      enum: ["healthy", "degraded", "critical", "market_closed"],
      required: true,
    },
    connectionStatus: {
      type: String,
      enum: ["connected", "reconnecting", "disconnected"],
      required: true,
    },
    healthySymbolCount: {
      type: Number,
      required: true,
    },
    totalSymbolCount: {
      type: Number,
      required: true,
    },
    isUsedForFinalization: {
      type: Boolean,
      default: false,
    },
    usedForCompetitionId: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: "pricesnapshots",
  },
);

// Compound indexes for efficient querying
PriceSnapshotSchema.index({ competitionId: 1, timestamp: -1 });
PriceSnapshotSchema.index({ healthStatus: 1, timestamp: -1 });
PriceSnapshotSchema.index({ snapshotType: 1, timestamp: -1 });

// TTL index to auto-delete old snapshots after 7 days (can be adjusted)
PriceSnapshotSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 },
);

// Virtual to get price by symbol
PriceSnapshotSchema.methods.getPriceForSymbol = function (
  symbol: string,
): IPriceSnapshotEntry | undefined {
  return this.prices.find((p: IPriceSnapshotEntry) => p.symbol === symbol);
};

// Static method to get the last healthy snapshot
PriceSnapshotSchema.statics.getLastHealthySnapshot = async function (
  competitionId?: string,
) {
  const query: Record<string, unknown> = { healthStatus: "healthy" };
  if (competitionId) {
    query.competitionId = competitionId;
  }
  return this.findOne(query).sort({ timestamp: -1 });
};

// Static method to get snapshots within a time range
PriceSnapshotSchema.statics.getSnapshotsInRange = async function (
  startTime: Date,
  endTime: Date,
  competitionId?: string,
) {
  const query: Record<string, unknown> = {
    timestamp: { $gte: startTime, $lte: endTime },
  };
  if (competitionId) {
    query.competitionId = competitionId;
  }
  return this.find(query).sort({ timestamp: -1 });
};

const PriceSnapshot =
  mongoose.models.PriceSnapshot ||
  mongoose.model<IPriceSnapshot>("PriceSnapshot", PriceSnapshotSchema);

export default PriceSnapshot;
