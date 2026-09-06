import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import { 
  checkBadgeCondition, 
  UserStats 
} from "@/lib/services/badge-evaluation.service";
import { Badge } from "@/lib/constants/badges";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── INVERSE CONDITIONS ───────────────────────────────────────────────────
// Condition types where LOWER values are BETTER (e.g., "Low Drawdown").
// If an AI wizard sets comparison to "gte" on these, it's almost always wrong.
const INVERSE_CONDITION_TYPES = new Set([
  "max_drawdown",        // lower drawdown = better risk management
  "max_drawdown_under",  // explicitly "under" a threshold
  "position_size_under", // explicitly "under" a threshold
]);

// ─── COUNTER TYPES THAT SHOULD USE GTE ─────────────────────────────────────
// Cumulative counters where "eq" is almost always wrong (same as milestone sim)
const COUNTER_TYPES_PREFER_GTE = new Set([
  "total_trades", "winning_trades", "losing_trades",
  "competitions_entered", "competitions_completed",
  "first_place_finishes", "second_place_finishes", "third_place_finishes",
  "podium_finishes", "top_10_finishes", "top_50_percent_finishes",
  "total_pnl", "competition_pnl", "total_deposited", "total_deposits",
  "total_withdrawals", "unique_pairs_traded", "different_assets_traded",
  "referrals_made", "referrals_active", "friends_added", "messages_sent",
  "consecutive_trading_days", "daily_trading_streak", "active_days",
  "active_trading_days", "consecutive_profitable_days", "login_streak",
  "weekly_trading_streak", "monthly_trading_streak",
  "max_trades_in_one_day", "max_trades_in_one_week", "max_trades_in_one_month",
  "daily_trade_volume", "weekly_trade_volume", "monthly_trade_volume",
  "single_day_trades", "comeback_wins", "wire_to_wire_wins",
  "trades_under_1_minute", "trades_under_5_minutes",
  "trades_at_market_open", "trades_at_market_close", "trades_at_open", "trades_at_close",
  "level_reached", "xp_threshold", "xp_earned_today", "xp_earned_this_week",
  "total_badges", "stop_loss_used", "take_profit_used",
  "max_win_streak", "win_streak", "best_trade_pnl", "best_single_trade",
  "average_trade_pnl", "average_win", "account_age_days", "account_age", "platform_age",
]);

// ─── BOOLEAN / ALWAYS-TRUE TYPES ────────────────────────────────────────
const BOOLEAN_TYPES = new Set([
  "account_created", "first_deposit", "has_deposit", "first_trade",
  "kyc_verified", "profile_complete", "total_pnl_positive",
]);

// ─── SUPPORTED CONDITION TYPES ──────────────────────────────────────────
// All types the production checkBadgeCondition handles
const SUPPORTED_CONDITION_TYPES = new Set([
  // Trading
  "total_trades", "winning_trades", "losing_trades", "unique_pairs_traded",
  "different_assets_traded", "single_pair_focus",
  // Profit
  "total_pnl_positive", "total_pnl", "single_trade_profit", "win_streak",
  "average_roi", "profit_factor", "win_rate", "drawdown_recovery",
  "best_trade_pnl", "best_single_trade", "average_trade_pnl", "average_win",
  "max_win_streak",
  // Competition
  "competitions_entered", "competitions_completed", "first_place_finishes",
  "second_place_finishes", "third_place_finishes", "podium_finishes",
  "top_10_finishes", "top_50_percent_finishes", "competition_pnl",
  "perfect_competition_win_rate", "comeback_wins", "wire_to_wire_wins",
  "survived_full_competition", "first_trade_in_comp", "beat_top_trader",
  "underdog_win", "comeback_victory", "wire_to_wire_win",
  "undefeated_in_comps", "all_legendary_badges", "hall_of_fame_status",
  "perfect_competition_trades",
  // Risk
  "no_liquidations", "zero_liquidations_lifetime", "always_uses_sl",
  "always_uses_tp", "max_drawdown", "max_drawdown_under", "average_leverage_low",
  "average_loss_small", "risk_discipline", "sharpe_ratio_high",
  "low_volatility", "optimal_position_sizing", "strategy_diversity",
  "balanced_risk_reward", "low_return_variance", "predictable_results",
  "exceptional_dd_control", "hedging_strategy",
  "stop_loss_used", "take_profit_used", "position_size_under",
  // Speed
  "fast_order_execution", "trades_under_1_minute", "trades_under_5_minutes",
  "quick_scalps", "swing_trading_style", "position_trading_style",
  "trades_at_market_open", "trades_at_market_close", "trades_at_open",
  "trades_at_close", "late_night_trader", "ninja_trading", "trades_all_hours",
  "ultra_fast_execution", "precise_entry_timing",
  // Strategy
  "trend_following", "counter_trend", "breakout_trading", "range_trading",
  "momentum_trading", "mean_reversion", "multiple_strategies",
  "unique_strategy", "patient_trading", "closes_all_daily",
  "technical_analysis", "news_trading", "versatile",
  // Consistency
  "consecutive_trading_days", "daily_trading_streak", "active_days",
  "active_trading_days", "consecutive_profitable_days",
  "weekly_trading_streak", "monthly_trading_streak", "login_streak",
  "perfect_attendance", "perfect_month", "perfect_year",
  // Volume
  "max_trades_in_one_day", "daily_trade_volume", "single_day_trades",
  "max_trades_in_one_week", "weekly_trade_volume",
  "max_trades_in_one_month", "monthly_trade_volume",
  // Social
  "first_deposit", "total_deposited", "total_deposits",
  "withdrawal_made", "total_withdrawals", "large_withdrawal",
  "net_profit_lifetime", "platform_age", "account_age_days", "account_age",
  "early_adopter", "kyc_verified", "has_deposit", "profile_complete",
  "referrals_made", "referrals_active", "friends_added", "messages_sent",
  // Progression
  "level_reached", "xp_threshold", "xp_earned_today", "xp_earned_this_week",
  "total_badges",
  // Account
  "account_created", "first_trade",
  // Global
  "global_rank", "epic_comeback",
  // Risk management additional
  "risk_reward_ratio", "trades_today", "trades_this_week", "trades_this_month",
]);

