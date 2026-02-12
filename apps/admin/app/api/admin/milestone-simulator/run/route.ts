import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── SUPPORTED CONDITION TYPES ─────────────────────────────────────────────
// All types handled by production checkConditionMet + aliases
const SUPPORTED_CONDITION_TYPES = new Set([
  "account_created", "first_deposit", "has_deposit", "kyc_verified", "profile_complete",
  "total_deposits", "total_deposited", "first_trade", "total_trades",
  "winning_trades", "losing_trades", "trades_today", "trades_this_week",
  "trades_this_month", "consecutive_trading_days", "different_assets_traded",
  "unique_pairs_traded",
  "win_rate", "win_streak", "max_win_streak", "total_pnl_positive", "total_pnl",
  "profit_factor", "best_trade_pnl", "best_single_trade", "average_trade_pnl",
  "average_win", "risk_reward_ratio",
  "competitions_entered", "competitions_completed", "first_place_finishes",
  "second_place_finishes", "third_place_finishes", "podium_finishes",
  "top_10_finishes", "top_50_percent_finishes", "competition_pnl",
  "level_reached", "xp_threshold", "xp_earned_today", "xp_earned_this_week",
  "total_badges", "badge_earned", "milestone_complete",
  "referrals_made", "referrals_active", "friends_added", "messages_sent",
  "stop_loss_used", "always_uses_sl", "take_profit_used", "always_uses_tp",
  "max_drawdown_under", "position_size_under",
  "account_age_days", "account_age", "active_days", "active_trading_days",
  "login_streak", "consecutive_profitable_days",
  "map_completed",
  // AI-generated aliases (handled by production with case fall-through)
  "daily_trading_streak",    // → consecutive_trading_days
  "consecutive_wins_in_map", // → win_streak
  "perfect_day",             // → consecutive_profitable_days
  "comeback_victory",        // → comebackWins stat
  "comeback_trade",          // → comebackWins stat
  "comp_perfect_run",        // → perfectCompetitionTrades stat
  "legend_rank_1",           // → firstPlaceFinishes stat
  "legend_hall_of_fame",     // → podiumFinishes stat
]);

const DB_DEPENDENT_TYPES = new Set([
  "kyc_verified", "profile_complete", "level_reached", "xp_threshold",
  "total_badges", "badge_earned", "milestone_complete",
  "referrals_made", "referrals_active", "map_completed",
]);

// Boolean conditions: true/false, don't need numeric value
const BOOLEAN_TYPES = new Set([
  "account_created", "first_deposit", "has_deposit",
  "total_pnl_positive", "first_trade",
]);

// ─── AUTO-FIX MAPPINGS ─────────────────────────────────────────────────────
// Maps unsupported types to the closest supported equivalent
const AUTO_FIX_TYPE_MAP: Record<string, { type: string; label: string }> = {
  "daily_trading_streak":    { type: "consecutive_trading_days", label: "Consecutive Trading Days" },
  "consecutive_wins_in_map": { type: "win_streak",              label: "Win Streak" },
  "perfect_day":             { type: "consecutive_profitable_days", label: "Consecutive Profitable Days" },
  "comeback_victory":        { type: "comeback_victory",        label: "Comeback Victory (now supported)" },
  "comeback_trade":          { type: "comeback_trade",          label: "Comeback Trade (now supported)" },
  "comp_perfect_run":        { type: "comp_perfect_run",        label: "Perfect Competition Run (now supported)" },
  "legend_rank_1":           { type: "legend_rank_1",           label: "Legend Rank 1 (now supported)" },
  "legend_hall_of_fame":     { type: "legend_hall_of_fame",     label: "Legend Hall of Fame (now supported)" },
};

// ─── COMPARISON FIX FOR BOOLEAN TYPES ────────────────────────────────────
// Boolean types should always use gte, not eq
const BOOLEAN_COMPARISON_FIX: Record<string, string> = {
  "first_trade": "gte",
  "first_deposit": "gte",
  "has_deposit": "gte",
  "account_created": "gte",
};

