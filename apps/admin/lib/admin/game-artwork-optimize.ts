/**
 * Resize + WebP encode for game artwork at upload time (Tasks 15–16).
 *
 * Owner decision, 9 Sep 2026: optimise **on upload only**. Do not point the bulk
 * Image Optimizer at existing files as the primary fix — renaming without rewriting
 * `provider_game` / `branding_asset` URLs breaks every title. New uploads land already
 * light, so the player never receives a multi-megabyte PNG for a logo or card.
 *
 * Model-free and sharp-only so tests can exercise the buffer path without writing disk.
 * `storeGameArtwork` is the only production caller.
 */

import type { ArtworkSlot } from "./game-artwork-slots";

export interface ArtworkOptimizeSpec {
  /** Longest edge / box the image must fit inside. Never enlarges. */
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

/**
 * Per-slot ceilings. A logo must not be banner-sized; a banner must not be a 4K dump.
 * Values match the Image Optimizer's artwork preset (1920×1080 @ q80) for wide slots,
 * and are tighter for square / panel art.
 *
 * Reason: a Map, not a Record — slot arrives from a form field, and object indexing
 * walks the prototype chain (`"__proto__"` would be truthy). Same rule as the
 * round-inspector action map and contest-edit allow-list.
 */
export const ARTWORK_SLOT_OPTIMIZE: ReadonlyMap<ArtworkSlot, ArtworkOptimizeSpec> =
  new Map([
    ["logo", { maxWidth: 512, maxHeight: 512, quality: 82 }],
    ["banner", { maxWidth: 1920, maxHeight: 1080, quality: 80 }],
    ["how-to-play", { maxWidth: 1200, maxHeight: 900, quality: 80 }],
    ["highlight", { maxWidth: 1200, maxHeight: 900, quality: 80 }],
    ["gameplay-preview", { maxWidth: 1280, maxHeight: 720, quality: 80 }],
    ["gallery", { maxWidth: 1920, maxHeight: 1080, quality: 80 }],
  ]);

const FALLBACK_SPEC: ArtworkOptimizeSpec = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 80,
};

export function artworkOptimizeSpec(slot: ArtworkSlot): ArtworkOptimizeSpec {
  return ARTWORK_SLOT_OPTIMIZE.get(slot) ?? FALLBACK_SPEC;
}

export interface OptimizedArtwork {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
  /** Bytes before encode — for logs / tests, never shown to players. */
  originalBytes: number;
  optimizedBytes: number;
}

/**
 * Encode an uploaded image as WebP at the slot's size ceiling.
 *
 * Throws when sharp cannot decode the buffer — callers should surface that as a
 * 400 rather than storing a corrupt file under a `.webp` name.
 */
export async function optimizeGameArtworkBuffer(
  input: Buffer,
  slot: ArtworkSlot,
): Promise<OptimizedArtwork> {
  const spec = artworkOptimizeSpec(slot);
  const sharp = (await import("sharp")).default;

  const buffer = await sharp(input, { animated: false })
    .rotate() // honour EXIF orientation so phones do not land sideways
    .resize(spec.maxWidth, spec.maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: spec.quality, effort: 4 })
    .toBuffer();

  return {
    buffer,
    contentType: "image/webp",
    extension: "webp",
    originalBytes: input.length,
    optimizedBytes: buffer.length,
  };
}
