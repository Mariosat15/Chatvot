import { Schema, model, models, type Document, type Model } from "mongoose";

/**
 * One uploaded image, in its own document.
 *
 * This exists because the previous home for these bytes could not hold them. Every hero
 * image, branding image and game artwork upload was base64-encoded into the
 * `WhiteLabel.brandingFiles` map - a single document shared by every setting the platform
 * has - and MongoDB caps a document at 16MB. On 8 September 2026 that document reached
 * 17,070,874 bytes on a game-logo upload and the write was refused, which means uploading
 * ANY image had by then become impossible platform-wide. The failure mode is the part worth
 * remembering: nothing was wrong with the image, the route or the encoding, and the ceiling
 * is reached by success rather than by a bug, so it arrives without warning and every
 * upload after it fails identically.
 *
 * A collection has no such ceiling. The limit that remains is per file, which is a limit an
 * operator can act on ("this picture is too big") rather than one they cannot ("the
 * platform has run out of pictures").
 *
 * Keyed by `filename` rather than by the `__DOT__`-encoded key the map needed. That encoding
 * exists solely to work round Mongoose refusing a dot in a MAP key; a plain String path has
 * no such restriction, and carrying a workaround past its cause is how it survives long
 * enough for somebody to "simplify" it. `branding-file-key.ts` is still required for reading
 * the legacy map, and only for that.
 */
export interface IBrandingAsset extends Document {
  /** The generated filename, exactly as the asset routes receive it in the URL. */
  filename: string;
  /** Base64, matching what the legacy map stored so the read path has one shape. */
  data: string;
  contentType: string;
  /** Decoded size. Stored so the migration and any future report can total it up. */
  bytes: number;
  updatedAt: Date;
}

const BrandingAssetSchema = new Schema<IBrandingAsset>(
  {
    filename: { type: String, required: true, unique: true, index: true },
    data: { type: String, required: true },
    contentType: { type: String, required: true },
    bytes: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "branding_asset" },
);

export const BrandingAsset: Model<IBrandingAsset> =
  (models.BrandingAsset as Model<IBrandingAsset>) ||
  model<IBrandingAsset>("BrandingAsset", BrandingAssetSchema);
