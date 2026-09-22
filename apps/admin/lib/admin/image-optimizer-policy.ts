/**
 * Shared rules for what Image Optimizer treats as already done.
 *
 * Model-free; imported by the optimize-images route (GET scan + POST process)
 * so the two handlers cannot disagree about which files need work.
 *
 * // Reason: a flat 150KB WebP cutoff was right for avatars and cosmetics, and
 * // wrong for game artwork. Hero / gallery / tips images at ~1920px routinely
 * // land at 200–350KB as healthy WebP — the scan then showed "Needs
 * // optimization", re-encoding did almost nothing, and renaming PNG→WebP
 * // without rewriting gallery URLs broke Featured tiles on the game page.
 */

const KB = 1024;

/** Cosmetics, avatars, badges — small surfaces. */
export const DEFAULT_OPTIMIZED_MAX_BYTES = 150 * KB;

/**
 * Game banners, tips art, gallery, gameplay preview — wide and detailed.
 * 500KB is still a hard ceiling for a 1920px WebP at quality ~80.
 */
export const ARTWORK_OPTIMIZED_MAX_BYTES = 500 * KB;

/** Full-bleed backgrounds / hero uploads. */
export const BACKGROUND_OPTIMIZED_MAX_BYTES = 400 * KB;

/** Skip files this small — not worth the round trip. */
export const MIN_OPTIMIZE_BYTES = 10 * KB;

export function optimizedSizeLimitBytes(imageType: string): number {
  if (imageType === "artwork") return ARTWORK_OPTIMIZED_MAX_BYTES;
  if (imageType === "background") return BACKGROUND_OPTIMIZED_MAX_BYTES;
  return DEFAULT_OPTIMIZED_MAX_BYTES;
}

/**
 * True when the file is already WebP and under the type's size ceiling.
 * Non-WebP is never "optimized" — converting is the whole point of the tool.
 */
export function isImageOptimized(
  ext: string,
  sizeBytes: number,
  imageType: string,
): boolean {
  const lower = ext.toLowerCase();
  if (lower !== ".webp") return false;
  return sizeBytes <= optimizedSizeLimitBytes(imageType);
}

export function canOptimizeImage(
  ext: string,
  sizeBytes: number,
  imageType: string,
): boolean {
  if (sizeBytes <= MIN_OPTIMIZE_BYTES) return false;
  return !isImageOptimized(ext, sizeBytes, imageType);
}
