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

// Reason: TTL not applied — these records must be kept indefinitely for legal compliance.

const TermsAcceptance =
  (mongoose.models.TermsAcceptance as mongoose.Model<ITermsAcceptance>) ||
  mongoose.model<ITermsAcceptance>("TermsAcceptance", TermsAcceptanceSchema);

export default TermsAcceptance;