// ─── USER-FRIENDLY MESSAGES ──────────────────────────────────────────────
function getUserFriendlyMessage(result: BadgeTestResult): string {
  const { passed, issues, condition } = result;

  if (passed && issues.length === 0) {
    return "This badge is configured correctly and will work in production.";
  }

  if (passed && issues.length > 0) {
    return "This badge passes but has configuration issues that should be fixed for reliability.";
  }

  if (!passed && !SUPPORTED_CONDITION_TYPES.has(condition.type)) {
    return `The condition type "${condition.type}" is not recognized by the production code. Users can never earn this badge.`;
  }

  // Inverse condition with wrong comparison
  if (!passed && INVERSE_CONDITION_TYPES.has(condition.type) && condition.comparison === "gte") {
    return `"${condition.type}" is a "lower is better" condition but uses "≥" (gte). A "Low Drawdown" badge should use "≤" (lte) so users with LOWER drawdown qualify. Click Fix to correct it.`;
  }

  // Counter with eq
  if (!passed && COUNTER_TYPES_PREFER_GTE.has(condition.type) && condition.comparison === "eq") {
    return `"${condition.type}" uses "equals ${condition.value}" — a user must have EXACTLY ${condition.value}, not ${(condition.value || 0) + 1}. This is usually an AI mistake. Click Fix to change to "≥" (gte).`;
  }

  // Boolean with eq
  if (!passed && BOOLEAN_TYPES.has(condition.type) && condition.comparison === "eq") {
    return `"${condition.type}" is a yes/no condition but uses "equals". Change comparison to "≥" (gte).`;
  }

  return "This badge failed testing. Check the condition type, value, and comparison below.";
}

function getIssueMessage(issue: string): string {
  if (issue.includes("Inverse condition") && issue.includes("gte")) {
    const typeMatch = issue.match(/"([^"]+)"/);
    const type = typeMatch?.[1] || "this type";
    return `"${type}" measures something where LOWER is better. Using "≥" means users need HIGH values to earn a "Low" badge. Click Fix to change to "≤" (lte).`;
  }

  if (issue.includes("Counter condition") && issue.includes("eq")) {
    const typeMatch = issue.match(/"([^"]+)"/);
    const type = typeMatch?.[1] || "this type";
    return `"${type}" is a cumulative counter — using "equals" means the user must hit the exact number. Click Fix to change to "≥" (gte).`;
  }

  if (issue.includes("Unsupported condition type")) {
    const match = issue.match(/"([^"]+)"/);
    const type = match?.[1] || "unknown";
    return `Condition "${type}" is not recognized by the system. Users can never earn this badge. Edit the badge to use a supported condition type.`;
  }

  if (issue.includes("condition.value is string")) {
    return "The condition value is stored as text instead of a number. This can cause comparison bugs. Click Fix to convert it.";
  }

  if (issue.includes("Missing condition.value")) {
    return "No target value set. Set a number in the badge editor.";
  }

  if (issue.includes("Missing condition.comparison")) {
    return "No comparison operator set. Defaults to \"≥\" but should be set explicitly. Click Fix.";
  }

  if (issue.includes("Missing or zero XP")) {
    return "This badge gives 0 XP. Consider adding an XP value in the badge editor.";
  }

  return issue;
}