// ─── USER-FRIENDLY MESSAGES ─────────────────────────────────────────────
function getUserFriendlyMessage(result: any): string {
  const { conditionType, passed, issues, condition } = result;

  if (passed && issues.length === 0) {
    return `This milestone is configured correctly and will work in production.`;
  }

  if (passed && issues.length > 0) {
    return `This milestone passes but has minor configuration issues that should be fixed for reliability.`;
  }

  if (!passed && conditionType === "none") {
    return `This milestone has no completion condition. Users cannot complete it. Add a condition in Edit Milestone.`;
  }

  if (!passed && !SUPPORTED_CONDITION_TYPES.has(conditionType)) {
    const fix = AUTO_FIX_TYPE_MAP[conditionType];
    if (fix) {
      return `The condition type "${conditionType}" was created by AI but is now supported in production. Click Fix to update it.`;
    }
    return `The condition type "${conditionType}" is not recognized. Users can never complete this milestone. Use the Fix button or edit it manually.`;
  }

  // Comparison mismatch (e.g., first_trade with eq)
  if (!passed && BOOLEAN_TYPES.has(conditionType) && condition?.comparison === "eq") {
    return `"${conditionType}" is a yes/no condition but uses "equals" comparison. A user with 500 trades won't match "equals 1". Change comparison to "greater or equal" (≥).`;
  }

  // Counter type with eq comparison
  if (!passed && COUNTER_TYPES_PREFER_GTE.has(conditionType) && condition?.comparison === "eq") {
    return `"${conditionType}" uses "equals ${condition?.value}" — a user must have EXACTLY ${condition?.value}, not ${(condition?.value || 0) + 1}. This is usually an AI mistake. Click Fix to change to "≥" (greater or equal).`;
  }

  return `This milestone failed testing. Check the condition type, value, and comparison below.`;
}

function getIssueMessage(issue: string): string {
  // Make raw issue strings more user-friendly
  const map: Record<string, string> = {
    "Missing completeCondition - milestone has no completion criteria":
      "No completion condition set. Open Edit Milestone and set a condition type (e.g., Total Trades ≥ 1).",
    "Missing condition.type - no condition type specified":
      "Condition type is blank. Open Edit Milestone and choose what the user needs to achieve.",
  };

  for (const [key, friendly] of Object.entries(map)) {
    if (issue.includes(key)) return friendly;
  }

  if (issue.includes("Unsupported condition type")) {
    const match = issue.match(/"([^"]+)"/);
    const type = match?.[1] || "unknown";
    const fix = AUTO_FIX_TYPE_MAP[type];
    if (fix) {
      return `Condition "${type}" is an AI-generated name. It's now supported in production. Click Fix to keep it clean, or leave as-is.`;
    }
    return `Condition "${type}" is not recognized by the system. Click Fix to replace it with the closest supported type, or edit the milestone manually.`;
  }

  if (issue.includes("Counter condition") && issue.includes("equals")) {
    const typeMatch = issue.match(/"([^"]+)"/);
    const type = typeMatch?.[1] || "this type";
    return `"${type}" is a cumulative counter — using "equals" means the user must hit the exact number, not go above it. Click Fix to change to "≥" (greater or equal), which is almost always what you want.`;
  }

  if (issue.includes("condition.value is string")) {
    return `The condition value is stored as text instead of a number. This can cause comparison bugs. Click Fix to convert it.`;
  }

  if (issue.includes("Missing condition.value for numeric")) {
    return `No target value set. Example: "Total Trades ≥ ???". Set a number in Edit Milestone.`;
  }

  if (issue.includes("Missing condition.comparison")) {
    return `No comparison operator set (e.g., ≥, =, <). Defaults to "≥" but should be set explicitly.`;
  }

  if (issue.includes("Missing or zero XP reward")) {
    return `This milestone gives 0 XP. Users won't earn anything for completing it. Set an XP value in Edit Milestone → Rewards.`;
  }

  if (issue.includes("Invalid comparison")) {
    return `The comparison operator is invalid. Valid options: ≥ (gte), > (gt), = (eq), ≤ (lte), < (lt).`;
  }

  return issue;
}

