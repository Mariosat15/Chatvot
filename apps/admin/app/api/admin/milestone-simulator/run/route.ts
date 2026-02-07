import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import {
  evaluateMilestoneCondition,
  type MilestoneCondition,
} from "@root/lib/services/journey-milestone-evaluation.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface MilestoneTestResult {
  milestoneId: string;
  milestoneName: string;
  mapId: string;
  mapName: string;
  order: number;
  condition: MilestoneCondition | null;
  mockStats: Record<string, number | boolean>;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  reason: string;
  duration: number;
}

/**
 * Generate mock stats that SHOULD pass for a given milestone condition
 */
function generateMockStatsForMilestone(condition: MilestoneCondition | null): Record<string, number | boolean> {
  if (!condition) {
    return { account_created: true };
  }

  const { type, value = 1 } = condition;
  const numericValue = typeof value === "string" ? parseFloat(value) || 1 : value;

  // Base stats that should pass most conditions
  const baseStats: Record<string, number | boolean> = {
    account_created: true,
    kyc_verified: true,
    first_deposit: true,
    has_deposit: true,
    first_trade: true,
    first_withdrawal: true,
    withdrawal_made: true,
    first_winning_trade: true,
    first_losing_trade: true,
    first_stop_loss: true,
    first_take_profit: true,
    total_pnl_positive: true,
    total_trades: 500,
    winning_trades: 300,
    losing_trades: 200,
    win_streak: 20,
    max_win_streak: 25,
    total_pnl: 10000,
    unique_pairs_traded: 15,
    different_assets_traded: 15,
    daily_trading_streak: 30,
    consecutive_profitable_days: 15,
    competitions_entered: 30,
    competitions_completed: 25,
    podium_finishes: 15,
    first_place_finishes: 10,
    comeback_victory: 3,
    underdog_win: 2,
    total_deposits: 5000,
    total_deposited: 5000,
    deposit_amount: 5000,
    always_uses_sl: 1,
    always_uses_tp: 1,
    net_profit_lifetime: 10000,
    maps_completed_count: 5,
  };

  // Override specific stat based on condition type
  switch (type) {
    // Boolean conditions
    case "account_created":
    case "kyc_verified":
    case "first_deposit":
    case "has_deposit":
    case "first_trade":
    case "first_withdrawal":
    case "withdrawal_made":
    case "first_winning_trade":
    case "first_losing_trade":
    case "first_stop_loss":
    case "first_take_profit":
    case "total_pnl_positive":
      baseStats[type] = true;
      break;

    // Numeric conditions - ensure we exceed the required value
    case "total_trades":
      baseStats.total_trades = numericValue + 10;
      break;
    case "winning_trades":
      baseStats.winning_trades = numericValue + 5;
      break;
    case "losing_trades":
      baseStats.losing_trades = numericValue + 5;
      break;
    case "win_streak":
    case "max_win_streak":
      baseStats.win_streak = numericValue + 2;
      baseStats.max_win_streak = numericValue + 2;
      break;
    case "total_pnl":
      baseStats.total_pnl = numericValue + 100;
      break;
    case "unique_pairs_traded":
    case "different_assets_traded":
      baseStats.unique_pairs_traded = numericValue + 2;
      baseStats.different_assets_traded = numericValue + 2;
      break;
    case "daily_trading_streak":
      baseStats.daily_trading_streak = numericValue + 5;
      break;
    case "consecutive_profitable_days":
      baseStats.consecutive_profitable_days = numericValue + 3;
      break;
    case "competitions_entered":
      baseStats.competitions_entered = numericValue + 5;
      break;
    case "competitions_completed":
      baseStats.competitions_completed = numericValue + 3;
      break;
    case "podium_finishes":
      baseStats.podium_finishes = numericValue + 2;
      break;
    case "first_place_finishes":
      baseStats.first_place_finishes = numericValue + 2;
      break;
    case "total_deposits":
    case "total_deposited":
    case "deposit_amount":
      baseStats.total_deposits = numericValue + 100;
      baseStats.total_deposited = numericValue + 100;
      baseStats.deposit_amount = numericValue + 100;
      break;
    case "maps_completed_count":
      baseStats.maps_completed_count = numericValue + 1;
      break;

    // Map completed is special - return false expected
    case "map_completed":
      // This requires special handling outside this function
      break;

    default:
      // For unknown types, try to set the stat
      if (typeof numericValue === "number") {
        baseStats[type] = numericValue + 5;
      }
      break;
  }

  return baseStats;
}

