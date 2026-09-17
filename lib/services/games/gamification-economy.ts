/**
 * Gamification economy — the rules engine behind badge quotas, XP income and
 * the level ladder (R103).
 *
 * The defect this exists to prevent: the ladder and the badge catalogue were
 * designed independently. `proposeNeutralLadder` grew a 1.35x curve ending at
 * 426,400 XP while the catalogue could only ever pay out a few thousand, so
 * Legend was unreachable by a factor of roughly a hundred. Nothing errored and
 * nothing logged — both halves were internally consistent and the two had
 * simply never been compared.
 *
 * The rule that follows, and the reason every consumer must come through here:
 * THE LADDER IS DERIVED FROM XP INCOME, NEVER CHOSEN BESIDE IT. A curve picked
 * by hand is a curve that is wrong the next time the catalogue changes size.
 *
 * Model-free and client-reachable (R58) — it must never import a Mongoose
 * model. Mirrored into apps/admin and pinned byte-identical by a test.
 */

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export const BADGE_RARITIES: readonly BadgeRarity[] = [
  "common",
  "rare",
  "epic",
  "legendary",
] as const;

export type RarityCount = Record<BadgeRarity, number>;

/** Platform default XP per rarity. The stored `badge_xp` config wins over this. */
export const DEFAULT_BADGE_XP: RarityCount = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
};

/**
 * Propose XP-per-rarity for a catalogue of `badgeCount` badges.
 *
 * Reason: leaving `DEFAULT_BADGE_XP` forever means the XP Values screen never
 * moves when the wizard runs, which reads as "the wizard does not calculate
 * XP" even when the ladder was derived correctly underneath. The ratios stay
 * the DEFAULT ones; only the scale moves with catalogue size so a 220-badge
 * system does not pay the same per-badge as a 50-badge one.
 *
 * Floor is the default table — never shrink below what a fresh install pays.
 */
export function proposeBadgeXp(badgeCount: number): RarityCount {
  const n = Math.max(1, Math.floor(Number(badgeCount) || 0) || 1);
  // Reason: one "unit" of the default table per ~50 badges. 220 → scale 4 →
  // 40 / 100 / 200 / 400, which is a visible change on the XP Values screen
  // and still keeps the ladder reachable under `LADDER_TOP_FRACTION`.
  const scale = Math.max(1, Math.round(n / 50));
  return {
    common: DEFAULT_BADGE_XP.common * scale,
    rare: DEFAULT_BADGE_XP.rare * scale,
    epic: DEFAULT_BADGE_XP.epic * scale,
    legendary: DEFAULT_BADGE_XP.legendary * scale,
  };
}

/**
 * Rarity pyramid. Deliberately not equal shares: a catalogue where a quarter of
 * everything is legendary devalues the word, and one with no legendaries has no
 * top end to chase.
 */
export const RARITY_MIX: RarityCount = {
  common: 0.4,
  rare: 0.3,
  epic: 0.2,
  legendary: 0.1,
};

/**
 * Share of the catalogue reserved for platform-wide badges (account, social,
 * progression). Fixed rather than per-game because these do not multiply when a
 * game is added — a second game does not double the number of ways to deposit.
 */
export const PLATFORM_SHARE = 0.16;

/** The wizard's default first-run catalogue size. Operator-settable. */
export const DEFAULT_TARGET_BADGE_TOTAL = 220;

/** Rungs on the ladder. Matches the twenty neutral titles. */
export const DEFAULT_LEVEL_COUNT = 20;

/**
 * Fraction of all earnable XP the top rung sits at.
 *
 * Reason: not 1.0. A player reaching Legend must not need every badge in the
 * catalogue, because some are mutually exclusive in practice (a games-only
 * player will never hold the trading set) and a ladder only the completionist
 * can finish is one nobody climbs. 0.55 means a player earning a little over
 * half the catalogue tops out.
 */
export const LADDER_TOP_FRACTION = 0.55;

export interface GameRef {
  /** Stored `gameKey` — `trading` or `provider:<providerKey>:<gameCode>`. */
  gameKey: string;
  /** Display name for generated copy. */
  name: string;
}

