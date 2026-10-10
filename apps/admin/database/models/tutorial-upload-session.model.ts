import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * Tutorial Upload Session
 *
 * Reason: Tutorial videos can be up to 200 MB but the nginx reverse
 * proxy in front of the admin app caps single requests at 10 MB. To
 * avoid raising that limit (and the security exposure that comes
 * with it), large uploads are split into < 8 MB chunks by the
 * browser. This collection tracks the multipart upload as it streams
 * to disk, lets the client report progress, and powers the
 * finalize / abort flows.
 *
 * A TTL index automatically removes abandoned sessions after 24
 * hours. On every `init` we also opportunistically delete any
 * sessions where `expiresAt < now`, so disk cleanup happens even if
 * mongo TTL hasn't run yet.
 */

export type UploadSessionStatus = "pending" | "completed" | "aborted";

export interface ITutorialUploadSession extends Document {
  sessionId: string; // UUID
  adminId: string;
  adminName?: string;

  // Final-file info (kept in sync with TutorialVideo)
  title: string;
  description?: string;
  category: string;
  order: number;
  isActive: boolean;
  slug: string;
  filename: string; // basename to be written under <repo-root>/Videos/
  thumbnailFilename?: string; // basename under <repo-root>/Videos/thumbnails/

  // Transport info
  mimeType: string;
  totalSize: number; // bytes
  chunkSize: number; // bytes per chunk (last chunk may be smaller)
  totalChunks: number;
  receivedChunks: number[]; // sorted ascending, 0-based
  bytesReceived: number;

  status: UploadSessionStatus;
  expiresAt: Date;
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TutorialUploadSessionSchema = new Schema<ITutorialUploadSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    adminId: { type: String, required: true, index: true },
    adminName: { type: String, trim: true },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 2000 },
    category: { type: String, required: true },
    order: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    filename: { type: String, required: true, trim: true },
    thumbnailFilename: { type: String, trim: true },

    mimeType: { type: String, required: true, trim: true },
    totalSize: { type: Number, required: true, min: 0 },
    chunkSize: { type: Number, required: true, min: 1 },
    totalChunks: { type: Number, required: true, min: 1 },
    receivedChunks: { type: [Number], default: [] },
    bytesReceived: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "completed", "aborted"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true },
    finalizedAt: { type: Date },
  },
  { timestamps: true },
);

// Reason: MongoDB TTL monitor deletes documents where `expiresAt` has
// passed. `expireAfterSeconds: 0` makes the date itself the TTL.
TutorialUploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TutorialUploadSession: Model<ITutorialUploadSession> =
  (models.TutorialUploadSession as Model<ITutorialUploadSession>) ||
  model<ITutorialUploadSession>(
    "TutorialUploadSession",
    TutorialUploadSessionSchema,
  );

export default TutorialUploadSession;
