import mongoose, { Schema, Document } from "mongoose";

/**
 * Terms Acceptance Model
 *
 * Records every instance of a user accepting action-specific terms
 * (credit purchase, withdrawal, marketplace, competition entry, challenge).
 * Provides a permanent audit trail for legal/compliance purposes.
 */

export interface ITermsAcceptance extends Document {
  /** The user who accepted */
  userId: string;
  /** Slug of the terms page (e.g. "terms-credit-purchase") */
  termsSlug: string;
  /** Human-readable title at the time of acceptance */
  termsTitle: string;
  /** The SitePage version date at acceptance time (for version tracking) */
  termsUpdatedAt?: Date;
  /**
   * The SitePage `version` string at acceptance (Gamemaster Program v2, `24` s2.4). A date
   * cannot say which wording was accepted once a page is edited twice in a day; an explicit
   * version can, and a re-acceptance is required when it changes. Absent on older rows.
   */
  termsVersion?: string;
  /**
   * What the acceptance was FOR, when that is more than the page itself - e.g. affiliating
   * to one particular Game Master. Absent for the action-terms popups, which need none.
   */
  context?: {
    gameMasterId?: string;
    affiliationSource?: string;
    competitionId?: string;
  };
  /** IP address of the user at acceptance time */
  ipAddress?: string;
  /** User agent string at acceptance time */
  userAgent?: string;
  /** Timestamp of acceptance */
  acceptedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const TermsAcceptanceSchema = new Schema<ITermsAcceptance>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    termsSlug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    termsTitle: {
      type: String,
      required: true,
      trim: true,
    },
    termsUpdatedAt: {
      type: Date,
    },
    termsVersion: {
      type: String,
    },
    // Reason: plain strings, not an enum on `affiliationSource` - the source vocabulary is
    // owned by `user-referral.model.ts`, and this row is a legal record that must never be
    // refused because the two vocabularies were extended in different commits.
    context: {
      gameMasterId: { type: String },
      affiliationSource: { type: String },
      competitionId: { type: String },
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    acceptedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "termsacceptances",
  },
);

// Compound index for querying a user's acceptances of a specific terms page
TermsAcceptanceSchema.index({ userId: 1, termsSlug: 1, acceptedAt: -1 });
// Which players accepted a given Game Master's affiliation terms (GM dashboard, D6).
TermsAcceptanceSchema.index({ "context.gameMasterId": 1, acceptedAt: -1 });

// Reason: TTL not applied — these records must be kept indefinitely for legal compliance.

const TermsAcceptance =
  (mongoose.models.TermsAcceptance as mongoose.Model<ITermsAcceptance>) ||
  mongoose.model<ITermsAcceptance>("TermsAcceptance", TermsAcceptanceSchema);

export default TermsAcceptance;