/** Stored `gameKey` for trading. Duplicated from the games layer on purpose:
 * this module is model-free and client-reachable (R58), so it must not import
 * a service. A test pins the two spellings together. */
export const TRADING_GAME_KEY = "trading";

/** The trading scope, as a game like any other. */
export const TRADING_GAME_REF: GameRef = {
  gameKey: TRADING_GAME_KEY,
  name: "Trading",
};

export interface QuotaOptions {
  /**
   * Whether trading gets a scope of its own. Default true.
   *
   * Reason: the catalogue reader every caller has to hand
   * (`loadCatalogueGameRefs`) returns **provider titles only** — trading is
   * appended to the AI prompt text separately — so a caller passing it
   * straight through plans zero trading badges while every test still passes
   * and every total still adds up. Guaranteeing it here means no caller can
   * forget; the flag exists so a games-only deployment can still say no,
   * explicitly, rather than by omission.
   */
  includeTrading?: boolean;
}

export interface ScopeQuota {
  /** `platform`, or a `gameKey`. */
  scope: string;
  label: string;
  counts: RarityCount;
  total: number;
}

export interface BadgeQuotaPlan {
  target: number;
  /** Sum of every scope's total. May differ from `target` by rounding. */
  planned: number;
  scopes: ScopeQuota[];
}

function emptyCounts(): RarityCount {
  return { common: 0, rare: 0, epic: 0, legendary: 0 };
}

/**
 * Read one rarity out of a `RarityCount`.
 *
 * Reason: an exhaustive switch rather than `counts[rarity]`. Indexing by a
 * variable is safe here — the key is a literal union — but the lint rule
 * cannot see types, so the alternative is silencing it at eleven call sites,
 * and a blanket disable would also cover a genuinely unsafe index added later.
 * The switch is provably total AND is a tripwire: add a fifth rarity and the
 * compiler names every place that has to learn about it, where a record index
 * would silently return `undefined`.
 */
export function rarityValue(counts: RarityCount, rarity: BadgeRarity): number {
  switch (rarity) {
    case "common":
      return counts.common;
    case "rare":
      return counts.rare;
    case "epic":
      return counts.epic;
    case "legendary":
      return counts.legendary;
  }
}

/** Add to one rarity of a `RarityCount`. See `rarityValue` for why. */
export function addRarity(
  counts: RarityCount,
  rarity: BadgeRarity,
  by: number,
): void {
  switch (rarity) {
    case "common":
      counts.common += by;
      break;
    case "rare":
      counts.rare += by;
      break;
    case "epic":
      counts.epic += by;
      break;
    case "legendary":
      counts.legendary += by;
      break;
  }
}

/**
 * Split a badge count across the rarity pyramid.
 *
 * Largest-remainder rather than plain rounding, so the parts always sum to the
 * whole. Plain `Math.round` on four fractions loses or gains a badge roughly
 * half the time, and a quota that does not add up makes every downstream
 * arithmetic check wrong by an amount nobody can explain.
 */
export function splitByRarity(total: number): RarityCount {
  const counts = emptyCounts();
  if (total <= 0) return counts;

  const exact = BADGE_RARITIES.map((r) => ({
    rarity: r,
    value: total * rarityValue(RARITY_MIX, r),
  }));
  let assigned = 0;
  for (const e of exact) {
    const floored = Math.floor(e.value);
    addRarity(counts, e.rarity, floored);
    assigned += floored;
  }

  const remainders = exact
    .map((e) => ({ rarity: e.rarity, frac: e.value - Math.floor(e.value) }))
    .sort((a, b) => b.frac - a.frac);

  let spare = total - assigned;
  let i = 0;
  while (spare > 0 && remainders.length > 0) {
    const pick = remainders.at(i % remainders.length);
    if (pick) addRarity(counts, pick.rarity, 1);
    spare -= 1;
    i += 1;
  }

  // Every scope must offer at least one entry rung, or a game appears in the
  // catalogue with nothing a new player can earn.
  if (total >= 1 && counts.common === 0) {
    const donor = BADGE_RARITIES.find(
      (r) => r !== "common" && rarityValue(counts, r) > 0,
    );
    if (donor) {
      addRarity(counts, donor, -1);
      counts.common += 1;
    }
  }

  return counts;
}

