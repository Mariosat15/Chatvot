import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * All condition types supported by the production checkConditionMet function.
 * If a milestone uses a type NOT in this list, the simulator flags it as UNSUPPORTED.
 */
const SUPPORTED_CONDITION_TYPES = new Set([
  // Account & Setup
  "account_created", "first_deposit", "has_deposit", "kyc_verified", "profile_complete",
  // Trading Activity
  "total_deposits", "total_deposited", "first_trade", "total_trades",
  "winning_trades", "losing_trades", "trades_today", "trades_this_week",
  "trades_this_month", "consecutive_trading_days", "different_assets_traded",
  "unique_pairs_traded",
  // Performance
  "win_rate", "win_streak", "max_win_streak", "total_pnl_positive", "total_pnl",
  "profit_factor", "best_trade_pnl", "best_single_trade", "average_trade_pnl",
  "average_win", "risk_reward_ratio",
  // Competitions
  "competitions_entered", "competitions_completed", "first_place_finishes",
  "second_place_finishes", "third_place_finishes", "podium_finishes",
  "top_10_finishes", "top_50_percent_finishes", "competition_pnl",
  // Progression & XP
  "level_reached", "xp_threshold", "xp_earned_today", "xp_earned_this_week",
  "total_badges", "badge_earned", "milestone_complete",
  // Social
  "referrals_made", "referrals_active", "friends_added", "messages_sent",
  // Risk Management
  "stop_loss_used", "always_uses_sl", "take_profit_used", "always_uses_tp",
  "max_drawdown_under", "position_size_under",
  // Time-based
  "account_age_days", "account_age", "active_days", "active_trading_days",
  "login_streak", "consecutive_profitable_days",
  // Map progression
  "map_completed",
]);

/**
 * Condition types that require DB access and can't be fully tested with mock stats.
 */
const DB_DEPENDENT_TYPES = new Set([
  "kyc_verified", "profile_complete", "level_reached", "xp_threshold",
  "total_badges", "badge_earned", "milestone_complete",
  "referrals_made", "referrals_active", "map_completed",
]);

/**
 * Condition types that are boolean (pass/fail) in production.
 */
const BOOLEAN_TYPES = new Set([
  "account_created", "first_deposit", "has_deposit",
  "total_pnl_positive",
]);

/**
 * Generate mock stats matching the camelCase format from gatherUserStats() in production.
 * This ensures the simulator tests the SAME code path as production.
 */