// ─── VALIDATE BADGE INPUT ────────────────────────────────────────────────
function validateBadgeInput(badge: any): { issues: string[]; autoFixable: boolean; suggestedFix?: any } {
  const issues: string[] = [];
  let autoFixable = false;
  const suggestedFix: any = {};
  const cond = badge.condition;

  if (!cond) {
    issues.push("Missing condition - badge has no completion criteria");
    return { issues, autoFixable: false };
  }

  if (!cond.type) {
    issues.push("Missing condition.type - no condition type specified");
    return { issues, autoFixable: false };
  }

  // Unsupported type
  if (!SUPPORTED_CONDITION_TYPES.has(cond.type)) {
    issues.push(`Unsupported condition type "${cond.type}" - not handled in production code`);
  }

  // Inverse condition with wrong comparison (e.g., max_drawdown gte 10)
  if (INVERSE_CONDITION_TYPES.has(cond.type) && cond.comparison === "gte") {
    issues.push(`Inverse condition "${cond.type}" uses "gte" — should use "lte" (lower is better)`);
    autoFixable = true;
    suggestedFix["condition.comparison"] = "lte";
  }

  // Counter with eq comparison
  if (!BOOLEAN_TYPES.has(cond.type) && COUNTER_TYPES_PREFER_GTE.has(cond.type) && cond.comparison === "eq") {
    issues.push(`Counter condition "${cond.type}" uses "eq" — should use "gte" (≥)`);
    autoFixable = true;
    suggestedFix["condition.comparison"] = "gte";
  }

  // Boolean type with eq comparison
  if (BOOLEAN_TYPES.has(cond.type) && cond.comparison === "eq") {
    issues.push(`Boolean condition "${cond.type}" uses "eq" — should use "gte"`);
    autoFixable = true;
    suggestedFix["condition.comparison"] = "gte";
    if (cond.value !== undefined && cond.value !== 1) {
      suggestedFix["condition.value"] = 1;
    }
  }

  // Value stored as string
  if (cond.value !== undefined && typeof cond.value === "string" && !isNaN(parseFloat(cond.value))) {
    issues.push(`condition.value is string "${cond.value}" instead of number`);
    autoFixable = true;
    suggestedFix["condition.value"] = parseFloat(cond.value);
  }

  // Missing comparison
  if (cond.type && !BOOLEAN_TYPES.has(cond.type) && !cond.comparison && cond.value !== undefined) {
    issues.push("Missing condition.comparison - defaults to 'gte' but should be explicit");
    autoFixable = true;
    suggestedFix["condition.comparison"] = INVERSE_CONDITION_TYPES.has(cond.type) ? "lte" : "gte";
  }

  // Invalid comparison
  const validComparisons = ["gte", "gt", "lte", "lt", "eq"];
  if (cond.comparison && !validComparisons.includes(cond.comparison)) {
    issues.push(`Invalid comparison "${cond.comparison}"`);
    autoFixable = true;
    suggestedFix["condition.comparison"] = INVERSE_CONDITION_TYPES.has(cond.type) ? "lte" : "gte";
  }

  return { issues, autoFixable, suggestedFix: Object.keys(suggestedFix).length > 0 ? suggestedFix : undefined };
}

// ─── RESULT TYPE ─────────────────────────────────────────────────────────
interface BadgeTestResult {
  badgeId: string;
  badgeName: string;
  category: string;
  rarity: string;
  condition: {
    type: string;
    value?: number;
    comparison?: string;
    minTrades?: number;
    minCompletedCompetitions?: number;
  };
  mockStats: Partial<UserStats>;
  expected: boolean;
  actual: boolean;
  passed: boolean;
  reason: string;
  friendlyMessage: string;
  friendlyIssues: string[];
  duration: number;
  issues: string[];
  autoFixable: boolean;
  suggestedFix?: any;
}

