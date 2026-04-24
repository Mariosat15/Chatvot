import { Schema, model, models, Document } from "mongoose";

/**
 * Chargeback case record.
 *
 * One document per disputed PSP transaction. Created either automatically by
 * the PSP webhook (status "pending_review") or manually by an admin.
 *
 * Lifecycle:
 *   pending_review -> initiated -> (represented) -> won | lost | withdrawn
 *
 * "lost" is the only outcome that triggers a clawback (user wallet and/or
 * platform bank). "won" / "withdrawn" restore the original transaction and
 * lift the payment_fraud restriction so the user can resume.
 */

export type ChargebackStatus =
  | "pending_review"
  | "initiated"
  | "represented"
  | "won"
  | "lost"
  | "withdrawn";

export type ChargebackOutcome = "won" | "lost" | "withdrawn";

export interface IChargebackAttachment {
  id: string;
  filename: string; // on-disk filename (safe + unique)
  originalName: string; // what the admin uploaded
  mimeType: string;
  size: number;
  fileUrl: string; // served via /api/uploads/chargebacks/[caseId]/[filename]
  uploadedAt: Date;
  uploadedBy?: string;
  uploadedByName?: string;
}

export interface IChargebackTimelineEntry {
  at: Date;
  actorId?: string;
  actorName?: string;
  action: string;
  notes?: string;
}

export interface IChargebackClawbackLeg {
  applied: boolean;
  amount?: number;
  transactionId?: string; // WalletTransaction._id (userWallet) or PlatformTransaction._id (platformBank)
  appliedAt?: Date;
  appliedBy?: string;
  appliedByName?: string;
}

export interface IChargebackClawback {
  userWallet: IChargebackClawbackLeg;
  platformBank: IChargebackClawbackLeg;
}

export interface IChargebackActor {
  id?: string;
  name?: string;
  email?: string;
}

export interface IChargeback extends Document {
  userId: string;
  userEmail?: string;
  userName?: string;

  walletTransactionId?: string;
  providerTransactionId?: string;
  provider: string;
  chargebackCaseId?: string;
  reasonCode?: string;

  amount: number;
  currency: string;

  status: ChargebackStatus;
  outcome?: ChargebackOutcome;

  receivedAt: Date;
  initiatedAt?: Date;
  representedAt?: Date;
  resolvedAt?: Date;

  initiatedBy?: IChargebackActor;
  resolvedBy?: IChargebackActor;

  restrictionId?: string;
  securityAlertId?: string;

  clawback: IChargebackClawback;

  // Frozen at initiate time — the defense report we actually sent. JSON blob.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form evidence snapshot
  evidenceSnapshot?: Record<string, any>;
  // Admin-edited rebuttal letter body (Markdown).
  narrative?: string;

  attachments: IChargebackAttachment[];
  timeline: IChargebackTimelineEntry[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form integration metadata
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IChargebackAttachment>(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    uploadedAt: { type: Date, required: true, default: () => new Date() },
    uploadedBy: String,
    uploadedByName: String,
  },
  { _id: false },
);

const TimelineEntrySchema = new Schema<IChargebackTimelineEntry>(
  {
    at: { type: Date, required: true, default: () => new Date() },
    actorId: String,
    actorName: String,
    action: { type: String, required: true },
    notes: String,
  },
  { _id: false },
);

const ClawbackLegSchema = new Schema<IChargebackClawbackLeg>(
  {
    applied: { type: Boolean, required: true, default: false },
    amount: Number,
    transactionId: String,
    appliedAt: Date,
    appliedBy: String,
    appliedByName: String,
  },
  { _id: false },
);

const ActorSchema = new Schema<IChargebackActor>(
  {
    id: String,
    name: String,
    email: String,
  },
  { _id: false },
);

const ChargebackSchema = new Schema<IChargeback>(
  {
    userId: { type: String, required: true, index: true },
    userEmail: String,
    userName: String,

    walletTransactionId: { type: String, index: true },
    providerTransactionId: String,
    provider: { type: String, required: true, index: true },
    chargebackCaseId: { type: String, index: true },
    reasonCode: String,

    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "EUR" },

    status: {
      type: String,
      required: true,
      enum: [
        "pending_review",
        "initiated",
        "represented",
        "won",
        "lost",
        "withdrawn",
      ],
      index: true,
    },
    outcome: {
      type: String,
      enum: ["won", "lost", "withdrawn"],
    },

    receivedAt: { type: Date, required: true, default: () => new Date() },
    initiatedAt: Date,
    representedAt: Date,
    resolvedAt: Date,

    initiatedBy: ActorSchema,
    resolvedBy: ActorSchema,

    restrictionId: String,
    securityAlertId: String,

    clawback: {
      type: new Schema<IChargebackClawback>(
        {
          userWallet: { type: ClawbackLegSchema, required: true, default: () => ({ applied: false }) },
          platformBank: { type: ClawbackLegSchema, required: true, default: () => ({ applied: false }) },
        },
        { _id: false },
      ),
      required: true,
      default: () => ({
        userWallet: { applied: false },
        platformBank: { applied: false },
      }),
    },

    evidenceSnapshot: Schema.Types.Mixed,
    narrative: String,

    attachments: { type: [AttachmentSchema], default: [] },
    timeline: { type: [TimelineEntrySchema], default: [] },

    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

// Reason: lookups by userId + status (open vs closed) drive the admin queue
// and the user dashboard badge; keep them fast.
ChargebackSchema.index({ userId: 1, status: 1, createdAt: -1 });
ChargebackSchema.index({ status: 1, createdAt: -1 });
ChargebackSchema.index({ providerTransactionId: 1 });

export const Chargeback =
  models?.Chargeback || model<IChargeback>("Chargeback", ChargebackSchema);

export default Chargeback;
