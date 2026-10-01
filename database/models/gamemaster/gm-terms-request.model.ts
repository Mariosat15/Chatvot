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
 * One row per referral (unique `referralId`), so re-sending updates the same row and the
 * cooldown and cap in `gm-terms-request-rules.ts` have a single place to read.
 *
 * Main app only: nothing in `apps/admin` reads it, and mirroring ahead of a caller is two
 * copies agreeing while one runs (R42). The admin sees each step in the customer audit trail.
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
  },
  { timestamps: true, collection: "gm_terms_requests" },
);

GmTermsRequestSchema.index({ userId: 1, status: 1 });

const GmTermsRequest =
  (mongoose.models.GmTermsRequest as mongoose.Model<IGmTermsRequest>) ||
  mongoose.model<IGmTermsRequest>("GmTermsRequest", GmTermsRequestSchema);

export default GmTermsRequest;