// ─── MOCK STATS GENERATOR ───────────────────────────────────────────────
function generateMockStatsForBadge(badge: Badge): Partial<UserStats> {
  const { condition } = badge;
  const { type, value = 1, comparison = "gte", minTrades = 0, minCompletedCompetitions = 0 } = condition;
  const numericValue = typeof value === "number" ? value : parseInt(value as string) || 1;

  // For "eq" comparisons on counter types, use the EXACT target value
  const isEq = comparison === "eq";

  // Base stats that satisfy minimum requirements
  const baseStats: Partial<UserStats> = {
    userId: "test-user-simulator",
    totalTrades: Math.max(100, minTrades + 50),
    completedCompetitionsWithTrades: Math.max(10, minCompletedCompetitions + 5),
    completedCompetitions: Math.max(10, minCompletedCompetitions + 5),
    liquidationCount: 0,
    alwaysUsesSL: true,
    alwaysUsesTP: true,
    tradesWithSL: 50,
    tradesWithTP: 50,
    kycVerified: true,
    totalDeposited: 1000,
    totalWithdrawn: 500,
    withdrawalCount: 5,
    accountAge: 365,
    winningTrades: 60,
    losingTrades: 40,
    winRate: 60,
    totalPnl: 5000,
    profitFactor: 2.0,
    maxWinStreak: 10,
    currentWinStreak: 5,
    maxDrawdown: 5,      // Low drawdown = good (for "Low Drawdown" badges)
    uniquePairsTraded: 10,
    competitionsEntered: 20,
    firstPlaceFinishes: 5,
    podiumFinishes: 10,
    totalWins: 5,
    averageRoi: 15,
    bestSingleTrade: 500,
    averageLoss: 30,
    averageWin: 80,
    sharpeRatio: 2.5,
    profitVolatility: 50,
    averagePositionSize: 1.5,
    uniqueStrategiesUsed: 5,
    consecutiveProfitableDays: 10,
    consecutiveTradingDays: 30,
    weeklyTradingStreak: 4,
    monthlyTradingStreak: 2,
    globalRank: 50,
    comebackWins: 2,
    wireToWireWins: 3,
    perfectCompetitionTrades: 5,
    averageTradeDuration: 30,
    tradesUnder1Minute: 20,
    tradesUnder5Minutes: 40,
    tradesOver1Day: 10,
    tradesOver7Days: 5,
    tradesAtMarketOpen: 15,
    tradesAtMarketClose: 10,
    tradesAtLateNight: 5,
    maxTradesInOneDay: 25,
    maxTradesInOneWeek: 100,
    maxTradesInOneMonth: 300,
    secondPlaceFinishes: 3,
    thirdPlaceFinishes: 2,
    top10Finishes: 15,
    top50PercentFinishes: 18,
    competitionPnl: 3000,
    currentLevel: 10,
    currentXP: 5000,
    xpEarnedToday: 100,
    xpEarnedThisWeek: 500,
    totalBadgesEarned: 20,
    slTriggeredCount: 10,
    tpTriggeredCount: 10,
    depositCount: 10,
    referralsMade: 5,
    referralsActive: 3,
    friendsAdded: 10,
    messagesSent: 50,
    loginStreak: 30,
    averageTradesDuration: 30,
  };

  // Override specific stats based on condition type to ensure they pass
  switch (type) {
    // Competition conditions
    case "competitions_entered":
      baseStats.competitionsEntered = isEq ? numericValue : numericValue + 5;
      break;
    case "first_place_finishes":
      baseStats.firstPlaceFinishes = isEq ? numericValue : numericValue + 2;
      break;
    case "podium_finishes":
      baseStats.podiumFinishes = isEq ? numericValue : numericValue + 3;
      break;
    case "perfect_competition_win_rate":
      baseStats.completedCompetitions = minCompletedCompetitions || 3;
      baseStats.firstPlaceFinishes = baseStats.competitionsEntered || 10;
      break;

    // Trading volume conditions
    case "total_trades":
      baseStats.totalTrades = isEq ? numericValue : numericValue + 10;
      break;
    case "unique_pairs_traded":
      baseStats.uniquePairsTraded = isEq ? numericValue : numericValue + 2;
      break;
    case "single_pair_focus":
      baseStats.totalTrades = 150;
      baseStats.uniquePairsTraded = 2;
      break;

    // Profit conditions
    case "winning_trades":
      baseStats.winningTrades = isEq ? numericValue : numericValue + 5;
      break;
    case "total_pnl_positive":
      baseStats.totalPnl = 1000;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;
    case "total_pnl":
      baseStats.totalPnl = isEq ? numericValue : numericValue + 100;
      break;
    case "single_trade_profit":
      baseStats.bestSingleTrade = isEq ? numericValue : numericValue + 50;
      break;
    case "win_streak":
      baseStats.maxWinStreak = isEq ? numericValue : numericValue + 2;
      break;
    case "average_roi":
      baseStats.averageRoi = isEq ? numericValue : numericValue + 5;
      break;
    case "profit_factor":
      baseStats.profitFactor = isEq ? numericValue : numericValue + 0.5;
      break;
    case "win_rate":
      baseStats.winRate = isEq ? numericValue : numericValue + 5;
      break;
    case "drawdown_recovery":
      baseStats.totalPnl = 1000;
      baseStats.losingTrades = 10;
      baseStats.maxWinStreak = 5;
      break;

    // Risk conditions
    case "no_liquidations":
      baseStats.liquidationCount = 0;
      baseStats.completedCompetitionsWithTrades = Math.max(1, minCompletedCompetitions || 1);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 5);
      break;
    case "zero_liquidations_lifetime":
      baseStats.liquidationCount = 0;
      baseStats.completedCompetitionsWithTrades = Math.max(10, minCompletedCompetitions || 10);
      baseStats.totalTrades = Math.max(50, minTrades || 50);
      break;
    case "always_uses_sl":
      baseStats.alwaysUsesSL = true;
      baseStats.slTriggeredCount = 10;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;
    case "always_uses_tp":
      baseStats.alwaysUsesTP = true;
      baseStats.tpTriggeredCount = 10;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;

    // Social conditions
    case "first_deposit":
      baseStats.totalDeposited = 100;
      break;
    case "total_deposited":
      baseStats.totalDeposited = isEq ? numericValue : numericValue + 100;
      break;
    case "total_deposits":
      baseStats.depositCount = isEq ? numericValue : numericValue + 5;
      break;
    case "withdrawal_made":
      baseStats.totalWithdrawn = 100;
      break;
    case "total_withdrawals":
      baseStats.withdrawalCount = isEq ? numericValue : numericValue + 2;
      break;
    case "large_withdrawal":
      baseStats.totalWithdrawn = 600;
      break;
    case "net_profit_lifetime":
      baseStats.totalWithdrawn = 1500;
      baseStats.totalDeposited = 1000;
      break;
    case "platform_age":
    case "account_age_days":
    case "account_age":
      baseStats.accountAge = isEq ? numericValue : numericValue + 10;
      break;
    case "early_adopter":
      baseStats.accountAge = 60;
      break;
    case "kyc_verified":
      baseStats.kycVerified = true;
      break;

    // Global rank
    case "global_rank":
      baseStats.globalRank = numericValue;
      break;

    // Legendary conditions
    case "undefeated_in_comps":
      baseStats.completedCompetitionsWithTrades = Math.max(10, minCompletedCompetitions || 10);
      baseStats.firstPlaceFinishes = baseStats.competitionsEntered || 10;
      break;
    case "all_legendary_badges":
      baseStats.competitionsEntered = 60;
      baseStats.firstPlaceFinishes = 25;
      baseStats.totalPnl = 60000;
      break;

    // Risk management advanced — INVERSE conditions (lower = better)
    case "max_drawdown":
      // For max_drawdown: the mock ALWAYS sets a low value.
      // If comparison is "lte" (correct): 5 <= 10 → true.
      // If comparison is "gte" (wrong):   5 >= 10 → false (will show as issue).
      baseStats.maxDrawdown = Math.min(numericValue - 1, 5);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 20);
      baseStats.completedCompetitionsWithTrades = Math.max(1, minCompletedCompetitions || 1);
      break;
    case "max_drawdown_under":
      baseStats.maxDrawdown = Math.min(numericValue - 5, 10);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;
    case "average_leverage_low":
      baseStats.averagePositionSize = 0.5;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 20);
      break;
    case "average_loss_small":
      baseStats.averageLoss = 25;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;
    case "risk_discipline":
      baseStats.alwaysUsesSL = true;
      baseStats.alwaysUsesTP = true;
      baseStats.liquidationCount = 0;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      baseStats.completedCompetitionsWithTrades = Math.max(5, minCompletedCompetitions || 5);
      break;
    case "sharpe_ratio_high":
      baseStats.sharpeRatio = 3;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;
    case "low_volatility":
      baseStats.profitVolatility = 50;
      baseStats.winRate = 60;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;
    case "optimal_position_sizing":
      baseStats.averagePositionSize = 1;
      baseStats.liquidationCount = 0;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;
    case "strategy_diversity":
      baseStats.uniqueStrategiesUsed = 6;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;
    case "balanced_risk_reward":
      baseStats.profitFactor = 2;
      baseStats.winRate = 52;
      break;
    case "low_return_variance":
      baseStats.profitVolatility = 100;
      baseStats.winRate = 55;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;
    case "predictable_results":
      baseStats.profitVolatility = 80;
      baseStats.winRate = 60;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 75);
      break;
    case "exceptional_dd_control":
      baseStats.maxDrawdown = 3;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      baseStats.completedCompetitionsWithTrades = 5;
      break;
    case "hedging_strategy":
      baseStats.alwaysUsesSL = true;
      baseStats.uniquePairsTraded = 5;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;

    // Strategy detection
    case "trend_following":
      baseStats.winRate = 55;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;
    case "counter_trend":
      baseStats.winRate = 50;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 40);
      break;
    case "breakout_trading":
      baseStats.winRate = 48;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 35);
      break;
    case "range_trading":
      baseStats.winRate = 56;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 40);
      break;
    case "momentum_trading":
      baseStats.winRate = 50;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 25);
      break;
    case "mean_reversion":
      baseStats.winRate = 55;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;
    case "multiple_strategies":
      baseStats.uniqueStrategiesUsed = 4;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;

    // Speed conditions
    case "fast_order_execution":
      baseStats.averageTradeDuration = 3;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 20);
      break;
    case "trades_under_1_minute":
      baseStats.tradesUnder1Minute = isEq ? numericValue : numericValue + 5;
      break;
    case "trades_under_5_minutes":
      baseStats.tradesUnder5Minutes = isEq ? numericValue : numericValue + 5;
      break;
    case "quick_scalps":
      baseStats.tradesUnder5Minutes = Math.max(55, (minTrades || 50) + 5);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;
    case "swing_trading_style":
      baseStats.tradesOver1Day = 30;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;
    case "position_trading_style":
      baseStats.tradesOver7Days = 20;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;
    case "trades_at_market_open":
    case "trades_at_open":
      baseStats.tradesAtMarketOpen = Math.max(isEq ? numericValue : numericValue + 5, 25);
      break;
    case "trades_at_market_close":
    case "trades_at_close":
      baseStats.tradesAtMarketClose = Math.max(isEq ? numericValue : numericValue + 5, 25);
      break;
    case "late_night_trader":
      baseStats.tradesAtLateNight = Math.max((minTrades || 20) + 5, 25);
      break;

    // Consistency conditions
    case "daily_trading_streak":
    case "consecutive_trading_days":
    case "active_days":
    case "active_trading_days":
      baseStats.consecutiveTradingDays = isEq ? numericValue : numericValue + 5;
      break;
    case "consecutive_profitable_days":
      baseStats.consecutiveProfitableDays = isEq ? numericValue : numericValue + 2;
      break;
    case "weekly_trading_streak":
      baseStats.weeklyTradingStreak = isEq ? numericValue : numericValue + 1;
      break;
    case "monthly_trading_streak":
      baseStats.monthlyTradingStreak = isEq ? numericValue : numericValue + 1;
      break;
    case "login_streak":
      baseStats.consecutiveTradingDays = isEq ? numericValue : numericValue + 5;
      baseStats.loginStreak = isEq ? numericValue : numericValue + 5;
      break;

    // Volume conditions
    case "max_trades_in_one_day":
    case "daily_trade_volume":
    case "single_day_trades":
      baseStats.maxTradesInOneDay = isEq ? numericValue : numericValue + 5;
      break;
    case "max_trades_in_one_week":
    case "weekly_trade_volume":
      baseStats.maxTradesInOneWeek = isEq ? numericValue : numericValue + 10;
      break;
    case "max_trades_in_one_month":
    case "monthly_trade_volume":
      baseStats.maxTradesInOneMonth = isEq ? numericValue : numericValue + 20;
      break;

    // Competition specific
    case "comeback_wins":
      baseStats.comebackWins = isEq ? numericValue : numericValue + 1;
      break;
    case "wire_to_wire_wins":
      baseStats.wireToWireWins = isEq ? numericValue : numericValue + 1;
      break;

    // No-value conditions (production uses fixed thresholds)
    case "precise_entry_timing":
      baseStats.winRate = 75;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 40);
      break;
    case "hall_of_fame_status":
      baseStats.firstPlaceFinishes = 25;
      baseStats.totalPnl = 60000;
      baseStats.competitionsEntered = Math.max(55, minCompletedCompetitions || 50);
      break;
    case "closes_all_daily":
      baseStats.tradesOver1Day = 0;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;
    case "unique_strategy":
      baseStats.profitFactor = 3.5;
      baseStats.uniquePairsTraded = 10;
      break;
    case "patient_trading":
      baseStats.averageTradeDuration = 90;
      baseStats.winRate = 60;
      break;
    case "perfect_attendance":
      baseStats.consecutiveTradingDays = 100;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 200);
      break;
    case "perfect_month":
      baseStats.consecutiveTradingDays = 35;
      baseStats.winRate = 92;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 100);
      break;
    case "epic_comeback":
      baseStats.comebackWins = 5;
      baseStats.totalPnl = Math.max(baseStats.totalPnl!, 5000);
      break;
    case "perfect_year":
      baseStats.consecutiveTradingDays = 370;
      baseStats.totalPnl = 5000;
      baseStats.winRate = 60;
      break;

    // Social & Community
    case "referrals_made":
      baseStats.referralsMade = isEq ? numericValue : numericValue + 2;
      break;
    case "referrals_active":
      baseStats.referralsActive = isEq ? numericValue : numericValue + 2;
      break;
    case "friends_added":
      baseStats.friendsAdded = isEq ? numericValue : numericValue + 3;
      break;
    case "messages_sent":
      baseStats.messagesSent = isEq ? numericValue : numericValue + 10;
      break;

    // Risk management additional
    case "stop_loss_used":
      baseStats.tradesWithSL = Math.max(baseStats.tradesWithSL || 0, value || 1);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;
    case "take_profit_used":
      baseStats.tradesWithTP = Math.max(baseStats.tradesWithTP || 0, value || 1);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;
    case "position_size_under":
      baseStats.averagePositionSize = Math.min(numericValue - 1, 1);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;

    // Competition placement
    case "second_place_finishes":
      baseStats.secondPlaceFinishes = isEq ? numericValue : numericValue + 2;
      break;
    case "third_place_finishes":
      baseStats.thirdPlaceFinishes = isEq ? numericValue : numericValue + 1;
      break;
    case "top_10_finishes":
      baseStats.top10Finishes = isEq ? numericValue : numericValue + 5;
      break;
    case "top_50_percent_finishes":
      baseStats.top50PercentFinishes = isEq ? numericValue : numericValue + 5;
      break;
    case "competitions_completed":
      baseStats.completedCompetitions = isEq ? numericValue : numericValue + 3;
      break;
    case "competition_pnl":
      baseStats.competitionPnl = isEq ? numericValue : numericValue + 500;
      break;

    // Progression & XP
    case "level_reached":
      baseStats.currentLevel = isEq ? numericValue : numericValue + 2;
      break;
    case "xp_threshold":
      baseStats.currentXP = isEq ? numericValue : numericValue + 500;
      break;
    case "xp_earned_today":
      baseStats.xpEarnedToday = isEq ? numericValue : numericValue + 50;
      break;
    case "xp_earned_this_week":
      baseStats.xpEarnedThisWeek = isEq ? numericValue : numericValue + 100;
      break;
    case "total_badges":
      baseStats.totalBadgesEarned = isEq ? numericValue : numericValue + 5;
      break;

    // Account & milestone
    case "account_created": break;
    case "has_deposit":
      baseStats.totalDeposited = 100;
      break;
    case "profile_complete":
      baseStats.totalDeposited = 100;
      break;
    case "first_trade":
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, 1);
      break;
    case "losing_trades":
      baseStats.losingTrades = isEq ? numericValue : numericValue + 5;
      break;
    case "risk_reward_ratio":
      baseStats.averageWin = 80;
      baseStats.averageLoss = 30;
      break;

    // Time-based
    case "trades_today":
      baseStats.maxTradesInOneDay = isEq ? numericValue : numericValue + 5;
      break;
    case "trades_this_week":
      baseStats.maxTradesInOneWeek = isEq ? numericValue : numericValue + 10;
      break;
    case "trades_this_month":
      baseStats.maxTradesInOneMonth = isEq ? numericValue : numericValue + 20;
      break;
    case "different_assets_traded":
      baseStats.uniquePairsTraded = isEq ? numericValue : numericValue + 3;
      break;

    // Performance
    case "max_win_streak":
      baseStats.maxWinStreak = isEq ? numericValue : numericValue + 3;
      break;
    case "best_trade_pnl":
    case "best_single_trade":
      baseStats.bestSingleTrade = isEq ? numericValue : numericValue + 100;
      break;
    case "average_trade_pnl":
    case "average_win":
      baseStats.averageWin = isEq ? numericValue : numericValue + 20;
      break;

    // Speed
    case "ninja_trading":
      baseStats.tradesUnder5Minutes = 25;
      baseStats.winRate = 65;
      break;
    case "trades_all_hours":
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 100);
      baseStats.uniquePairsTraded = 6;
      break;
    case "ultra_fast_execution":
      baseStats.tradesUnder1Minute = 10;
      break;

    // Competition additional
    case "survived_full_competition":
      baseStats.completedCompetitionsWithTrades = Math.max(1, minCompletedCompetitions || 1);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      baseStats.liquidationCount = 0;
      break;
    case "first_trade_in_comp":
      baseStats.totalTrades = Math.max(1, baseStats.totalTrades!);
      baseStats.competitionsEntered = Math.max(1, baseStats.competitionsEntered!);
      break;
    case "beat_top_trader":
      baseStats.firstPlaceFinishes = Math.max(1, baseStats.firstPlaceFinishes!);
      baseStats.competitionsEntered = Math.max(5, baseStats.competitionsEntered!);
      break;
    case "underdog_win":
      baseStats.firstPlaceFinishes = Math.max(1, baseStats.firstPlaceFinishes!);
      baseStats.averageRoi = 30;
      break;
    case "comeback_victory":
      baseStats.comebackWins = Math.max(1, baseStats.comebackWins!);
      break;
    case "wire_to_wire_win":
      baseStats.wireToWireWins = Math.max(1, baseStats.wireToWireWins!);
      break;

    default:
      break;
  }

  return baseStats;
}

