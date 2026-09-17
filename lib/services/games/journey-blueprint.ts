/**
 * Deterministic journey blueprint — a fixed sequence of thematic maps whose
 * milestones are dual-path: trading OR gaming.
 *
 * Reason: the previous version built **one map per catalogue scope**, so with
 * trading + one provider game the generator produced exactly two maps while
 * operators still expected the historic ~10-map sequence. Nothing failed; the
 * toast just said "2 maps". The schema also caps `sequenceOrder` at 10, which
 * is the hard ceiling this module honours.
 *
 * Dual-path is load-bearing for a mixed audience: a games-only player must be
 * able to finish every required node without placing a trade, and a trader
 * without entering a game contest. Each activity milestone therefore carries a
 * primary `completeCondition` (trading) and `orCompleteConditions` (gaming).
 * Evaluation is OR — see `checkMilestoneAnyCondition` in journey-progress.
 */

import {
  DEFAULT_BADGE_XP,
  deriveLadderBands,
  type BadgeQuotaPlan,
} from "./gamification-economy";
import {
  DEFAULT_MAP_COUNT,
  JOURNEY_MAP_SHELLS,
  MAX_JOURNEY_MAPS,
  type MapTheme,
} from "./journey-map-shells";

export type { MapTheme } from "./journey-map-shells";
export {
  DEFAULT_MAP_COUNT,
  JOURNEY_MAP_SHELLS,
  MAX_JOURNEY_MAPS,
} from "./journey-map-shells";

export interface BlueprintZone {
  id: string;
  name: string;
  description: string;
  order: number;
  position: { x: number; y: number };
  color: string;
  icon: string;
  isUnlockable: boolean;
}

export interface BlueprintCondition {
  type: string;
  value?: number;
  comparison: "gte" | "lte";
}

export interface BlueprintMilestone {
  id: string;
  mapId: string;
  name: string;
  description: string;
  shortDescription: string;
  zoneId: string;
  position: { x: number; y: number };
  nodeType: "start" | "milestone" | "checkpoint" | "legendary";
  icon: string;
  color: string;
  size: "small" | "medium" | "large";
  completeCondition: BlueprintCondition;
  /**
   * Alternate ways to finish the same node. Evaluation is OR against
   * `completeCondition`. Absent / empty means trading-only (or platform-only).
   */
  orCompleteConditions?: BlueprintCondition[];
  rewards: { xp: number };
  connectedTo: string[];
  connectedFrom: string[];
  isRequired: boolean;
  isAutoComplete: boolean;
  order: number;
  isActive: boolean;
  isSeasonal: boolean;
  requiredBadgeIds: string[];
  gameTypes?: string[];
}

export interface BlueprintMap {
  mapId: string;
  name: string;
  description: string;
  zones: BlueprintZone[];
  defaultStartNode: string;
  backgroundColor: string;
  isActive: boolean;
  sequenceOrder: number;
  previousMapId: string | null;
  nextMapId: string | null;
  theme: MapTheme;
  difficulty: number;
  estimatedXP: number;
  requiredLevelToStart: number;
  completionRequirement: number;
  totalMilestones: number;
  /** Cross-audience journey — never scoped to a single game. */
  gameKey: string | null;
}

export interface JourneyBlueprint {
  maps: BlueprintMap[];
  milestones: BlueprintMilestone[];
  totalXp: number;
}

const MILESTONE_XP_MULTIPLIER = 2;

const TIER_XP: readonly number[] = [
  DEFAULT_BADGE_XP.common * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.common * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.rare * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.rare * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.epic * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.epic * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.legendary * MILESTONE_XP_MULTIPLIER,
];

const ZONE_TEMPLATES: readonly {
  suffix: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}[] = [
  {
    suffix: "foundations",
    name: "Foundations",
    description: "First steps — nothing here needs experience.",
    color: "#22C55E",
    icon: "flag",
  },
  {
    suffix: "ascent",
    name: "Ascent",
    description: "Consistency and volume start to matter.",
    color: "#3B82F6",
    icon: "mountain",
  },
  {
    suffix: "summit",
    name: "Summit",
    description: "The long targets, for players who stay.",
    color: "#A855F7",
    icon: "crown",
  },
];