/**
 * Put trading at the head of the game list, deduped, unless asked not to.
 *
 * Deduped by `gameKey` rather than by prepending blindly: a caller that has
 * already added trading would otherwise get two trading scopes, which halves
 * every other game's share while the totals still add up correctly.
 */
export function normaliseQuotaGames(
  games: readonly GameRef[],
  includeTrading: boolean,
): GameRef[] {
  const seen = new Set<string>();
  const out: GameRef[] = [];

  if (includeTrading) {
    out.push(TRADING_GAME_REF);
    seen.add(TRADING_GAME_KEY);
  }

  for (const g of games) {
    const key = typeof g?.gameKey === "string" ? g.gameKey.trim() : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ gameKey: key, name: g.name || key });
  }

  return out;
}

/**
 * Plan how many badges each scope gets.
 *
 * Trading is a scope like any other game — that equality is the whole point of
 * R96b, and it is what stops the catalogue being trading-dominated the moment
 * a second game exists.
 */
export function planBadgeQuota(
  games: readonly GameRef[],
  target: number = DEFAULT_TARGET_BADGE_TOTAL,
  options: QuotaOptions = {},
): BadgeQuotaPlan {
  const safeTarget = Math.max(0, Math.floor(target));
  const scopes: ScopeQuota[] = [];
  const planFor = normaliseQuotaGames(games, options.includeTrading !== false);

  const platformTotal = Math.round(safeTarget * PLATFORM_SHARE);
  scopes.push({
    scope: "platform",
    label: "Platform",
    counts: splitByRarity(platformTotal),
    total: platformTotal,
  });

  const gameBudget = Math.max(0, safeTarget - platformTotal);
  const gameCount = planFor.length;
  if (gameCount > 0) {
    const per = Math.floor(gameBudget / gameCount);
    let spare = gameBudget - per * gameCount;
    for (const g of planFor) {
      const extra = spare > 0 ? 1 : 0;
      spare -= extra;
      const total = per + extra;
      scopes.push({
        scope: g.gameKey,
        label: g.name,
        counts: splitByRarity(total),
        total,
      });
    }
  }

  return {
    target: safeTarget,
    planned: scopes.reduce((sum, s) => sum + s.total, 0),
    scopes,
  };
}

/** Total XP a player could earn holding every badge in a plan. */
export function earnableXpFromQuota(
  plan: BadgeQuotaPlan,
  xpByRarity: RarityCount = DEFAULT_BADGE_XP,
): number {
  let total = 0;
  for (const scope of plan.scopes) {
    for (const rarity of BADGE_RARITIES) {
      total += rarityValue(scope.counts, rarity) * rarityValue(xpByRarity, rarity);
    }
  }
  return total;
}

/** Total XP from an actual stored catalogue rather than a plan. */
export function earnableXpFromBadges(
  badges: ReadonlyArray<{ rarity?: string | null }>,
  xpByRarity: RarityCount = DEFAULT_BADGE_XP,
): number {
  let total = 0;
  for (const b of badges) {
    const rarity = BADGE_RARITIES.find((r) => r === b.rarity);
    if (rarity) total += rarityValue(xpByRarity, rarity);
  }
  return total;
}

export interface LadderBand {
  level: number;
  minXP: number;
  /** Exclusive upper bound less one. The final rung is open-ended. */
  maxXP: number;
}

/**
 * Solve the geometric growth rate that lands the final rung on `topXp`.
 *
 * A geometric curve with first band `b` and growth `g` over `n` levels reaches
 * `b * (g^(n-1) - 1) / (g - 1)` at the start of the last rung. Rather than
 * solving that in closed form (and then rounding it into being wrong anyway),
 * bisect on `g` — it is monotonic in the total, converges in ~40 iterations and
 * is exact enough for values we then round to hundreds.
 */