// ─── FIX HANDLER ─────────────────────────────────────────────────────────
async function handleFixAction(body: any) {
  const { badgeId, suggestedFix, fixAll, fixes } = body;

  if (fixAll && Array.isArray(fixes)) {
    let fixed = 0;
    let errors = 0;

    for (const fix of fixes) {
      try {
        const updateDoc: Record<string, any> = {};
        for (const [key, val] of Object.entries(fix.suggestedFix)) {
          updateDoc[key] = val;
        }
        await BadgeConfig.findOneAndUpdate(
          { id: fix.badgeId },
          { $set: updateDoc }
        );
        fixed++;
      } catch (err) {
        errors++;
        console.error(`Error fixing badge ${fix.badgeId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixed} badges${errors > 0 ? `, ${errors} errors` : ""}`,
      fixed,
      errors,
    });
  }

  if (!badgeId || !suggestedFix) {
    return NextResponse.json(
      { success: false, error: "badgeId and suggestedFix are required" },
      { status: 400 }
    );
  }

  try {
    const updateDoc: Record<string, any> = {};
    for (const [key, val] of Object.entries(suggestedFix)) {
      updateDoc[key] = val;
    }

    const result = await BadgeConfig.findOneAndUpdate(
      { id: badgeId },
      { $set: updateDoc },
      { new: true }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: `Badge "${badgeId}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Badge "${badgeId}" fixed successfully`,
      badge: { id: result.id, condition: result.condition },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ─── POST HANDLER ────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    
    const body = await request.json().catch(() => ({}));
    const { 
      badgeId,
      includeFailTests = false,
      category,
      action,
    } = body;

    // Handle fix actions
    if (action === "fix") {
      return handleFixAction(body);
    }

    // Load all badges from database
    const query: Record<string, unknown> = { isActive: true };
    if (badgeId) query.id = badgeId;
    if (category) query.category = category;

    const badges = await BadgeConfig.find(query).lean();

    if (badges.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No badges found to test",
      }, { status: 404 });
    }

    const results: BadgeTestResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let issueCount = 0;
    let autoFixableCount = 0;

    for (const badgeDoc of badges) {
      const badge: Badge = {
        id: badgeDoc.id,
        name: badgeDoc.name,
        description: badgeDoc.description,
        category: badgeDoc.category as Badge["category"],
        icon: badgeDoc.icon as Badge["icon"],
        rarity: badgeDoc.rarity as Badge["rarity"],
        condition: {
          type: badgeDoc.condition?.type || "",
          value: badgeDoc.condition?.value,
          comparison: badgeDoc.condition?.comparison as "gte" | "lte" | "eq" | undefined,
          minTrades: badgeDoc.condition?.minTrades,
          minCompletedCompetitions: badgeDoc.condition?.minCompletedCompetitions,
        },
      };

      // Validate badge configuration
      const validation = validateBadgeInput(badgeDoc);
      if (validation.issues.length > 0) issueCount += validation.issues.length;
      if (validation.autoFixable) autoFixableCount++;

      // Generate mock stats and test
      const mockStats = generateMockStatsForBadge(badge);
      const startTime = Date.now();
      
      let actual = false;
      let reason = "";
      
      try {
        actual = await checkBadgeCondition(badge, mockStats as UserStats);
        
        if (actual) {
          reason = "Badge condition correctly evaluated to TRUE with valid stats";
        } else {
          reason = `Badge condition evaluated to FALSE when it should be TRUE. ` +
            `Condition type: ${badge.condition.type}, ` +
            `Expected value: ${badge.condition.value ?? "N/A"}, ` +
            `Comparison: ${badge.condition.comparison ?? "gte"}`;
        }
      } catch (error) {
        reason = `Error during evaluation: ${error instanceof Error ? error.message : "Unknown error"}`;
      }

      const duration = Date.now() - startTime;
      const passed = actual === true;

      if (passed) passedCount++;
      else failedCount++;

      const testResult: BadgeTestResult = {
        badgeId: badge.id,
        badgeName: badge.name,
        category: badge.category,
        rarity: badge.rarity,
        condition: badge.condition,
        mockStats,
        expected: true,
        actual,
        passed,
        reason,
        friendlyMessage: "",
        friendlyIssues: [],
        duration,
        issues: validation.issues,
        autoFixable: validation.autoFixable,
        suggestedFix: validation.suggestedFix,
      };

      // Generate friendly messages
      testResult.friendlyMessage = getUserFriendlyMessage(testResult);
      testResult.friendlyIssues = validation.issues.map(getIssueMessage);

      results.push(testResult);

      // Optional fail test
      if (includeFailTests) {
        const failingStats = generateFailingMockStats(badge);
        const startTime2 = Date.now();
        
        let actualFail = false;
        let reasonFail = "";
        
        try {
          actualFail = await checkBadgeCondition(badge, failingStats as UserStats);
          
          if (!actualFail) {
            reasonFail = "Badge condition correctly evaluated to FALSE with invalid stats";
          } else {
            reasonFail = "Badge condition evaluated to TRUE when it should be FALSE (zero-baseline issue?)";
          }
        } catch (error) {
          reasonFail = `Error during evaluation: ${error instanceof Error ? error.message : "Unknown error"}`;
        }

        const duration2 = Date.now() - startTime2;
        const passedFail = actualFail === false;

        if (passedFail) passedCount++;
        else failedCount++;

        results.push({
          badgeId: badge.id + "_fail_test",
          badgeName: badge.name + " (Fail Test)",
          category: badge.category,
          rarity: badge.rarity,
          condition: badge.condition,
          mockStats: failingStats,
          expected: false,
          actual: actualFail,
          passed: passedFail,
          reason: reasonFail,
          friendlyMessage: passedFail
            ? "Negative test passed correctly."
            : "This badge incorrectly awards with zero/minimal stats. The minimum requirements may be too low.",
          friendlyIssues: [],
          duration: duration2,
          issues: [],
          autoFixable: false,
        });
      }
    }

    // Generate report
    const failedResults = results.filter(r => !r.passed);
    const issueResults = results.filter(r => r.issues.length > 0 && r.passed);
    let report = "BADGE SIMULATOR REPORT\n";
    report += "═══════════════════════\n";
    report += `Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount} | Issues: ${issueCount}\n`;
    report += `Auto-fixable: ${autoFixableCount}\n\n`;

    if (failedResults.length > 0 || issueResults.length > 0) {
      report += "ISSUES FOUND:\n─────────────\n\n";
      for (const r of [...failedResults, ...issueResults]) {
        const status = !r.passed ? "FAIL" : "WARN";
        report += `[${status}] ${r.badgeName} (${r.condition.type})\n`;
        report += `  Category: ${r.category} | Rarity: ${r.rarity}\n`;
        report += `  Condition: ${r.condition.type} ${r.condition.comparison || "gte"} ${r.condition.value ?? "N/A"}`;
        if (r.condition.minTrades) report += ` (minTrades: ${r.condition.minTrades})`;
        report += "\n";
        report += `  Status: ${r.friendlyMessage}\n`;
        if (r.friendlyIssues.length > 0) {
          for (const issue of r.friendlyIssues) {
            report += `  • ${issue}\n`;
          }
        }
        report += "\n";
      }
    } else {
      report += "All badges passed! No issues found.\n";
    }

    // Reason: Object.create(null) prevents prototype pollution via keys like "__proto__"
    const byCategory: Record<string, { passed: number; failed: number; total: number; issues: number }> = Object.create(null);
    for (const result of results) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = { passed: 0, failed: 0, total: 0, issues: 0 };
      }
      byCategory[result.category].total++;
      if (result.passed) byCategory[result.category].passed++;
      else byCategory[result.category].failed++;
      byCategory[result.category].issues += result.issues.length;
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        passRate: ((passedCount / results.length) * 100).toFixed(1) + "%",
        issues: issueCount,
        autoFixable: autoFixableCount,
        byCategory,
      },
      results,
      report,
    });

  } catch (error) {
    console.error("Badge simulator error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

// ─── FAILING MOCK STATS ─────────────────────────────────────────────────
function generateFailingMockStats(badge: Badge): Partial<UserStats> {
  const { condition } = badge;
  const { minTrades = 0, minCompletedCompetitions = 0 } = condition;

  const failingStats: Partial<UserStats> = {
    userId: "test-user-simulator-fail",
    totalTrades: 0,
    completedCompetitionsWithTrades: 0,
    completedCompetitions: 0,
    liquidationCount: 5,
    alwaysUsesSL: false,
    alwaysUsesTP: false,
    tradesWithSL: 0,
    tradesWithTP: 0,
    kycVerified: false,
    totalDeposited: 0,
    totalWithdrawn: 0,
    accountAge: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    totalPnl: -500,
    profitFactor: 0.5,
    maxWinStreak: 0,
    currentWinStreak: 0,
    maxDrawdown: 80,
    uniquePairsTraded: 0,
    competitionsEntered: 0,
    firstPlaceFinishes: 0,
    podiumFinishes: 0,
    totalWins: 0,
    averageRoi: -10,
    bestSingleTrade: 0,
    sharpeRatio: 0,
    profitVolatility: 500,
    averagePositionSize: 10,
    uniqueStrategiesUsed: 0,
    consecutiveProfitableDays: 0,
    consecutiveTradingDays: 0,
    globalRank: 10000,
    slTriggeredCount: 0,
    tpTriggeredCount: 0,
    depositCount: 0,
    withdrawalCount: 0,
  };

  if (minTrades > 0) failingStats.totalTrades = minTrades - 1;
  if (minCompletedCompetitions > 0) failingStats.completedCompetitionsWithTrades = minCompletedCompetitions - 1;

  return failingStats;
}

export async function GET() {
  try {
    await connectToDatabase();
    
    const badges = await BadgeConfig.find({ isActive: true })
      .select("id name category rarity condition")
      .lean();

    const categories = [...new Set(badges.map(b => b.category))];

    return NextResponse.json({
      success: true,
      totalBadges: badges.length,
      categories,
      badges: badges.map(b => ({
        id: b.id,
        name: b.name,
        category: b.category,
        rarity: b.rarity,
        conditionType: b.condition?.type,
      })),
    });

  } catch (error) {
    console.error("Badge simulator GET error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
