import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * Tutorial Video model — admin app mirror.
 *
 * Reason: The main app and the admin app each have their own Mongoose
 * model registry. They share the same MongoDB collection
 * (`tutorialvideos`), so the schema must stay identical. When updating
 * one file, mirror the change to the other.
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
  slug: string;
  title: string;
  description?: string;
  category: TutorialCategory;

  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;

  thumbnailFilename?: string;

  order: number;
  isActive: boolean;

  uploadedBy: string;
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
