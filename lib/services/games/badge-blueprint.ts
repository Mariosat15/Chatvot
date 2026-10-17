/**
 * Deterministic badge blueprint (R103).
 *
 * The defect this replaces: the wizard asked a language model to emit the whole
 * catalogue in one reply capped at 6,000 tokens, against a coverage target of
 * eight badges per game. Five badges arrived, all trading, and nothing failed —
 * the model answered, the writer wrote, and the quota it had been given was the
 * ceiling all along.
 *
 * The rule: A CATALOGUE IS ARITHMETIC, NOT PROSE. How many badges, at what
 * thresholds, in which scope and at which rarity is derived here from the
 * registry and the quota. A model is useful for naming and flavour and is
 * incapable of holding two hundred thresholds in balance, so it is not asked
 * to. That also removes the token ceiling and the hallucinated condition types
 * in one move.
 *
 * Model-free and client-reachable (R58). Mirrored into apps/admin.
 */

import {
  BADGE_CONDITION_DEFS,
  type BadgeConditionDef,
} from "./badge-condition-registry";
import {
  BADGE_RARITIES,
  rarityValue,
  type BadgeQuotaPlan,
  type BadgeRarity,
  type RarityCount,
  type ScopeQuota,
} from "./gamification-economy";

export interface BlueprintBadge {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rarity: BadgeRarity;
  condition: {
    type: string;
    value?: number;
    comparison: "gte" | "lte" | "eq";
  };
  minLevel: number;
  gameTypes: string[];
  isActive: boolean;
}

/**
 * Threshold ladders by condition type: [base, growth].
 *
 * Keyed on the condition TYPE, which is the registry's own vocabulary — this is
 * not the game-type enumeration invariant 8 forbids. A new game needs no entry
 * here; a new condition type does, and falls back to a sane count ladder if it
 * is forgotten.
 */
const THRESHOLD_LADDERS = new Map<string, readonly [number, number]>([
  // Counts of contests / placements
  ["competitions_entered", [5, 2.2]],
  ["competitions_completed", [3, 2.4]],
  ["first_place_finishes", [1, 2.6]],
  ["podium_finishes", [3, 2.2]],
  ["second_place_finishes", [2, 2.4]],
  ["third_place_finishes", [2, 2.4]],
  ["top_10_finishes", [5, 2.2]],
  ["top_50_percent_finishes", [5, 2.2]],
  // Progression
  ["level_reached", [3, 1.6]],
  ["xp_threshold", [250, 2.6]],
  ["xp_earned_today", [50, 2.2]],
  ["xp_earned_this_week", [200, 2.2]],
  ["total_badges", [5, 2.0]],
  // Game (UserGameStats)
  ["game_contests_entered", [3, 2.3]],
  ["game_contests_completed", [3, 2.3]],
  ["game_wins", [1, 2.6]],
  ["game_podiums", [3, 2.2]],
  ["game_total_points", [500, 2.6]],
  ["game_season_points", [200, 2.4]],
  ["game_rating", [1100, 1.08]],
  ["game_best_score", [100, 2.2]],
  ["game_current_streak", [2, 1.8]],
  // Social / account
  ["referrals_made", [1, 2.6]],
  ["referrals_active", [1, 2.6]],
  ["friends_added", [3, 2.2]],
  ["login_streak", [3, 2.0]],
  ["messages_sent", [10, 2.6]],
  ["platform_age", [30, 2.0]],
  ["account_age", [30, 2.0]],
  ["account_age_days", [30, 2.0]],
  ["total_deposits", [100, 2.6]],
  ["total_deposited", [100, 2.6]],
  ["total_withdrawals", [100, 2.6]],
  ["large_withdrawal", [500, 2.2]],
  ["net_profit_lifetime", [100, 2.6]],
  // Trading counts
  ["total_trades", [10, 2.4]],
  ["winning_trades", [5, 2.4]],
  ["losing_trades", [5, 2.4]],
  ["trades_today", [5, 2.0]],
  ["trades_this_week", [20, 2.0]],
  ["trades_this_month", [50, 2.0]],
  ["consecutive_trading_days", [3, 2.0]],
  ["unique_pairs_traded", [3, 1.8]],
  ["different_assets_traded", [3, 1.8]],
  ["win_streak", [3, 1.8]],
  ["max_win_streak", [3, 1.8]],
  ["total_pnl", [100, 2.8]],
  ["profit_factor", [2, 1.5]],
  ["single_trade_profit", [50, 2.8]],
  ["best_trade_pnl", [100, 2.8]],
  ["average_trade_pnl", [10, 2.4]],
]);

