/**
 * Level badge for the Challenge VS card.
 *
 * Uses the same ladder as the rest of the platform (`TITLE_LEVELS`, 20 rungs).
 * A previous decorative map of only 1–8 crashed Challenge for anyone at level 9+.
 * Model-free and client-safe (R58) — constants only, no mongoose.
 */

import { TITLE_LEVELS } from "@/lib/constants/levels";
import { resolveLevelName } from "@/lib/utils/level-title";

export type VsLevelBadge = {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
};

/** Safe badge for any stored level — never returns undefined. */
export function resolveVsLevelInfo(
  level: number | undefined | null,
): VsLevelBadge {
  const n =
    typeof level === "number" && Number.isFinite(level) && level > 0
      ? Math.floor(level)
      : 1;
  const art = TITLE_LEVELS.find((e) => e.level === n) ?? TITLE_LEVELS[0];
  return {
    label: resolveLevelName(n),
    color: art.color,
    // Reason: ladder colours are text-* classes; a translucent white chip keeps
    // contrast on both sides of the VS card without inventing a parallel palette.
    bgColor: "bg-white/15",
    icon: "⭐",
  };
}
