import mongoose, { Document, Schema } from "mongoose";

// ─── Section Types ──────────────────────────────────────────────────────────
export interface ISitePageSection {
  id: string;
  type: "heading" | "paragraph" | "list" | "divider" | "html";
  /** Used for heading type as the section title */
  title?: string;
  /** Main content (text, HTML, or list items separated by newlines) */
  content: string;
  order: number;
}

// ─── Category Types ─────────────────────────────────────────────────────────
// Reason: "page" = regular site pages (terms, privacy, about, etc.)
//         "action_terms" = short pop-up terms shown before critical user actions
export type SitePageCategory = "page" | "action_terms";

// ─── Main Interface ──────────────────────────────────────────────────────────
export interface ISitePage extends Document {
  slug: string;
  title: string;
  subtitle?: string;
  sections: ISitePageSection[];
  isActive: boolean;
  /** System pages (terms, privacy) cannot be deleted */
  isSystem: boolean;
  /** Category distinguishes regular pages from action-specific pop-up terms */
  category: SitePageCategory;
  /**
   * For action_terms pages only.
   * true  = popup shows every time the user performs the action (per session)
   * false = popup shows only once ever (persisted server-side after first accept)
   * @default true
   */
  showEveryTime: boolean;
  seoTitle?: string;
  seoDescription?: string;
  lastUpdatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const SitePageSectionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["heading", "paragraph", "list", "divider", "html"],
      default: "paragraph",
    },
    title: { type: String, default: "" },
    content: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const SitePageSchema = new Schema<ISitePage>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "" },
    sections: { type: [SitePageSectionSchema], default: [] },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    category: {
      type: String,
      enum: ["page", "action_terms"],
      default: "page",
      index: true,
    },
    // Reason: Controls whether the terms popup re-appears each session or only once ever.
    // Default true = show every time (per session). Admin can toggle to false = one-time only.
    showEveryTime: { type: Boolean, default: true },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    lastUpdatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

// Reason: Use lean() on reads for 5x faster deserialization
SitePageSchema.index({ isActive: 1 });

const SitePage =
  (mongoose.models.SitePage as mongoose.Model<ISitePage>) ||
  mongoose.model<ISitePage>("SitePage", SitePageSchema);

export default SitePage;
