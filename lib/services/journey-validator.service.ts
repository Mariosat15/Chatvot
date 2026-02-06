"use server";

/**
 * Journey Validator Service
 * 
 * Enforces strict linear progression rules for journey milestones:
 * 1. Each milestone must be harder than the previous (progressive difficulty)
 * 2. No duplicate condition types with same values
 * 3. Strict prerequisite chains (must complete N to unlock N+1)
 * 4. Proper order numbering without gaps
 * 5. Cross-map validation for multi-map sequences
 * 6. XP budget verification per map
 */

import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone, { IJourneyMilestone, IMilestoneCondition } from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

// Difficulty weights for condition types (higher = harder)
const CONDITION_DIFFICULTY: Record<string, number> = {
  // Account & Setup (easiest)
  account_created: 1,
  kyc_verified: 5,
  first_deposit: 10,
  email_verified: 3,
  two_factor_enabled: 8,
  profile_complete: 7,
  
  // Trading basics (easy)
  total_trades: 15,
  winning_trades: 20,
  trades_today: 12,
  trades_this_week: 14,
  
  // Trading milestones (medium)
  win_streak: 30,
  total_pnl: 35,
  profit_factor: 40,
  win_rate: 35,
  total_volume: 25,
  
  // Competition (harder)
  competitions_entered: 50,
  competitions_completed: 55,
  podium_finishes: 60,
  first_place_finishes: 70,
  competition_wins: 70,
  
  // Mastery (hardest)
  level_reached: 80,
  total_badges_earned: 85,
  referrals_made: 90,
  
  // Multi-map conditions
  map_completed: 75,
  maps_completed_count: 85,
  total_journey_xp: 40,
  all_maps_completed: 100,
  
  // Special achievements
  consecutive_wins_in_map: 45,
  no_losses_in_zone: 55,
  speed_run: 50,
  multi_asset_master: 35,
  perfect_day: 65,
  comeback_trade: 60,
  
  // Social
  followers_count: 30,
  copy_traders_count: 45,
  
  // Time-based
  login_streak: 25,
  trading_days: 20,
  account_age_days: 15,
};

// Minimum value increments for progressive difficulty
const MIN_VALUE_INCREMENTS: Record<string, number> = {
  total_trades: 5,
  winning_trades: 3,
  win_streak: 2,
  total_pnl: 100,
  competitions_entered: 1,
  competitions_completed: 1,
  podium_finishes: 1,
  first_place_finishes: 1,
  level_reached: 1,
  total_badges_earned: 2,
};

export interface ValidationError {
  type: "error" | "warning";
  milestoneId: string;
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions: string[];
}

/**
 * Calculate difficulty score for a milestone condition
 */
export function calculateDifficultyScore(condition: IMilestoneCondition): number {
  const baseScore = CONDITION_DIFFICULTY[condition.type] || 25;
  const valueMultiplier = condition.value ? Math.log10(condition.value + 1) : 0;
  return baseScore + (valueMultiplier * 10);
}

/**
 * Validate that milestones form a proper linear progression
 */
