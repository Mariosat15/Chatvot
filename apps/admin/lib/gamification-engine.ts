/**
 * Local Gamification Evaluation & Auto-Fix Engine v2
 *
 * 100% local, instant, deterministic — NO AI calls, NO timeouts.
 * SMART: Detects flat distributions, clustered levels, missing progression.
 * CREATIVE: Distributes values across smooth curves, not just minimums.
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface BadgeData {
  id: string;
  name: string;
  category: string;
  rarity: string;
  minLevel: number;
  condition: {
    type: string;
    value?: number;
    comparison?: string;
    minTrades?: number;
    minCompletedCompetitions?: number;
    minValue?: number;
    maxValue?: number;
  };
  description?: string;
  icon?: string;
  isActive?: boolean;
}

export interface MilestoneData {
  id: string;
  mapId: string;
  name: string;
  nodeType: string;
  order: number;
  completeCondition: {
    type: string;
    value?: number | string;
    comparison?: string;
    minTrades?: number;
    minCompletedCompetitions?: number;
  };
  rewards: { xp: number; badgeId?: string };
  requiredBadgeIds?: string[];
}

export interface MapData {
  mapId: string;
  name: string;
  difficulty: number;
  sequenceOrder: number;
  totalMilestones: number;
}

export interface EvalIssue {
  severity: "critical" | "high" | "medium" | "low";
  area: string;
  description: string;
  recommendation: string;
  targetAgent: "badge_agent" | "milestone_agent" | "manual";
  autoFixable: boolean;
  fix?: {
    type: "update_badge" | "update_milestone";
    id: string;
    field: string;
    oldValue: any;
    newValue: any;
  };
}

export interface EvalResult {
  overallScore: number;
  scores: Record<string, number>;
  issues: EvalIssue[];
  strengths: string[];
  summary: string;
}

export interface FixResult {
  badgeFixes: Array<{ id: string; field: string; oldValue: any; newValue: any }>;
  milestoneFixes: Array<{ id: string; mapId: string; field: string; oldValue: any; newValue: any }>;
  totalFixes: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];

// Full ranges for distributing levels (not just minimums!)
const RARITY_LEVEL_RANGES: Record<string, [number, number]> = {
  common: [0, 2],
  rare: [2, 6],
  epic: [6, 13],
  legendary: [10, 18],
};

// Full ranges for distributing minTrades
const RARITY_TRADES_RANGES: Record<string, [number, number]> = {
  common: [3, 20],
  rare: [15, 80],
  epic: [50, 300],
  legendary: [200, 1500],
};

// Full ranges for distributing minCompletedCompetitions
const RARITY_COMPS_RANGES: Record<string, [number, number]> = {
  common: [1, 5],
  rare: [3, 12],
  epic: [8, 25],
  legendary: [15, 75],
};

const VALID_CATEGORIES = [
  "Competition", "Trading", "Profit", "Risk",
  "Speed", "Consistency", "Strategy", "Social", "Legendary",
];

const TRADE_CATEGORIES = ["Trading", "Profit", "Risk", "Speed", "Consistency", "Strategy"];
const COMP_CATEGORIES = ["Competition"];

// ─── Smart Distribution Helper ──────────────────────────────────────────────────

/**
 * Distributes N items across a range [min, max] with a smooth curve.
 * Returns an array of N values, sorted ascending.
 * Uses linear interpolation for even spread.
 */
function distributeValues(count: number, min: number, max: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round((min + max) / 2)];
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0 to 1
    const val = Math.round(min + t * (max - min));
    values.push(val);
  }
  return values;
}

/**
 * Checks if an array of numbers is "flat" — all same or nearly same value.
 * Returns the dominant value if flat, or null if varied.
 */
function detectFlatDistribution(values: number[]): { isFlat: boolean; dominant: number; uniqueCount: number } {
  if (values.length === 0) return { isFlat: true, dominant: 0, uniqueCount: 0 };
  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const unique = Object.keys(counts).length;
  const maxCount = Math.max(...Object.values(counts));
  const dominant = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  // Flat if > 80% of values are the same, or only 1-2 unique values with 5+ badges
  const isFlat = (maxCount / values.length > 0.8) || (unique <= 2 && values.length >= 5);
  return { isFlat, dominant, uniqueCount: unique };
}