function generateProductionMockStats(
  conditionType: string,
  conditionValue: number
): Record<string, any> {
  const v = conditionValue;

  // Base stats - all generous values so most conditions pass
  return {
    userId: "mock-simulator-user",
    totalTrades: Math.max(500, v + 10),
    winningTrades: Math.max(300, v + 5),
    losingTrades: Math.max(200, v + 5),
    winRate: Math.max(60, v),
    totalPnl: Math.max(10000, v + 100),
    profitFactor: Math.max(2.5, v),
    bestSingleTrade: Math.max(500, v + 50),
    averageWin: Math.max(50, v + 5),
    averageLoss: Math.max(25, v > 0 ? v : 25),
    currentWinStreak: Math.max(20, v + 2),
    maxWinStreak: Math.max(25, v + 5),
    liquidationCount: 0,
    maxDrawdown: 5, // low for "under" conditions
    alwaysUsesSL: true,
    alwaysUsesTP: true,
    tradesWithSL: Math.max(400, v + 10),
    tradesWithTP: Math.max(400, v + 10),
    totalDeposited: Math.max(5000, v + 100),
    depositCount: Math.max(10, v + 1),
    totalWithdrawn: 1000,
    withdrawalCount: 2,
    kycVerified: true,
    accountAge: Math.max(365, v + 30),
    consecutiveTradingDays: Math.max(30, v + 5),
    consecutiveProfitableDays: Math.max(15, v + 3),
    uniquePairsTraded: Math.max(15, v + 2),
    differentAssetsTraded: Math.max(15, v + 2),
    competitionsEntered: Math.max(30, v + 5),
    completedCompetitions: Math.max(25, v + 3),
    competitionsCompleted: Math.max(25, v + 3),
    firstPlaceFinishes: Math.max(10, v + 2),
    secondPlaceFinishes: Math.max(8, v + 1),
    thirdPlaceFinishes: Math.max(5, v + 1),
    podiumFinishes: Math.max(15, v + 2),
    top10Finishes: Math.max(20, v + 3),
    top50PercentFinishes: Math.max(22, v + 3),
    competitionPnl: Math.max(5000, v + 500),
    currentLevel: Math.max(10, v),
    currentXP: Math.max(5000, v + 100),
    xpEarnedToday: Math.max(50, v + 5),
    xpEarnedThisWeek: Math.max(200, v + 20),
    totalBadgesEarned: Math.max(20, v + 2),
    referralsMade: Math.max(5, v + 1),
    referralsActive: Math.max(3, v + 1),
    friendsAdded: Math.max(10, v + 1),
    messagesSent: Math.max(50, v + 5),
    loginStreak: Math.max(30, v + 5),
    maxPositionSize: 0.1, // low for "under" conditions
    maxTradesInOneDay: Math.max(20, v + 2),
    maxTradesInOneWeek: Math.max(80, v + 10),
    maxTradesInOneMonth: Math.max(300, v + 30),
    slTriggeredCount: Math.max(50, v + 5),
    tpTriggeredCount: Math.max(100, v + 10),
    accountAgeDays: Math.max(365, v + 30),
    activeTradingDays: Math.max(60, v + 10),
    comebackWins: Math.max(5, v + 1),
    profileComplete: true,
  };
}

/**
 * Evaluate a milestone condition using the SAME logic as production checkConditionMet.
 * This is a direct mirror of the switch statement in journey-progress.service.ts.
 */
