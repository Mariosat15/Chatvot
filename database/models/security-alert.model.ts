import { Schema, model, models, Document } from "mongoose";

/**
 * Runtime security events detected by defensive code paths.
 *
 * These are distinct from FraudAlert (which is scoped to multi-account /
 * behavioral fraud across users) — SecurityAlert is for infrastructure-level
 * attacks against individual endpoints: forged webhooks, chargebacks,
 * injection attempts, replay attacks, brute-force, etc.
 *
 * Every write is fire-and-forget; if the DB is unavailable we still log to
 * console. Alerts are surfaced in the admin Fraud Monitoring UI.
 */

export type SecurityAlertType =
  | "webhook_signature_failure"
  | "webhook_replay_detected"
  | "chargeback_received"
  | "nosql_injection_attempt"
  | "csrf_violation"
  | "origin_mismatch"
  | "brute_force_detected"
  | "ato_attempt"
  | "rate_limit_exceeded"
  | "other";

export type SecurityAlertSeverity = "low" | "medium" | "high" | "critical";

export interface ISecurityAlert extends Document {
  alertType: SecurityAlertType;
  severity: SecurityAlertSeverity;

  // Where the alert fired from — used for filtering in admin UI.
  source: string; // e.g., "/api/nuvei/webhook"
  provider?: string; // e.g., "nuvei" | "stripe" | "paddle"

  // Evidence (all optional — logged only when available)
  ip?: string;
  userAgent?: string;
  userId?: string;
  reason: string; // short human-readable summary

  // Free-form structured metadata. Never store full card numbers, secrets, or
  // raw authentication credentials here — only non-sensitive fingerprints.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;

  // Ack tracking
  acknowledged: boolean;
  acknowledgedBy?: string; // Admin user ID
  acknowledgedAt?: Date;
  acknowledgmentNote?: string;

  createdAt: Date;
  updatedAt: Date;
}

const SecurityAlertSchema = new Schema<ISecurityAlert>(
  {
    alertType: {
      type: String,
      required: true,
      enum: [
        "webhook_signature_failure",
        "webhook_replay_detected",
        "chargeback_received",
        "nosql_injection_attempt",
        "csrf_violation",
        "origin_mismatch",
        "brute_force_detected",
        "ato_attempt",
        "rate_limit_exceeded",
        "other",
      ],
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "critical"],
      default: "high",
      index: true,
    },
    source: { type: String, required: true },
    provider: String,

    ip: String,
    userAgent: String,
    userId: String,
    reason: { type: String, required: true },

    metadata: Schema.Types.Mixed,

    acknowledged: { type: Boolean, default: false, index: true },
    acknowledgedBy: String,
    acknowledgedAt: Date,
    acknowledgmentNote: String,
  },
  { timestamps: true },
);

// Fast "recent unacknowledged" query in the admin dashboard.
SecurityAlertSchema.index({ acknowledged: 1, createdAt: -1 });
SecurityAlertSchema.index({ createdAt: -1 });

const SecurityAlert =
  models.SecurityAlert ||
  model<ISecurityAlert>("SecurityAlert", SecurityAlertSchema);

export default SecurityAlert;
