import mongoose, { Document, Schema } from "mongoose";
import type { ILPSection } from "./landing-page-template.model";

// ─── Main Interface ─────────────────────────────────────────────────────────
export interface ILandingPage extends Document {
  /** Internal name for admin reference */
  name: string;
  /** Unique tracking identifier used in the public URL: /lp/{trackingId} */
  trackingId: string;
  /** Template this page was created from (null if from scratch) */
  templateSlug?: string;
  /** Editable content sections (copy of template content) */
  sections: ILPSection[];
  /** Custom CSS overrides */
  customCss?: string;
  /** SEO */
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  /** Risk disclaimer toggle (should always be true for compliance) */
  showRiskDisclaimer: boolean;
  /** Marketing tracking */
  assignedTo?: string; // Marketing partner/company name
  campaign?: string; // Campaign name for grouping
  source?: string; // Traffic source label
  /** Status */
  isActive: boolean;
  /** Counters (denormalized for performance) */
  totalVisits: number;
  uniqueVisitors: number;
  totalSignups: number;
  /** Admin who created this page */
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ─────────────────────────────────────────────────────────────────
const LPSectionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "hero",
        "features",
        "stats",
        "how-it-works",
        "testimonials",
        "cta",
        "faq",
        "custom-html",
      ],
      required: true,
    },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    content: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const LandingPageSchema = new Schema<ILandingPage>(
  {
    name: { type: String, required: true, trim: true },
    trackingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    templateSlug: { type: String, default: null },
    sections: { type: [LPSectionSchema], default: [] },
    customCss: { type: String, default: "" },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    ogImage: { type: String, default: "" },
    showRiskDisclaimer: { type: Boolean, default: true },
    assignedTo: { type: String, default: "" },
    campaign: { type: String, default: "" },
    source: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    totalVisits: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    totalSignups: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

// Reason: Compound index for analytics queries filtering by campaign/source
LandingPageSchema.index({ isActive: 1 });
LandingPageSchema.index({ campaign: 1, source: 1 });
LandingPageSchema.index({ assignedTo: 1 });

const LandingPage =
  (mongoose.models.LandingPage as mongoose.Model<ILandingPage>) ||
  mongoose.model<ILandingPage>("LandingPage", LandingPageSchema);

export default LandingPage;