function solveGrowth(levelCount: number, firstBand: number, topXp: number): number {
  const rungs = Math.max(1, levelCount - 1);
  if (rungs === 1) return 1;

  const totalAt = (g: number): number => {
    if (Math.abs(g - 1) < 1e-9) return firstBand * rungs;
    return (firstBand * (Math.pow(g, rungs) - 1)) / (g - 1);
  };

  let lo = 1.0;
  let hi = 3.0;
  if (totalAt(hi) < topXp) return hi;
  if (totalAt(lo) > topXp) return lo;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (totalAt(mid) < topXp) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Build XP bands whose last rung opens at roughly `LADDER_TOP_FRACTION` of the
 * XP the catalogue can actually pay.
 *
 * `earnableXp` of zero means the catalogue is empty — there is nothing to
 * derive from, so it falls back to a modest curve rather than producing a
 * ladder of zeroes, which would put every player at Legend on sign-up.
 */
export function deriveLadderBands(
  earnableXp: number,
  levelCount: number = DEFAULT_LEVEL_COUNT,
  topFraction: number = LADDER_TOP_FRACTION,
): LadderBand[] {
  const count = Math.max(1, Math.floor(levelCount));
  const usable = Number.isFinite(earnableXp) && earnableXp > 0 ? earnableXp : 4000;
  const topXp = Math.max(count * 50, usable * topFraction);

  // First band sized so the early rungs are a badge or two apart. A curve that
  // opens at a tenth of the top would need a legendary badge to leave level 1.
  const firstBand = Math.max(50, Math.round(topXp / (count * count * 0.55)));
  const growth = solveGrowth(count, firstBand, topXp);

  const bands: LadderBand[] = [];
  let cursor = 0;
  let band = firstBand;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const rounded = roundBand(band);
    bands.push({
      level: i + 1,
      minXP: cursor,
      maxXP: isLast ? Number.MAX_SAFE_INTEGER : cursor + rounded - 1,
    });
    cursor += rounded;
    band *= growth;
  }

  return bands;
}

/**
 * Round a band to something an operator editing the row is not fighting.
 * Scales the rounding unit with the magnitude, so 340 stays 340 while 18,732
 * becomes 19,000 rather than 18,700.
 */
function roundBand(value: number): number {
  const v = Math.max(50, value);
  if (v < 1000) return Math.max(50, Math.round(v / 50) * 50);
  if (v < 10000) return Math.round(v / 100) * 100;
  return Math.round(v / 500) * 500;
}

export interface EconomyAudit {
  badgeCount: number;
  earnableXp: number;
  topRungXp: number;
  /** Fraction of the catalogue a player must hold to reach the final rung. */
  requiredFraction: number;
  reachable: boolean;
  verdict: string;
}

/**
 * Report whether a stored ladder is reachable from a stored catalogue.
 *
 * Reports rather than rewrites, for the same reason `auditLadder` does: a
 * ladder an operator has tuned is theirs. What this adds is the comparison
 * nobody was making — the two halves were each audited alone.
 */
export function auditEconomy(
  badges: ReadonlyArray<{ rarity?: string | null }>,
  levels: ReadonlyArray<{ minXP?: number | null }>,
  xpByRarity: RarityCount = DEFAULT_BADGE_XP,
): EconomyAudit {
  const earnableXp = earnableXpFromBadges(badges, xpByRarity);
  const tops = levels
    .map((l) => (typeof l.minXP === "number" ? l.minXP : 0))
    .filter((n) => Number.isFinite(n));
  const topRungXp = tops.length > 0 ? Math.max(...tops) : 0;

  const requiredFraction = earnableXp > 0 ? topRungXp / earnableXp : Infinity;
  // Reason: above 1.0 the top rung cannot be reached even by a player holding
  // every badge in the catalogue, which is the R103 defect exactly.
  const reachable = earnableXp > 0 && requiredFraction <= 1;

  const parts: string[] = [
    `${badges.length} badges paying ${earnableXp.toLocaleString()} XP in total`,
    `top rung at ${topRungXp.toLocaleString()} XP`,
  ];
  if (!reachable) {
    parts.push(
      earnableXp === 0
        ? "no badge pays any XP, so no level above the first is reachable"
        : `UNREACHABLE — needs ${(requiredFraction * 100).toFixed(0)}% of every badge in the catalogue`,
    );
  } else {
    parts.push(`reachable at ${(requiredFraction * 100).toFixed(0)}% of the catalogue`);
  }

  return {
    badgeCount: badges.length,
    earnableXp,
    topRungXp,
    requiredFraction,
    reachable,
    verdict: parts.join("; "),
  };
}
