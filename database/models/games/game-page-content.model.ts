import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Operator-owned player page content for a platform game that is NOT a provider title.
 *
 * Today that is Trading only (`gameKey: "trading"`). Provider titles store the same field
 * vocabulary on `provider_game`; inventing a fake provider row for trading would pollute
 * catalogue sync and the immutable join key story (R7). A WhiteLabel blob would ride every
 * settings read the way brandingFiles once did (R56).
 *
 * One document per `gameKey`. Absences are intentional: readers fall back to
 * `TRADING_PAGE_DEFAULTS` rather than inventing empty strings.
 */

export interface IGamePageContent extends Document {
  gameKey: string;
  displayName?: string;
  tagline?: string;
  description?: string;
  category?: string;
  rulesSummary?: string;
  howToPlay?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  howToPlayImageUrl?: string;
  highlightsImageUrl?: string;
  highlights?: { title: string; detail: string }[];
  heroFeatures?: { icon: string; label: string }[];
  pageThemeId?: string;
  stylizedQuote?: string;
  gameplayPreviewUrl?: string;
  gameplayVideoUrl?: string;
  gallery?: { url: string; title?: string; type?: string }[];
  supportedDevices?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  skillLevelLabel?: string;
  howItWorksSteps?: { title: string; detail: string; icon?: string }[];
  descriptionTags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const HighlightSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    detail: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const HeroFeatureSchema = new Schema(
  {
    icon: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const GalleryItemSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    type: { type: String, trim: true },
  },
  { _id: false },
);

const HowItWorksStepSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    detail: { type: String, required: true, trim: true },
    icon: { type: String, trim: true },
  },
  { _id: false },
);

const GamePageContentSchema = new Schema<IGamePageContent>(
  {
    // Reason: no schema default — a default would write "trading" onto every insert and
    // make a mistyped key indistinguishable from the real singleton.
    gameKey: { type: String, required: true, trim: true, unique: true },
    displayName: { type: String, trim: true },
    tagline: { type: String, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    rulesSummary: { type: String, trim: true },
    howToPlay: { type: String, trim: true },
    thumbnailUrl: { type: String, trim: true },
    bannerUrl: { type: String, trim: true },
    howToPlayImageUrl: { type: String, trim: true },
    highlightsImageUrl: { type: String, trim: true },
    highlights: { type: [HighlightSchema], default: undefined },
    heroFeatures: { type: [HeroFeatureSchema], default: undefined },
    pageThemeId: { type: String, trim: true },
    stylizedQuote: { type: String, trim: true },
    gameplayPreviewUrl: { type: String, trim: true },
    gameplayVideoUrl: { type: String, trim: true },
    gallery: { type: [GalleryItemSchema], default: undefined },
    supportedDevices: {
      type: {
        desktop: { type: Boolean },
        tablet: { type: Boolean },
        mobile: { type: Boolean },
      },
      default: undefined,
    },
    skillLevelLabel: { type: String, trim: true },
    howItWorksSteps: { type: [HowItWorksStepSchema], default: undefined },
    descriptionTags: { type: [String], default: undefined },
  },
  {
    timestamps: true,
    collection: "game_page_content",
  },
);

const GamePageContent: Model<IGamePageContent> =
  mongoose.models?.GamePageContent ||
  mongoose.model<IGamePageContent>("GamePageContent", GamePageContentSchema);

export default GamePageContent;
