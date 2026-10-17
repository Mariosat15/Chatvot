import mongoose, { Schema, Document } from "mongoose";
import {
  TERMS_REQUEST_STATUSES,
  type TermsRequestStatus,
} from "@/lib/services/gamemaster/gm-terms-request-rules";

/**
 * A Game Master asking an existing own referral to accept the Game Master terms
 * (`External game plans/24` s5.5).
 *
 * Reason it is not a `gm_referral_claims` row: a claim exists to turn a sign-up INTO an
 * affiliation, and `decideClaimPrompt` deliberately lapses one when the player is already
 * affiliated. These players are already affiliated and simply never recorded consent, so a
 * claim would be closed before it was ever shown. Nor can `affiliate()` record it - it
 * returns `alreadyAffiliated` and writes nothing for the same Game Master.
 *
 * One row per referral (unique `referralId`), so the once-only send in
 * `gm-terms-request-rules.ts` has a single place to read. Until `24` s5.6 a Game Master could
 * send three times with a 24-hour cooldown; the owner made it once per referral, and the
 * player is reminded by the terms modal on every visit instead.
 *
 * Main app only as a MODEL: `apps/admin` reaches the collection with the raw driver
 * (`admin-terms-reminder.service.ts`), and mirroring ahead of a model caller is two copies
 * agreeing while one runs (R42). The admin also sees each step in the customer audit trail.
 */
export interface IGmTermsRequest extends Document {
  referralId: string;
  userId: string;
  userEmail?: string;
  gameMasterId: string;
  gameMasterName?: string;
  status: TermsRequestStatus;
  sendCount: number;
  lastSentAt?: Date;
  termsAcceptanceId?: string;
  resolvedAt?: Date;
  /**
   * Reminders sent by an ADMIN (`24` s5.6). Kept apart from `sendCount`, which is the Game
   * Master's once-only allowance - an admin reminder must never use it up, nor be capped by it.
   */
  adminTermsReminderCount?: number;
  lastAdminTermsReminderAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GmTermsRequestSchema = new Schema<IGmTermsRequest>(
  {
    referralId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String },
    gameMasterId: { type: String, required: true, index: true },
    gameMasterName: { type: String },
    status: { type: String, enum: [...TERMS_REQUEST_STATUSES], required: true },
    sendCount: { type: Number, required: true, default: 0, min: 0 },
    lastSentAt: { type: Date },
    termsAcceptanceId: { type: String },
    resolvedAt: { type: Date },
    adminTermsReminderCount: { type: Number, min: 0 },
    lastAdminTermsReminderAt: { type: Date },
  },
  { timestamps: true, collection: "gm_terms_requests" },
);

GmTermsRequestSchema.index({ userId: 1, status: 1 });

const GmTermsRequest =
  (mongoose.models.GmTermsRequest as mongoose.Model<IGmTermsRequest>) ||
  mongoose.model<IGmTermsRequest>("GmTermsRequest", GmTermsRequestSchema);

export default GmTermsRequest;
