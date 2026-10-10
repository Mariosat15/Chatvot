import mongoose, { Document, Schema } from "mongoose";

// ─── Section Content Types ──────────────────────────────────────────────────
export interface ILPHeroContent {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
  backgroundGradient?: string;
  badge?: string; // e.g. "🏆 #1 Trading Platform"
}

export interface ILPFeatureItem {
  icon: string; // Lucide icon name
  title: string;
  description: string;
}

export interface ILPStatItem {
  value: string;
  label: string;
  icon?: string;
}

export interface ILPStep {
  step: number;
  title: string;
  description: string;
  icon?: string;
}

export interface ILPTestimonial {
  name: string;
  role?: string;
  quote: string;
  avatar?: string;
  rating?: number;
}

export interface ILPFAQItem {
  question: string;
  answer: string;
}

export interface ILPCTAContent {
  headline: string;
  subheadline?: string;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
}

// ─── Section Type ───────────────────────────────────────────────────────────
export type LPSectionType =
  | "hero"
  | "features"
  | "stats"
  | "how-it-works"
  | "testimonials"
  | "cta"
  | "faq"
  | "custom-html";

export interface ILPSection {
  id: string;
  type: LPSectionType;
  order: number;
  enabled: boolean;
  // Reason: content is a flexible JSON object whose structure depends on `type`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any>;
}

// ─── Template Interface ─────────────────────────────────────────────────────
export interface ILandingPageTemplate extends Document {
  slug: string;
  name: string;
  description: string;
  category: string; // "trading" | "competition" | "crypto" | "general"
  thumbnailGradient: string; // CSS gradient for thumbnail preview
  previewColors: { primary: string; accent: string; background: string };
  sections: ILPSection[];
  /** System templates cannot be deleted */
  isSystem: boolean;
  isActive: boolean;
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
        "image-text",
        "banner",
        "gallery",
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

const LandingPageTemplateSchema = new Schema<ILandingPageTemplate>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["trading", "competition", "crypto", "general"],
      default: "general",
      index: true,
    },
    thumbnailGradient: {
      type: String,
      default: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    previewColors: {
      primary: { type: String, default: "#3b82f6" },
      accent: { type: String, default: "#8b5cf6" },
      background: { type: String, default: "#0f172a" },
    },
    sections: { type: [LPSectionSchema], default: [] },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

LandingPageTemplateSchema.index({ isActive: 1, category: 1 });

const LandingPageTemplate =
  (mongoose.models.LandingPageTemplate as mongoose.Model<ILandingPageTemplate>) ||
  mongoose.model<ILandingPageTemplate>(
    "LandingPageTemplate",
    LandingPageTemplateSchema,
  );

export default LandingPageTemplate;