export async function validateJourneyProgression(
  mapId: string = "traders_journey"
): Promise<ValidationResult> {
  await connectToDatabase();
  
  const milestones = await JourneyMilestone.find({ mapId, isActive: true })
    .sort({ order: 1 })
    .lean() as IJourneyMilestone[];
  
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const suggestions: string[] = [];
  
  // Track seen conditions to detect duplicates
  const seenConditions = new Map<string, { milestoneId: string; value?: number }>();
  
  let previousDifficulty = 0;
  let previousOrder = 0;
  
  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i];
    const currentDifficulty = calculateDifficultyScore(milestone.completeCondition);
    
    // 1. Check order is sequential (no gaps)
    if (milestone.order !== previousOrder + 1 && i > 0) {
      errors.push({
        type: "error",
        milestoneId: milestone.id,
        field: "order",
        message: `Order gap detected: ${previousOrder} -> ${milestone.order}`,
        suggestion: `Change order to ${previousOrder + 1}`,
      });
    }
    
    // 2. Check difficulty progression (each should be harder)
    if (currentDifficulty < previousDifficulty && i > 0) {
      warnings.push({
        type: "warning",
        milestoneId: milestone.id,
        field: "completeCondition",
        message: `Milestone "${milestone.name}" is easier than previous (${currentDifficulty.toFixed(1)} < ${previousDifficulty.toFixed(1)})`,
        suggestion: "Consider making this milestone harder or reordering",
      });
    }
    
    // 3. Check for duplicate conditions
    const conditionKey = `${milestone.completeCondition.type}:${milestone.completeCondition.value || 0}`;
    if (seenConditions.has(conditionKey)) {
      const existing = seenConditions.get(conditionKey)!;
      errors.push({
        type: "error",
        milestoneId: milestone.id,
        field: "completeCondition",
        message: `Duplicate condition: "${milestone.completeCondition.type}" with value ${milestone.completeCondition.value} already exists in milestone "${existing.milestoneId}"`,
        suggestion: "Use a different condition type or increase the value",
      });
    }
    seenConditions.set(conditionKey, { milestoneId: milestone.id, value: milestone.completeCondition.value });
    
    // 4. Check prerequisite chain (connectedFrom should include previous milestone)
    if (i > 0) {
      const previousMilestone = milestones[i - 1];
      if (!milestone.connectedFrom?.includes(previousMilestone.id)) {
        warnings.push({
          type: "warning",
          milestoneId: milestone.id,
          field: "connectedFrom",
          message: `Missing prerequisite: Should be connected from "${previousMilestone.name}"`,
          suggestion: `Add "${previousMilestone.id}" to connectedFrom`,
        });
      }
    }
    
    // 5. Check that non-start nodes have prerequisites
    if (milestone.nodeType !== "start" && (!milestone.connectedFrom || milestone.connectedFrom.length === 0)) {
      errors.push({
        type: "error",
        milestoneId: milestone.id,
        field: "connectedFrom",
        message: `Non-start milestone has no prerequisites`,
        suggestion: "Add at least one milestone to connectedFrom",
      });
    }
    
    // 6. Check for proper XP rewards (should increase with difficulty)
    const expectedMinXP = Math.floor(currentDifficulty / 2);
    if ((milestone.rewards?.xp || 0) < expectedMinXP && milestone.rewards?.xp !== 0) {
      suggestions.push(
        `Milestone "${milestone.name}" could have higher XP (suggested: ${expectedMinXP}+)`
      );
    }
    
    previousDifficulty = currentDifficulty;
    previousOrder = milestone.order;
  }
  
  // Overall suggestions
  if (milestones.length < 5) {
    suggestions.push("Consider adding more milestones for better player engagement");
  }
  
  if (milestones.length > 0) {
    const lastMilestone = milestones[milestones.length - 1];
    if (lastMilestone.nodeType !== "legendary") {
      suggestions.push("Consider making the final milestone 'legendary' type for epic ending");
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Auto-fix common progression issues
 */
export async function autoFixProgression(
  mapId: string = "traders_journey"
): Promise<{ fixed: number; issues: string[] }> {
  await connectToDatabase();
  
  const milestones = await JourneyMilestone.find({ mapId, isActive: true })
    .sort({ order: 1 });
  
  let fixed = 0;
  const issues: string[] = [];
  
  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i];
    let needsSave = false;
    
    // Fix order gaps
    const expectedOrder = i + 1;
    if (milestone.order !== expectedOrder) {
      milestone.order = expectedOrder;
      needsSave = true;
      issues.push(`Fixed order for "${milestone.name}": ${milestone.order} -> ${expectedOrder}`);
    }
    
    // Fix missing connectedFrom (for non-start nodes)
    if (i > 0 && milestone.nodeType !== "start") {
      const previousId = milestones[i - 1].id;
      if (!milestone.connectedFrom.includes(previousId)) {
        milestone.connectedFrom = [...milestone.connectedFrom, previousId];
        needsSave = true;
        issues.push(`Added prerequisite "${previousId}" to "${milestone.name}"`);
      }
    }
    
    // Fix missing connectedTo on previous milestone
    if (i > 0) {
      const previous = milestones[i - 1];
      if (!previous.connectedTo.includes(milestone.id)) {
        previous.connectedTo = [...previous.connectedTo, milestone.id];
        await previous.save();
        issues.push(`Added connection to "${milestone.name}" from "${previous.name}"`);
        fixed++;
      }
    }
    
    if (needsSave) {
      await milestone.save();
      fixed++;
    }
  }
  
  return { fixed, issues };
}