// ─── Evaluation Engine ──────────────────────────────────────────────────────────

export function evaluateSystem(
  badges: BadgeData[],
  milestones: MilestoneData[],
  maps: MapData[],
): EvalResult {
  const issues: EvalIssue[] = [];
  const strengths: string[] = [];

  const progressionScore = scoreProgressionFlow(badges, issues, strengths);
  const difficultyScore = scoreDifficultyCurve(badges, issues, strengths);
  const zeroBaselineScore = scoreZeroBaseline(badges, issues, strengths);
  const levelGatingScore = scoreLevelGating(badges, issues, strengths);
  const categoryScore = scoreCategoryBalance(badges, issues, strengths);
  const xpScore = scoreXPEconomy(badges, milestones, issues, strengths);
  const connectionScore = scoreMilestoneBadgeConnection(badges, milestones, issues, strengths);
  const engagementScore = scoreEngagementHooks(badges, milestones, issues, strengths);
  const urgencyScore = scoreUrgency(badges, milestones, issues, strengths);
  const funScore = scoreFunFactor(badges, milestones, maps, issues, strengths);

  const scores: Record<string, number> = {
    progressionFlow: progressionScore,
    difficultyCurve: difficultyScore,
    zeroBaselineProtection: zeroBaselineScore,
    levelGating: levelGatingScore,
    categoryBalance: categoryScore,
    xpEconomy: xpScore,
    milestoneBadgeConnection: connectionScore,
    engagementHooks: engagementScore,
    urgency: urgencyScore,
    funFactor: funScore,
  };

  const overallScore = Math.round(
    (Object.values(scores).reduce((a, b) => a + b, 0) / 10) * 10
  ) / 10;

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  const summary = buildSummary(overallScore, badges.length, milestones.length, maps.length, issues);
  return { overallScore, scores, issues, strengths, summary };
}

// ─── Smart Auto-Fix Engine ──────────────────────────────────────────────────────

