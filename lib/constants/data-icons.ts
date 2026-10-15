/**
 * ONE icon per piece of data, platform-wide (owner, 15 Oct 2026: "the icon used
 * for other pages must match the same icons for all, not different icons for the
 * same data").
 *
 * Any screen that shows one of these facts takes its icon from here - never its
 * own Lucide glyph, emoji or a different plate. Add a key when a second fact gets
 * a canonical icon; do not fork a screen-local copy.
 *
 * Files are the owner's Menuitems art, imported by `tools/overview/import-menuitems.mjs`.
 */
export const DATA_ICON = {
  /** Entry fee - the red wallet with the up arrow (Menuitems `withdrwal.png`). */
  entryFee: "/assets/neon/icons/withdrawal.webp",
} as const;