/**
 * Get suggested next milestone based on current progression
 */
export function suggestNextMilestone(
  existingMilestones: IJourneyMilestone[]
): {
  suggestedCondition: IMilestoneCondition;
  suggestedOrder: number;
  suggestedXP: number;
  explanation: string;
} {
  if (existingMilestones.length === 0) {
    return {
      suggestedCondition: { type: "account_created" },
      suggestedOrder: 1,
      suggestedXP: 5,
      explanation: "Start with account creation - the beginning of every journey",
    };
  }
  
  // Sort by order to get the last milestone
  const sorted = [...existingMilestones].sort((a, b) => a.order - b.order);
  const lastMilestone = sorted[sorted.length - 1];
  const lastCondition = lastMilestone.completeCondition;
  
  // Determine next logical condition
  let nextCondition: IMilestoneCondition;
  let explanation: string;
  
  // Progressive conditions based on journey stage
  const conditionProgression: IMilestoneCondition[] = [
    { type: "account_created" },
    { type: "kyc_verified" },
    { type: "first_deposit" },
    { type: "total_trades", value: 1, comparison: "gte" },
    { type: "total_trades", value: 5, comparison: "gte" },
    { type: "winning_trades", value: 1, comparison: "gte" },
    { type: "total_trades", value: 10, comparison: "gte" },
    { type: "win_streak", value: 3, comparison: "gte" },
    { type: "total_trades", value: 25, comparison: "gte" },
    { type: "competitions_entered", value: 1, comparison: "gte" },
    { type: "total_trades", value: 50, comparison: "gte" },
    { type: "competitions_completed", value: 3, comparison: "gte" },
    { type: "win_streak", value: 5, comparison: "gte" },
    { type: "podium_finishes", value: 1, comparison: "gte" },
    { type: "total_trades", value: 100, comparison: "gte" },
    { type: "first_place_finishes", value: 1, comparison: "gte" },
    { type: "podium_finishes", value: 5, comparison: "gte" },
    { type: "first_place_finishes", value: 3, comparison: "gte" },
  ];
  
  // Find the next condition not yet used
  const usedConditions = new Set(
    sorted.map(m => `${m.completeCondition.type}:${m.completeCondition.value || 0}`)
  );
  
  const nextAvailable = conditionProgression.find(
    c => !usedConditions.has(`${c.type}:${c.value || 0}`)
  );
  
  if (nextAvailable) {
    nextCondition = nextAvailable;
    explanation = `Next logical step in trader progression`;
  } else {
    // All standard conditions used, suggest increasing last one
    const increment = MIN_VALUE_INCREMENTS[lastCondition.type] || 5;
    nextCondition = {
      type: lastCondition.type,
      value: (lastCondition.value || 0) + increment,
      comparison: "gte",
    };
    explanation = `Increase ${lastCondition.type} requirement for continued challenge`;
  }
  
  const suggestedDifficulty = calculateDifficultyScore(nextCondition);
  const suggestedXP = Math.max(5, Math.floor(suggestedDifficulty / 2));
  
  return {
    suggestedCondition: nextCondition,
    suggestedOrder: lastMilestone.order + 1,
    suggestedXP,
    explanation,
  };
}