export const DEFAULT_MILESTONES_PER_MAP = 12;

const MAP_LAYOUT_WIDTH = 1200;
const MAP_LAYOUT_HEIGHT = 800;

const NODE_ICONS: readonly string[] = [
  "flag",
  "starBadge",
  "shield1",
  "target",
  "goldMedal",
  "trophy",
  "crown",
];

/**
 * Trading ↔ gaming equivalents. Thresholds scale by map index so later maps
 * are harder without hard-coding ten ladders.
 *
 * Reason: values are deliberately lower on the gaming side for early maps —
 * a contest is a heavier commitment than a single trade — then catch up.
 */
type DualStep = {
  key: string;
  label: string;
  tradingType: string;
  gamingType: string | null;
  /** Base value at map index 0; multiplied by growth^mapIndex. */
  base: number;
  growth: number;
  gamingBase?: number;
  gamingGrowth?: number;
};

const DUAL_STEPS: readonly DualStep[] = [
  { key: "activity", label: "Activity", tradingType: "total_trades", gamingType: "game_contests_completed", base: 3, growth: 1.55, gamingBase: 1, gamingGrowth: 1.45 },
  { key: "wins", label: "Wins", tradingType: "winning_trades", gamingType: "game_wins", base: 1, growth: 1.6, gamingBase: 1, gamingGrowth: 1.5 },
  { key: "volume", label: "Volume", tradingType: "total_trades", gamingType: "game_contests_entered", base: 8, growth: 1.5, gamingBase: 2, gamingGrowth: 1.45 },
  { key: "streak", label: "Streak", tradingType: "win_streak", gamingType: "game_current_streak", base: 2, growth: 1.35, gamingBase: 2, gamingGrowth: 1.3 },
  { key: "contests", label: "Contests", tradingType: "competitions_entered", gamingType: "game_contests_entered", base: 1, growth: 1.55, gamingBase: 1, gamingGrowth: 1.5 },
  { key: "finished", label: "Finishes", tradingType: "competitions_completed", gamingType: "game_contests_completed", base: 1, growth: 1.55, gamingBase: 1, gamingGrowth: 1.5 },
  { key: "podium", label: "Podiums", tradingType: "podium_finishes", gamingType: "game_podiums", base: 1, growth: 1.5, gamingBase: 1, gamingGrowth: 1.45 },
  { key: "first", label: "First Places", tradingType: "first_place_finishes", gamingType: "game_wins", base: 1, growth: 1.45, gamingBase: 2, gamingGrowth: 1.4 },
  { key: "points", label: "Scoreboard", tradingType: "total_pnl", gamingType: "game_total_points", base: 50, growth: 1.7, gamingBase: 200, gamingGrowth: 1.65 },
  { key: "season", label: "Season Points", tradingType: "competitions_completed", gamingType: "game_season_points", base: 2, growth: 1.5, gamingBase: 150, gamingGrowth: 1.55 },
  { key: "rating", label: "Rating", tradingType: "win_rate", gamingType: "game_rating", base: 45, growth: 1.08, gamingBase: 1220, gamingGrowth: 1.02 },
  { key: "bestscore", label: "Best Score", tradingType: "best_trade_pnl", gamingType: "game_best_score", base: 20, growth: 1.6, gamingBase: 100, gamingGrowth: 1.5 },
  { key: "depth", label: "Depth", tradingType: "total_trades", gamingType: "game_contests_completed", base: 15, growth: 1.45, gamingBase: 3, gamingGrowth: 1.4 },
  { key: "mastery", label: "Mastery", tradingType: "winning_trades", gamingType: "game_wins", base: 10, growth: 1.5, gamingBase: 3, gamingGrowth: 1.45 },
];

function scale(base: number, growth: number, mapIndex: number): number {
  return Math.max(1, Math.round(base * Math.pow(growth, mapIndex)));
}