/** Percentages are capped rather than compounded past the possible. */
export const PERCENTAGE_TYPES = new Set([
  "win_rate",
  "average_roi",
  "max_drawdown",
  "perfect_competition_win_rate",
]);

/** Lower is better — the comparison flips and the ladder descends. */
export const DESCENDING_TYPES = new Set(["game_best_rank", "max_drawdown"]);

/** Conditions with no threshold at all: one badge each, never tiered. */
export function isBooleanCondition(def: BadgeConditionDef): boolean {
  return (
    !THRESHOLD_LADDERS.has(def.type) &&
    !PERCENTAGE_TYPES.has(def.type) &&
    !DESCENDING_TYPES.has(def.type)
  );
}

export function thresholdFor(type: string, tier: number): number | undefined {
  if (DESCENDING_TYPES.has(type)) {
    if (type === "game_best_rank") {
      const ladder = [10, 5, 3, 2, 1];
      return ladder.at(Math.min(tier, ladder.length - 1));
    }
    const ladder = [30, 20, 15, 10, 5];
    return ladder.at(Math.min(tier, ladder.length - 1));
  }
  if (PERCENTAGE_TYPES.has(type)) {
    const ladder = [40, 50, 60, 70, 80, 90];
    return ladder.at(Math.min(tier, ladder.length - 1));
  }
  const entry = THRESHOLD_LADDERS.get(type);
  if (!entry) return undefined;
  const [base, growth] = entry;
  const raw = base * Math.pow(growth, tier);
  return roundThreshold(raw);
}

function roundThreshold(value: number): number {
  if (value < 10) return Math.max(1, Math.round(value));
  if (value < 100) return Math.round(value / 5) * 5;
  if (value < 1000) return Math.round(value / 25) * 25;
  if (value < 10000) return Math.round(value / 100) * 100;
  return Math.round(value / 1000) * 1000;
}

/**
 * Icons by condition group. Every name here is checked against `GAME_ICONS` by
 * a test — R103's sibling defect was a ladder shipping `medal1`, `diamond1` and
 * `flame1`, none of which exist, which the admin icon component renders as raw
 * text rather than falling back.
 */
const GROUP_ICONS = new Map<string, readonly string[]>([
  ["Account", ["shield1", "shieldAward", "shield2", "shield3"]],
  ["Social", ["heart", "starAward", "trophy1", "gems"]],
  ["Competition", ["trophy", "trophyStar", "goldMedal", "crown"]],
  ["Progression", ["starBadge", "star1", "star2", "star3"]],
  ["Games", ["trophyGame", "joystick1", "target", "gems"]],
  ["Trading", ["coin", "coins", "money", "dollarFinance1"]],
  ["Performance", ["energySpell", "fireSpell", "star2", "crown"]],
  ["Risk", ["shield2", "shield3", "shieldProto", "magicShield3D"]],
  ["Other", ["starBadge", "trophy", "crown", "gems"]],
]);

// Reason: a Map rather than a record, because the lookup key is a variable and
// an object index walks the prototype chain — the same reasoning as the round
// inspector's action map and `UNSCORED_CONTEST_POLICY_COPY`. `LAST_RESORT_ICON`
// exists because a Map read is legitimately partial where a record read is not.
const RARITY_FALLBACK_ICONS = new Map<BadgeRarity, string>([
  ["common", "starBadge"],
  ["rare", "shield1"],
  ["epic", "trophy"],
  ["legendary", "crown"],
]);

const LAST_RESORT_ICON = "starBadge";

function iconFor(def: BadgeConditionDef, rarity: BadgeRarity): string {
  const fallback = RARITY_FALLBACK_ICONS.get(rarity) ?? LAST_RESORT_ICON;
  const pool = GROUP_ICONS.get(def.group);
  if (!pool || pool.length === 0) return fallback;
  const index = BADGE_RARITIES.indexOf(rarity);
  return pool.at(Math.min(index, pool.length - 1)) ?? fallback;
}

/** Category for a condition, honouring the registry's scope rules. */
function categoryFor(def: BadgeConditionDef, isGameScope: boolean): string {
  if (def.scope === "game") return "Games";
  if (def.scope === "trading") {
    if (def.group === "Risk") return "Risk";
    if (def.group === "Performance") return "Profit";
    return "Trading";
  }
  if (def.group === "Social") return "Social";
  if (def.group === "Competition") return "Competition";
  if (def.group === "Progression") return "Competition";
  if (def.group === "Account") return isGameScope ? "Competition" : "Social";
  return "Competition";
}

