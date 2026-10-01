import mongoose, { Schema, Document } from "mongoose";
import { REFERRAL_CLAIM_STATUSES, type ReferralClaimStatus } from "@/lib/services/gamemaster/referral-claim-rules";

/**
 * A referral-link sign-up that has NOT yet become an affiliation (Gamemaster Program v2,
 * `External game plans/24` s5.3).
 *
 * Registering through a Game Master's link used to attach the player at once, with no way to
 * agree to the Gamemaster terms. Since s5.3 sign-up writes only this row; the player's first
 * visit shows the terms once, and only an acceptance turns it into a `userreferrals` row
 * through `affiliate()`, the single writer. A decline - or the link no longer applying -
 * resolves the claim for good, so a player who said no is never attached and never asked
 * again.
 *
 * Main app only as a MODEL. This comment once said "nothing in `apps/admin` reads it yet"; since
 * `24` s5.6 the admin app reads and writes the collection with the raw driver
 * (`admin-terms-reminder.service.ts`: the waiting list and the reminder counter), never through a
 * model, so there is still no second schema copy to keep in step (R42). The admin also sees the
 * outcome through the customer audit trail (`gm_referral_link_pending` / `_declined` / `_lapsed`).
 */
export interface IGmReferralClaim extends Document {
  userId: string;
  userEmail: string;
  /** The code the link carried; resolved to a subscription again when the player answers. */
  referralCode: string;
  /** The Game Master the code named at sign-up - shown in the prompt, never trusted for the join. */
  gameMasterId: string;
  gameMasterName?: string;
  status: ReferralClaimStatus;
  /** Why the claim ended: `affiliated`, `declined`, or the refusal code that closed it. */
  resolution?: string;
  termsAcceptanceId?: string;
  resolvedAt?: Date;
  signupIP?: string;
  signupUserAgent?: string;
  /**
   * The Game Master's once-only "Send terms" reminder (`24` s5.6). Set by ONE conditional
   * update on `gmTermsReminderSent: { $ne: true }`, so a double click sends once.
   */
  gmTermsReminderSent?: boolean;
  gmTermsReminderSentAt?: Date;
  /** Admin reminders - unlimited, audited, and never counted against the Game Master's one. */
  adminTermsReminderCount?: number;
  lastAdminTermsReminderAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GmReferralClaimSchema = new Schema<IGmReferralClaim>(
  {
    // Reason: unique - one link claim per player, ever. A second sign-up cannot happen for
    // the same account, and an upsert keyed here makes a retried sign-up harmless.
    userId: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true },
    referralCode: { type: String, required: true },
    gameMasterId: { type: String, required: true, index: true },
    gameMasterName: { type: String },
    status: { type: String, enum: [...REFERRAL_CLAIM_STATUSES], required: true },
    resolution: { type: String },
    termsAcceptanceId: { type: String },
    resolvedAt: { type: Date },
    signupIP: { type: String },
    signupUserAgent: { type: String },
    gmTermsReminderSent: { type: Boolean },
    gmTermsReminderSentAt: { type: Date },
    adminTermsReminderCount: { type: Number, min: 0 },
    lastAdminTermsReminderAt: { type: Date },
  },
  { timestamps: true, collection: "gm_referral_claims" },
);

const GmReferralClaim =
  (mongoose.models.GmReferralClaim as mongoose.Model<IGmReferralClaim>) ||
  mongoose.model<IGmReferralClaim>("GmReferralClaim", GmReferralClaimSchema);

export default GmReferralClaim;
