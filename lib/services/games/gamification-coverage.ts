/**
 * Per-game gamification coverage analysis (R96b orchestration).
 *
 * Answers two questions deterministically, with no AI and no database:
 *   1. Which games are missing badges / milestones, and how many of each rarity?
 *   2. Can a games-only player earn comparable XP to a trader?
 *
 * Reason: the wizard used to generate a caller-supplied `generateCount` and let
 * the model decide what to write. That is how a second run re-proposes badges
 * the catalogue already has, and how a newly added game gets nothing. Coverage
 * is computed here so generation is driven by a gap rather than by a number,
 * and so a later run only sees the gap that is actually left.
 *
 * Model-free and client-safe. Mirrored into apps/admin.
 */

import { TRADING_GAME_TYPE } from "@/lib/games/types";
import {
  badgeAppliesToPlayer,
  normalizeBadgeGameTypes,
  providerKeysFromGameTypes,
} from "@/lib/services/games/badge-game-scope";

export const BADGE_RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type BadgeRarity = (typeof BADGE_RARITIES)[number];

export type RarityCounts = Record<BadgeRarity, number>;

export interface CoverageGameRef {
  gameKey: string;
  displayName: string;
  category?: string;
}

export interface CoverageBadge {
  id: string;
  rarity?: string;
  category?: string;
  gameTypes?: string[] | null;
  condition?: { type?: string } | null;
}

export interface CoverageMilestone {
  id: string;
  mapId?: string;
  completeCondition?: { type?: string } | null;
  gameTypes?: string[] | null;
}

/**
 * How many badges each scope should carry. Deliberately modest: the target is
 * "a player of this game has a ladder to climb", not parity of badge count with
 * trading, which has years of authored content.
 */
export interface CoverageTarget {
  perGame: RarityCounts;
  platform: RarityCounts;
  /** Minimum game-scoped milestones per catalogue game. */
  milestonesPerGame: number;
}

export const DEFAULT_COVERAGE_TARGET: CoverageTarget = {
  perGame: { common: 3, rare: 2, epic: 2, legendary: 1 },
  platform: { common: 4, rare: 3, epic: 2, legendary: 1 },
  milestonesPerGame: 3,
};

function emptyCounts(): RarityCounts {
  return { common: 0, rare: 0, epic: 0, legendary: 0 };
}

function normaliseRarity(rarity: string | undefined): BadgeRarity {
  const r = (rarity || "").toLowerCase();
  return (BADGE_RARITIES as readonly string[]).includes(r)
    ? (r as BadgeRarity)
    : "common";
}

/*
 * Every rarity lookup in this module goes through these two helpers.
 *
 * Reason: `RarityCounts` is a closed `Record<BadgeRarity, number>` and the key
 * is always either a member of `BADGE_RARITIES` or the output of
 * `normaliseRarity`, which cannot return anything else — so the lookup can
 * never reach the prototype chain and a `Map` would buy nothing but a shape
 * change across the engine, the wizard and the UI that read these records.
 * Routing the access through two functions keeps that argument in one place
 * rather than repeating it at ten call sites.
 */
function readCount(counts: RarityCounts, rarity: BadgeRarity): number {
  // eslint-disable-next-line security/detect-object-injection
  return counts[rarity];
}

function addCount(counts: RarityCounts, rarity: BadgeRarity, by = 1): void {
  // eslint-disable-next-line security/detect-object-injection
  counts[rarity] += by;
}

function deficit(have: RarityCounts, want: RarityCounts): RarityCounts {
  const out = emptyCounts();
  for (const r of BADGE_RARITIES) {
    addCount(out, r, Math.max(0, readCount(want, r) - readCount(have, r)));
  }
  return out;
}

function sumCounts(counts: RarityCounts): number {
  return BADGE_RARITIES.reduce((acc, r) => acc + readCount(counts, r), 0);
}

// ─── Badge coverage ──────────────────────────────────────────────────────────

export interface BadgeCoverageRow {
  gameKey: string;
  displayName: string;
  /** Badges scoped to exactly this game (platform badges are not counted). */
  have: RarityCounts;
  missing: RarityCounts;
  total: number;
  missingTotal: number;
}

