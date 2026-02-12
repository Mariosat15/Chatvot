import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import BadgeConfig from "@/database/models/badge-config.model";
import { 
  checkBadgeCondition, 
  UserStats 
} from "@/lib/services/badge-evaluation.service";
import { Badge } from "@/lib/constants/badges";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max for testing all badges

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
  duration: number;
}

/**
 * Generate mock stats that SHOULD pass for a given badge condition
 * This creates stats that exceed the requirements
 */
function generateMockStatsForBadge(badge: Badge): Partial<UserStats> {
  const { condition } = badge;
  const { type, value = 1, minTrades = 0, minCompletedCompetitions = 0 } = condition;

  // Base stats that satisfy minimum requirements
  const baseStats: Partial<UserStats> = {
    userId: "test-user-simulator",
    totalTrades: Math.max(100, minTrades + 50),
    completedCompetitionsWithTrades: Math.max(10, minCompletedCompetitions + 5),
    completedCompetitions: Math.max(10, minCompletedCompetitions + 5),
    liquidationCount: 0,
    alwaysUsesSL: true,
    alwaysUsesTP: true,
    kycVerified: true,
    totalDeposited: 1000,
    totalWithdrawn: 500,
    withdrawalCount: 5, // 5 completed withdrawals (for total_withdrawals badge)
    accountAge: 365,
    winningTrades: 60,
    losingTrades: 40,
    winRate: 60,
    totalPnl: 5000,
    profitFactor: 2.0,
    maxWinStreak: 10,
    currentWinStreak: 5,
    maxDrawdown: 10,
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
    // SL/TP trigger counts (required for always_uses_sl/always_uses_tp badges)
    slTriggeredCount: 10,
    tpTriggeredCount: 10,
    // Deposit count (required for total_deposits badge)
    depositCount: 10,
    // Social/community fields
    referralsMade: 5,
    referralsActive: 3,
    friendsAdded: 10,
    messagesSent: 50,
    loginStreak: 30,
    // Speed alias
    averageTradesDuration: 30,
  };

  // Override specific stats based on condition type to ensure they pass
  const numericValue = typeof value === "number" ? value : parseInt(value as string) || 1;

  switch (type) {
    // Competition conditions
    case "competitions_entered":
      baseStats.competitionsEntered = numericValue + 5;
      break;
    case "first_place_finishes":
      baseStats.firstPlaceFinishes = numericValue + 2;
      break;
    case "podium_finishes":
      baseStats.podiumFinishes = numericValue + 3;
      break;
    case "perfect_competition_win_rate":
      baseStats.completedCompetitions = minCompletedCompetitions || 3;
      baseStats.firstPlaceFinishes = baseStats.competitionsEntered || 10;
      break;

    // Trading volume conditions
    case "total_trades":
      baseStats.totalTrades = numericValue + 10;
      break;
    case "unique_pairs_traded":
      baseStats.uniquePairsTraded = numericValue + 2;
      break;
    case "single_pair_focus":
      baseStats.totalTrades = 150;
      baseStats.uniquePairsTraded = 2;
      break;

    // Profit conditions
    case "winning_trades":
      baseStats.winningTrades = numericValue + 5;
      break;
    case "total_pnl_positive":
      baseStats.totalPnl = 1000;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;
    case "total_pnl":
      baseStats.totalPnl = numericValue + 100;
      break;
    case "single_trade_profit":
      baseStats.bestSingleTrade = numericValue + 50;
      break;
    case "win_streak":
      baseStats.maxWinStreak = numericValue + 2;
      break;
    case "average_roi":
      baseStats.averageRoi = numericValue + 5;
      break;
    case "profit_factor":
      baseStats.profitFactor = numericValue + 0.5;
      break;
    case "win_rate":
      baseStats.winRate = numericValue + 5;
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
      baseStats.slTriggeredCount = 10; // At least 3 required
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;
    case "always_uses_tp":
      baseStats.alwaysUsesTP = true;
      baseStats.tpTriggeredCount = 10; // At least 3 required
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 50);
      break;

    // Social conditions
    case "first_deposit":
      baseStats.totalDeposited = 100;
      break;
    case "total_deposited":
      baseStats.totalDeposited = numericValue + 100;
      break;
    case "total_deposits":
      baseStats.depositCount = numericValue + 5; // Number of completed deposits
      break;
    case "withdrawal_made":
      baseStats.totalWithdrawn = 100;
      break;
    case "total_withdrawals":
      baseStats.withdrawalCount = numericValue + 2;
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
      baseStats.accountAge = numericValue + 10;
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

    // Risk management advanced
    case "max_drawdown":
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
      baseStats.winRate = 56; // production: winRate >= 55
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
      baseStats.tradesUnder1Minute = numericValue + 5;
      break;
    case "trades_under_5_minutes":
      baseStats.tradesUnder5Minutes = numericValue + 5;
      break;
    case "quick_scalps":
      baseStats.tradesUnder5Minutes = Math.max(55, (minTrades || 50) + 5); // production: >= 50
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
      baseStats.tradesAtMarketOpen = Math.max(numericValue + 5, 25); // production: >= 20
      break;
    case "trades_at_market_close":
    case "trades_at_close":
      baseStats.tradesAtMarketClose = Math.max(numericValue + 5, 25); // production: >= 20
      break;
    case "late_night_trader":
      baseStats.tradesAtLateNight = Math.max((minTrades || 20) + 5, 25); // production: >= (minTrades || 20)
      break;

    // Consistency conditions
    case "daily_trading_streak":
    case "consecutive_trading_days":
    case "active_days":
    case "active_trading_days":
      baseStats.consecutiveTradingDays = numericValue + 5;
      break;
    case "consecutive_profitable_days":
      baseStats.consecutiveProfitableDays = numericValue + 2;
      break;
    case "weekly_trading_streak":
      baseStats.weeklyTradingStreak = numericValue + 1;
      break;
    case "monthly_trading_streak":
      baseStats.monthlyTradingStreak = numericValue + 1;
      break;
    case "login_streak":
      baseStats.consecutiveTradingDays = numericValue + 5;
      break;

    // Volume conditions (production uses these for daily/monthly/single_day volume badges)
    case "max_trades_in_one_day":
    case "daily_trade_volume":
    case "single_day_trades":
      baseStats.maxTradesInOneDay = numericValue + 5;
      break;
    case "max_trades_in_one_week":
    case "weekly_trade_volume":
      baseStats.maxTradesInOneWeek = numericValue + 10;
      break;
    case "max_trades_in_one_month":
    case "monthly_trade_volume":
      baseStats.maxTradesInOneMonth = numericValue + 20;
      break;

    // Competition specific
    case "comeback_wins":
      baseStats.comebackWins = numericValue + 1;
      break;
    case "wire_to_wire_wins":
      baseStats.wireToWireWins = numericValue + 1;
      break;

    // Conditions with no value (production uses fixed thresholds)
    case "precise_entry_timing":
      baseStats.winRate = 75; // production: winRate >= 70 && totalTrades >= 40
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 40);
      break;
    case "hall_of_fame_status":
      baseStats.firstPlaceFinishes = 25; // production: >= 20
      baseStats.totalPnl = 60000; // production: >= 50000
      baseStats.competitionsEntered = Math.max(55, minCompletedCompetitions || 50);
      break;
    case "closes_all_daily":
      baseStats.tradesOver1Day = 0; // production: === 0 && totalTrades >= 30
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 30);
      break;
    case "unique_strategy":
      baseStats.profitFactor = 3.5; // production: >= 3
      baseStats.uniquePairsTraded = 10; // production: >= 8
      break;
    case "patient_trading":
      baseStats.averageTradeDuration = 90; // production: >= 60 minutes
      baseStats.winRate = 60; // production: >= 55
      break;
    case "perfect_attendance":
      baseStats.consecutiveTradingDays = 100; // production: >= 90
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 200);
      break;
    case "perfect_month":
      baseStats.consecutiveTradingDays = 35; // production: >= 30
      baseStats.winRate = 92; // production: >= 90
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 100);
      break;
    case "epic_comeback":
      baseStats.comebackWins = 5; // production: >= 3
      baseStats.totalPnl = Math.max(baseStats.totalPnl!, 5000); // production: >= 5000
      break;
    case "perfect_year":
      baseStats.consecutiveTradingDays = 370; // production: >= 365
      baseStats.totalPnl = 5000; // production: > 0
      baseStats.winRate = 60; // production: >= 55
      break;

    // Social & Community conditions
    case "referrals_made":
      baseStats.referralsMade = numericValue + 2;
      break;
    case "referrals_active":
      baseStats.referralsActive = numericValue + 2;
      break;
    case "friends_added":
      baseStats.friendsAdded = numericValue + 3;
      break;
    case "messages_sent":
      baseStats.messagesSent = numericValue + 10;
      break;
    case "login_streak":
      baseStats.loginStreak = numericValue + 5;
      baseStats.consecutiveTradingDays = numericValue + 5;
      break;

    // Risk management additional
    case "stop_loss_used":
      baseStats.alwaysUsesSL = true;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;
    case "take_profit_used":
      baseStats.alwaysUsesTP = true;
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;
    case "max_drawdown_under":
      baseStats.maxDrawdown = Math.min(numericValue - 5, 10);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;
    case "position_size_under":
      baseStats.averagePositionSize = Math.min(numericValue - 1, 1);
      baseStats.totalTrades = Math.max(baseStats.totalTrades!, minTrades || 10);
      break;

    // Competition placement conditions
    case "second_place_finishes":
      baseStats.secondPlaceFinishes = numericValue + 2;
      break;
    case "third_place_finishes":
      baseStats.thirdPlaceFinishes = numericValue + 1;
      break;
    case "top_10_finishes":
      baseStats.top10Finishes = numericValue + 5;
      break;
    case "top_50_percent_finishes":
      baseStats.top50PercentFinishes = numericValue + 5;
      break;
    case "competitions_completed":
      baseStats.completedCompetitions = numericValue + 3;
      break;
    case "competition_pnl":
      baseStats.competitionPnl = numericValue + 500;
      break;

    // Progression & XP conditions
    case "level_reached":
      baseStats.currentLevel = numericValue + 2;
      break;
    case "xp_threshold":
      baseStats.currentXP = numericValue + 500;
      break;
    case "xp_earned_today":
      baseStats.xpEarnedToday = numericValue + 50;
      break;
    case "xp_earned_this_week":
      baseStats.xpEarnedThisWeek = numericValue + 100;
      break;
    case "total_badges":
      baseStats.totalBadgesEarned = numericValue + 5;
      break;

    // Account & milestone conditions
    case "account_created":
      break; // Always true
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
      baseStats.losingTrades = numericValue + 5;
      break;
    case "risk_reward_ratio":
      baseStats.averageWin = 80;
      baseStats.averageLoss = 30; // Gives ~2.67 ratio
      break;

    // Additional time-based conditions
    case "trades_today":
      baseStats.maxTradesInOneDay = numericValue + 5;
      break;
    case "trades_this_week":
      baseStats.maxTradesInOneWeek = numericValue + 10;
      break;
    case "trades_this_month":
      baseStats.maxTradesInOneMonth = numericValue + 20;
      break;
    case "different_assets_traded":
      baseStats.uniquePairsTraded = numericValue + 3;
      break;

    // Additional performance conditions
    case "max_win_streak":
      baseStats.maxWinStreak = numericValue + 3;
      break;
    case "best_trade_pnl":
    case "best_single_trade":
      baseStats.bestSingleTrade = numericValue + 100;
      break;
    case "average_trade_pnl":
    case "average_win":
      baseStats.averageWin = numericValue + 20;
      break;

    // Additional speed/execution conditions
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

    // Additional competition conditions
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
      baseStats.averageRoi = 30; // production: < 50
      break;
    case "comeback_victory":
      baseStats.comebackWins = Math.max(1, baseStats.comebackWins!);
      break;
    case "wire_to_wire_win":
      baseStats.wireToWireWins = Math.max(1, baseStats.wireToWireWins!);
      break;

    default:
      // For unhandled types, keep base stats
      break;
  }

  return baseStats;
}

