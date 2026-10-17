/**
 * Sticky Enter bar slogans (game page). One is chosen at random each visit.
 * Reason (6 Oct 2026, owner): replace the fixed "Better traders / brighter
 * tomorrow" line with rotating competition-flavoured copy.
 */

export const STICKY_ENTER_SLOGANS = [
  "We Came. We Competed. We Conquered.",
  "Play. Compete. Conquer.",
  "Trade. Play. Win.",
  "Compete. Rise. Conquer.",
  "Enter. Compete. Dominate.",
  "Challenge. Compete. Win.",
  "Play Hard. Rise Higher.",
  "Trade Smart. Compete Hard.",
  "Skill In. Victory Out.",
  "Compete Beyond Limits.",
  "Own the Challenge.",
  "Rise Through Competition.",
  "Play for the Win.",
  "Where Skill Becomes Victory.",
  "Compete. Climb. Conquer.",
  "Your Skill. Your Arena.",
  "Enter the Arena. Own It.",
  "Prove Your Skill. Take the Win.",
  "One Platform. Endless Competition.",
  "Trade. Game. Compete. Conquer.",
  "Built to Compete. Made to Win.",
] as const;

export type StickyEnterSlogan = (typeof STICKY_ENTER_SLOGANS)[number];

export function pickStickyEnterSlogan(
  random: () => number = Math.random,
): StickyEnterSlogan {
  // Reason: .at avoids the bracket-index object-injection lint; bounds are
  // already clamped by floor(random * length).
  return (
    STICKY_ENTER_SLOGANS.at(
      Math.floor(random() * STICKY_ENTER_SLOGANS.length),
    ) ?? STICKY_ENTER_SLOGANS[0]
  );
}

/**
 * Split into gold / accent halves so multi-phrase slogans keep the two-tone
 * look of the old line. A single phrase stays all gold.
 */
export function splitSloganTone(slogan: string): {
  lead: string;
  trail: string | null;
} {
  const parts = slogan.split(/(?<=\.)\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { lead: slogan, trail: null };
  }
  const mid = Math.ceil(parts.length / 2);
  return {
    lead: parts.slice(0, mid).join(" "),
    trail: parts.slice(mid).join(" "),
  };
}
