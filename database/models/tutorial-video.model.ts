import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * Tutorial Video model.
 *
 * Reason: Stores admin-uploaded tutorial video metadata. The binary file
 * itself lives on disk under `<repo-root>/Videos/` (committed to git as
 * platform defaults, replaceable per-whitelabel at runtime). Only the
 * structured metadata is persisted in MongoDB so admins can edit
 * titles, descriptions and ordering without touching the disk file.
 */

export const TUTORIAL_CATEGORIES = [
  "getting-started",
  "trading",
  "wallet",
  "competitions",
  "challenges",
  "marketplace",
  "profile",
  "other",
] as const;

export type TutorialCategory = (typeof TUTORIAL_CATEGORIES)[number];

export interface ITutorialVideo extends Document {
  slug: string; // URL-safe identifier (unique)
  title: string;
  description?: string;
  category: TutorialCategory;

  // File on disk
  filename: string; // basename under <repo-root>/Videos/
  mimeType: string; // e.g. video/mp4
  sizeBytes: number;
  durationSec?: number;

  // Optional poster image
  thumbnailFilename?: string; // basename under <repo-root>/Videos/thumbnails/

  // Display
  order: number;
  isActive: boolean;

  // Audit
  uploadedBy: string; // admin id
  uploadedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TutorialVideoSchema = new Schema<ITutorialVideo>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9][a-z0-9-]{1,79}$/,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 2000 },
    category: {
      type: String,
      enum: TUTORIAL_CATEGORIES,
      default: "other",
      index: true,
    },

    filename: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    durationSec: { type: Number, min: 0 },

    thumbnailFilename: { type: String, trim: true },

    order: { type: Number, default: 100, index: true },
    isActive: { type: Boolean, default: true, index: true },

    uploadedBy: { type: String, required: true },
    uploadedByName: { type: String, trim: true },
  },
  { timestamps: true },
);

TutorialVideoSchema.index({ category: 1, order: 1, createdAt: -1 });

export const TutorialVideo: Model<ITutorialVideo> =
  (models.TutorialVideo as Model<ITutorialVideo>) ||
  model<ITutorialVideo>("TutorialVideo", TutorialVideoSchema);

export default TutorialVideo;
