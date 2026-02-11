/**
 * Local Gamification Evaluation & Auto-Fix Engine
 *
 * 100% local, instant, deterministic — NO AI calls, NO timeouts.
 * Scores 10 criteria based on concrete rules and generates
 * specific, targeted fixes for each issue found.
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

const RARITY_MINLEVEL_RANGES: Record<string, [number, number]> = {
  common: [0, 1],
  rare: [2, 5],
  epic: [5, 12],
  legendary: [8, 18],
};

const RARITY_MINTRADES_RANGES: Record<string, [number, number]> = {
  common: [3, 25],
  rare: [15, 100],
  epic: [50, 500],
  legendary: [200, 2000],
};

const RARITY_MINCOMPS_RANGES: Record<string, [number, number]> = {
  common: [1, 5],
  rare: [3, 15],
  epic: [10, 30],
  legendary: [20, 100],
};

const VALID_CATEGORIES = [
  "Competition", "Trading", "Profit", "Risk",
  "Speed", "Consistency", "Strategy", "Social", "Legendary",
];

// Categories that should require minTrades
const TRADE_CATEGORIES = ["Trading", "Profit", "Risk", "Speed", "Consistency", "Strategy"];
// Categories that should require minCompletedCompetitions
const COMP_CATEGORIES = ["Competition"];

// ─── Evaluation Engine ──────────────────────────────────────────────────────────

export function evaluateSystem(
  badges: BadgeData[],
  milestones: MilestoneData[],
  maps: MapData[],
): EvalResult {
  const issues: EvalIssue[] = [];
  const strengths: string[] = [];

  // ── 1. Progression Flow ──
  const progressionScore = scoreProgressionFlow(badges, issues, strengths);

  // ── 2. Difficulty Curve ──
  const difficultyScore = scoreDifficultyCurve(badges, issues, strengths);

  // ── 3. Zero-Baseline Protection ──
  const zeroBaselineScore = scoreZeroBaseline(badges, issues, strengths);

  // ── 4. Level Gating ──
  const levelGatingScore = scoreLevelGating(badges, issues, strengths);

  // ── 5. Category Balance ──
  const categoryScore = scoreCategoryBalance(badges, issues, strengths);

  // ── 6. XP Economy ──
  const xpScore = scoreXPEconomy(badges, milestones, issues, strengths);

  // ── 7. Milestone-Badge Connection ──
  const connectionScore = scoreMilestoneBadgeConnection(badges, milestones, issues, strengths);

  // ── 8. Engagement Hooks ──
  const engagementScore = scoreEngagementHooks(badges, milestones, issues, strengths);

  // ── 9. Urgency ──
  const urgencyScore = scoreUrgency(badges, milestones, issues, strengths);

  // ── 10. Fun Factor ──
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

  // Sort issues by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const summary = buildSummary(overallScore, badges.length, milestones.length, maps.length, issues);

  return { overallScore, scores, issues, strengths, summary };
}

// ─── Auto-Fix Engine ────────────────────────────────────────────────────────────

export function generateFixes(
  badges: BadgeData[],
  milestones: MilestoneData[],
): FixResult {
  const badgeFixes: FixResult["badgeFixes"] = [];
  const milestoneFixes: FixResult["milestoneFixes"] = [];
  const badgeIds = new Set(badges.map(b => b.id));

  for (const badge of badges) {
    const rarity = badge.rarity || "common";
    const cat = badge.category || "";

    // Fix: Zero-baseline for trade categories
    if (TRADE_CATEGORIES.includes(cat) && rarity !== "common") {
      const mt = badge.condition?.minTrades || 0;
      const range = RARITY_MINTRADES_RANGES[rarity] || [5, 25];
      if (mt < range[0]) {
        badgeFixes.push({
          id: badge.id,
          field: "condition.minTrades",
          oldValue: mt,
          newValue: range[0],
        });
      }
    }

    // Fix: Zero-baseline for competition categories
    if (COMP_CATEGORIES.includes(cat) && rarity !== "common") {
      const mc = badge.condition?.minCompletedCompetitions || 0;
      const range = RARITY_MINCOMPS_RANGES[rarity] || [1, 5];
      if (mc < range[0]) {
        badgeFixes.push({
          id: badge.id,
          field: "condition.minCompletedCompetitions",
          oldValue: mc,
          newValue: range[0],
        });
      }
    }

    // Fix: Level gating
    const mlRange = RARITY_MINLEVEL_RANGES[rarity] || [0, 1];
    const ml = badge.minLevel || 0;
    if (rarity !== "common" && ml < mlRange[0]) {
      badgeFixes.push({
        id: badge.id,
        field: "minLevel",
        oldValue: ml,
        newValue: mlRange[0],
      });
    }
    if (ml > mlRange[1]) {
      badgeFixes.push({
        id: badge.id,
        field: "minLevel",
        oldValue: ml,
        newValue: mlRange[1],
      });
    }
  }

  // Fix milestones: invalid badge references
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

  // Fix milestones: add badge gates to strategic checkpoints
  // Strategy: every ~4 milestones in a map, add a badge gate using a
  // progressively harder badge (common → rare → epic → legendary)
  const gatedCount = milestones.filter(ms =>
    ms.requiredBadgeIds && ms.requiredBadgeIds.length > 0
  ).length;
  const gateRatio = milestones.length > 0 ? gatedCount / milestones.length : 1;

  if (gateRatio < 0.15 && badges.length > 0) {
    // Build badge pools by rarity (sorted by minLevel ascending)
    const badgesByRarity: Record<string, BadgeData[]> = {
      common: [], rare: [], epic: [], legendary: [],
    };
    for (const b of badges) {
      const r = b.rarity || "common";
      if (badgesByRarity[r]) badgesByRarity[r].push(b);
    }
    // Sort each pool by minLevel
    for (const pool of Object.values(badgesByRarity)) {
      pool.sort((a, b) => (a.minLevel || 0) - (b.minLevel || 0));
    }

    // Group milestones by map and sort by order
    const byMap: Record<string, MilestoneData[]> = {};
    for (const ms of milestones) {
      if (!byMap[ms.mapId]) byMap[ms.mapId] = [];
      byMap[ms.mapId].push(ms);
    }

    const GATE_INTERVAL = 4; // add a gate every 4 milestones
    const rarityProgression = ["common", "common", "rare", "rare", "epic", "epic", "legendary"];

    for (const [mapId, mapMilestones] of Object.entries(byMap)) {
      const sorted = [...mapMilestones].sort((a, b) => a.order - b.order);
      let badgePoolIdx = 0;

      for (let i = GATE_INTERVAL - 1; i < sorted.length; i += GATE_INTERVAL) {
        const ms = sorted[i];
        // Skip if already has a badge gate
        if (ms.requiredBadgeIds && ms.requiredBadgeIds.length > 0) continue;

        // Pick a badge from the appropriate rarity tier
        const tierIdx = Math.min(
          Math.floor(i / GATE_INTERVAL),
          rarityProgression.length - 1,
        );
        const rarity = rarityProgression[tierIdx];
        const pool = badgesByRarity[rarity] || badgesByRarity.common;

        if (pool.length === 0) continue;

        const badge = pool[badgePoolIdx % pool.length];
        badgePoolIdx++;

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
        recommendation: `Increase minLevel on ${curr.rarity} badges to create clear progression`,
        targetAgent: "badge_agent",
        autoFixable: true,
      });
    }
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

  // Check: condition values should increase with rarity
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
  let zeroCount = 0;

  for (const b of badges) {
    if (b.rarity === "common") continue;
    const mt = b.condition?.minTrades || 0;
    const mc = b.condition?.minCompletedCompetitions || 0;
    const cat = b.category || "";

    if (TRADE_CATEGORIES.includes(cat) && mt === 0) {
      zeroCount++;
      issues.push({
        severity: "critical",
        area: "zero-baseline",
        description: `${b.rarity} badge "${b.name}" (${b.id}) in ${cat} has minTrades=0 — earnable without trading`,
        recommendation: `Set minTrades >= ${RARITY_MINTRADES_RANGES[b.rarity]?.[0] || 5}`,
        targetAgent: "badge_agent",
        autoFixable: true,
        fix: {
          type: "update_badge",
          id: b.id,
          field: "condition.minTrades",
          oldValue: 0,
          newValue: RARITY_MINTRADES_RANGES[b.rarity]?.[0] || 5,
        },
      });
    }

    if (COMP_CATEGORIES.includes(cat) && mc === 0) {
      zeroCount++;
      issues.push({
        severity: "critical",
        area: "zero-baseline",
        description: `${b.rarity} badge "${b.name}" (${b.id}) in ${cat} has minCompletedCompetitions=0 — earnable without competing`,
        recommendation: `Set minCompletedCompetitions >= ${RARITY_MINCOMPS_RANGES[b.rarity]?.[0] || 1}`,
        targetAgent: "badge_agent",
        autoFixable: true,
        fix: {
          type: "update_badge",
          id: b.id,
          field: "condition.minCompletedCompetitions",
          oldValue: 0,
          newValue: RARITY_MINCOMPS_RANGES[b.rarity]?.[0] || 1,
        },
      });
    }
  }

  const nonCommon = badges.filter(b => b.rarity !== "common").length;
  const ratio = nonCommon > 0 ? zeroCount / nonCommon : 0;
  score = Math.round(10 * (1 - ratio));

  if (zeroCount === 0) strengths.push("Excellent zero-baseline protection: all non-common badges require activity");
  return Math.max(1, Math.min(10, score));
}

function scoreLevelGating(badges: BadgeData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 10;
  let ungatedNonCommon = 0;
  let overGated = 0;

  for (const b of badges) {
    const r = b.rarity || "common";
    if (r === "common") continue;
    const ml = b.minLevel || 0;
    const range = RARITY_MINLEVEL_RANGES[r];
    if (!range) continue;

    if (ml < range[0]) {
      ungatedNonCommon++;
      if (ungatedNonCommon <= 5) { // Only report first 5
        issues.push({
          severity: r === "legendary" ? "high" : "medium",
          area: "level-gating",
          description: `${r} badge "${b.name}" (${b.id}) has minLevel=${ml}, should be ${range[0]}-${range[1]}`,
          recommendation: `Set minLevel to at least ${range[0]}`,
          targetAgent: "badge_agent",
          autoFixable: true,
          fix: { type: "update_badge", id: b.id, field: "minLevel", oldValue: ml, newValue: range[0] },
        });
      }
    }
    if (ml > range[1]) {
      overGated++;
      issues.push({
        severity: "medium",
        area: "level-gating",
        description: `${r} badge "${b.name}" (${b.id}) has minLevel=${ml}, max for ${r} is ${range[1]}`,
        recommendation: `Reduce minLevel to ${range[1]}`,
        targetAgent: "badge_agent",
        autoFixable: true,
        fix: { type: "update_badge", id: b.id, field: "minLevel", oldValue: ml, newValue: range[1] },
      });
    }
  }

  if (ungatedNonCommon > 5) {
    issues.push({
      severity: "high",
      area: "level-gating",
      description: `${ungatedNonCommon} total non-common badges have insufficient minLevel`,
      recommendation: "Run Badge Agent auto-fix to set appropriate minLevels",
      targetAgent: "badge_agent",
      autoFixable: true,
    });
  }

  const nonCommon = badges.filter(b => b.rarity !== "common").length;
  const ungatedRatio = nonCommon > 0 ? ungatedNonCommon / nonCommon : 0;
  score -= Math.round(ungatedRatio * 6);
  score -= Math.min(2, overGated);

  if (ungatedNonCommon === 0 && overGated === 0) {
    strengths.push("Perfect level gating: all non-common badges have appropriate minLevel requirements");
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

  // Check for empty categories
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

  // Check for categories with no legendary
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

  // Check for heavily skewed categories
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
  let score = 8; // Start at 8 — XP is mostly config-based

  // Check: milestone XP rewards should be reasonable
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

  // Check badge count vs level count (rough check)
  const commonCount = badges.filter(b => b.rarity === "common").length;
  if (commonCount > 40) {
    score -= 1;
    issues.push({
      severity: "low",
      area: "xp-economy",
      description: `${commonCount} common badges — each gives 10 XP, total ${commonCount * 10} XP from common alone`,
      recommendation: "Monitor if players level up too quickly from common badges",
      targetAgent: "manual",
      autoFixable: false,
    });
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
          issues.push({
            severity: "high",
            area: "connections",
            description: `Milestone "${ms.name}" (${ms.id}) requires non-existent badge "${bid}"`,
            recommendation: "Remove invalid badge reference or create the missing badge",
            targetAgent: "milestone_agent",
            autoFixable: true,
            fix: { type: "update_milestone", id: ms.id, field: "requiredBadgeIds", oldValue: bid, newValue: null },
          });
        }
      }
    }
  }

  if (invalidRefs > 0) score -= Math.min(4, invalidRefs);

  // Check: enough milestones should have badge gates
  if (milestones.length > 10 && gatedCount < milestones.length * 0.15) {
    score -= 2;
    issues.push({
      severity: "medium",
      area: "connections",
      description: `Only ${gatedCount}/${milestones.length} milestones have badge gates (${(gatedCount / milestones.length * 100).toFixed(0)}%)`,
      recommendation: "Auto-fix will add badge gates every ~4 milestones per map, using progressively harder badges",
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

  // Check: variety of condition types
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

  // Check: mix of short-term and long-term goals
  const easyBadges = badges.filter(b => b.rarity === "common").length;
  const hardBadges = badges.filter(b => b.rarity === "legendary").length;
  if (easyBadges > 0 && hardBadges > 0) {
    score += 1;
  }

  return Math.max(1, Math.min(10, score));
}

function scoreUrgency(badges: BadgeData[], milestones: MilestoneData[], issues: EvalIssue[], strengths: string[]): number {
  let score = 5; // Start neutral — urgency depends on implementation

  // Check for competition-related badges (inherently time-limited)
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

  // Legendary badges are exciting goals
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

  // Multiple maps = variety
  if (maps.length >= 5) {
    score += 1;
    strengths.push(`${maps.length} journey maps provide varied progression paths`);
  }

  // Total badges — more = more to collect
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