/**
 * Generate mock stats that should FAIL for a given milestone condition
 */
function generateFailingMockStats(condition: MilestoneCondition | null): Record<string, number | boolean> {
  if (!condition) {
    return { account_created: false };
  }

  const { type } = condition;

  // Base stats with minimal/zero values
  const failingStats: Record<string, number | boolean> = {
    account_created: false,
    kyc_verified: false,
    first_deposit: false,
    has_deposit: false,
    first_trade: false,
    first_withdrawal: false,
    withdrawal_made: false,
    first_winning_trade: false,
    first_losing_trade: false,
    first_stop_loss: false,
    first_take_profit: false,
    total_pnl_positive: false,
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
    win_streak: 0,
    max_win_streak: 0,
    total_pnl: -500,
    unique_pairs_traded: 0,
    different_assets_traded: 0,
    daily_trading_streak: 0,
    consecutive_profitable_days: 0,
    competitions_entered: 0,
    competitions_completed: 0,
    podium_finishes: 0,
    first_place_finishes: 0,
    total_deposits: 0,
    total_deposited: 0,
    deposit_amount: 0,
    maps_completed_count: 0,
  };

  // Ensure specific condition type fails
  failingStats[type] = typeof failingStats[type] === "boolean" ? false : 0;

  return failingStats;
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    
    const body = await request.json().catch(() => ({}));
    const { 
      milestoneId, // Optional: test specific milestone
      mapId, // Optional: filter by map
      includeFailTests = false,
    } = body;

    // Get all maps
    const maps = await JourneyMapConfig.find({ isActive: true })
      .sort({ sequenceOrder: 1 })
      .lean() as any[];

    const mapNames: Record<string, string> = {};
    for (const map of maps) {
      mapNames[map.mapId] = map.name;
    }

    // Build query for milestones
    const query: Record<string, unknown> = { isActive: true };
    if (milestoneId) {
      query.id = milestoneId;
    }
    if (mapId) {
      query.mapId = mapId;
    }

    const milestones = await JourneyMilestone.find(query)
      .sort({ mapId: 1, order: 1 })
      .lean() as any[];

    if (milestones.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No milestones found to test",
      }, { status: 404 });
    }

    const results: MilestoneTestResult[] = [];
    let passedCount = 0;
    let failedCount = 0;

    // Test each milestone
    for (const milestone of milestones) {
      const condition = milestone.completeCondition as MilestoneCondition | null;
      
      // Test 1: Mock stats that SHOULD pass
      const mockStats = generateMockStatsForMilestone(condition);
      const startTime = Date.now();
      
      let actual = false;
      let expected = true;
      let reason = "";

      // Special case: map_completed requires actual map completion
      if (condition?.type === "map_completed") {
        expected = false; // Can't test this with mock stats
        actual = false;
        reason = "map_completed conditions require actual map progression checks - SKIPPED";
      } else if (!condition) {
        // No condition = auto-pass
        expected = true;
        actual = true;
        reason = "No condition defined - milestone always passes";
      } else {
        try {
          actual = evaluateMilestoneCondition(condition, mockStats);
          
          if (actual) {
            reason = "Milestone condition correctly evaluated to TRUE with valid stats";
          } else {
            reason = `Milestone condition evaluated to FALSE when it should be TRUE. ` +
              `Condition type: ${condition.type}, ` +
              `Expected value: ${condition.value ?? "N/A"}, ` +
              `Mock stat value: ${mockStats[condition.type]}, ` +
              `Comparison: ${condition.comparison ?? "gte"}`;
          }
        } catch (error) {
          reason = `Error during evaluation: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      }

      const duration = Date.now() - startTime;
      const passed = actual === expected;

      if (passed) {
        passedCount++;
      } else {
        failedCount++;
      }

      results.push({
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        mapId: milestone.mapId,
        mapName: mapNames[milestone.mapId] || milestone.mapId,
        order: milestone.order,
        condition,
        mockStats,
        expected,
        actual,
        passed,
        reason,
        duration,
      });

      // Test 2 (optional): Mock stats that should FAIL
      if (includeFailTests && condition && condition.type !== "map_completed") {
        const failingStats = generateFailingMockStats(condition);
        const startTime2 = Date.now();
        
        let actualFail = false;
        let reasonFail = "";
        
        try {
          actualFail = evaluateMilestoneCondition(condition, failingStats);
          
          if (!actualFail) {
            reasonFail = "Milestone condition correctly evaluated to FALSE with invalid stats";
          } else {
            reasonFail = `Milestone condition evaluated to TRUE when it should be FALSE (zero-baseline issue?)`;
          }
        } catch (error) {
          reasonFail = `Error during evaluation: ${error instanceof Error ? error.message : "Unknown error"}`;
        }

        const duration2 = Date.now() - startTime2;
        const passedFail = actualFail === false;

        if (passedFail) {
          passedCount++;
        } else {
          failedCount++;
        }

        results.push({
          milestoneId: milestone.id + "_fail_test",
          milestoneName: milestone.name + " (Fail Test)",
          mapId: milestone.mapId,
          mapName: mapNames[milestone.mapId] || milestone.mapId,
          order: milestone.order,
          condition,
          mockStats: failingStats,
          expected: false,
          actual: actualFail,
          passed: passedFail,
          reason: reasonFail,
          duration: duration2,
        });
      }
    }

    // Group results by map
    const byMap: Record<string, { passed: number; failed: number; total: number }> = {};
    for (const result of results) {
      if (!byMap[result.mapId]) {
        byMap[result.mapId] = { passed: 0, failed: 0, total: 0 };
      }
      byMap[result.mapId].total++;
      if (result.passed) {
        byMap[result.mapId].passed++;
      } else {
        byMap[result.mapId].failed++;
      }
    }

    // Group by condition type
    const byConditionType: Record<string, { passed: number; failed: number; total: number }> = {};
    for (const result of results) {
      const condType = result.condition?.type || "none";
      if (!byConditionType[condType]) {
        byConditionType[condType] = { passed: 0, failed: 0, total: 0 };
      }
      byConditionType[condType].total++;
      if (result.passed) {
        byConditionType[condType].passed++;
      } else {
        byConditionType[condType].failed++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        passRate: ((passedCount / results.length) * 100).toFixed(1) + "%",
        byMap,
        byConditionType,
        mapsIncluded: Object.keys(mapNames).length,
      },
      results,
    });

  } catch (error) {
    console.error("Milestone simulator error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function GET() {
  // Return available milestones and maps for UI
  try {
    await connectToDatabase();
    
    const maps = await JourneyMapConfig.find({ isActive: true })
      .select("mapId name sequenceOrder")
      .sort({ sequenceOrder: 1 })
      .lean() as any[];

    const milestones = await JourneyMilestone.find({ isActive: true })
      .select("id name mapId order completeCondition")
      .sort({ mapId: 1, order: 1 })
      .lean() as any[];

    // Get unique condition types
    const conditionTypes = [...new Set(
      milestones
        .filter(m => m.completeCondition?.type)
        .map(m => m.completeCondition.type)
    )];

    return NextResponse.json({
      success: true,
      totalMilestones: milestones.length,
      totalMaps: maps.length,
      maps: maps.map(m => ({
        mapId: m.mapId,
        name: m.name,
        sequenceOrder: m.sequenceOrder,
        milestoneCount: milestones.filter(ms => ms.mapId === m.mapId).length,
      })),
      conditionTypes,
      milestones: milestones.map(m => ({
        id: m.id,
        name: m.name,
        mapId: m.mapId,
        order: m.order,
        conditionType: m.completeCondition?.type,
      })),
    });

  } catch (error) {
    console.error("Milestone simulator GET error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
