import { connectToDatabase } from "@/database/mongoose";
import { BrandingAsset } from "@/database/models/branding-asset.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { encodeBrandingFileKey } from "@/lib/utils/branding-file-key";

/**
 * The database copy of an uploaded image, so every server can serve it.
 *
 * ChartVolt runs more than one application server behind one hostname, so a file written to
 * the disk of whichever server handled the upload is a 404 from the others - intermittently,
 * which reads as a caching problem rather than a storage one - and a redeploy loses it
 * altogether. So the bytes go into the database too, and the asset routes fall back to them.
 *
 * This module is the ONLY place that knows where those bytes live. That matters more than it
 * looks: the write side and the read side disagreeing about a storage location is the
 * "one rule, two copies" shape behind several defects here already, and the store changed on
 * 8 September 2026 (see `branding-asset.model.ts`). Every writer, reader and delete goes
 * through the three functions below, which is what lets `brandingFiles` be `select: false`.
 *
 * Keep this file identical to the copy in `apps/admin/lib/services/`.
 */

/**
 * The per-file ceiling.
 *
 * Base64 inflates by a third, so an 8MB image is about 10.7MB stored, comfortably inside
 * MongoDB's 16MB document limit with room for the rest of the document. Callers with a
 * stricter limit of their own - game artwork is capped at 4MB - keep theirs; this is the
 * backstop that makes the STORE safe rather than a product decision about picture sizes.
 */
export const MAX_BRANDING_ASSET_BYTES = 8 * 1024 * 1024;

export interface BrandingAssetBytes {
  /**
   * `Buffer<ArrayBuffer>` rather than plain `Buffer`, which is `Buffer<ArrayBufferLike>` and
   * is not assignable to `BodyInit` - so a route handing this straight to `NextResponse`
   * would need a cast, and a cast in a serve route is where a wrong type hides.
   */
  data: Buffer<ArrayBuffer>;
  contentType: string;
}

/**
 * Store or replace one image. Throws, so a caller that must report failure can.
 *
 * An upsert on `filename` rather than a read-modify-write. The old code loaded the whole
 * settings document, mutated a map and saved it, which meant every upload transferred every
 * previously uploaded image in both directions.
 */
export async function putBrandingAsset(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  if (buffer.length > MAX_BRANDING_ASSET_BYTES) {
    throw new Error(
      `${filename} is ${Math.round(buffer.length / 1024 / 1024)}MB, over the ${
        MAX_BRANDING_ASSET_BYTES / 1024 / 1024
      }MB limit for a stored image.`,
    );
  }

  await connectToDatabase();
  await BrandingAsset.findOneAndUpdate(
    { filename },
    {
      $set: {
        data: buffer.toString("base64"),
        contentType,
        bytes: buffer.length,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

/**
 * Read one image, from the collection first and the legacy map second.
 *
 * Reason for that order rather than the reverse: the collection is where every new upload
 * goes, so it answers the common case in one indexed lookup, and the legacy map is a
 * shrinking set that the migration in `tools/branding/` empties. Reading the map at all
 * requires `select` because the field is `select: false` - it was on the hot path of 67
 * settings reads, at up to 16MB each, purely so that four routes could occasionally recover
 * one picture.
 */
export async function readBrandingAsset(
  filename: string,
): Promise<BrandingAssetBytes | null> {
  await connectToDatabase();

  const stored = await BrandingAsset.findOne({ filename }).lean();
  if (stored?.data) {
    return {
      data: Buffer.from(stored.data, "base64"),
      contentType: stored.contentType || "image/png",
    };
  }

  const settings = await WhiteLabel.findOne().select("+brandingFiles");
  const legacy = settings?.brandingFiles?.get(encodeBrandingFileKey(filename));
  if (legacy?.data) {
    return {
      data: Buffer.from(legacy.data, "base64"),
      contentType: legacy.contentType || "image/png",
    };
  }

  return null;
}

/** Remove one image from both stores. Returns whether anything was removed. */
export async function deleteBrandingAsset(filename: string): Promise<boolean> {
  await connectToDatabase();

  const removed = await BrandingAsset.deleteOne({ filename });
  let removedLegacy = false;

  const settings = await WhiteLabel.findOne().select("+brandingFiles");
  const key = encodeBrandingFileKey(filename);
  if (settings?.brandingFiles?.has(key)) {
    settings.brandingFiles.delete(key);
    await settings.save();
    removedLegacy = true;
  }

  return removed.deletedCount > 0 || removedLegacy;
}
