import { PRESS_EFFECT } from "@/components/ui/press-effect";
import { neonButtonClasses } from "@/components/neon/Buttons";

/**
 * One sharp cyan action button for every CTA on the overview dashboard
 * (Challenge, Matching Cards, View Leaderboard, Join, Browse competitions,
 * View All Missions, View all).
 *
 * Reason: owner, 5 Oct 2026 - the PNG button art (Challenge orange / Matching
 * Cards purple / Join) plus CSS `drop-shadow` blooms looked blurry and each
 * control wore a different colour. Replacing them with the neon kit's outline
 * tone keeps the cyan theme, drops the soft glow, and gives every CTA the
 * same height, radius, type and press. No `drop-shadow` / `shadow-[0_0_*]`
 * bloom — a hard border is what reads sharp on this page.
 */
export const OVERVIEW_ACTION_BUTTON = [
  "inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5",
  // Reason: tone sets border-* colour; `border` is required for width (NeonButton BASE).
  "rounded-xl border px-3 text-xs font-bold uppercase tracking-wide",
  "cursor-pointer",
  neonButtonClasses("outline"),
  PRESS_EFFECT,
].join(" ");

/** Compact twin for a header/empty-state control that should not stretch full width. */
export const OVERVIEW_ACTION_BUTTON_INLINE = [
  "inline-flex h-11 min-w-0 items-center justify-center gap-1.5",
  "rounded-xl border px-4 text-xs font-bold uppercase tracking-wide",
  "cursor-pointer",
  neonButtonClasses("outline"),
  PRESS_EFFECT,
].join(" ");