function evaluateWithProductionLogic(
  condition: { type: string; value?: any; comparison?: string },
  stats: Record<string, any>
): { met: boolean; currentValue?: number; reason?: string } {
  const { type, value, comparison = "gte" } = condition;

  let currentValue: number | undefined;

  switch (type) {
    case "account_created":
      return { met: true, currentValue: 1 };

    case "first_deposit":
    case "has_deposit":
      currentValue = (stats.totalDeposited || 0) > 0 ? 1 : 0;
      break;

    case "kyc_verified":
      currentValue = stats.kycVerified ? 1 : 0;
      break;

    case "profile_complete":
      currentValue = stats.profileComplete ? 1 : 0;
      break;

    case "total_deposits":
    case "total_deposited":
      currentValue = stats.totalDeposited || 0;
      break;

    case "first_trade":
    case "total_trades":
      currentValue = stats.totalTrades || 0;
      break;

    case "winning_trades":
      currentValue = stats.winningTrades || 0;
      break;

    case "losing_trades":
      currentValue = stats.losingTrades || 0;
      break;

    case "trades_today":
      currentValue = stats.tradesToday || stats.maxTradesInOneDay || 0;
      break;

    case "trades_this_week":
      currentValue = stats.tradesThisWeek || stats.maxTradesInOneWeek || 0;
      break;

    case "trades_this_month":
      currentValue = stats.tradesThisMonth || stats.maxTradesInOneMonth || 0;
      break;

    case "consecutive_trading_days":
      currentValue = stats.consecutiveTradingDays || 0;
      break;

    case "different_assets_traded":
    case "unique_pairs_traded":
      currentValue = stats.uniquePairsTraded || stats.differentAssetsTraded || 0;
      break;

    case "win_rate":
      currentValue = stats.winRate || 0;
      break;

    case "win_streak":
      currentValue = stats.currentWinStreak || stats.maxWinStreak || 0;
      break;

    case "max_win_streak":
      currentValue = stats.maxWinStreak || 0;
      break;

    case "total_pnl_positive":
      return { met: (stats.totalPnl || 0) > 0, currentValue: stats.totalPnl || 0 };

    case "total_pnl":
      currentValue = stats.totalPnl || 0;
      break;

    case "profit_factor":
      currentValue = stats.profitFactor || 0;
      break;

    case "best_trade_pnl":
    case "best_single_trade":
      currentValue = stats.bestSingleTrade || stats.bestTradePnl || 0;
      break;

    case "average_trade_pnl":
    case "average_win":
      currentValue = stats.averageWin || stats.averageTradePnl || 0;
      break;

    case "risk_reward_ratio":
      const avgWin = stats.averageWin || 0;
      const avgLoss = stats.averageLoss || 1;
      currentValue = avgLoss > 0 ? avgWin / avgLoss : 0;
      break;

    case "competitions_entered":
      currentValue = stats.competitionsEntered || 0;
      break;

    case "competitions_completed":
      currentValue = stats.completedCompetitions || stats.competitionsCompleted || 0;
      break;

    case "first_place_finishes":
      currentValue = stats.firstPlaceFinishes || 0;
      break;

    case "second_place_finishes":
      currentValue = stats.secondPlaceFinishes || 0;
      break;

    case "third_place_finishes":
      currentValue = stats.thirdPlaceFinishes || 0;
      break;

    case "podium_finishes":
      currentValue = stats.podiumFinishes || 0;
      break;

    case "top_10_finishes":
      currentValue = stats.top10Finishes || 0;
      break;

    case "top_50_percent_finishes":
      currentValue = stats.top50PercentFinishes || 0;
      break;

    case "competition_pnl":
      currentValue = stats.competitionPnl || 0;
      break;

    case "level_reached":
      currentValue = stats.currentLevel || 1;
      break;

    case "xp_threshold":
      currentValue = stats.currentXP || 0;
      break;

    case "xp_earned_today":
      currentValue = stats.xpEarnedToday || 0;
      break;

    case "xp_earned_this_week":
      currentValue = stats.xpEarnedThisWeek || 0;
      break;

    case "total_badges":
      currentValue = stats.totalBadgesEarned || 0;
      break;

    case "referrals_made":
      currentValue = stats.referralsMade || 0;
      break;

    case "referrals_active":
      currentValue = stats.referralsActive || 0;
      break;

    case "friends_added":
      currentValue = stats.friendsAdded || 0;
      break;

    case "messages_sent":
      currentValue = stats.messagesSent || 0;
      break;

    case "stop_loss_used":
      currentValue = stats.tradesWithSL || 0;
      break;

    case "always_uses_sl":
      currentValue = stats.alwaysUsesSL ? 1 : 0;
      break;

    case "take_profit_used":
      currentValue = stats.tradesWithTP || 0;
      break;

    case "always_uses_tp":
      currentValue = stats.alwaysUsesTP ? 1 : 0;
      break;

    case "max_drawdown_under":
      currentValue = stats.maxDrawdown || 0;
      return { met: value !== undefined && currentValue <= value, currentValue };

    case "position_size_under":
      currentValue = stats.maxPositionSize || 0;
      return { met: value !== undefined && currentValue <= value, currentValue };

    case "account_age_days":
    case "account_age":
      currentValue = stats.accountAge || stats.accountAgeDays || 0;
      break;

    case "active_days":
    case "active_trading_days":
      currentValue = stats.consecutiveTradingDays || stats.activeTradingDays || 0;
      break;

    case "login_streak":
      currentValue = stats.loginStreak || stats.consecutiveTradingDays || 0;
      break;

    case "consecutive_profitable_days":
      currentValue = stats.consecutiveProfitableDays || 0;
      break;

    // DB-dependent - can only test with mock values
    case "badge_earned":
    case "milestone_complete":
      return { met: true, currentValue: 1, reason: "DB-dependent: assumed pass for simulation" };

    case "map_completed":
      return { met: false, currentValue: 0, reason: "map_completed requires actual progression - SKIPPED" };

    default:
      return { met: false, currentValue: 0, reason: `UNSUPPORTED condition type: "${type}" - not handled in production code` };
  }

  // Apply comparison (same as production)
  if (value === undefined) {
    return { met: currentValue !== undefined && currentValue > 0, currentValue };
  }

  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  let met = false;
  switch (comparison) {
    case "gte":
      met = currentValue !== undefined && currentValue >= numericValue;
      break;
    case "gt":
      met = currentValue !== undefined && currentValue > numericValue;
      break;
    case "lte":
      met = currentValue !== undefined && currentValue <= numericValue;
      break;
    case "lt":
      met = currentValue !== undefined && currentValue < numericValue;
      break;
    case "eq":
      met = currentValue !== undefined && currentValue === numericValue;
      break;
    default:
      met = currentValue !== undefined && currentValue >= numericValue;
  }

  return { met, currentValue };
}