const TIER_WORDS: readonly string[] = [
  "Initiate",
  "Apprentice",
  "Adept",
  "Specialist",
  "Veteran",
  "Master",
  "Grandmaster",
  "Legend",
] as const;

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/** Candidate before rarity is assigned — ordered by difficulty within a scope. */
interface Candidate {
  def: BadgeConditionDef;
  tier: number;
  value?: number;
}

/**
 * Which conditions a scope may use.
 *
 * A provider game takes the per-game stats plus the cross-game contest set; a
 * game badge must never be handed a trading condition, which is the R96a rule
 * one layer earlier. Platform takes the platform set.
 */
export function conditionsForScope(scope: string): BadgeConditionDef[] {
  if (scope === "platform") {
    // Reason: `manual` is an admin award with no earnable condition, and
    // `first_trade` is filed platform-scoped but is a trading act — leaving it
    // here puts a badge a games-only player can never hold in the bucket that
    // exists precisely because it is earnable by everyone.
    return BADGE_CONDITION_DEFS.filter(
      (d) => d.scope === "platform" && d.type !== "manual" && d.group !== "Trading",
    );
  }
  if (scope === "trading") {
    return BADGE_CONDITION_DEFS.filter(
      (d) =>
        d.scope === "trading" ||
        d.scope === "both" ||
        (d.scope === "platform" && d.group === "Trading"),
    );
  }
  // Reason: XP and levels are ONE platform ladder, so `level_reached`,
  // `xp_threshold` and `total_badges` measure a platform fact however the badge
  // is labelled. Generating them per game produces a card headed with a game's
  // name that is earned by doing something else entirely — the same misleading
  // shape as a game badge demanding trades. They are "both" in the registry
  // because the EVALUATOR accepts them either way; that is a question about
  // trade floors, not about what the number counts.
  return BADGE_CONDITION_DEFS.filter(
    (d) => (d.scope === "game" || d.scope === "both") && d.group !== "Progression",
  );
}

/**
 * Build candidates for one scope, deepest ladder first.
 *
 * Tiers are widened until the quota is met rather than fixed at four, because a
 * provider game has only sixteen legal condition types and a fixed four-tier
 * ladder caps it at sixty-four badges however large the target. Widening keeps
 * one arithmetic rule instead of a special case per scope.
 */
function candidatesForScope(scope: string, wanted: number): Candidate[] {
  const defs = conditionsForScope(scope);
  const booleans = defs.filter(isBooleanCondition);
  const countable = defs.filter((d) => !isBooleanCondition(d));

  const out: Candidate[] = [];
  for (const def of booleans) {
    out.push({ def, tier: 0 });
  }

  if (countable.length > 0) {
    const remaining = Math.max(0, wanted - out.length);
    const tiersPerType = Math.max(1, Math.ceil(remaining / countable.length));
    // Interleave tiers so taking a prefix of the list gives a spread of
    // conditions rather than eight rungs of one and nothing of the rest.
    for (let tier = 0; tier < tiersPerType; tier++) {
      for (const def of countable) {
        const value = thresholdFor(def.type, tier);
        if (value === undefined) continue;
        const previous = out.find((c) => c.def.type === def.type && c.value === value);
        // A ladder that has flattened (a capped percentage, a rank of 1) must
        // not emit the same badge twice under two ids.
        if (previous) continue;
        out.push({ def, tier, value });
      }
    }
  }

  return out;
}

function describe(def: BadgeConditionDef, value: number | undefined, gameName: string | null): string {
  const subject = gameName ? ` in ${gameName}` : "";
  if (value === undefined) return `${def.label}${subject}`;
  if (PERCENTAGE_TYPES.has(def.type)) return `Reach ${value}% ${def.label.toLowerCase()}${subject}`;
  if (DESCENDING_TYPES.has(def.type)) return `Finish at rank ${value} or better${subject}`;
  return `Reach ${value.toLocaleString()} ${def.label.toLowerCase()}${subject}`;
}

function nameFor(
  def: BadgeConditionDef,
  tier: number,
  gameName: string | null,
  tiered: boolean,
): string {
  const base = def.label.replace(/\s*\(.*\)\s*/g, "").replace(/^Game\s+/, "");
  const prefix = gameName ? `${gameName} ` : "";
  // Reason: a flag condition has exactly one badge, so a tier word on it is a
  // rank in a ladder of one — "Account Created Initiate" implies an Apprentice
  // rung that can never exist.
  const word = tiered ? ` ${TIER_WORDS.at(Math.min(tier, TIER_WORDS.length - 1)) ?? "Master"}` : "";
  return `${prefix}${base}${word}`.replace(/\s+/g, " ").trim();
}

