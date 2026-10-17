/**
 * Global leaderboard scoring — the ONE definition of what contributes to a
 * player's global rank and by how much.
 *
 * Model-free and free of `"use server"` on purpose:
 *  - R58: this module is imported by client components (the rankings explainer
 *    and the table headers), so it must never reach a Mongoose model.
 *  - The weights, the labels and the arithmetic are read by the service, the
 *    API, the player explainer and the admin editor. Four copies of a ranking
 *    rule is the "one rule, two copies" shape this codebase keeps paying for.
 *
 * Two properties are load-bearing and are pinned by tests:
 *
 *  1. Every component is normalised to a 0-100 POSITION against the other
 *     players before it is weighted. Without that step a raw P&L in the
 *     thousands drowns a badge count of 4 and the published percentages are
 *     decoration rather than a description.
 *
 *  2. A component a player does not take part in is REDISTRIBUTED across the
 *     ones they do, never scored zero (owner decision, 16 Sep 2026). Scoring it
 *     zero means a games-only player can never reach #1 however well they play,
 *     which contradicts the platform's games-first direction.
 */

/** The seven things that decide a global rank. */
export type GlobalScoreComponentId =
  | "trading"
  | "games"
  | "competitions"
  | "challenges"
  | "level"
  | "badges"
  | "milestones";

export interface GlobalScoreComponent {
  id: GlobalScoreComponentId;
  /** Player-facing label. Must not name a single game (R29 / invariant 9). */
  label: string;
  /** One line a player can act on. */
  description: string;
  defaultWeight: number;
}

/**
 * Owner-approved defaults, 16 Sep 2026. An operator may change them under
 * Badges & XP; these are what ships and what a bad stored value falls back to.
 */
export const GLOBAL_SCORE_COMPONENTS: readonly GlobalScoreComponent[] = [
  {
    id: "trading",
    label: "Trading performance",
    description: "Your position on the Trading board.",
    defaultWeight: 25,
  },
  {
    id: "games",
    label: "Games performance",
    description: "Your position on the Games board, across every game you play.",
    defaultWeight: 25,
  },
  {
    id: "competitions",
    label: "Competitions won",
    description: "First places in finished competitions, in any game.",
    defaultWeight: 15,
  },
  {
    id: "challenges",
    label: "Challenges won",
    description: "One-against-one challenges you have won.",
    defaultWeight: 10,
  },
  {
    id: "level",
    label: "Level",
    description: "The level you have reached.",
    defaultWeight: 10,
  },
  {
    id: "badges",
    label: "Badges",
    description: "Badges you have earned.",
    defaultWeight: 8,
  },
  {
    id: "milestones",
    label: "Milestones",
    description: "Journey milestones you have completed.",
    defaultWeight: 7,
  },
] as const;

export const GLOBAL_SCORE_COMPONENT_IDS: readonly GlobalScoreComponentId[] =
  GLOBAL_SCORE_COMPONENTS.map((c) => c.id);

export type GlobalScoreWeights = Record<GlobalScoreComponentId, number>;

/** Weights as a Map — the safe shape when the key came from stored data. */
function weightsToMap(weights: GlobalScoreWeights): Map<GlobalScoreComponentId, number> {
  const map = new Map<GlobalScoreComponentId, number>();
  for (const component of GLOBAL_SCORE_COMPONENTS) {
    const raw = readWeight(weights, component.id);
    map.set(component.id, raw);
  }
  return map;
}

/**
 * Reason: the key is a member of a closed union but the object may have arrived
 * from `XPConfig.data` (Mixed), so it is read through an entry scan rather than
 * by indexing — which also keeps the object-injection lint rule quiet without a
 * blanket disable at the top of the file.
 */
function readWeight(
  source: Partial<Record<string, unknown>>,
  id: GlobalScoreComponentId,
): number {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (key !== id) continue;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
}