interface MilestoneTestResult {
  milestoneId: string;
  milestoneName: string;
  mapId: string;
  mapName: string;
  order: number;
  condition: any;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  reason: string;
  currentValue?: number;
  targetValue?: number;
  conditionType: string;
  duration: number;
  issues: string[];
  autoFixable: boolean;
  suggestedFix?: any;
}

/**
 * Validate a milestone for input issues (missing fields, bad values, etc.)
 */
function validateMilestoneInput(milestone: any): { issues: string[]; autoFixable: boolean; suggestedFix?: any } {
  const issues: string[] = [];
  let autoFixable = false;
  const suggestedFix: any = {};

  const cond = milestone.completeCondition;

  // No condition at all
  if (!cond) {
    issues.push("Missing completeCondition - milestone has no completion criteria");
    autoFixable = true;
    suggestedFix.completeCondition = { type: "total_trades", value: 1, comparison: "gte" };
    return { issues, autoFixable, suggestedFix };
  }

  // Missing type
  if (!cond.type) {
    issues.push("Missing condition.type - no condition type specified");
    autoFixable = true;
    suggestedFix["completeCondition.type"] = "total_trades";
  }

  // Unsupported type
  if (cond.type && !SUPPORTED_CONDITION_TYPES.has(cond.type)) {
    issues.push(`Unsupported condition type "${cond.type}" - not handled in production code`);
  }

  // Missing value for numeric conditions
  if (cond.type && !BOOLEAN_TYPES.has(cond.type) && !DB_DEPENDENT_TYPES.has(cond.type)) {
    if (cond.value === undefined || cond.value === null || cond.value === "") {
      issues.push(`Missing condition.value for numeric condition "${cond.type}"`);
      autoFixable = true;
      suggestedFix["completeCondition.value"] = 1;
    }
  }

  // Value is a string instead of number
  if (cond.value !== undefined && typeof cond.value === "string" && !isNaN(parseFloat(cond.value))) {
    issues.push(`condition.value is string "${cond.value}" instead of number - may cause comparison issues`);
    autoFixable = true;
    suggestedFix["completeCondition.value"] = parseFloat(cond.value);
  }

  // Missing comparison
  if (cond.type && !BOOLEAN_TYPES.has(cond.type) && !cond.comparison) {
    issues.push("Missing condition.comparison - defaults to 'gte' but should be explicit");
    autoFixable = true;
    suggestedFix["completeCondition.comparison"] = "gte";
  }

  // Invalid comparison value
  const validComparisons = ["gte", "gt", "lte", "lt", "eq", ">=", ">", "<=", "<", "=", "=="];
  if (cond.comparison && !validComparisons.includes(cond.comparison)) {
    issues.push(`Invalid comparison "${cond.comparison}" - must be one of: ${validComparisons.join(", ")}`);
    autoFixable = true;
    suggestedFix["completeCondition.comparison"] = "gte";
  }

  // Missing rewards
  if (!milestone.rewards || !milestone.rewards.xp) {
    issues.push("Missing or zero XP reward");
    autoFixable = true;
    suggestedFix["rewards.xp"] = 10;
  }

  return { issues, autoFixable, suggestedFix: Object.keys(suggestedFix).length > 0 ? suggestedFix : undefined };
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const {
      milestoneId,
      mapId,
      includeFailTests = false,
      action, // "fix" to auto-fix issues
    } = body;

    // ─── FIX ACTION ────────────────────────────────────────────────────
    if (action === "fix") {
      return handleFixAction(body);
    }

    // Get all maps
    const maps = await JourneyMapConfig.find({ isActive: true })
      .sort({ sequenceOrder: 1 })
      .lean() as any[];

    const mapNames: Record<string, string> = {};
    for (const map of maps) {
      mapNames[map.mapId] = map.name;
    }

    // Build query
    const query: Record<string, unknown> = { isActive: true };
    if (milestoneId) query.id = milestoneId;
    if (mapId) query.mapId = mapId;

    const milestones = await JourneyMilestone.find(query)
      .sort({ mapId: 1, order: 1 })
      .lean() as any[];

    if (milestones.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No milestones found to test",
      }, { status: 404 });
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cdeeb214-56c4-42f5-af3d-c63a29f02716',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'milestone-simulator/run/route.ts:POST',message:'Simulator started',data:{milestoneCount:milestones.length,mapCount:Object.keys(mapNames).length,selectedMap:mapId||'all'},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    const results: MilestoneTestResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let issueCount = 0;

    for (const milestone of milestones) {
      const condition = milestone.completeCondition;
      const startTime = Date.now();

      // Step 1: Validate inputs
      const validation = validateMilestoneInput(milestone);
      if (validation.issues.length > 0) issueCount += validation.issues.length;

      // Step 2: Evaluate with production logic
      const condType = condition?.type || "none";
      const condValue = typeof condition?.value === "string"
        ? parseFloat(condition.value) || 1
        : (condition?.value ?? 1);

      let actual = false;
      let expected = true;
      let reason = "";
      let currentValue: number | undefined;
      let targetValue: number | undefined = typeof condValue === "number" ? condValue : undefined;

      if (!condition) {
        expected = true;
        actual = true;
        reason = "No condition defined - milestone auto-passes";
      } else if (condition.type === "map_completed") {
        expected = false;
        actual = false;
        reason = "map_completed requires actual progression - SKIPPED";
      } else if (!SUPPORTED_CONDITION_TYPES.has(condType)) {
        expected = false;
        actual = false;
        reason = `UNSUPPORTED: condition type "${condType}" is not handled in production`;
      } else {
        // Generate mock stats that SHOULD make this condition pass
        const mockStats = generateProductionMockStats(condType, condValue);

        // Evaluate using production-mirror logic
        const result = evaluateWithProductionLogic(condition, mockStats);
        actual = result.met;
        currentValue = result.currentValue;

        if (result.reason) {
          reason = result.reason;
        } else if (actual) {
          reason = `PASS: ${condType} evaluated correctly (current=${currentValue}, target=${condValue}, comparison=${condition.comparison || "gte"})`;
        } else {
          reason = `FAIL: ${condType} should pass but didn't. current=${currentValue}, target=${condValue}, comparison=${condition.comparison || "gte"}`;
        }
      }

      const duration = Date.now() - startTime;
      const passed = actual === expected;

      if (passed) passedCount++;
      else failedCount++;

      results.push({
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        mapId: milestone.mapId,
        mapName: mapNames[milestone.mapId] || milestone.mapId,
        order: milestone.order,
        condition,
        expected,
        actual,
        passed,
        reason,
        currentValue,
        targetValue,
        conditionType: condType,
        duration,
        issues: validation.issues,
        autoFixable: validation.autoFixable,
        suggestedFix: validation.suggestedFix,
      });
    }

    // Group by map
    const byMap: Record<string, { passed: number; failed: number; total: number; issues: number }> = {};
    for (const result of results) {
      if (!byMap[result.mapId]) {
        byMap[result.mapId] = { passed: 0, failed: 0, total: 0, issues: 0 };
      }
      byMap[result.mapId].total++;
      byMap[result.mapId].issues += result.issues.length;
      if (result.passed) byMap[result.mapId].passed++;
      else byMap[result.mapId].failed++;
    }

    // Group by condition type
    const byConditionType: Record<string, { passed: number; failed: number; total: number }> = {};
    for (const result of results) {
      if (!byConditionType[result.conditionType]) {
        byConditionType[result.conditionType] = { passed: 0, failed: 0, total: 0 };
      }
      byConditionType[result.conditionType].total++;
      if (result.passed) byConditionType[result.conditionType].passed++;
      else byConditionType[result.conditionType].failed++;
    }

    // #region agent log
    const failedItems = results.filter(r => !r.passed).map(r => ({id:r.milestoneId,name:r.milestoneName,type:r.conditionType,reason:r.reason}));
    const issueItems = results.filter(r => r.issues.length > 0).map(r => ({id:r.milestoneId,name:r.milestoneName,issues:r.issues}));
    fetch('http://127.0.0.1:7242/ingest/cdeeb214-56c4-42f5-af3d-c63a29f02716',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'milestone-simulator/run/route.ts:POST-result',message:'Simulator completed',data:{total:results.length,passed:passedCount,failed:failedCount,issues:issueCount,failedItems:failedItems.slice(0,10),issueItems:issueItems.slice(0,10)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        issues: issueCount,
        autoFixable: results.filter(r => r.autoFixable).length,
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

/**
 * Auto-fix milestone input issues
 */
async function handleFixAction(body: any) {
  try {
    await connectToDatabase();

    const { milestoneIds, fixAll = false } = body;

    // Get milestones to fix
    let query: Record<string, unknown> = { isActive: true };
    if (!fixAll && milestoneIds?.length > 0) {
      query.id = { $in: milestoneIds };
    }

    const milestones = await JourneyMilestone.find(query).lean() as any[];
    let fixedCount = 0;
    const fixes: Array<{ milestoneId: string; name: string; fixes: string[] }> = [];

    for (const milestone of milestones) {
      const validation = validateMilestoneInput(milestone);
      if (!validation.autoFixable || !validation.suggestedFix) continue;

      const updateOps: Record<string, any> = {};
      const fixDetails: string[] = [];

      for (const [key, val] of Object.entries(validation.suggestedFix)) {
        updateOps[key] = val;
        fixDetails.push(`${key} → ${JSON.stringify(val)}`);
      }

      if (Object.keys(updateOps).length > 0) {
        await JourneyMilestone.updateOne(
          { id: milestone.id },
          { $set: updateOps }
        );
        fixedCount++;
        fixes.push({
          milestoneId: milestone.id,
          name: milestone.name,
          fixes: fixDetails,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} milestones`,
      fixedCount,
      fixes,
    });
  } catch (error) {
    console.error("Milestone fix error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDatabase();

    const maps = await JourneyMapConfig.find({ isActive: true })
      .select("mapId name sequenceOrder")
      .sort({ sequenceOrder: 1 })
      .lean() as any[];

    const milestones = await JourneyMilestone.find({ isActive: true })
      .select("id name mapId order completeCondition rewards")
      .sort({ mapId: 1, order: 1 })
      .lean() as any[];

    const conditionTypes = [...new Set(
      milestones
        .filter((m: any) => m.completeCondition?.type)
        .map((m: any) => m.completeCondition.type)
    )];

    // Check for unsupported types
    const unsupportedTypes = conditionTypes.filter(t => !SUPPORTED_CONDITION_TYPES.has(t));

    return NextResponse.json({
      success: true,
      totalMilestones: milestones.length,
      totalMaps: maps.length,
      supportedConditionTypes: [...SUPPORTED_CONDITION_TYPES],
      unsupportedTypes,
      maps: maps.map((m: any) => ({
        mapId: m.mapId,
        name: m.name,
        sequenceOrder: m.sequenceOrder,
        milestoneCount: milestones.filter((ms: any) => ms.mapId === m.mapId).length,
      })),
      conditionTypes,
      milestones: milestones.map((m: any) => ({
        id: m.id,
        name: m.name,
        mapId: m.mapId,
        order: m.order,
        conditionType: m.completeCondition?.type,
        conditionValue: m.completeCondition?.value,
        comparison: m.completeCondition?.comparison,
        xpReward: m.rewards?.xp,
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
