import { PRESS_EFFECT } from "@/components/ui/press-effect";
import { neonButtonClasses } from "@/components/neon/Buttons";

/**
 * Sharp cyan action button for Overview *actions* (Challenge, Matching Cards,
 * View Leaderboard, Join).
 *
 * Reason: owner, 5 Oct 2026 - PNG button art plus CSS `drop-shadow` blooms
 * looked blurry. Neon outline tone, no soft glow. A later pass the same day
 * kept only real actions as buttons — "View all" style links are text
 * (`OVERVIEW_TEXT_LINK`), except View Leaderboard which stays a button.
 */
export const OVERVIEW_ACTION_BUTTON = [
  "inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5",
  // Reason: tone sets border-* colour; `border` is required for width (NeonButton BASE).
  "rounded-xl border px-3 text-xs font-bold uppercase tracking-wide",
  "cursor-pointer",
  neonButtonClasses("outline"),
  PRESS_EFFECT,
].join(" ");

/** Compact twin for a header/empty-state action that should not stretch full width. */
export const OVERVIEW_ACTION_BUTTON_INLINE = [
  "inline-flex h-11 min-w-0 items-center justify-center gap-1.5",
  "rounded-xl border px-4 text-xs font-bold uppercase tracking-wide",
  "cursor-pointer",
  neonButtonClasses("outline"),
  PRESS_EFFECT,
].join(" ");

/**
 * Quiet header "view …" link — cyan text, no border, no glow.
 * Reason: owner, 5 Oct 2026 - every View all except View Leaderboard should
 * read as text, not a button.
 */
export const OVERVIEW_TEXT_LINK =
  "inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-cyan-300 transition-colors hover:text-cyan-200 cursor-pointer";
