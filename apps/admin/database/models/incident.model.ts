import mongoose, { Schema, Document } from "mongoose";

/**
 * Incident Model
 *
 * Tracks incidents related to competitions, challenges, and system issues.
 * Used for dispute resolution, audit trail, and post-mortem analysis.
 */

export interface ICompensation {
  userId: string;
  username?: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "paid" | "rejected";
  paidAt?: Date;
  transactionId?: string;
}

export interface IResultAdjustment {
  participantId: string;
  userId: string;
  username?: string;
  previousRank?: number;
  newRank?: number;
  previousPrize?: number;
  newPrize?: number;
  adjustmentReason: string;
}

export interface IAuditLogEntry {
  timestamp: Date;
  action: string;
  by: string; // Admin ID or 'system'
  byEmail?: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export type IncidentSubjectType =
  | "competition"
  | "challenge"
  | "round"
  | "system";

export type IncidentActionOutcome = "applied" | "refused" | "failed";

export interface IIncidentActionTaken {
  actionId: string;
  subjectType: IncidentSubjectType;
  subjectId: string;
  reason: string;
  outcome: IncidentActionOutcome;
  detail?: string;
  by: string;
  byEmail?: string;
  at: Date;
}

export interface IIncident extends Document {
  // Reference
  competitionId?: string;
  challengeId?: string;
  /**
   * What this incident is about. Absent on rows written before the hub, which is
   * a different fact from `system` — those rows are read by which id they carry.
   */
  subjectType?: IncidentSubjectType;
  roundId?: string;
  gameKey?: string;
  actionsTaken?: IIncidentActionTaken[];

  // Classification
  type:
    | "price_feed_failure"
    | "unfair_result"
    | "technical_error"
    | "user_complaint"
    | "system_error"
    | "other";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved" | "rejected" | "escalated";

  // Details
  title: string;
  description: string;
  affectedUsers: string[];

  // Evidence
  evidence: {
    priceSnapshots?: string[]; // Snapshot IDs
    tradeIds?: string[];
    positionIds?: string[];
    orderIds?: string[];
    screenshots?: string[]; // URLs
    logs?: string[];
    healthAlertIds?: string[];
  };

  // Resolution
  resolution?: {
    summary: string;
    action: string;
    compensations: ICompensation[];
    resultAdjustments: IResultAdjustment[];
    resolvedAt: Date;
  };

  // Tracking
  createdBy: string; // Admin ID or 'system'
  createdByEmail?: string;
  assignedTo?: string;
  assignedToEmail?: string;
  resolvedBy?: string;
  resolvedByEmail?: string;
  resolvedAt?: Date;

  // Audit trail
  auditLog: IAuditLogEntry[];

  // Metadata
  tags?: string[];
  priority: "low" | "medium" | "high" | "urgent";

  createdAt: Date;
  updatedAt: Date;
}

const CompensationSchema = new Schema(
  {
    userId: { type: String, required: true },
    username: { type: String },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending",
    },
    paidAt: { type: Date },
    transactionId: { type: String },
  },
  { _id: false },
);

const ResultAdjustmentSchema = new Schema(
  {
    participantId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String },
    previousRank: { type: Number },
    newRank: { type: Number },
    previousPrize: { type: Number },
    newPrize: { type: Number },
    adjustmentReason: { type: String, required: true },
  },
  { _id: false },
);

const ActionTakenSchema = new Schema(
  {
    actionId: { type: String, required: true },
    subjectType: {
      type: String,
      enum: ["competition", "challenge", "round", "system"],
      required: true,
    },
    subjectId: { type: String, required: true },
    reason: { type: String, required: true },
    outcome: {
      type: String,
      enum: ["applied", "refused", "failed"],
      required: true,
    },
    detail: { type: String },
    by: { type: String, required: true },
    byEmail: { type: String },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const AuditLogEntrySchema = new Schema(
  {
    timestamp: { type: Date, required: true, default: Date.now },
    action: { type: String, required: true },
    by: { type: String, required: true },
    byEmail: { type: String },
    details: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const IncidentSchema: Schema = new Schema(
  {
    competitionId: {
      type: String,
      index: true,
    },
    challengeId: {
      type: String,
      index: true,
    },
    // Add-only. No default: a row from before the hub has no subject type, and
    // that is not the same as an incident about the platform itself.
    subjectType: {
      type: String,
      enum: ["competition", "challenge", "round", "system"],
      index: true,
    },
    roundId: {
      type: String,
      index: true,
    },
    gameKey: {
      type: String,
    },
    actionsTaken: [ActionTakenSchema],
    type: {
      type: String,
      enum: [
        "price_feed_failure",
        "unfair_result",
        "technical_error",
        "user_complaint",
        "system_error",
        "other",
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "investigating", "resolved", "rejected", "escalated"],
      required: true,
      default: "open",
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    affectedUsers: [
      {
        type: String,
      },
    ],
    evidence: {
      priceSnapshots: [{ type: String }],
      tradeIds: [{ type: String }],
      positionIds: [{ type: String }],
      orderIds: [{ type: String }],
      screenshots: [{ type: String }],
      logs: [{ type: String }],
      healthAlertIds: [{ type: String }],
    },
    resolution: {
      summary: { type: String },
      action: { type: String },
      compensations: [CompensationSchema],
      resultAdjustments: [ResultAdjustmentSchema],
      resolvedAt: { type: Date },
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdByEmail: {
      type: String,
    },
    assignedTo: {
      type: String,
    },
    assignedToEmail: {
      type: String,
    },
    resolvedBy: {
      type: String,
    },
    resolvedByEmail: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
    auditLog: [AuditLogEntrySchema],
    tags: [
      {
        type: String,
      },
    ],
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
  },
  {
    timestamps: true,
    collection: "incidents",
  },
);

// Compound indexes
IncidentSchema.index({ status: 1, severity: 1, createdAt: -1 });
IncidentSchema.index({ competitionId: 1, status: 1 });
IncidentSchema.index({ createdBy: 1, createdAt: -1 });
IncidentSchema.index({ assignedTo: 1, status: 1 });

// Methods
IncidentSchema.methods.addAuditEntry = function (
  action: string,
  by: string,
  details: string,
  byEmail?: string,
  metadata?: Record<string, unknown>,
) {
  this.auditLog.push({
    timestamp: new Date(),
    action,
    by,
    byEmail,
    details,
    metadata,
  });
  return this;
};

const Incident =
  mongoose.models.Incident ||
  mongoose.model<IIncident>("Incident", IncidentSchema);

export default Incident;