export function generateFixes(
  badges: BadgeData[],
  milestones: MilestoneData[],
): FixResult {
  const badgeFixes: FixResult["badgeFixes"] = [];
  const milestoneFixes: FixResult["milestoneFixes"] = [];
  const badgeIds = new Set(badges.map(b => b.id));

  // #region agent log
  console.log(`[GEN-FIX] Input: ${badges.length} badges, ${milestones.length} milestones`);
  if (badges.length > 0) {
    const sample = badges[0];
    console.log(`[GEN-FIX] Sample badge: id=${sample.id} rarity=${sample.rarity} cat=${sample.category} minLevel=${sample.minLevel} condType=${sample.condition?.type} minTrades=${sample.condition?.minTrades}`);
  }
  // #endregion

  // ══════════════════════════════════════════════════════════════════════════
  // SMART minLevel DISTRIBUTION
  // ══════════════════════════════════════════════════════════════════════════

  // Group badges by rarity
  const byRarity: Record<string, BadgeData[]> = {};
  for (const b of badges) {
    const r = b.rarity || "common";
    if (!byRarity[r]) byRarity[r] = [];
    byRarity[r].push(b);
  }

  // #region agent log
  console.log(`[GEN-FIX] byRarity: common=${byRarity.common?.length||0} rare=${byRarity.rare?.length||0} epic=${byRarity.epic?.length||0} legendary=${byRarity.legendary?.length||0}`);
  // #endregion

  for (const rarity of RARITY_ORDER) {
    const pool = byRarity[rarity] || [];
    if (pool.length === 0) continue;

    const range = RARITY_LEVEL_RANGES[rarity];
    if (!range) continue;

    const currentLevels = pool.map(b => b.minLevel || 0);
    const dist = detectFlatDistribution(currentLevels);

    // Fix if: flat distribution, or most badges below the range minimum
    const belowMin = pool.filter(b => (b.minLevel || 0) < range[0]).length;
    const needsFix = dist.isFlat || (belowMin > pool.length * 0.5);

    // #region agent log
    console.log(`[GEN-FIX] ${rarity}: pool=${pool.length} range=[${range}] isFlat=${dist.isFlat} dominant=${dist.dominant} unique=${dist.uniqueCount} belowMin=${belowMin} needsFix=${needsFix}`);
    // #endregion

    if (needsFix && pool.length > 0) {
      const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name));
      const targetLevels = distributeValues(sorted.length, range[0], range[1]);

      // #region agent log
      let levelFixCount = 0;
      // #endregion
      for (let i = 0; i < sorted.length; i++) {
        const badge = sorted[i];
        const current = badge.minLevel || 0;
        const target = targetLevels[i];
        if (current !== target) {
          badgeFixes.push({
            id: badge.id,
            field: "minLevel",
            oldValue: current,
            newValue: target,
          });
          // #region agent log
          levelFixCount++;
          // #endregion
        }
      }
      // #region agent log
      console.log(`[GEN-FIX] ${rarity} minLevel fixes: ${levelFixCount} (targets sample: [${targetLevels.slice(0,5).join(",")}...])`);
      // #endregion
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SMART minTrades DISTRIBUTION
  // ══════════════════════════════════════════════════════════════════════════

  // #region agent log
  console.log(`[GEN-FIX] Badge fixes after minLevel phase: ${badgeFixes.length}`);
  // #endregion

  for (const rarity of RARITY_ORDER) {
    const pool = (byRarity[rarity] || []).filter(b =>
      TRADE_CATEGORIES.includes(b.category || "")
    );
    if (pool.length === 0) continue;

    const range = RARITY_TRADES_RANGES[rarity];
    if (!range) continue;

    const currentTrades = pool.map(b => b.condition?.minTrades || 0);
    const dist = detectFlatDistribution(currentTrades);
    const zeroCount = currentTrades.filter(v => v === 0).length;

    // #region agent log
    console.log(`[GEN-FIX] minTrades ${rarity}: tradePool=${pool.length} zeros=${zeroCount} isFlat=${dist.isFlat} needsFix=${dist.isFlat || zeroCount > pool.length * 0.5}`);
    // #endregion

    // Fix if: flat, mostly zero, or clustered
    if (dist.isFlat || zeroCount > pool.length * 0.5) {
      const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name));
      const targetTrades = distributeValues(sorted.length, range[0], range[1]);

      for (let i = 0; i < sorted.length; i++) {
        const badge = sorted[i];
        const current = badge.condition?.minTrades || 0;
        const target = targetTrades[i];
        if (current !== target) {
          badgeFixes.push({
            id: badge.id,
            field: "condition.minTrades",
            oldValue: current,
            newValue: target,
          });
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SMART minCompletedCompetitions DISTRIBUTION
  // Same approach for competition badges.
  // ══════════════════════════════════════════════════════════════════════════

  for (const rarity of RARITY_ORDER) {
    const pool = (byRarity[rarity] || []).filter(b =>
      COMP_CATEGORIES.includes(b.category || "")
    );
    if (pool.length === 0) continue;

    const range = RARITY_COMPS_RANGES[rarity];
    if (!range) continue;

    const currentComps = pool.map(b => b.condition?.minCompletedCompetitions || 0);
    const dist = detectFlatDistribution(currentComps);
    const zeroCount = currentComps.filter(v => v === 0).length;

    if (dist.isFlat || zeroCount > pool.length * 0.5) {
      const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name));
      const targetComps = distributeValues(sorted.length, range[0], range[1]);

      for (let i = 0; i < sorted.length; i++) {
        const badge = sorted[i];
        const current = badge.condition?.minCompletedCompetitions || 0;
        const target = targetComps[i];
        if (current !== target) {
          badgeFixes.push({
            id: badge.id,
            field: "condition.minCompletedCompetitions",
            oldValue: current,
            newValue: target,
          });
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FIX: Invalid milestone badge references
  // ══════════════════════════════════════════════════════════════════════════

  for (const ms of milestones) {
    if (ms.requiredBadgeIds && ms.requiredBadgeIds.length > 0) {
      const invalid = ms.requiredBadgeIds.filter(bid => !badgeIds.has(bid));
      if (invalid.length > 0) {
        const validOnly = ms.requiredBadgeIds.filter(bid => badgeIds.has(bid));
        milestoneFixes.push({
          id: ms.id,
          mapId: ms.mapId,
          field: "requiredBadgeIds",
          oldValue: ms.requiredBadgeIds,
          newValue: validOnly,
        });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SMART: Add badge gates to milestone checkpoints
  // Strategy: every ~4 milestones per map, add a gate using a badge that
  // gets progressively harder (common → rare → epic → legendary).
  // Uses different badges per gate for variety.
  // ══════════════════════════════════════════════════════════════════════════

  const gatedCount = milestones.filter(ms =>
    ms.requiredBadgeIds && ms.requiredBadgeIds.length > 0
  ).length;
  const gateRatio = milestones.length > 0 ? gatedCount / milestones.length : 1;

  if (gateRatio < 0.15 && badges.length > 0) {
    // Build badge pools by rarity, shuffle for variety
    const badgesByRarity: Record<string, BadgeData[]> = {
      common: [], rare: [], epic: [], legendary: [],
    };
    for (const b of badges) {
      const r = b.rarity || "common";
      if (badgesByRarity[r]) badgesByRarity[r].push(b);
    }
    // Sort each pool by minLevel for progression
    for (const pool of Object.values(badgesByRarity)) {
      pool.sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0));
    }

    // Group milestones by map
    const byMap: Record<string, MilestoneData[]> = {};
    for (const ms of milestones) {
      if (!byMap[ms.mapId]) byMap[ms.mapId] = [];
      byMap[ms.mapId].push(ms);
    }

    const GATE_INTERVAL = 4;
    const rarityProgression = ["common", "common", "rare", "rare", "epic", "epic", "legendary"];

    for (const [_mapId, mapMilestones] of Object.entries(byMap)) {
      const sorted = [...mapMilestones].sort((a, b) => a.order - b.order);
      let poolIdx = 0;

      for (let i = GATE_INTERVAL - 1; i < sorted.length; i += GATE_INTERVAL) {
        const ms = sorted[i];
        if (ms.requiredBadgeIds && ms.requiredBadgeIds.length > 0) continue;

        const tierIdx = Math.min(
          Math.floor(i / GATE_INTERVAL),
          rarityProgression.length - 1,
        );
        const rarity = rarityProgression[tierIdx];
        const pool = badgesByRarity[rarity]?.length > 0
          ? badgesByRarity[rarity]
          : badgesByRarity.common;

        if (pool.length === 0) continue;

        const badge = pool[poolIdx % pool.length];
        poolIdx++;

        milestoneFixes.push({
          id: ms.id,
          mapId: ms.mapId,
          field: "requiredBadgeIds",
          oldValue: ms.requiredBadgeIds || [],
          newValue: [badge.id],
        });
      }
    }
  }

  // #region agent log
  console.log(`[GEN-FIX] FINAL: ${badgeFixes.length} badge fixes, ${milestoneFixes.length} milestone fixes`);
  if (badgeFixes.length > 0) {
    console.log(`[GEN-FIX] Sample badge fix: ${JSON.stringify(badgeFixes[0])}`);
  }
  // #endregion

  return {
    badgeFixes,
    milestoneFixes,
    totalFixes: badgeFixes.length + milestoneFixes.length,
  };
}

// ─── Scoring Functions ──────────────────────────────────────────────────────────

function scoreProgressionFlow(badges: BadgeData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 10;
  const byRarity: Record<string, number[]> = { common: [], rare: [], epic: [], legendary: [] };

  for (const b of badges) {
    const r = b.rarity || "common";
    if (byRarity[r]) byRarity[r].push(b.minLevel || 0);
  }

  // Check: average minLevel should increase with rarity
  const avgLevels = Object.entries(byRarity).map(([r, levels]) => ({
    rarity: r,
    avg: levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 0,
    count: levels.length,
  }));

  for (let i = 1; i < RARITY_ORDER.length; i++) {
    const prev = avgLevels.find(a => a.rarity === RARITY_ORDER[i - 1]);
    const curr = avgLevels.find(a => a.rarity === RARITY_ORDER[i]);
    if (prev && curr && curr.count > 0 && prev.count > 0 && curr.avg <= prev.avg) {
      score -= 2;
      issues.push({
        severity: "high",
        area: "progression",
        description: `${curr.rarity} badges (avg level ${curr.avg.toFixed(1)}) don't require higher level than ${prev.rarity} (avg ${prev.avg.toFixed(1)})`,
        recommendation: `Auto-fix distributes minLevel across the full range for each rarity tier`,
        targetAgent: "badge_agent",
        autoFixable: true,
      });
    }
  }

  // NEW: Check for flat distribution across ALL badges
  const allLevels = badges.map(b => b.minLevel || 0);
  const allDist = detectFlatDistribution(allLevels);
  if (allDist.isFlat && badges.length > 10) {
    score -= 3;
    issues.push({
      severity: "critical",
      area: "progression",
      description: `${allDist.uniqueCount === 1 ? "ALL" : "Almost all"} badges have minLevel=${allDist.dominant} — no progression curve exists`,
      recommendation: "Auto-fix will distribute minLevel across 0-18 based on rarity (common:0-2, rare:2-6, epic:6-13, legendary:10-18)",
      targetAgent: "badge_agent",
      autoFixable: true,
    });
  }

  if (score >= 8) strengths.push("Good progression flow: minLevel increases with rarity tiers");
  return Math.max(1, Math.min(10, score));
}

function scoreDifficultyCurve(badges: BadgeData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 10;
  const byRarity: Record<string, number[]> = { common: [], rare: [], epic: [], legendary: [] };

  for (const b of badges) {
    const r = b.rarity || "common";
    const val = b.condition?.value || 0;
    if (byRarity[r]) byRarity[r].push(val);
  }

  const avgValues = RARITY_ORDER.map(r => ({
    rarity: r,
    avg: byRarity[r].length > 0 ? byRarity[r].reduce((a, b) => a + b, 0) / byRarity[r].length : 0,
  }));

  for (let i = 1; i < avgValues.length; i++) {
    if (avgValues[i].avg > 0 && avgValues[i - 1].avg > 0 && avgValues[i].avg <= avgValues[i - 1].avg) {
      score -= 1.5;
      issues.push({
        severity: "medium",
        area: "difficulty",
        description: `${avgValues[i].rarity} badges (avg condition value ${avgValues[i].avg.toFixed(0)}) aren't harder than ${avgValues[i - 1].rarity} (avg ${avgValues[i - 1].avg.toFixed(0)})`,
        recommendation: `Increase condition values for ${avgValues[i].rarity} badges`,
        targetAgent: "badge_agent",
        autoFixable: false,
      });
    }
  }

  if (score >= 8) strengths.push("Good difficulty curve: condition values scale with rarity");
  return Math.max(1, Math.min(10, score));
}

function scoreZeroBaseline(badges: BadgeData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 10;
  let tradeZeros = 0;
  let compZeros = 0;

  for (const b of badges) {
    if (b.rarity === "common") continue;
    const cat = b.category || "";

    if (TRADE_CATEGORIES.includes(cat) && (b.condition?.minTrades || 0) === 0) {
      tradeZeros++;
    }
    if (COMP_CATEGORIES.includes(cat) && (b.condition?.minCompletedCompetitions || 0) === 0) {
      compZeros++;
    }
  }

  const totalZeros = tradeZeros + compZeros;

  // Report as bulk issue instead of per-badge spam
  if (tradeZeros > 0) {
    issues.push({
      severity: "critical",
      area: "zero-baseline",
      description: `${tradeZeros} non-common trade/profit/risk/etc. badges have minTrades=0 — earnable without trading`,
      recommendation: `Auto-fix distributes minTrades across each rarity tier (common:3-20, rare:15-80, epic:50-300, legendary:200-1500)`,
      targetAgent: "badge_agent",
      autoFixable: true,
    });
  }
  if (compZeros > 0) {
    issues.push({
      severity: "critical",
      area: "zero-baseline",
      description: `${compZeros} non-common competition badges have minCompletedCompetitions=0 — earnable without competing`,
      recommendation: `Auto-fix distributes minCompletedCompetitions across each rarity tier (common:1-5, rare:3-12, epic:8-25, legendary:15-75)`,
      targetAgent: "badge_agent",
      autoFixable: true,
    });
  }

  const nonCommon = badges.filter(b => b.rarity !== "common").length;
  const ratio = nonCommon > 0 ? totalZeros / nonCommon : 0;
  score = Math.round(10 * (1 - ratio));

  if (totalZeros === 0) strengths.push("Excellent zero-baseline protection: all non-common badges require activity");
  return Math.max(1, Math.min(10, score));
}

function scoreLevelGating(badges: BadgeData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 10;

  // Group by rarity and check distribution quality
  const byRarity: Record<string, { below: number; above: number; inRange: number; flat: boolean; total: number }> = {};

  for (const rarity of RARITY_ORDER) {
    const pool = badges.filter(b => (b.rarity || "common") === rarity);
    if (pool.length === 0) continue;

    const range = RARITY_LEVEL_RANGES[rarity];
    if (!range) continue;

    const levels = pool.map(b => b.minLevel || 0);
    const dist = detectFlatDistribution(levels);

    let below = 0, above = 0, inRange = 0;
    for (const ml of levels) {
      if (ml < range[0]) below++;
      else if (ml > range[1]) above++;
      else inRange++;
    }

    byRarity[rarity] = { below, above, inRange, flat: dist.isFlat, total: pool.length };
  }

  // Score based on issues found
  for (const [rarity, stats] of Object.entries(byRarity)) {
    if (rarity === "common") continue; // common is fine at 0

    if (stats.flat && stats.total >= 3) {
      score -= 2;
      issues.push({
        severity: "high",
        area: "level-gating",
        description: `All ${stats.total} ${rarity} badges have the same/similar minLevel — no variety within the tier`,
        recommendation: `Auto-fix distributes across ${RARITY_LEVEL_RANGES[rarity]?.[0]}-${RARITY_LEVEL_RANGES[rarity]?.[1]}`,
        targetAgent: "badge_agent",
        autoFixable: true,
      });
    }

    if (stats.below > stats.total * 0.5) {
      score -= 1.5;
      issues.push({
        severity: "high",
        area: "level-gating",
        description: `${stats.below}/${stats.total} ${rarity} badges have minLevel below the expected range (${RARITY_LEVEL_RANGES[rarity]?.[0]}-${RARITY_LEVEL_RANGES[rarity]?.[1]})`,
        recommendation: `Auto-fix will distribute minLevel for ${rarity} badges across the full range`,
        targetAgent: "badge_agent",
        autoFixable: true,
      });
    }
  }

  // Check if ALL non-common badges have minLevel=0
  const nonCommonLevels = badges.filter(b => b.rarity !== "common").map(b => b.minLevel || 0);
  const allZero = nonCommonLevels.length > 0 && nonCommonLevels.every(l => l === 0);
  if (allZero) {
    score = 1; // Catastrophic
    issues.push({
      severity: "critical",
      area: "level-gating",
      description: `ALL ${nonCommonLevels.length} non-common badges have minLevel=0 — level gating does not exist`,
      recommendation: "Auto-fix creates full progression: rare(2-6), epic(6-13), legendary(10-18)",
      targetAgent: "badge_agent",
      autoFixable: true,
    });
  }

  if (score >= 8) {
    strengths.push("Well-distributed level gating across all rarity tiers");
  }
  return Math.max(1, Math.min(10, score));
}

function scoreCategoryBalance(badges: BadgeData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 10;
  const byCat: Record<string, Record<string, number>> = {};

  for (const b of badges) {
    const cat = b.category || "Unknown";
    const r = b.rarity || "common";
    if (!byCat[cat]) byCat[cat] = { common: 0, rare: 0, epic: 0, legendary: 0 };
    byCat[cat][r] = (byCat[cat][r] || 0) + 1;
  }

  const catCounts = Object.entries(byCat).map(([cat, rarities]) => ({
    cat,
    total: Object.values(rarities).reduce((a, b) => a + b, 0),
    ...rarities,
  }));

  const emptyCats = VALID_CATEGORIES.filter(c => !byCat[c] || Object.values(byCat[c]).reduce((a, b) => a + b, 0) === 0);
  if (emptyCats.length > 0) {
    score -= emptyCats.length;
    issues.push({
      severity: "medium",
      area: "category-balance",
      description: `Missing badges in categories: ${emptyCats.join(", ")}`,
      recommendation: "Generate badges for these categories using Badge Agent",
      targetAgent: "badge_agent",
      autoFixable: false,
    });
  }

  const noLegendary = catCounts.filter(c => (c.legendary || 0) === 0 && c.total > 3);
  if (noLegendary.length > 3) {
    score -= 1;
    issues.push({
      severity: "low",
      area: "category-balance",
      description: `${noLegendary.length} categories have no legendary badge`,
      recommendation: "Consider generating legendary badges for top categories",
      targetAgent: "badge_agent",
      autoFixable: false,
    });
  }

  if (catCounts.length > 0) {
    const avg = badges.length / catCounts.length;
    const overLoaded = catCounts.filter(c => c.total > avg * 2);
    const underLoaded = catCounts.filter(c => c.total < avg * 0.3 && c.total > 0);
    if (overLoaded.length > 0 || underLoaded.length > 0) {
      score -= 1;
    }
  }

  if (emptyCats.length === 0 && score >= 8) {
    strengths.push(`Good category coverage across ${catCounts.length} categories`);
  }
  return Math.max(1, Math.min(10, score));
}

function scoreXPEconomy(badges: BadgeData[], milestones: MilestoneData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 8;

  const xpValues = milestones.map(m => m.rewards?.xp || 0).filter(x => x > 0);
  if (xpValues.length > 0) {
    const avgXP = xpValues.reduce((a, b) => a + b, 0) / xpValues.length;
    if (avgXP < 5) {
      score -= 2;
      issues.push({
        severity: "medium",
        area: "xp-economy",
        description: `Average milestone XP reward is only ${avgXP.toFixed(0)} — too low to be meaningful`,
        recommendation: "Increase milestone XP rewards (easy:10-15, medium:20-30, hard:40-60)",
        targetAgent: "milestone_agent",
        autoFixable: false,
      });
    }
    if (avgXP > 100) {
      score -= 1;
      issues.push({
        severity: "low",
        area: "xp-economy",
        description: `Average milestone XP reward is ${avgXP.toFixed(0)} — may cause too-fast leveling`,
        recommendation: "Consider reducing milestone XP to maintain progression pacing",
        targetAgent: "milestone_agent",
        autoFixable: false,
      });
    }
  }

  if (score >= 7) strengths.push("XP economy appears balanced for the level curve");
  return Math.max(1, Math.min(10, score));
}

function scoreMilestoneBadgeConnection(
  badges: BadgeData[],
  milestones: MilestoneData[],
  issues: EvalIssue[],
  strengths: string[],
): number {
  let score = 10;
  const badgeIds = new Set(badges.map(b => b.id));
  let gatedCount = 0;
  let invalidRefs = 0;

  for (const ms of milestones) {
    if (ms.requiredBadgeIds && ms.requiredBadgeIds.length > 0) {
      gatedCount++;
      for (const bid of ms.requiredBadgeIds) {
        if (!badgeIds.has(bid)) {
          invalidRefs++;
          if (invalidRefs <= 3) {
            issues.push({
              severity: "high",
              area: "connections",
              description: `Milestone "${ms.name}" requires non-existent badge "${bid}"`,
              recommendation: "Auto-fix removes invalid badge references",
              targetAgent: "milestone_agent",
              autoFixable: true,
            });
          }
        }
      }
    }
  }

  if (invalidRefs > 3) {
    issues.push({
      severity: "high",
      area: "connections",
      description: `${invalidRefs} total invalid badge references in milestones`,
      recommendation: "Auto-fix removes all invalid badge references",
      targetAgent: "milestone_agent",
      autoFixable: true,
    });
  }

  if (invalidRefs > 0) score -= Math.min(4, invalidRefs);

  if (milestones.length > 10 && gatedCount < milestones.length * 0.15) {
    score -= 2;
    issues.push({
      severity: "medium",
      area: "connections",
      description: `Only ${gatedCount}/${milestones.length} milestones have badge gates (${(gatedCount / milestones.length * 100).toFixed(0)}%)`,
      recommendation: "Auto-fix adds badge gates every ~4 milestones per map with progressive difficulty",
      targetAgent: "milestone_agent",
      autoFixable: true,
    });
  }

  if (invalidRefs === 0 && gatedCount > 0) {
    strengths.push(`${gatedCount} milestones have valid badge gates connecting the two systems`);
  }
  return Math.max(1, Math.min(10, score));
}

function scoreEngagementHooks(badges: BadgeData[], milestones: MilestoneData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 7;

  const condTypes = new Set(badges.map(b => b.condition?.type).filter(Boolean));
  if (condTypes.size >= 8) {
    score += 2;
    strengths.push(`Good variety: ${condTypes.size} different badge condition types`);
  } else if (condTypes.size < 4) {
    score -= 2;
    issues.push({
      severity: "medium",
      area: "engagement",
      description: `Only ${condTypes.size} unique condition types — limited variety`,
      recommendation: "Add badges with diverse condition types (profit, speed, consistency, etc.)",
      targetAgent: "badge_agent",
      autoFixable: false,
    });
  }

  const easyBadges = badges.filter(b => b.rarity === "common").length;
  const hardBadges = badges.filter(b => b.rarity === "legendary").length;
  if (easyBadges > 0 && hardBadges > 0) score += 1;

  return Math.max(1, Math.min(10, score));
}

function scoreUrgency(badges: BadgeData[], milestones: MilestoneData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 5;

  const compBadges = badges.filter(b => b.category === "Competition");
  if (compBadges.length > 0) {
    score += Math.min(3, Math.floor(compBadges.length / 5));
    if (compBadges.length >= 5) {
      strengths.push(`${compBadges.length} competition badges create natural urgency through events`);
    }
  } else {
    issues.push({
      severity: "low",
      area: "urgency",
      description: "No competition badges — missing time-limited engagement driver",
      recommendation: "Add competition-related badges that create urgency",
      targetAgent: "badge_agent",
      autoFixable: false,
    });
  }

  return Math.max(1, Math.min(10, score));
}

function scoreFunFactor(
  badges: BadgeData[],
  milestones: MilestoneData[],
  maps: MapData[],
  issues: EvalIssue[],
  strengths: string[],
): number {
  let score = 6;

  const legendaryCount = badges.filter(b => b.rarity === "legendary").length;
  if (legendaryCount >= 5) {
    score += 2;
    strengths.push(`${legendaryCount} legendary badges provide aspirational long-term goals`);
  } else if (legendaryCount === 0) {
    score -= 2;
    issues.push({
      severity: "medium",
      area: "fun",
      description: "No legendary badges — missing aspirational end-game goals",
      recommendation: "Add legendary badges as ultimate achievements",
      targetAgent: "badge_agent",
      autoFixable: false,
    });
  }

  if (maps.length >= 5) {
    score += 1;
    strengths.push(`${maps.length} journey maps provide varied progression paths`);
  }

  if (badges.length >= 80) score += 1;
  if (badges.length >= 120) strengths.push(`${badges.length} badges create a rich collection to pursue`);

  return Math.max(1, Math.min(10, score));
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function buildSummary(
  score: number,
  badgeCount: number,
  milestoneCount: number,
  mapCount: number,
  issues: EvalIssue[],
): string {
  const critical = issues.filter(i => i.severity === "critical").length;
  const high = issues.filter(i => i.severity === "high").length;
  const fixable = issues.filter(i => i.autoFixable).length;

  let summary = `System has ${badgeCount} badges, ${milestoneCount} milestones across ${mapCount} maps. `;

  if (score >= 8) {
    summary += "The gamification system is well-designed with strong progression.";
  } else if (score >= 6) {
    summary += `Found ${issues.length} issues (${critical} critical, ${high} high). ${fixable} can be auto-fixed.`;
  } else {
    summary += `Significant issues found: ${critical} critical, ${high} high priority. Run auto-fix to address ${fixable} issues.`;
  }

  return summary;
}