function positionFor(index: number, perRow = 5): { x: number; y: number } {
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  const laidOut = row % 2 === 0 ? col : perRow - 1 - col;
  const marginX = 100;
  const marginY = 100;
  const usableW = MAP_LAYOUT_WIDTH - marginX * 2;
  const usableH = MAP_LAYOUT_HEIGHT - marginY * 2;
  const rowPitch = Math.min(160, Math.floor(usableH / 3));
  return {
    x: Math.round(marginX + laidOut * (usableW / Math.max(1, perRow - 1))),
    y: Math.round(marginY + row * rowPitch),
  };
}

function zonesFor(mapId: string): BlueprintZone[] {
  return ZONE_TEMPLATES.map((z, i) => ({
    id: `${mapId}_${z.suffix}`,
    name: z.name,
    description: z.description,
    order: i,
    position: { x: 15 + i * 35, y: 50 },
    color: z.color,
    icon: z.icon,
    isUnlockable: i > 0,
  }));
}

function nodeTypeFor(
  index: number,
  total: number,
): BlueprintMilestone["nodeType"] {
  if (index === 0) return "start";
  if (index === total - 1) return "legendary";
  return (index + 1) % 4 === 0 ? "checkpoint" : "milestone";
}

function sizeFor(
  nodeType: BlueprintMilestone["nodeType"],
): BlueprintMilestone["size"] {
  if (nodeType === "legendary") return "large";
  if (nodeType === "checkpoint" || nodeType === "start") return "medium";
  return "small";
}

function describeDual(
  label: string,
  trading: BlueprintCondition,
  gaming: BlueprintCondition | null,
): { name: string; description: string; shortDescription: string } {
  const tVal = trading.value ?? 0;
  const gVal = gaming?.value;
  if (!gaming) {
    return {
      name: label,
      description: `Reach ${tVal} ${trading.type.replace(/_/g, " ")}.`,
      shortDescription: `${tVal} ${label.toLowerCase()}`,
    };
  }
  return {
    name: label,
    description: `Traders: ${tVal} ${trading.type.replace(/_/g, " ")}. Gamers: ${gVal} ${gaming.type.replace(/_/g, " ")}. Either path completes this node.`,
    shortDescription: `${tVal} trades OR ${gVal} games`,
  };
}

function buildMilestonesForMap(
  mapId: string,
  mapIndex: number,
  perMap: number,
): BlueprintMilestone[] {
  const out: BlueprintMilestone[] = [];
  const total = Math.max(2, perMap);

  // Start node — always true for anyone who can open the map (gated by level).
  {
    const zone = ZONE_TEMPLATES[0];
    out.push({
      id: `${mapId}_start`,
      mapId,
      name: "Begin",
      description: "Enter this chapter of the journey.",
      shortDescription: "Start",
      zoneId: `${mapId}_${zone.suffix}`,
      position: positionFor(0),
      nodeType: "start",
      icon: "flag",
      color: zone.color,
      size: "large",
      completeCondition: { type: "account_created", comparison: "gte" },
      orCompleteConditions: [],
      rewards: { xp: TIER_XP[0] },
      connectedTo: [],
      connectedFrom: [],
      isRequired: true,
      isAutoComplete: true,
      order: 0,
      isActive: true,
      isSeasonal: false,
      requiredBadgeIds: [],
    });
  }

  const stepsNeeded = total - 1;
  for (let i = 0; i < stepsNeeded; i += 1) {
    const step = DUAL_STEPS[i % DUAL_STEPS.length];
    const tier = Math.min(
      TIER_XP.length - 1,
      Math.floor((i / Math.max(1, stepsNeeded - 1)) * (TIER_XP.length - 1)),
    );
    const tradingValue = scale(step.base, step.growth, mapIndex + Math.floor(i / DUAL_STEPS.length));
    const gamingValue = step.gamingType
      ? scale(
          step.gamingBase ?? Math.max(1, Math.ceil(step.base / 3)),
          step.gamingGrowth ?? step.growth,
          mapIndex + Math.floor(i / DUAL_STEPS.length),
        )
      : undefined;

    const trading: BlueprintCondition = {
      type: step.tradingType,
      value: tradingValue,
      comparison: "gte",
    };
    const gaming: BlueprintCondition | null = step.gamingType
      ? {
          type: step.gamingType,
          value: gamingValue,
          comparison: "gte",
        }
      : null;

    const copy = describeDual(step.label, trading, gaming);
    const index = out.length;
    const nodeType = nodeTypeFor(index, total);
    const zone = ZONE_TEMPLATES[
      Math.min(Math.floor((index / total) * ZONE_TEMPLATES.length), ZONE_TEMPLATES.length - 1)
    ];

    out.push({
      id: `${mapId}_${step.key}_${tradingValue}`,
      mapId,
      name: copy.name,
      description: copy.description,
      shortDescription: copy.shortDescription,
      zoneId: `${mapId}_${zone.suffix}`,
      position: positionFor(index),
      nodeType,
      icon: NODE_ICONS[Math.min(tier, NODE_ICONS.length - 1)] ?? "flag",
      color: zone.color,
      size: sizeFor(nodeType),
      completeCondition: trading,
      orCompleteConditions: gaming ? [gaming] : [],
      rewards: { xp: TIER_XP.at(tier) ?? TIER_XP[0]! },
      connectedTo: [],
      connectedFrom: [],
      isRequired: nodeType !== "checkpoint",
      isAutoComplete: false,
      order: index,
      isActive: true,
      isSeasonal: false,
      requiredBadgeIds: [],
    });
  }

  for (let i = 0; i < out.length; i += 1) {
    const current = out.at(i);
    const next = out.at(i + 1);
    if (current && next) {
      current.connectedTo = [next.id];
      next.connectedFrom = [current.id];
    }
  }

  return out;
}

