/**
 * Image Optimizer renames PNG/JPEG → WebP on disk and (now) rewrites stored URLs.
 * Rows written before gallery retarget still name the deleted `.png`. Serving the
 * sibling `.webp` keeps Featured tiles working without a deploy-time data wait.
 *
 * Model-free; safe for route handlers.
 * Mirrored into apps/admin/lib/utils/.
 */

const RASTER_EXT = /\.(png|jpe?g|gif|bmp|tiff)$/i;

export function webpAliasFilename(filename: string): string | null {
  const base = filename.split(/[\\/]/).pop()?.split("?")[0] ?? "";
  if (!base || !RASTER_EXT.test(base)) return null;
  const alias = base.replace(RASTER_EXT, ".webp");
  return alias === base ? null : alias;
}