/**
 * Check if a new milestone would break progression rules
 */
export function validateNewMilestone(
  newMilestone: Partial<IJourneyMilestone>,
  existingMilestones: IJourneyMilestone[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const suggestions: string[] = [];
  
  // Check for duplicate condition
  const conditionKey = `${newMilestone.completeCondition?.type}:${newMilestone.completeCondition?.value || 0}`;
  const duplicate = existingMilestones.find(
    m => `${m.completeCondition.type}:${m.completeCondition.value || 0}` === conditionKey
  );
  
  if (duplicate) {
    errors.push({
      type: "error",
      milestoneId: newMilestone.id || "new",
      field: "completeCondition",
      message: `Duplicate condition already exists in "${duplicate.name}"`,
      suggestion: "Choose a different condition or value",
    });
  }
  
  // Check difficulty order
  if (newMilestone.order && newMilestone.completeCondition) {
    const sorted = [...existingMilestones].sort((a, b) => a.order - b.order);
    const newDifficulty = calculateDifficultyScore(newMilestone.completeCondition);
    
    // Find where this milestone would fit
    const prevMilestone = sorted.find(m => m.order === newMilestone.order! - 1);
    const nextMilestone = sorted.find(m => m.order === newMilestone.order! + 1);
    
    if (prevMilestone) {
      const prevDifficulty = calculateDifficultyScore(prevMilestone.completeCondition);
      if (newDifficulty < prevDifficulty) {
        warnings.push({
          type: "warning",
          milestoneId: newMilestone.id || "new",
          field: "completeCondition",
          message: `New milestone is easier than previous "${prevMilestone.name}"`,
          suggestion: "Consider a harder condition or lower order number",
        });
      }
    }
    
    if (nextMilestone) {
      const nextDifficulty = calculateDifficultyScore(nextMilestone.completeCondition);
      if (newDifficulty > nextDifficulty) {
        warnings.push({
          type: "warning",
          milestoneId: newMilestone.id || "new",
          field: "completeCondition",
          message: `New milestone is harder than next "${nextMilestone.name}"`,
          suggestion: "Consider an easier condition or higher order number",
        });
      }
    }
  }
  
  // Check prerequisites
  if (newMilestone.order && newMilestone.order > 1) {
    if (!newMilestone.connectedFrom || newMilestone.connectedFrom.length === 0) {
      errors.push({
        type: "error",
        milestoneId: newMilestone.id || "new",
        field: "connectedFrom",
        message: "Non-first milestone must have prerequisites",
        suggestion: "Add the previous milestone to connectedFrom",
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Extended validation result for multi-map sequences
 */
export interface SequenceValidationResult extends ValidationResult {
  mapId: string;
  mapName: string;
  totalXP: number;
  xpBudget: number;
  withinBudget: boolean;
  milestoneCount: number;
}

/**
 * Validate XP budget for a single map
 */
export async function validateMapXPBudget(mapId: string): Promise<{
  isValid: boolean;
  totalXP: number;
  budget: number;
  difference: number;
  percentageUsed: number;
}> {
  await connectToDatabase();
  
  const mapConfig = await JourneyMapConfig.findOne({ mapId }).lean();
  const milestones = await JourneyMilestone.find({ mapId, isActive: true }).lean() as IJourneyMilestone[];
  
  const totalXP = milestones.reduce((sum, m) => sum + (m.rewards?.xp || 0), 0);
  const budget = (mapConfig as any)?.estimatedXP || 150;
  const difference = budget - totalXP;
  const percentageUsed = budget > 0 ? Math.round((totalXP / budget) * 100) : 0;
  
  // Allow 20% over budget as warning threshold
  const isValid = totalXP <= budget * 1.2;
  
  return { isValid, totalXP, budget, difference, percentageUsed };
}

/**
 * Validate cross-map progression and difficulty
 */
export async function validateCrossMapProgression(): Promise<{
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  maps: SequenceValidationResult[];
}> {
  await connectToDatabase();
  
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const maps: SequenceValidationResult[] = [];
  
  // Get all maps in order
  const mapConfigs = await JourneyMapConfig.find({ isActive: true })
    .sort({ sequenceOrder: 1 })
    .lean();
  
  // Track conditions across all maps
  const globalSeenConditions = new Map<string, { mapId: string; milestoneId: string }>();
  let previousMapLastDifficulty = 0;
  
  for (const mapConfig of mapConfigs) {
    const mapId = (mapConfig as any).mapId;
    const mapName = (mapConfig as any).name || mapId;
    const sequenceOrder = (mapConfig as any).sequenceOrder || 1;
    const budget = (mapConfig as any).estimatedXP || 150;
    
    const milestones = await JourneyMilestone.find({ mapId, isActive: true })
      .sort({ order: 1 })
      .lean() as IJourneyMilestone[];
    
    let mapTotalXP = 0;
    let mapLastDifficulty = 0;
    
    // Validate map's milestones
    const mapValidation = await validateJourneyProgression(mapId);
    
    // Check first milestone connects to previous map
    if (sequenceOrder > 1 && milestones.length > 0) {
      const firstMilestone = milestones[0];
      const firstCondition = firstMilestone.completeCondition;
      
      if (firstCondition.type !== "map_completed") {
        warnings.push({
          type: "warning",
          milestoneId: firstMilestone.id,
          field: "completeCondition",
          message: `First milestone of Map ${sequenceOrder} should require completing previous map`,
          suggestion: "Add map_completed condition type",
        });
      }
    }
    
    // Check for cross-map duplicates and track difficulty
    for (const milestone of milestones) {
      const conditionKey = `${milestone.completeCondition.type}:${milestone.completeCondition.value || 0}`;
      const currentDifficulty = calculateDifficultyScore(milestone.completeCondition);
      mapTotalXP += milestone.rewards?.xp || 0;
      mapLastDifficulty = currentDifficulty;
      
      // Check global duplicates (excluding map_completed which is allowed)
      if (milestone.completeCondition.type !== "map_completed") {
        if (globalSeenConditions.has(conditionKey)) {
          const existing = globalSeenConditions.get(conditionKey)!;
          if (existing.mapId !== mapId) {
            warnings.push({
              type: "warning",
              milestoneId: milestone.id,
              field: "completeCondition",
              message: `Duplicate condition across maps: "${milestone.completeCondition.type}:${milestone.completeCondition.value}" also exists in map "${existing.mapId}"`,
              suggestion: "Use a different condition value for variety",
            });
          }
        }
        globalSeenConditions.set(conditionKey, { mapId, milestoneId: milestone.id });
      }
    }
    
    // Check difficulty increases from previous map
    if (sequenceOrder > 1 && milestones.length > 0) {
      const firstMilestoneDifficulty = calculateDifficultyScore(milestones[0].completeCondition);
      if (firstMilestoneDifficulty < previousMapLastDifficulty * 0.8) {
        warnings.push({
          type: "warning",
          milestoneId: milestones[0].id,
          field: "difficulty",
          message: `Map ${sequenceOrder} starts easier than Map ${sequenceOrder - 1} ends`,
          suggestion: "Ensure difficulty progression across maps",
        });
      }
    }
    previousMapLastDifficulty = mapLastDifficulty;
    
    // Check XP budget
    const withinBudget = mapTotalXP <= budget * 1.2; // 20% tolerance
    if (!withinBudget) {
      errors.push({
        type: "error",
        milestoneId: mapId,
        field: "xpBudget",
        message: `Map "${mapName}" XP (${mapTotalXP}) exceeds budget (${budget}) by more than 20%`,
        suggestion: `Reduce total XP by ${mapTotalXP - budget}`,
      });
    } else if (mapTotalXP > budget) {
      warnings.push({
        type: "warning",
        milestoneId: mapId,
        field: "xpBudget",
        message: `Map "${mapName}" XP (${mapTotalXP}) slightly exceeds budget (${budget})`,
        suggestion: "Consider reducing XP rewards",
      });
    }
    
    maps.push({
      mapId,
      mapName,
      isValid: mapValidation.isValid && withinBudget,
      errors: mapValidation.errors,
      warnings: mapValidation.warnings,
      suggestions: mapValidation.suggestions,
      totalXP: mapTotalXP,
      xpBudget: budget,
      withinBudget,
      milestoneCount: milestones.length,
    });
  }
  
  return {
    isValid: errors.length === 0 && maps.every(m => m.isValid),
    errors,
    warnings,
    maps,
  };
}

/**
 * Validate difficulty progression across all maps
 */
export async function validateDifficultyProgression(): Promise<{
  isValid: boolean;
  difficultyByMap: { mapId: string; avgDifficulty: number; minDifficulty: number; maxDifficulty: number }[];
  issues: string[];
}> {
  await connectToDatabase();
  
  const issues: string[] = [];
  const difficultyByMap: { mapId: string; avgDifficulty: number; minDifficulty: number; maxDifficulty: number }[] = [];
  
  const mapConfigs = await JourneyMapConfig.find({ isActive: true })
    .sort({ sequenceOrder: 1 })
    .lean();
  
  let previousMaxDifficulty = 0;
  
  for (const mapConfig of mapConfigs) {
    const mapId = (mapConfig as any).mapId;
    const milestones = await JourneyMilestone.find({ mapId, isActive: true }).lean() as IJourneyMilestone[];
    
    if (milestones.length === 0) {
      difficultyByMap.push({ mapId, avgDifficulty: 0, minDifficulty: 0, maxDifficulty: 0 });
      continue;
    }
    
    const difficulties = milestones.map(m => calculateDifficultyScore(m.completeCondition));
    const avgDifficulty = difficulties.reduce((a, b) => a + b, 0) / difficulties.length;
    const minDifficulty = Math.min(...difficulties);
    const maxDifficulty = Math.max(...difficulties);
    
    difficultyByMap.push({ mapId, avgDifficulty, minDifficulty, maxDifficulty });
    
    // Check progression
    if (minDifficulty < previousMaxDifficulty * 0.7) {
      issues.push(`Map "${mapId}" has lower difficulty than expected based on previous map`);
    }
    
    previousMaxDifficulty = maxDifficulty;
  }
  
  return {
    isValid: issues.length === 0,
    difficultyByMap,
    issues,
  };
}

/**
 * Check for duplicate conditions across entire sequence
 */
export async function validateNoGlobalDuplicates(): Promise<{
  isValid: boolean;
  duplicates: { condition: string; maps: string[] }[];
}> {
  await connectToDatabase();
  
  const conditionMap = new Map<string, string[]>();
  
  const milestones = await JourneyMilestone.find({ isActive: true }).lean() as IJourneyMilestone[];
  
  for (const milestone of milestones) {
    // Skip map_completed conditions as they're allowed to be repeated
    if (milestone.completeCondition.type === "map_completed") continue;
    
    const conditionKey = `${milestone.completeCondition.type}:${milestone.completeCondition.value || 0}`;
    const mapId = milestone.mapId;
    
    if (!conditionMap.has(conditionKey)) {
      conditionMap.set(conditionKey, []);
    }
    const maps = conditionMap.get(conditionKey)!;
    if (!maps.includes(mapId)) {
      maps.push(mapId);
    }
  }
  
  const duplicates = Array.from(conditionMap.entries())
    .filter(([, maps]) => maps.length > 1)
    .map(([condition, maps]) => ({ condition, maps }));
  
  return {
    isValid: duplicates.length === 0,
    duplicates,
  };
}
