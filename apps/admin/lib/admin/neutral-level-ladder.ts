/**
 * Neutral level ladder proposal (R96b).
 *
 * The shipped ladder in `lib/constants/levels.ts` reads "Novice Trader" through
 * to "Trading Legend", which is wrong on a platform where a player may never
 * have placed a trade. R88 already made the ladder operator-editable and made
 * every screen read the edited one; what was missing is something to propose.
 *
 * Deliberately deterministic — no AI. A ladder is twenty rows of thresholds and
 * a model adds nothing but the chance of a non-monotonic curve.
 *
 * It PROPOSES only. `run_full` writes it when no `level_progression` row exists
 * and never otherwise: an operator who has renamed their ladder must not have it
 * replaced by a later run of the wizard.
 */

export interface ProposedLevel {
  level: number;
  title: string;
  minXP: number;
  maxXP: number;
  color: string;
  icon: string;
}

/**
 * Twenty neutral titles. No game noun anywhere — they must read correctly for a
 * puzzle player, a racer and a trader, which is the whole point.
 */
const NEUTRAL_TITLES: readonly string[] = [
  "Rookie",
  "Challenger",
  "Contender",
  "Competitor",
  "Regular",
  "Specialist",
  "Skilled",
  "Veteran",
  "Expert",
  "Elite",
  "Master",
  "Grandmaster",
  "Champion",
  "Prodigy",
  "Virtuoso",
  "Titan",
  "Paragon",
  "Immortal",
  "Mythic",
  "Legend",
] as const;

const TIER_COLORS: readonly string[] = [
  "text-gray-400",
  "text-slate-300",
  "text-green-400",
  "text-emerald-400",
  "text-cyan-400",
  "text-blue-400",
  "text-indigo-400",
  "text-violet-400",
  "text-purple-400",
  "text-fuchsia-400",
  "text-pink-400",
  "text-rose-400",
  "text-orange-400",
  "text-amber-400",
  "text-yellow-400",
  "text-lime-400",
  "text-teal-300",
  "text-sky-300",
  "text-red-400",
  "text-yellow-300",
] as const;

const TIER_ICONS: readonly string[] = [
  "starBadge",
  "starBadge",
  "shield1",
  "shield1",
  "target",
  "target",
  "medal1",
  "medal1",
  "trophy",
  "trophy",
  "crown",
  "crown",
  "crown",
  "diamond1",
  "diamond1",
  "diamond1",
  "flame1",
  "flame1",
  "flame1",
  "crown",
] as const;

/**
 * Geometric XP curve. Each level costs ~1.35x the previous band, which keeps
 * early levels reachable from two or three badges while the top of the ladder
 * needs sustained play.
 */
export function proposeNeutralLadder(
  levelCount = NEUTRAL_TITLES.length,
  firstBandXp = 500,
  growth = 1.35,
): ProposedLevel[] {
  const count = Math.max(1, Math.min(NEUTRAL_TITLES.length, levelCount));
  const levels: ProposedLevel[] = [];

  let cursor = 0;
  let band = firstBandXp;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const minXP = cursor;
    // Round to a readable number so an operator editing the row is not fighting
    // values like 1837.
    const rounded = Math.max(100, Math.round(band / 100) * 100);
    const maxXP = isLast ? Number.MAX_SAFE_INTEGER : minXP + rounded - 1;

    levels.push({
      level: i + 1,
      // Reason: `.at()` rather than `[i]` so the type admits the out-of-range
      // case the readonly array signature otherwise hides.
      title: NEUTRAL_TITLES.at(i) ?? `Level ${i + 1}`,
      minXP,
      maxXP,
      color: TIER_COLORS.at(i) ?? "text-gray-400",
      icon: TIER_ICONS.at(i) ?? "starBadge",
    });

    cursor = minXP + rounded;
    band = band * growth;
  }

  return levels;
}

/** Titles carrying a game noun — a ladder failing this is trading-shaped. */
const GAME_NOUNS = /\b(trad(?:er|ing)|forex|fx|pip|scalp|chart|racer|racing|puzzle|quiz)\b/i;

export interface LadderAudit {
  levelCount: number;
  monotonic: boolean;
  tradingShapedTitles: string[];
  verdict: string;
}

/**
 * Report whether an existing ladder is usable rather than rewriting it.
 * Reason: a ladder an operator has tuned is theirs; naming the problem lets them
 * decide, and a silent replacement is how a deliberate rename is lost.
 */
export function auditLadder(
  levels: ReadonlyArray<{ level?: number; title?: string; minXP?: number; maxXP?: number }>,
): LadderAudit {
  const tradingShapedTitles: string[] = [];
  let monotonic = true;
  let previousMin = -1;

  for (const l of levels) {
    const title = typeof l.title === "string" ? l.title : "";
    if (title && GAME_NOUNS.test(title)) tradingShapedTitles.push(title);
    const min = typeof l.minXP === "number" ? l.minXP : -1;
    if (min <= previousMin) monotonic = false;
    previousMin = min;
  }

  const parts: string[] = [`${levels.length} levels`];
  if (!monotonic) parts.push("thresholds are not strictly increasing");
  if (tradingShapedTitles.length > 0) {
    parts.push(
      `${tradingShapedTitles.length} title(s) name a specific game (${tradingShapedTitles.slice(0, 3).join(", ")})`,
    );
  }
  if (monotonic && tradingShapedTitles.length === 0) parts.push("neutral and monotonic");

  return {
    levelCount: levels.length,
    monotonic,
    tradingShapedTitles,
    verdict: parts.join("; "),
  };
}
