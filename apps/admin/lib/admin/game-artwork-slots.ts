/**
 * The image slots a catalogue title has, in one place.
 *
 * MODEL-FREE BY REQUIREMENT, not by preference, and that is the whole reason this is its own
 * file rather than four literals exported from `game-artwork-storage.ts`. That module writes
 * to disk and calls `putBrandingAsset`, which reaches a Mongoose model - so a `"use client"`
 * component naming it in a value-import position cannot be bundled at all (R58), and the
 * upload field is a client component. Written the obvious way, the list would exist twice:
 * once for the form to offer and once for the route to admit, which is the "one rule, two
 * copies" shape behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||`.
 *
 * The drift it would cause is not cosmetic. The slot reaches the stored FILENAME, so a form
 * offering a slot the route has renamed fails with a 400 that reads to an operator like a
 * permissions problem.
 *
 * NOT MIRRORED. `apps/admin/lib/admin/` is admin-only; the player app reads these images and
 * never uploads one.
 */

/**
 * A `Set`, never an object, because the value arrives from a request and an object lookup
 * walks the prototype chain - `"constructor"` returns something truthy, survives a falsy
 * test and fails later somewhere unrelated. Fourth instance of that trap here, after the
 * round-inspector action map, the contest-edit field list and the Game Master limits.
 */
export const ARTWORK_SLOTS = new Set([
  "logo",
  "banner",
  // The arena's two illustrations (owner, 11 September 2026). Named for the panel each one
  // appears in rather than for what it depicts, because what it depicts is the operator's
  // decision per title and the panel is ours.
  "how-to-play",
  "highlight",
] as const);

export type ArtworkSlot = "logo" | "banner" | "how-to-play" | "highlight";

export function isArtworkSlot(value: unknown): value is ArtworkSlot {
  return typeof value === "string" && ARTWORK_SLOTS.has(value as ArtworkSlot);
}