export interface BadgeCoverageReport {
  games: BadgeCoverageRow[];
  platform: { have: RarityCounts; missing: RarityCounts; missingTotal: number };
  trading: { have: RarityCounts; total: number };
  /** Games with nothing at all — the first-run / new-game case. */
  uncoveredGameKeys: string[];
  missingTotal: number;
}

/**
 * Count badges per game scope.
 *
 * A badge counts towards a game only when that game appears in its `gameTypes`.
 * Platform badges are counted separately rather than credited to every game:
 * crediting them would report a brand-new title as fully covered on the day it
 * is added, which is exactly the case the wizard exists to find.
 */
export function analyseBadgeCoverage(
  badges: readonly CoverageBadge[],
  games: readonly CoverageGameRef[],
  target: CoverageTarget = DEFAULT_COVERAGE_TARGET,
): BadgeCoverageReport {
  const perGame = new Map<string, RarityCounts>();
  for (const g of games) perGame.set(g.gameKey, emptyCounts());

  const platformHave = emptyCounts();
  const tradingHave = emptyCounts();

  for (const b of badges) {
    const rarity = normaliseRarity(b.rarity);
    const types = normalizeBadgeGameTypes(b.gameTypes);
    const providerKeys = providerKeysFromGameTypes(types);

    if (providerKeys.length > 0) {
      for (const key of providerKeys) {
        const row = perGame.get(key);
        // Reason: a badge scoped to a title that has left the catalogue still
        // exists and is still earned — it is simply not part of any gap.
        if (row) addCount(row, rarity);
      }
      if (types.includes(TRADING_GAME_TYPE)) addCount(tradingHave, rarity);
      continue;
    }

    if (types.length === 0) {
      addCount(platformHave, rarity);
      continue;
    }

    if (types.includes(TRADING_GAME_TYPE)) {
      addCount(tradingHave, rarity);
      const row = perGame.get(TRADING_GAME_TYPE);
      if (row) addCount(row, rarity);
    }
  }

  const rows: BadgeCoverageRow[] = games.map((g) => {
    const have = perGame.get(g.gameKey) ?? emptyCounts();
    const missing = deficit(have, target.perGame);
    return {
      gameKey: g.gameKey,
      displayName: g.displayName,
      have,
      missing,
      total: sumCounts(have),
      missingTotal: sumCounts(missing),
    };
  });

  const platformMissing = deficit(platformHave, target.platform);

  return {
    games: rows,
    platform: {
      have: platformHave,
      missing: platformMissing,
      missingTotal: sumCounts(platformMissing),
    },
    trading: { have: tradingHave, total: sumCounts(tradingHave) },
    uncoveredGameKeys: rows.filter((r) => r.total === 0).map((r) => r.gameKey),
    missingTotal:
      rows.reduce((acc, r) => acc + r.missingTotal, 0) + sumCounts(platformMissing),
  };
}

// ─── Milestone coverage ──────────────────────────────────────────────────────

export interface MilestoneCoverageRow {
  gameKey: string;
  displayName: string;
  have: number;
  missing: number;
}

export interface MilestoneCoverageReport {
  games: MilestoneCoverageRow[];
  missingTotal: number;
  uncoveredGameKeys: string[];
}

/**
 * Milestones carry no `gameTypes` on the schema today, so coverage is read from
 * the completion condition's scope: a `game_*` condition is per-game progress.
 * Reason: inferring from the condition means a milestone authored for a game is
 * counted without a mirrored schema change on a path nothing else reads yet.
 */