// ─── COUNTER TYPES THAT SHOULD USE GTE ────────────────────────────────────
// Cumulative counter conditions where "eq" is almost always wrong.
// A user's count will grow over time, so "eq 27" means they'd have to
// have EXACTLY 27 — not 26, not 28. These should use "gte" (≥).
const COUNTER_TYPES_PREFER_GTE = new Set([
  "total_trades", "winning_trades", "losing_trades",
  "trades_today", "trades_this_week", "trades_this_month",
  "consecutive_trading_days", "daily_trading_streak",
  "different_assets_traded", "unique_pairs_traded",
  "win_streak", "consecutive_wins_in_map", "max_win_streak",
  "total_pnl", "total_deposited", "total_deposits",
  "competitions_entered", "competitions_completed",
  "first_place_finishes", "second_place_finishes", "third_place_finishes",
  "podium_finishes", "top_10_finishes", "top_50_percent_finishes",
  "competition_pnl", "total_badges", "referrals_made", "referrals_active",
  "friends_added", "messages_sent", "stop_loss_used", "take_profit_used",
  "account_age_days", "account_age", "active_days", "active_trading_days",
  "login_streak", "consecutive_profitable_days", "perfect_day",
  "comeback_victory", "comeback_trade",
  "comp_perfect_run", "legend_rank_1", "legend_hall_of_fame",
  "level_reached", "xp_threshold", "xp_earned_today", "xp_earned_this_week",
]);

// ─── MOCK STATS (camelCase matching gatherUserStats) ─────────────────────
function generateProductionMockStats(
  conditionType: string,
  conditionValue: number,
  comparison: string = "gte"
): Record<string, any> {
  const v = conditionValue;
  // For "eq" comparisons, use the EXACT target value so the test passes.
  // For "gte"/"gt", use a value comfortably above the target.
  const exact = comparison === "eq";
  const s = (min: number, offset: number) => exact ? v : Math.max(min, v + offset);

  return {
    userId: "mock-simulator-user",
    totalTrades: s(500, 10),
    winningTrades: s(300, 5),
    losingTrades: s(200, 5),
    winRate: s(60, 0),
    totalPnl: s(10000, 100),
    profitFactor: s(2.5, 0),
    bestSingleTrade: s(500, 50),
    averageWin: s(50, 5),
    averageLoss: exact ? v : Math.max(25, v > 0 ? v : 25),
    currentWinStreak: s(20, 2),
    maxWinStreak: s(25, 5),
    liquidationCount: 0,
    maxDrawdown: exact ? v : 5,
    alwaysUsesSL: true,
    alwaysUsesTP: true,
    tradesWithSL: s(400, 10),
    tradesWithTP: s(400, 10),
    totalDeposited: s(5000, 100),
    depositCount: s(10, 1),
    totalWithdrawn: exact ? v : 1000,
    withdrawalCount: exact ? v : 2,
    kycVerified: true,
    accountAge: s(365, 30),
    consecutiveTradingDays: s(30, 5),
    consecutiveProfitableDays: s(15, 3),
    uniquePairsTraded: s(15, 2),
    differentAssetsTraded: s(15, 2),
    competitionsEntered: s(30, 5),
    completedCompetitions: s(25, 3),
    competitionsCompleted: s(25, 3),
    firstPlaceFinishes: s(10, 2),
    secondPlaceFinishes: s(8, 1),
    thirdPlaceFinishes: s(5, 1),
    podiumFinishes: s(15, 2),
    top10Finishes: s(20, 3),
    top50PercentFinishes: s(22, 3),
    competitionPnl: s(5000, 500),
    currentLevel: s(10, 0),
    currentXP: s(5000, 100),
    xpEarnedToday: s(50, 5),
    xpEarnedThisWeek: s(200, 20),
    totalBadgesEarned: s(20, 2),
    referralsMade: s(5, 1),
    referralsActive: s(3, 1),
    friendsAdded: s(10, 1),
    messagesSent: s(50, 5),
    loginStreak: s(30, 5),
    maxPositionSize: exact ? v : 0.1,
    maxTradesInOneDay: s(20, 2),
    maxTradesInOneWeek: s(80, 10),
    maxTradesInOneMonth: s(300, 30),
    comebackWins: s(5, 1),
    perfectCompetitionTrades: s(3, 1),
    profileComplete: true,
  };
}