/** Level gate rises with rarity so the catalogue is not all visible on day one. */
const RARITY_MIN_LEVEL: Record<BadgeRarity, number> = {
  common: 0,
  rare: 2,
  epic: 5,
  legendary: 9,
};

/**
 * Assign rarities so the scope's quota is met exactly.
 *
 * Candidates arrive ordered by difficulty, so slicing in quota order gives the
 * easy rungs to common and the deep ones to legendary without anything having
 * to judge difficulty a second time.
 */
function assignRarities(candidates: Candidate[], counts: RarityCount): Array<Candidate & { rarity: BadgeRarity }> {
  const out: Array<Candidate & { rarity: BadgeRarity }> = [];
  let cursor = 0;
  for (const rarity of BADGE_RARITIES) {
    const take = rarityValue(counts, rarity);
    for (let i = 0; i < take && cursor < candidates.length; i++) {
      const c = candidates.at(cursor);
      cursor += 1;
      if (c) out.push({ ...c, rarity });
    }
  }
  return out;
}

export interface BlueprintResult {
  badges: BlueprintBadge[];
  /** Scopes whose quota could not be filled from the legal condition set. */
  shortfalls: Array<{ scope: string; wanted: number; produced: number }>;
}

/**
 * Build the whole catalogue from a quota plan.
 *
 * `existingIds` is add-only protection: a run that already has a badge keeps
 * the operator's copy untouched and skips it, so a second run adds the new
 * game and nothing else. Same rule as the wizard's gap fill, enforced here so
 * every caller inherits it rather than remembering it.
 */
export function buildBadgeBlueprint(
  plan: BadgeQuotaPlan,
  existingIds: ReadonlySet<string> = new Set(),
): BlueprintResult {
  const badges: BlueprintBadge[] = [];
  const shortfalls: BlueprintResult["shortfalls"] = [];
  const usedIds = new Set(existingIds);

  for (const scope of plan.scopes) {
    const produced = buildScope(scope, usedIds);
    badges.push(...produced);
    if (produced.length < scope.total) {
      shortfalls.push({ scope: scope.scope, wanted: scope.total, produced: produced.length });
    }
  }

  return { badges, shortfalls };
}

/**
 * Reason: a game key is `provider:<provider>:<code>`, so the provider segment is
 * identical for every title one provider supplies. Truncating the slug to a fixed
 * head length made two titles share a prefix, every id of the second collided with
 * the first, and the whole scope produced ZERO badges — silently, because a
 * collision is skipped rather than reported. Drop the leading `provider:` and keep
 * the rest whole so the distinguishing part is always present.
 */
export function scopeIdPrefix(scope: string): string {
  if (scope === "platform") return "pf";
  return slug(scope.startsWith("provider:") ? scope.slice("provider:".length) : scope);
}

function buildScope(quota: ScopeQuota, usedIds: Set<string>): BlueprintBadge[] {
  if (quota.total <= 0) return [];

  const isGameScope = quota.scope !== "platform";
  // Reason: the quota's label IS the game's display name — `planBadgeQuota`
  // copies it off `GameRef.name`. Looking the game up again here was a second
  // source for one fact, and the first version read a field `GameRef` does not
  // have, so every game badge was named as though it were platform-wide.
  const gameName = isGameScope ? quota.label : null;
  const candidates = candidatesForScope(quota.scope, quota.total);
  const assigned = assignRarities(candidates, quota.counts);

  const scopePrefix = scopeIdPrefix(quota.scope);
  const out: BlueprintBadge[] = [];
  for (const c of assigned) {
    const valuePart = c.value === undefined ? "flag" : String(c.value);
    const id = `${scopePrefix}_${slug(c.def.type)}_${valuePart}`;
    if (usedIds.has(id)) continue;
    usedIds.add(id);

    out.push({
      id,
      name: nameFor(c.def, c.tier, gameName, c.value !== undefined),
      description: describe(c.def, c.value, gameName),
      category: categoryFor(c.def, isGameScope),
      icon: iconFor(c.def, c.rarity),
      rarity: c.rarity,
      condition: {
        type: c.def.type,
        ...(c.value === undefined ? {} : { value: c.value }),
        comparison: DESCENDING_TYPES.has(c.def.type) ? "lte" : c.value === undefined ? "eq" : "gte",
      },
      minLevel: RARITY_MIN_LEVEL[c.rarity],
      // Reason: an empty array reads as "every game" on the model, so a platform
      // badge must send `[]` rather than a list — and a game badge must carry its
      // own key, never `trading`, or the trade floors come back with it.
      gameTypes: quota.scope === "platform" ? [] : [quota.scope],
      isActive: true,
    });
  }

  return out;
}
