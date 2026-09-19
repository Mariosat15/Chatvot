/**
 * Deterministic journey blueprint — a fixed sequence of thematic maps whose
 * milestones are dual-path: trading OR gaming.
 *
 * Reason: R106 emitted ten themed *names* but flat XP, flat milestone counts,
 * shared Foundations/Ascent/Summit zones, account_created on every start node,
 * and no backgroundImage — so every map looked and played like Pirate Cove.
 * This module restores progressive budgets/counts, theme zones, map-gated
 * starts, Map-1 onboarding, and stamps art URLs from the shells.
 */

import {
  DEFAULT_BADGE_XP,
  deriveLadderBands,
  type BadgeQuotaPlan,
} from "./gamification-economy";
import {
  DEFAULT_MAP_COUNT,
  JOURNEY_MAP_SHELLS,
  MAP_MILESTONE_COUNTS,
  MAP_XP_BUDGETS,
  MAX_JOURNEY_MAPS,
  THEME_ZONES,
  type MapTheme,
  type ThemeZoneTemplate,
} from "./journey-map-shells";

export type { MapTheme } from "./journey-map-shells";
export {
  DEFAULT_MAP_COUNT,
  JOURNEY_MAP_SHELLS,
  MAP_MILESTONE_COUNTS,
  MAP_XP_BUDGETS,
  MAX_JOURNEY_MAPS,
  backgroundImageForMapId,
  resolveMapBackgroundImage,
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
  value?: number | string;
  comparison: "gte" | "lte" | "eq";
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
  backgroundImage: string;
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
  gameKey: string | null;
}

export interface JourneyBlueprint {
  maps: BlueprintMap[];
  milestones: BlueprintMilestone[];
  totalXp: number;
}

const MILESTONE_XP_MULTIPLIER = 2;

const TIER_WEIGHTS: readonly number[] = [
  DEFAULT_BADGE_XP.common * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.common * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.rare * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.rare * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.epic * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.epic * MILESTONE_XP_MULTIPLIER,
  DEFAULT_BADGE_XP.legendary * MILESTONE_XP_MULTIPLIER,
];

/** Default only when a caller forces one flat count; generation uses MAP_MILESTONE_COUNTS. */
export const DEFAULT_MILESTONES_PER_MAP = MAP_MILESTONE_COUNTS[0];

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

type DualStep = {
  key: string;
  label: string;
  tradingType: string;
  gamingType: string | null;
  base: number;
  growth: number;
  gamingBase?: number;
  gamingGrowth?: number;
};

/** Map 1 only — platform onboarding before dual-path activity scales. */
const ONBOARDING_STEPS: readonly DualStep[] = [
  {
    key: "kyc",
    label: "Verify Identity",
    tradingType: "kyc_verified",
    gamingType: null,
    base: 1,
    growth: 1,
  },
  {
    key: "deposit",
    label: "First Deposit",
    tradingType: "first_deposit",
    gamingType: null,
    base: 1,
    growth: 1,
  },
  {
    key: "first_action",
    label: "First Action",
    tradingType: "first_trade",
    gamingType: "game_contests_entered",
    base: 1,
    growth: 1,
    gamingBase: 1,
    gamingGrowth: 1,
  },
];

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

function zoneTemplatesFor(theme: MapTheme): readonly ThemeZoneTemplate[] {
  // Reason: theme is a closed MapTheme union from the shell, not request input.
  // eslint-disable-next-line security/detect-object-injection
  return THEME_ZONES[theme] ?? THEME_ZONES.pirate;
}

