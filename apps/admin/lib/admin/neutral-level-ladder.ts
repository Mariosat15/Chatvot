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

// Reason: relative, never `@/` — vitest aliases `@` to the repository root, so
// the aliased form resolves under `next build` and fails in the suite (R58).
import { deriveLadderBands } from "../services/games/gamification-economy";

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

/**
 * Every name here must exist in `lib/constants/game-icons.ts`, and a test
 * asserts it does.
 *
 * Reason: this list shipped with `medal1`, `diamond1` and `flame1`, none of
 * which are in the registry — and the admin `GameIcon` renders an unknown name
 * as raw text rather than falling back, so eight of the twenty rungs displayed
 * the literal word "diamond1" beside the level. Nothing threw and nothing
 * logged; the only witness was a screenshot.
 *
 * Twenty DISTINCT names, deliberately. The first repair paired them up, which
 * left rungs 12, 13 and 20 all wearing `crown` — so the top of the ladder was
 * indistinguishable from its middle, and a ladder whose last rung looks like
 * its thirteenth gives a player nothing to recognise as an ending. A test
 * asserts both that every name resolves and that no name repeats.
 */
const TIER_ICONS: readonly string[] = [
  "star1",
  "star2",
  "star3",
  "starBadge",
  "shield1",
  "shield2",
  "shield3",
  "shield4",
  "magicShield3D",
  "medal7",
  "goldMedal",
  "starAward",
  "trophy1",
  "trophy2",
  "trophy3",
  "trophy",
  "trophyStar",
  "gems",
  "gemsAlt",
  "crown",
] as const;

/**
 * Propose a ladder whose top rung is reachable from the XP the badge catalogue
 * can actually pay.
 *
 * `earnableXp` comes from `earnableXpFromBadges`. Omitted, the curve falls back
 * to the engine's default rather than the old hand-picked 1.35x growth, which
 * ended at 426,400 XP against a catalogue paying a few thousand — Legend was
 * unreachable by roughly a hundredfold and nothing compared the two halves.
 */
export function proposeNeutralLadder(
  levelCount = NEUTRAL_TITLES.length,
  earnableXp = 0,
): ProposedLevel[] {
  const count = Math.max(1, Math.min(NEUTRAL_TITLES.length, levelCount));
  const bands = deriveLadderBands(earnableXp, count);

  return bands.map((band, i) => ({
    level: band.level,
    // Reason: `.at()` rather than `[i]` so the type admits the out-of-range
    // case the readonly array signature otherwise hides.
    title: NEUTRAL_TITLES.at(i) ?? `Level ${i + 1}`,
    minXP: band.minXP,
    maxXP: band.maxXP,
    color: TIER_COLORS.at(i) ?? "text-gray-400",
    icon: TIER_ICONS.at(i) ?? "starBadge",
  }));
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