export interface JourneyBlueprintOptions {
  perMap?: number;
  /** How many thematic maps to emit (1–10). Default 10. */
  mapCount?: number;
  earnableBadgeXp?: number;
}

/**
 * Build the multi-map dual-path journey.
 *
 * `plan` is accepted so call sites stay stable; map count no longer comes from
 * catalogue scope count. A platform with one game still gets the full sequence.
 */
export function buildJourneyBlueprint(
  _plan: BadgeQuotaPlan,
  options: JourneyBlueprintOptions = {},
): JourneyBlueprint {
  const perMap = Math.max(2, options.perMap ?? DEFAULT_MILESTONES_PER_MAP);
  const mapCount = Math.min(
    MAX_JOURNEY_MAPS,
    Math.max(1, options.mapCount ?? DEFAULT_MAP_COUNT),
  );
  const shells = JOURNEY_MAP_SHELLS.slice(0, mapCount);
  const maps: BlueprintMap[] = [];
  const milestones: BlueprintMilestone[] = [];

  shells.forEach((shell, i) => {
    const scopeMilestones = buildMilestonesForMap(shell.mapId, i, perMap);
    if (scopeMilestones.length === 0) return;

    const estimatedXP = scopeMilestones.reduce((sum, m) => sum + m.rewards.xp, 0);
    const bands = deriveLadderBands(
      (options.earnableBadgeXp ?? 0) + estimatedXP * shells.length,
    );
    const gateIndex = Math.min(i * 2, bands.length - 1);
    const requiredLevelToStart =
      i === 0 ? 1 : (bands.at(gateIndex)?.level ?? 1 + i);

    maps.push({
      mapId: shell.mapId,
      name: shell.name,
      description: shell.description,
      zones: zonesFor(shell.mapId),
      defaultStartNode: scopeMilestones[0]?.id ?? `${shell.mapId}_start`,
      backgroundColor: shell.backgroundColor,
      isActive: true,
      sequenceOrder: i + 1,
      previousMapId: null,
      nextMapId: null,
      theme: shell.theme,
      difficulty: Math.min(10, 1 + i),
      estimatedXP,
      requiredLevelToStart,
      completionRequirement: 100,
      totalMilestones: scopeMilestones.length,
      gameKey: null,
    });
    milestones.push(...scopeMilestones);
  });

  for (let i = 0; i < maps.length; i += 1) {
    const current = maps.at(i);
    const next = maps.at(i + 1);
    if (current && next) {
      current.nextMapId = next.mapId;
      next.previousMapId = current.mapId;
    }
  }

  return {
    maps,
    milestones,
    totalXp: milestones.reduce((sum, m) => sum + m.rewards.xp, 0),
  };
}