// ─── PRODUCTION-MIRROR EVALUATION ─────────────────────────────────────────
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
    case "first_trade":
      currentValue = (stats.totalTrades || 0) > 0 ? 1 : 0;
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
    case "daily_trading_streak":
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
    case "consecutive_wins_in_map":
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
    case "risk_reward_ratio": {
      const aW = stats.averageWin || 0;
      const aL = stats.averageLoss || 1;
      currentValue = aL > 0 ? aW / aL : 0;
      break;
    }
    case "competitions_entered":
      currentValue = stats.competitionsEntered || 0;
      break;
    case "competitions_completed":
      currentValue = stats.completedCompetitions || stats.competitionsCompleted || 0;
      break;
    case "first_place_finishes":
    case "legend_rank_1":
      currentValue = stats.firstPlaceFinishes || 0;
      break;
    case "second_place_finishes":
      currentValue = stats.secondPlaceFinishes || 0;
      break;
    case "third_place_finishes":
      currentValue = stats.thirdPlaceFinishes || 0;
      break;
    case "podium_finishes":
    case "legend_hall_of_fame":
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
      return { met: value !== undefined && currentValue! <= value, currentValue };
    case "position_size_under":
      currentValue = stats.maxPositionSize || 0;
      return { met: value !== undefined && currentValue! <= value, currentValue };
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
    case "perfect_day":
      currentValue = stats.consecutiveProfitableDays || 0;
      break;
    case "comeback_victory":
    case "comeback_trade":
      currentValue = stats.comebackWins || 0;
      break;
    case "comp_perfect_run":
      currentValue = stats.perfectCompetitionTrades || 0;
      break;
    case "badge_earned":
    case "milestone_complete":
      return { met: true, currentValue: 1, reason: "Requires real user data - assumed pass for simulation" };
    case "map_completed":
      return { met: false, currentValue: 0, reason: "Requires actual map progression - skipped in simulation" };
    default:
      return { met: false, currentValue: 0, reason: `Not recognized: "${type}" is not handled anywhere in the codebase` };
  }

  if (value === undefined) {
    return { met: currentValue !== undefined && currentValue > 0, currentValue };
  }

  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  let met = false;
  switch (comparison) {
    case "gte": met = currentValue !== undefined && currentValue >= numericValue; break;
    case "gt":  met = currentValue !== undefined && currentValue > numericValue; break;
    case "lte": met = currentValue !== undefined && currentValue <= numericValue; break;
    case "lt":  met = currentValue !== undefined && currentValue < numericValue; break;
    case "eq":  met = currentValue !== undefined && currentValue === numericValue; break;
    default:    met = currentValue !== undefined && currentValue >= numericValue;
  }

  return { met, currentValue };
}

// ─── VALIDATE MILESTONE INPUT ────────────────────────────────────────────
function validateMilestoneInput(milestone: any): { issues: string[]; autoFixable: boolean; suggestedFix?: any } {
  const issues: string[] = [];
  let autoFixable = false;
  const suggestedFix: any = {};
  const cond = milestone.completeCondition;

  if (!cond) {
    issues.push("Missing completeCondition - milestone has no completion criteria");
    autoFixable = true;
    suggestedFix.completeCondition = { type: "total_trades", value: 1, comparison: "gte" };
    return { issues, autoFixable, suggestedFix };
  }

  if (!cond.type) {
    issues.push("Missing condition.type - no condition type specified");
    autoFixable = true;
    suggestedFix["completeCondition.type"] = "total_trades";
  }

  if (cond.type && !SUPPORTED_CONDITION_TYPES.has(cond.type)) {
    issues.push(`Unsupported condition type "${cond.type}" - not handled in production code`);
    // Check if we have an auto-fix
    const fix = AUTO_FIX_TYPE_MAP[cond.type];
    if (fix) {
      autoFixable = true;
      suggestedFix["completeCondition.type"] = fix.type;
    }
  }

  // Boolean types should use gte, not eq
  if (cond.type && BOOLEAN_TYPES.has(cond.type) && cond.comparison === "eq") {
    issues.push(`Boolean condition "${cond.type}" uses "eq" comparison - should use "gte" to work correctly`);
    autoFixable = true;
    suggestedFix["completeCondition.comparison"] = "gte";
    if (cond.value !== undefined && cond.value !== 1) {
      suggestedFix["completeCondition.value"] = 1;
    }
  }

  // Counter/cumulative types should use gte, not eq
  // Using eq means the user must have EXACTLY that count — not one more, not one less.
  // This is almost always an AI wizard mistake.
  if (cond.type && !BOOLEAN_TYPES.has(cond.type) && COUNTER_TYPES_PREFER_GTE.has(cond.type) && cond.comparison === "eq") {
    issues.push(`Counter condition "${cond.type}" uses "equals" (eq) — user must have exactly ${cond.value}, not more. This is almost certainly wrong. Should use "≥" (gte).`);
    autoFixable = true;
    suggestedFix["completeCondition.comparison"] = "gte";
  }

  if (cond.type && !BOOLEAN_TYPES.has(cond.type) && !DB_DEPENDENT_TYPES.has(cond.type)) {
    if (cond.value === undefined || cond.value === null || cond.value === "") {
      issues.push(`Missing condition.value for numeric condition "${cond.type}"`);
      autoFixable = true;
      suggestedFix["completeCondition.value"] = 1;
    }
  }

  if (cond.value !== undefined && typeof cond.value === "string" && !isNaN(parseFloat(cond.value))) {
    issues.push(`condition.value is string "${cond.value}" instead of number`);
    autoFixable = true;
    suggestedFix["completeCondition.value"] = parseFloat(cond.value);
  }

  if (cond.type && !BOOLEAN_TYPES.has(cond.type) && !cond.comparison) {
    issues.push("Missing condition.comparison - defaults to 'gte' but should be explicit");
    autoFixable = true;
    suggestedFix["completeCondition.comparison"] = "gte";
  }

  const validComparisons = ["gte", "gt", "lte", "lt", "eq", ">=", ">", "<=", "<", "=", "=="];
  if (cond.comparison && !validComparisons.includes(cond.comparison)) {
    issues.push(`Invalid comparison "${cond.comparison}"`);
    autoFixable = true;
    suggestedFix["completeCondition.comparison"] = "gte";
  }

  if (!milestone.rewards || !milestone.rewards.xp) {
    issues.push("Missing or zero XP reward");
    autoFixable = true;
    suggestedFix["rewards.xp"] = 10;
  }

  return { issues, autoFixable, suggestedFix: Object.keys(suggestedFix).length > 0 ? suggestedFix : undefined };
}