/**
 * Generate mock stats that should FAIL for a given badge condition
 * Used to verify negative cases work correctly
 */
function generateFailingMockStats(badge: Badge): Partial<UserStats> {
  const { condition } = badge;
  const { type, minTrades = 0, minCompletedCompetitions = 0 } = condition;

  // Base stats with minimal values that should fail most conditions
  const failingStats: Partial<UserStats> = {
    userId: "test-user-simulator-fail",
    totalTrades: 0,
    completedCompetitionsWithTrades: 0,
    completedCompetitions: 0,
    liquidationCount: 5,
    alwaysUsesSL: false,
    alwaysUsesTP: false,
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

  // Specifically ensure minimum requirements fail
  if (minTrades > 0) {
    failingStats.totalTrades = minTrades - 1;
  }
  if (minCompletedCompetitions > 0) {
    failingStats.completedCompetitionsWithTrades = minCompletedCompetitions - 1;
  }

  return failingStats;
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    
    const body = await request.json().catch(() => ({}));
    const { 
      badgeId, // Optional: test specific badge
      includeFailTests = false, // Also test that failing stats don't pass
      category, // Optional: filter by category
    } = body;

    // Load all badges from database
    const query: Record<string, unknown> = { isActive: true };
    if (badgeId) {
      query.id = badgeId;
    }
    if (category) {
      query.category = category;
    }

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

    // Test each badge
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

      // Test 1: Mock stats that SHOULD pass
      const mockStats = generateMockStatsForBadge(badge);
      const startTime = Date.now();
      
      let actual = false;
      let reason = "";
      
      try {
        actual = await checkBadgeCondition(badge, mockStats as UserStats);
        
        if (actual) {
          reason = "Badge condition correctly evaluated to TRUE with valid stats";
        } else {
          // Determine why it failed
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

      if (passed) {
        passedCount++;
      } else {
        failedCount++;
      }

      results.push({
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
        duration,
      });

      // Test 2 (optional): Mock stats that should FAIL
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
            reasonFail = `Badge condition evaluated to TRUE when it should be FALSE (zero-baseline issue?)`;
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
          duration: duration2,
        });
      }
    }

    // Group results by category
    const byCategory: Record<string, { passed: number; failed: number; total: number }> = {};
    for (const result of results) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = { passed: 0, failed: 0, total: 0 };
      }
      byCategory[result.category].total++;
      if (result.passed) {
        byCategory[result.category].passed++;
      } else {
        byCategory[result.category].failed++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        passRate: ((passedCount / results.length) * 100).toFixed(1) + "%",
        byCategory,
      },
      results,
    });

  } catch (error) {
    console.error("Badge simulator error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function GET() {
  // Return available badges and categories for UI
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