function mapToWeights(map: Map<GlobalScoreComponentId, number>): GlobalScoreWeights {
  const out = {} as GlobalScoreWeights;
  for (const component of GLOBAL_SCORE_COMPONENTS) {
    Object.defineProperty(out, component.id, {
      value: map.get(component.id) ?? 0,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

export const DEFAULT_GLOBAL_WEIGHTS: GlobalScoreWeights = mapToWeights(
  new Map(GLOBAL_SCORE_COMPONENTS.map((c) => [c.id, c.defaultWeight])),
);

export const GLOBAL_WEIGHT_TOTAL = 100;

/**
 * Accept an operator's numbers, or fall back to the defaults.
 *
 * A non-finite or negative entry reads as zero, and a set that sums to nothing
 * falls back to the defaults entirely — these arrive from `parseFloat` on an
 * admin form, and a `NaN` weight makes every derived score `NaN` while nothing
 * checks (R31's rule; `??` is the wrong repair for the same reason).
 *
 * The result always sums to 100, so the published percentages are the ones the
 * arithmetic actually uses.
 */
export function normaliseGlobalWeights(
  input: Partial<Record<string, unknown>> | null | undefined,
): GlobalScoreWeights {
  if (!input || typeof input !== "object") return { ...DEFAULT_GLOBAL_WEIGHTS };

  const raw = new Map<GlobalScoreComponentId, number>();
  let sum = 0;
  for (const component of GLOBAL_SCORE_COMPONENTS) {
    const value = readWeight(input, component.id);
    raw.set(component.id, value);
    sum += value;
  }

  if (sum <= 0) return { ...DEFAULT_GLOBAL_WEIGHTS };

  const scaled = new Map<GlobalScoreComponentId, number>();
  for (const [id, value] of raw) {
    scaled.set(id, (value / sum) * GLOBAL_WEIGHT_TOTAL);
  }
  return mapToWeights(scaled);
}

/**
 * Whole numbers for display. Sums to 100 by construction.
 *
 * Reason: it rescales BEFORE rounding. Without that step the drift correction
 * below silently absorbs any discrepancy, however large — a set summing to 115
 * would be published with the whole 15 subtracted from its biggest row, which
 * reads as a correct list of percentages and describes a split nobody chose.
 * A probe that moved a default from 25 to 40 stayed green on exactly that.
 */
export function weightsForDisplay(
  weights: GlobalScoreWeights,
): { id: GlobalScoreComponentId; label: string; description: string; percent: number }[] {
  const map = weightsToMap(normaliseGlobalWeights(weights));
  const rows = GLOBAL_SCORE_COMPONENTS.map((component) => ({
    id: component.id,
    label: component.label,
    description: component.description,
    percent: Math.round(map.get(component.id) ?? 0),
  }));

  // Reason: rounding seven values can lose or gain a point. Push the remainder
  // onto the largest row so the published list always adds up to 100 — a list
  // of percentages that sums to 99 reads as a bug in the ranking itself.
  const rounded = rows.reduce((acc, r) => acc + r.percent, 0);
  const drift = GLOBAL_WEIGHT_TOTAL - rounded;
  const largest = rows.reduce<(typeof rows)[number] | null>(
    (best, row) => (best === null || row.percent > best.percent ? row : best),
    null,
  );
  if (drift !== 0 && largest) largest.percent += drift;

  return rows;
}

/** One player's raw figures, before normalisation. */
export interface GlobalComponentValue {
  /** The raw number shown in the table. */
  value: number;
  /**
   * Whether the player takes part in this component at all.
   *
   * Deliberately NOT derived from `value`: zero wins and never having entered
   * are different facts, and only the second one may be redistributed away.
   */
  participates: boolean;
}

export interface GlobalScoreRow {
  userId: string;
  components: Map<GlobalScoreComponentId, GlobalComponentValue>;
}

export interface GlobalComponentBreakdown {
  id: GlobalScoreComponentId;
  label: string;
  value: number;
  participates: boolean;
  /** 0-100 position against the other players who take part. */
  position: number;
  /** Weight actually applied after redistribution, out of 100. */
  appliedWeight: number;
  /** `position * appliedWeight / 100` — adds up to the score. */
  contribution: number;
}

export interface GlobalScoredRow {
  userId: string;
  score: number;
  breakdown: GlobalComponentBreakdown[];
  /** False when the player takes part in nothing — such a row is unranked. */
  ranked: boolean;
}

/**
 * Position of every value in `values` on a 0-100 scale, by rank.
 *
 * Ties share the better position, exactly as the boards already do. The worst
 * participant lands on `100 / n` rather than 0, deliberately: a floor of zero
 * would make taking part and finishing last worse than never taking part,
 * which is the incentive the redistribution rule exists to avoid.
 */
export function positionsByRank(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];

  // Rank of a value = the position of its FIRST appearance in the descending
  // order, so equal values share the better rank.
  const rankOfValue = new Map<number, number>();
  [...values]
    .sort((a, b) => b - a)
    .forEach((value, index) => {
      if (!rankOfValue.has(value)) rankOfValue.set(value, index + 1);
    });

  return values.map((value) => {
    const rank = rankOfValue.get(value) ?? n;
    return ((n - rank + 1) / n) * 100;
  });
}

/**
 * Score every row against every other row.
 *
 * Each component is positioned among the players who take part in it, then the
 * weights of the components a player does not take part in are spread across
 * the ones they do. Returns rows in input order; the caller sorts and ranks.
 */
export function computeGlobalScores(
  rows: GlobalScoreRow[],
  weights: GlobalScoreWeights = DEFAULT_GLOBAL_WEIGHTS,
): GlobalScoredRow[] {
  const weightMap = weightsToMap(weights);

  // Positions are computed per component over its participants only.
  const positionByComponent = new Map<GlobalScoreComponentId, Map<string, number>>();
  for (const component of GLOBAL_SCORE_COMPONENTS) {
    const participants: { userId: string; value: number }[] = [];
    for (const row of rows) {
      const entry = row.components.get(component.id);
      if (entry?.participates) {
        participants.push({ userId: row.userId, value: entry.value });
      }
    }
    const positions = positionsByRank(participants.map((p) => p.value));
    const byUser = new Map<string, number>(
      participants.map((p, index) => [p.userId, positions.at(index) ?? 0]),
    );
    positionByComponent.set(component.id, byUser);
  }

  return rows.map((row) => {
    let participatingWeight = 0;
    for (const component of GLOBAL_SCORE_COMPONENTS) {
      if (row.components.get(component.id)?.participates) {
        participatingWeight += weightMap.get(component.id) ?? 0;
      }
    }

    const breakdown: GlobalComponentBreakdown[] = [];
    let score = 0;

    for (const component of GLOBAL_SCORE_COMPONENTS) {
      const entry = row.components.get(component.id);
      const participates = Boolean(entry?.participates);
      const declared = weightMap.get(component.id) ?? 0;
      const position = participates
        ? (positionByComponent.get(component.id)?.get(row.userId) ?? 0)
        : 0;
      // Redistribution: the declared weight is rescaled so the components the
      // player DOES take part in still add up to 100.
      const appliedWeight =
        participates && participatingWeight > 0
          ? (declared / participatingWeight) * GLOBAL_WEIGHT_TOTAL
          : 0;
      const contribution = (position * appliedWeight) / GLOBAL_WEIGHT_TOTAL;
      score += contribution;

      breakdown.push({
        id: component.id,
        label: component.label,
        value: entry?.value ?? 0,
        participates,
        position,
        appliedWeight,
        contribution,
      });
    }

    return {
      userId: row.userId,
      score,
      breakdown,
      ranked: participatingWeight > 0,
    };
  });
}

/** Build a row's component map without indexing an object by a dynamic key. */
export function buildComponentMap(
  entries: [GlobalScoreComponentId, GlobalComponentValue][],
): Map<GlobalScoreComponentId, GlobalComponentValue> {
  return new Map(entries);
}