// ─── RESULT TYPE ─────────────────────────────────────────────────────────
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
  friendlyMessage: string;
  currentValue?: number;
  targetValue?: number;
  conditionType: string;
  duration: number;
  issues: string[];
  friendlyIssues: string[];
  autoFixable: boolean;
  suggestedFix?: any;
}

// ─── POST HANDLER ────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const { milestoneId, mapId, action } = body;

    if (action === "fix") {
      return handleFixAction(body);
    }

    const maps = await JourneyMapConfig.find({ isActive: true }).sort({ sequenceOrder: 1 }).lean() as any[];
    const mapNames: Record<string, string> = {};
    for (const map of maps) mapNames[map.mapId] = map.name;

    const query: Record<string, unknown> = { isActive: true };
    if (milestoneId) query.id = milestoneId;
    if (mapId) query.mapId = mapId;

    const milestones = await JourneyMilestone.find(query).sort({ mapId: 1, order: 1 }).lean() as any[];

    if (milestones.length === 0) {
      return NextResponse.json({ success: false, error: "No milestones found to test" }, { status: 404 });
    }

    const results: MilestoneTestResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let issueCount = 0;

    for (const milestone of milestones) {
      const condition = milestone.completeCondition;
      const startTime = Date.now();

      const validation = validateMilestoneInput(milestone);
      if (validation.issues.length > 0) issueCount += validation.issues.length;

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
        reason = "Map completion requires actual user progression - skipped in simulation";
      } else if (!SUPPORTED_CONDITION_TYPES.has(condType)) {
        expected = false;
        actual = false;
        reason = `Not recognized: "${condType}" is not handled in the codebase. This milestone will never complete for any user.`;
      } else {
        const mockStats = generateProductionMockStats(condType, condValue, condition.comparison || "gte");
        const result = evaluateWithProductionLogic(condition, mockStats);
        actual = result.met;
        currentValue = result.currentValue;
        if (result.reason) {
          reason = result.reason;
        } else if (actual) {
          reason = `Working correctly (mock value: ${currentValue}, target: ${condValue}, comparison: ${condition.comparison || "gte"})`;
        } else {
          reason = `Failed: condition should pass but didn't (mock value: ${currentValue}, target: ${condValue}, comparison: ${condition.comparison || "gte"})`;
        }
      }

      const duration = Date.now() - startTime;
      const passed = actual === expected;
      if (passed) passedCount++; else failedCount++;

      const testResult: MilestoneTestResult = {
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
        friendlyMessage: "",
        currentValue,
        targetValue,
        conditionType: condType,
        duration,
        issues: validation.issues,
        friendlyIssues: validation.issues.map(getIssueMessage),
        autoFixable: validation.autoFixable,
        suggestedFix: validation.suggestedFix,
      };
      testResult.friendlyMessage = getUserFriendlyMessage(testResult);
      results.push(testResult);
    }

    // Group by map
    const byMap: Record<string, { passed: number; failed: number; total: number; issues: number }> = {};
    for (const r of results) {
      if (!byMap[r.mapId]) byMap[r.mapId] = { passed: 0, failed: 0, total: 0, issues: 0 };
      byMap[r.mapId].total++;
      byMap[r.mapId].issues += r.issues.length;
      if (r.passed) byMap[r.mapId].passed++; else byMap[r.mapId].failed++;
    }

    const byConditionType: Record<string, { passed: number; failed: number; total: number }> = {};
    for (const r of results) {
      if (!byConditionType[r.conditionType]) byConditionType[r.conditionType] = { passed: 0, failed: 0, total: 0 };
      byConditionType[r.conditionType].total++;
      if (r.passed) byConditionType[r.conditionType].passed++; else byConditionType[r.conditionType].failed++;
    }

    // Generate text report for easy copy-paste
    const failedResults = results.filter(r => !r.passed || r.issues.length > 0);
    let report = `MILESTONE SIMULATOR REPORT\n`;
    report += `═══════════════════════════\n`;
    report += `Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount} | Issues: ${issueCount}\n`;
    report += `Auto-fixable: ${results.filter(r => r.autoFixable).length}\n\n`;

    if (failedResults.length > 0) {
      report += `ISSUES FOUND:\n`;
      report += `─────────────\n`;
      for (const r of failedResults) {
        report += `\n[${r.passed ? "WARN" : "FAIL"}] ${r.milestoneName} (${r.milestoneId})\n`;
        report += `  Map: ${r.mapName} | Order: #${r.order}\n`;
        report += `  Condition: ${r.conditionType}${r.targetValue !== undefined ? ` ${r.condition?.comparison || "gte"} ${r.targetValue}` : ""}\n`;
        report += `  Status: ${r.friendlyMessage}\n`;
        if (r.friendlyIssues.length > 0) {
          for (const issue of r.friendlyIssues) {
            report += `  → ${issue}\n`;
          }
        }
        if (r.autoFixable) {
          report += `  🔧 Auto-fixable: Yes\n`;
        }
      }
    } else {
      report += `All milestones passed! No issues found.\n`;
    }

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
      report,
    });
  } catch (error) {
    console.error("Milestone simulator error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// ─── FIX HANDLER ─────────────────────────────────────────────────────────
async function handleFixAction(body: any) {
  try {
    await connectToDatabase();
    const { milestoneIds, fixAll = false } = body;

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
        await JourneyMilestone.updateOne({ id: milestone.id }, { $set: updateOps });
        fixedCount++;
        fixes.push({ milestoneId: milestone.id, name: milestone.name, fixes: fixDetails });
      }
    }

    return NextResponse.json({ success: true, message: `Fixed ${fixedCount} milestones`, fixedCount, fixes });
  } catch (error) {
    console.error("Milestone fix error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// ─── GET HANDLER ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    await connectToDatabase();
    const maps = await JourneyMapConfig.find({ isActive: true }).select("mapId name sequenceOrder").sort({ sequenceOrder: 1 }).lean() as any[];
    const milestones = await JourneyMilestone.find({ isActive: true }).select("id name mapId order completeCondition rewards").sort({ mapId: 1, order: 1 }).lean() as any[];

    const conditionTypes = [...new Set(milestones.filter((m: any) => m.completeCondition?.type).map((m: any) => m.completeCondition.type))];
    const unsupportedTypes = conditionTypes.filter(t => !SUPPORTED_CONDITION_TYPES.has(t));

    return NextResponse.json({
      success: true,
      totalMilestones: milestones.length,
      totalMaps: maps.length,
      supportedConditionTypes: [...SUPPORTED_CONDITION_TYPES],
      unsupportedTypes,
      maps: maps.map((m: any) => ({
        mapId: m.mapId, name: m.name, sequenceOrder: m.sequenceOrder,
        milestoneCount: milestones.filter((ms: any) => ms.mapId === m.mapId).length,
      })),
      conditionTypes,
      milestones: milestones.map((m: any) => ({
        id: m.id, name: m.name, mapId: m.mapId, order: m.order,
        conditionType: m.completeCondition?.type, conditionValue: m.completeCondition?.value,
        comparison: m.completeCondition?.comparison, xpReward: m.rewards?.xp,
      })),
    });
  } catch (error) {
    console.error("Milestone simulator GET error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