function zonesFor(mapId: string, theme: MapTheme): BlueprintZone[] {
  return zoneTemplatesFor(theme).map((z, i) => ({
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

/** Spread a map budget across `count` nodes using tier weights; last node absorbs rounding. */
function allocateXp(count: number, budget: number): number[] {
  const safeCount = Math.max(2, count);
  const safeBudget = Math.max(safeCount * 5, budget);
  const weights = Array.from({ length: safeCount }, (_, i) => {
    const tier = Math.min(
      TIER_WEIGHTS.length - 1,
      Math.floor((i / Math.max(1, safeCount - 1)) * (TIER_WEIGHTS.length - 1)),
    );
    // eslint-disable-next-line security/detect-object-injection -- tier is clamped to TIER_WEIGHTS
    return TIER_WEIGHTS[tier] ?? TIER_WEIGHTS[0]!;
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) =>
    Math.max(5, Math.round((w / weightSum) * safeBudget)),
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  const last = raw.length - 1;
  // eslint-disable-next-line security/detect-object-injection -- last is raw.length - 1
  raw[last] = Math.max(5, (raw[last] ?? 5) + (safeBudget - sum));
  return raw;
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

function booleanCondition(type: string): BlueprintCondition {
  return { type, value: 1, comparison: "gte" };
}

function buildMilestonesForMap(
  mapId: string,
  mapIndex: number,
  theme: MapTheme,
  perMap: number,
  xpBudget: number,
  previousMapId: string | null,
): BlueprintMilestone[] {
  const out: BlueprintMilestone[] = [];
  const total = Math.max(2, perMap);
  const xpByOrder = allocateXp(total, xpBudget);
  const zones = zoneTemplatesFor(theme);
  const zoneAt = (index: number) =>
    zones[
      Math.min(Math.floor((index / total) * zones.length), zones.length - 1)
    ]!;

  // Start — map 1 opens on account; later maps require the previous map done.
  {
    const zone = zones[0]!;
    const isFirst = mapIndex === 0 || !previousMapId;
    out.push({
      id: `${mapId}_start`,
      mapId,
      name: isFirst ? "Begin" : "Enter",
      description: isFirst
        ? "Create your account and enter this chapter."
        : `Complete ${previousMapId!.replace(/_/g, " ")} to enter this chapter.`,
      shortDescription: isFirst ? "Start" : "Previous map",
      zoneId: `${mapId}_${zone.suffix}`,
      position: positionFor(0),
      nodeType: "start",
      icon: "flag",
      color: zone.color,
      size: "large",
      completeCondition: isFirst
        ? booleanCondition("account_created")
        : {
            type: "map_completed",
            value: previousMapId!,
            comparison: "eq",
          },
      orCompleteConditions: [],
      rewards: { xp: xpByOrder[0] ?? 5 },
      connectedTo: [],
      connectedFrom: [],
      isRequired: true,
      isAutoComplete: isFirst,
      order: 0,
      isActive: true,
      isSeasonal: false,
      requiredBadgeIds: [],
    });
  }

  const stepsNeeded = total - 1;
  const stepSource: DualStep[] =
    mapIndex === 0
      ? [
          ...ONBOARDING_STEPS,
          ...Array.from({ length: Math.max(0, stepsNeeded - ONBOARDING_STEPS.length) }, (_, i) =>
            DUAL_STEPS[i % DUAL_STEPS.length]!,
          ),
        ]
      : Array.from({ length: stepsNeeded }, (_, i) => DUAL_STEPS[i % DUAL_STEPS.length]!);

  for (let i = 0; i < stepsNeeded; i += 1) {
    // eslint-disable-next-line security/detect-object-injection -- i bounded by stepsNeeded
    const step = stepSource[i]!;
    const tier = Math.min(
      TIER_WEIGHTS.length - 1,
      Math.floor((i / Math.max(1, stepsNeeded - 1)) * (TIER_WEIGHTS.length - 1)),
    );
    const isBoolean =
      step.tradingType === "kyc_verified" ||
      step.tradingType === "first_deposit" ||
      step.tradingType === "first_trade" ||
      step.tradingType === "account_created";

    const tradingValue = isBoolean
      ? 1
      : scale(
          step.base,
          step.growth,
          mapIndex + Math.floor(i / DUAL_STEPS.length),
        );
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

    const copy = isBoolean
      ? {
          name: step.label,
          description:
            step.tradingType === "kyc_verified"
              ? "Complete identity verification."
              : step.tradingType === "first_deposit"
                ? "Make your first deposit."
                : "Place a trade or enter a game contest.",
          shortDescription: step.label,
        }
      : describeDual(step.label, trading, gaming);

    const index = out.length;
    const nodeType = nodeTypeFor(index, total);
    const zone = zoneAt(index);

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
      // eslint-disable-next-line security/detect-object-injection -- index is out.length
      rewards: { xp: xpByOrder[index] ?? 5 },
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
  /** Override all maps to the same count (tests). Production uses MAP_MILESTONE_COUNTS. */
  perMap?: number;
  mapCount?: number;
  earnableBadgeXp?: number;
}

export function buildJourneyBlueprint(
  _plan: BadgeQuotaPlan,
  options: JourneyBlueprintOptions = {},
): JourneyBlueprint {
  const mapCount = Math.min(
    MAX_JOURNEY_MAPS,
    Math.max(1, options.mapCount ?? DEFAULT_MAP_COUNT),
  );
  const shells = JOURNEY_MAP_SHELLS.slice(0, mapCount);
  const maps: BlueprintMap[] = [];
  const milestones: BlueprintMilestone[] = [];

  shells.forEach((shell, i) => {
    const perMap =
      options.perMap ??
      MAP_MILESTONE_COUNTS[Math.min(i, MAP_MILESTONE_COUNTS.length - 1)] ??
      DEFAULT_MILESTONES_PER_MAP;
    const xpBudget =
      MAP_XP_BUDGETS[Math.min(i, MAP_XP_BUDGETS.length - 1)] ?? 150;
    const previousMapId = i === 0 ? null : (shells[i - 1]?.mapId ?? null);
    const scopeMilestones = buildMilestonesForMap(
      shell.mapId,
      i,
      shell.theme,
      perMap,
      xpBudget,
      previousMapId,
    );
    if (scopeMilestones.length === 0) return;

    const estimatedXP = scopeMilestones.reduce((sum, m) => sum + m.rewards.xp, 0);
    const bands = deriveLadderBands(
      (options.earnableBadgeXp ?? 0) +
        MAP_XP_BUDGETS.slice(0, shells.length).reduce((a, b) => a + b, 0),
    );
    const gateIndex = Math.min(i * 2, bands.length - 1);
    const requiredLevelToStart =
      i === 0 ? 1 : (bands.at(gateIndex)?.level ?? 1 + i);

    maps.push({
      mapId: shell.mapId,
      name: shell.name,
      description: shell.description,
      zones: zonesFor(shell.mapId, shell.theme),
      defaultStartNode: scopeMilestones[0]?.id ?? `${shell.mapId}_start`,
      backgroundColor: shell.backgroundColor,
      backgroundImage: shell.backgroundImage,
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