export function analyseMilestoneCoverage(
  milestones: readonly CoverageMilestone[],
  games: readonly CoverageGameRef[],
  target: CoverageTarget = DEFAULT_COVERAGE_TARGET,
): MilestoneCoverageReport {
  const perGame = new Map<string, number>();
  for (const g of games) perGame.set(g.gameKey, 0);

  for (const m of milestones) {
    const types = normalizeBadgeGameTypes(m.gameTypes);
    const keys = providerKeysFromGameTypes(types);
    const conditionType = m.completeCondition?.type || "";
    const isGameScoped = conditionType.startsWith("game_");

    if (keys.length > 0) {
      for (const key of keys) {
        if (perGame.has(key)) perGame.set(key, (perGame.get(key) ?? 0) + 1);
      }
      continue;
    }

    // A game-scoped condition with no explicit game list applies to every
    // catalogue game, so credit them all rather than none.
    if (isGameScoped) {
      for (const key of perGame.keys()) {
        if (key === TRADING_GAME_TYPE) continue;
        perGame.set(key, (perGame.get(key) ?? 0) + 1);
      }
    }
  }

  const rows: MilestoneCoverageRow[] = games
    .filter((g) => g.gameKey !== TRADING_GAME_TYPE)
    .map((g) => {
      const have = perGame.get(g.gameKey) ?? 0;
      return {
        gameKey: g.gameKey,
        displayName: g.displayName,
        have,
        missing: Math.max(0, target.milestonesPerGame - have),
      };
    });

  return {
    games: rows,
    missingTotal: rows.reduce((acc, r) => acc + r.missing, 0),
    uncoveredGameKeys: rows.filter((r) => r.have === 0).map((r) => r.gameKey),
  };
}

// ─── Games-only progression parity ───────────────────────────────────────────

export type BadgeXpByRarity = Record<BadgeRarity, number>;

export const DEFAULT_BADGE_XP: BadgeXpByRarity = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
};

export interface ParityReport {
  traderXp: number;
  gamesOnlyXp: number;
  /** gamesOnlyXp / traderXp, 1 = identical reach. */
  ratio: number;
  /** 0-10, fed into the evaluation score. */
  score: number;
  traderBadgeCount: number;
  gamesOnlyBadgeCount: number;
  verdict: string;
}

/**
 * Compare the XP a games-only player can reach with the XP a trader can reach.
 *
 * Reachability is decided by `badgeAppliesToPlayer`, the same function the
 * evaluator uses at runtime — a second copy of that rule here would let the
 * balance report disagree with what players actually see.
 */
export function analyseGamesOnlyParity(
  badges: readonly CoverageBadge[],
  games: readonly CoverageGameRef[],
  badgeXp: BadgeXpByRarity = DEFAULT_BADGE_XP,
): ParityReport {
  const allGameKeys = new Set(
    games.map((g) => g.gameKey).filter((k) => k !== TRADING_GAME_TYPE),
  );

  let traderXp = 0;
  let gamesOnlyXp = 0;
  let traderBadgeCount = 0;
  let gamesOnlyBadgeCount = 0;

  for (const b of badges) {
    const rarity = normaliseRarity(b.rarity);
    const xp = readCount(badgeXp, rarity) ?? 0;
    const conditionType = b.condition?.type || "";

    if (
      badgeAppliesToPlayer({
        gameTypes: b.gameTypes,
        conditionType,
        playedGameKeys: new Set<string>(),
        hasTradingActivity: true,
      })
    ) {
      traderXp += xp;
      traderBadgeCount += 1;
    }

    if (
      badgeAppliesToPlayer({
        gameTypes: b.gameTypes,
        conditionType,
        playedGameKeys: allGameKeys,
        hasTradingActivity: false,
      })
    ) {
      gamesOnlyXp += xp;
      gamesOnlyBadgeCount += 1;
    }
  }

  // Reason: with no badges at all there is nothing to be unbalanced about, so
  // report parity rather than a divide-by-zero that reads as a failure.
  const ratio = traderXp === 0 ? 1 : gamesOnlyXp / traderXp;
  const score = Math.max(0, Math.min(10, Math.round(ratio * 10 * 10) / 10));

  let verdict: string;
  if (ratio >= 0.8) {
    verdict = "A games-only player can reach comparable XP to a trader.";
  } else if (ratio >= 0.5) {
    verdict = `A games-only player can reach only ${Math.round(ratio * 100)}% of a trader's badge XP.`;
  } else {
    verdict = `A games-only player is locked out of ${Math.round((1 - ratio) * 100)}% of badge XP.`;
  }

  return {
    traderXp,
    gamesOnlyXp,
    ratio,
    score,
    traderBadgeCount,
    gamesOnlyBadgeCount,
    verdict,
  };
}
