import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

/**
 * POST /api/journey/fix-issues
 * Auto-fix validation issues in journey milestones
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const fixes: string[] = [];
    const errors: string[] = [];

    // Get all maps sorted by sequence
    const maps = await JourneyMapConfig.find({ isActive: true })
      .sort({ sequenceOrder: 1 })
      .lean();

    if (maps.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No maps found to fix",
      });
    }

    // Track cumulative values across all maps
    let cumulativeMaxValues: Record<string, number> = {};
    const usedConditions = new Set<string>();

    for (const map of maps) {
      const milestones = await JourneyMilestone.find({ mapId: map.mapId, isActive: true })
        .sort({ order: 1 });

      if (milestones.length === 0) continue;

      let previousDifficulty = 0;

      for (let i = 0; i < milestones.length; i++) {
        const milestone = milestones[i];
        const isFirstMilestone = i === 0;
        let modified = false;

        // Fix 1: Ensure prerequisites exist for non-start milestones
        if (!isFirstMilestone && (!milestone.connectedFrom || milestone.connectedFrom.length === 0)) {
          milestone.connectedFrom = [milestones[i - 1].id];
          fixes.push(`Added prerequisite to "${milestone.name}" in ${map.name}`);
          modified = true;
        }

        // Fix 2: Check for duplicate conditions and adjust values
        const condType = milestone.completeCondition?.type;
        const condValue = milestone.completeCondition?.value;
        
        if (condType && typeof condValue === 'number') {
          const condKey = `${condType}:${condValue}`;
          
          // Check if this exact condition already exists
          if (usedConditions.has(condKey)) {
            // Increment the value until it's unique
            let newValue = condValue + 1;
            while (usedConditions.has(`${condType}:${newValue}`)) {
              newValue++;
            }
            milestone.completeCondition.value = newValue;
            fixes.push(`Fixed duplicate condition in "${milestone.name}": ${condType} ${condValue} → ${newValue}`);
            modified = true;
          }
          
          // Check if value is higher than cumulative max
          const maxForType = cumulativeMaxValues[condType] || 0;
          if (condValue <= maxForType) {
            const newValue = maxForType + Math.ceil(maxForType * 0.1) + 1;
            milestone.completeCondition.value = newValue;
            fixes.push(`Increased "${milestone.name}" ${condType}: ${condValue} → ${newValue} (was <= previous max ${maxForType})`);
            modified = true;
          }

          // Track this condition
          usedConditions.add(`${condType}:${milestone.completeCondition.value}`);
          cumulativeMaxValues[condType] = Math.max(
            cumulativeMaxValues[condType] || 0,
            milestone.completeCondition.value
          );
        }

        // Fix 3: Ensure milestone difficulty is progressive
        const currentDifficulty = calculateDifficulty(milestone);
        if (currentDifficulty <= previousDifficulty && i > 0) {
          // Increase the condition value to make it harder
          if (milestone.completeCondition?.value && typeof milestone.completeCondition.value === 'number') {
            const oldValue = milestone.completeCondition.value;
            milestone.completeCondition.value = Math.ceil(oldValue * 1.2) + i;
            fixes.push(`Increased difficulty of "${milestone.name}": value ${oldValue} → ${milestone.completeCondition.value}`);
            modified = true;
          }
        }
        previousDifficulty = Math.max(previousDifficulty, calculateDifficulty(milestone));

        // Save if modified
        if (modified) {
          try {
            await milestone.save();
          } catch (saveError) {
            errors.push(`Failed to save "${milestone.name}": ${saveError}`);
          }
        }
      }
    }

    // Re-validate after fixes
    const validation = await validateAllMaps();

    return NextResponse.json({
      success: true,
      fixes,
      errors,
      fixCount: fixes.length,
      errorCount: errors.length,
      validation,
    });
  } catch (error) {
    console.error("Error fixing journey issues:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fix journey issues" },
      { status: 500 }
    );
  }
}

/**
 * Calculate difficulty score for a milestone
 */
function calculateDifficulty(milestone: any): number {
  const condition = milestone.completeCondition;
  if (!condition) return 0;

  const baseDifficulty: Record<string, number> = {
    account_created: 1,
    kyc_verified: 5,
    first_deposit: 10,
    total_trades: 15,
    winning_trades: 25,
    win_streak: 35,
    competitions_entered: 30,
    competitions_completed: 40,
    podium_finishes: 60,
    first_place_finishes: 80,
    map_completed: 50,
    total_journey_xp: 20,
  };

  const base = baseDifficulty[condition.type] || 20;
  const valueMultiplier = typeof condition.value === 'number' 
    ? Math.log10(condition.value + 1) 
    : 0;

  return base + (valueMultiplier * 10);
}

/**
 * Validate all maps after fixes
 */
async function validateAllMaps(): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const maps = await JourneyMapConfig.find({ isActive: true })
    .sort({ sequenceOrder: 1 })
    .lean();

  for (const map of maps) {
    const milestones = await JourneyMilestone.find({ mapId: map.mapId, isActive: true })
      .sort({ order: 1 })
      .lean();

    let previousDifficulty = 0;
    const usedConditions = new Set<string>();

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i] as any;
      const difficulty = calculateDifficulty(m);

      // Check prerequisites
      if (i > 0 && (!m.connectedFrom || m.connectedFrom.length === 0)) {
        warnings.push(`${map.name}: "${m.name}" has no prerequisites`);
      }

      // Check difficulty progression
      if (difficulty < previousDifficulty && i > 0) {
        warnings.push(`${map.name}: "${m.name}" is easier than previous (${difficulty.toFixed(1)} < ${previousDifficulty.toFixed(1)})`);
      }

      // Check duplicates
      const condKey = `${m.completeCondition?.type}:${m.completeCondition?.value}`;
      if (usedConditions.has(condKey)) {
        warnings.push(`${map.name}: Duplicate condition ${condKey} in "${m.name}"`);
      }
      usedConditions.add(condKey);

      previousDifficulty = Math.max(previousDifficulty, difficulty);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
