import mongoose, { Schema, Document } from "mongoose";

/**
 * Price Health Alert Model
 *
 * Stores alerts from the price health monitoring system for audit trail
 * and historical analysis of price feed issues.
 */

export interface IPriceHealthAlert extends Document {
  alertId: string;
  type:
    | "connection_lost"
    | "connection_restored"
    | "price_stale"
    | "price_anomaly"
    | "max_reconnect_reached"
    | "critical_health";
  severity: "warning" | "error" | "critical";
  symbol?: string;
  message: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  createdAt: Date;
}

const PriceHealthAlertSchema: Schema = new Schema(
  {
    alertId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "connection_lost",
        "connection_restored",
        "price_stale",
        "price_anomaly",
        "max_reconnect_reached",
        "critical_health",
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["warning", "error", "critical"],
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    acknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: "pricehealthalerts",
  },
);

// Compound indexes for efficient querying
PriceHealthAlertSchema.index({ type: 1, createdAt: -1 });
PriceHealthAlertSchema.index({ severity: 1, acknowledged: 1 });
PriceHealthAlertSchema.index({ createdAt: -1 });

// TTL index to auto-delete old alerts after 90 days
PriceHealthAlertSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

const PriceHealthAlert =
  mongoose.models.PriceHealthAlert ||
  mongoose.model<IPriceHealthAlert>("PriceHealthAlert", PriceHealthAlertSchema);

export default PriceHealthAlert;
