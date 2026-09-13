/**
 * Badge Condition Description Utility
 * Maps badge condition types to human-readable requirement descriptions
 * Used for badge detail cards to show users exactly what they need to do
 */

import type { Badge } from "@/lib/constants/badges";

interface BadgeRequirement {
  /** Short description of what the user needs to do */
  requirement: string;
  /** The specific stat/metric name to track */
  statLabel: string;
  /** The target value needed */
  targetValue: number | string;
  /** Additional requirements (minTrades, minComps, etc.) */
  extras: string[];
  /** Category-specific tip for the user */
  tip?: string;
}

/**
 * Get human-readable requirement description for a badge condition
 */
export function getBadgeRequirement(badge: Badge): BadgeRequirement {
  const { condition } = badge;
  const { type, value, comparison, minTrades, minCompletedCompetitions } = condition;

  const extras: string[] = [];
  if (minTrades) extras.push(`${minTrades}+ total trades required`);
  if (minCompletedCompetitions) extras.push(`${minCompletedCompetitions}+ competitions completed`);

  // Rarity tier requirements
  const tierReqs: Record<string, { trades: number; competitions: number }> = {
    common: { trades: 5, competitions: 0 },
    rare: { trades: 25, competitions: 1 },
    epic: { trades: 50, competitions: 3 },
    legendary: { trades: 100, competitions: 5 },
  };
  const tier = tierReqs[badge.rarity];
  if (tier) {
    const effectiveMinTrades = Math.max(minTrades || 0, tier.trades);
    const effectiveMinComps = Math.max(minCompletedCompetitions || 0, tier.competitions);
    if (effectiveMinTrades > (minTrades || 0)) {
      extras.push(`${effectiveMinTrades}+ total trades (${badge.rarity} tier)`);
    }
    if (effectiveMinComps > (minCompletedCompetitions || 0)) {
      extras.push(`${effectiveMinComps}+ competitions completed (${badge.rarity} tier)`);
    }
  }

  const compLabel = (n: number) => `${n} competition${n > 1 ? "s" : ""}`;
  const tradeLabel = (n: number) => `${n} trade${n > 1 ? "s" : ""}`;

  switch (type) {
    // Competition
    case "competitions_entered":
      return { requirement: `Join ${value} competition${(value || 1) > 1 ? "s" : ""}`, statLabel: "Competitions Entered", targetValue: value || 1, extras };
    case "first_place_finishes":
      return { requirement: `Win 1st place in ${compLabel(value || 1)}`, statLabel: "1st Place Finishes", targetValue: value || 1, extras, tip: "Win competitions by having the highest P&L" };
    case "podium_finishes":
      return { requirement: `Finish top 3 in ${compLabel(value || 1)}`, statLabel: "Podium Finishes", targetValue: value || 1, extras };
    case "perfect_competition_win_rate":
      return { requirement: "Win every competition you enter", statLabel: "Win Rate", targetValue: "100%", extras, tip: "Must have completed at least 3 competitions" };
    case "comeback_victory":
      return { requirement: "Win a competition after being behind", statLabel: "Comeback Wins", targetValue: 1, extras, tip: "Win despite having losing trades" };
    case "wire_to_wire_win":
      return { requirement: "Lead a competition from start to finish", statLabel: "Wire-to-Wire Wins", targetValue: 1, extras, tip: "Win with 80%+ win rate" };
    case "beat_top_trader":
      return { requirement: "Beat a top-ranked trader in competition", statLabel: "Competitions Won", targetValue: 1, extras };
    case "underdog_win":
      return { requirement: "Win a competition as an underdog", statLabel: "Underdog Wins", targetValue: 1, extras };
    case "perfect_competition_trades":
      return { requirement: "Win every trade in a competition (10+ trades)", statLabel: "Perfect Competitions", targetValue: 1, extras };
    case "survived_full_competition":
      return { requirement: "Complete a full competition without liquidation", statLabel: "Competitions Survived", targetValue: 1, extras };
    case "first_trade_in_comp":
      return { requirement: "Be the first to trade in a competition", statLabel: "First Trades in Comp", targetValue: 1, extras };
    case "late_night_trader":
      return { requirement: `Place ${value || 20}+ trades between 10PM-6AM UTC`, statLabel: "Late Night Trades", targetValue: value || 20, extras };

    // Trading Volume
    case "total_trades":
      return { requirement: `Place ${value} total trades`, statLabel: "Total Trades", targetValue: value || 1, extras };
    case "daily_trade_volume":
      return { requirement: `Place ${value}+ trades in a single day`, statLabel: "Max Daily Trades", targetValue: value || 1, extras };
    case "single_day_trades":
      return { requirement: `Place ${value}+ trades in one day`, statLabel: "Best Day Trades", targetValue: value || 1, extras };
    case "weekly_trade_volume":
      return { requirement: `Place ${value}+ trades in a single week`, statLabel: "Max Weekly Trades", targetValue: value || 1, extras };
    case "monthly_trade_volume":
      return { requirement: `Place ${value}+ trades in a single month`, statLabel: "Max Monthly Trades", targetValue: value || 1, extras };
    case "unique_pairs_traded":
      return { requirement: `Trade ${value}+ different currency pairs`, statLabel: "Unique Pairs", targetValue: value || 1, extras };
    case "single_pair_focus":
      return { requirement: `Place 100+ trades on a single pair`, statLabel: "Focus Trades", targetValue: 100, extras, tip: "Master one pair with 100+ trades" };

    // Profit
    case "winning_trades":
      return { requirement: `Win ${tradeLabel(value || 1)}`, statLabel: "Winning Trades", targetValue: value || 1, extras };
    case "total_pnl_positive":
      return { requirement: "Achieve positive total P&L", statLabel: "Total P&L", targetValue: "> $0", extras };
    case "total_pnl":
      return { requirement: `Reach $${(value || 0).toLocaleString()} total profit`, statLabel: "Total P&L", targetValue: `$${(value || 0).toLocaleString()}`, extras };
    case "single_trade_profit":
      return { requirement: `Earn $${value}+ from a single trade`, statLabel: "Best Trade", targetValue: `$${value}`, extras };
    case "win_streak":
      return { requirement: `Win ${value} trades in a row`, statLabel: "Max Win Streak", targetValue: value || 1, extras };
    case "average_roi":
      return { requirement: `Achieve ${value}%+ average ROI`, statLabel: "Average ROI", targetValue: `${value}%`, extras };
    case "profit_factor":
      return { requirement: `Achieve ${value}+ profit factor`, statLabel: "Profit Factor", targetValue: `${value}x`, extras, tip: "Profit Factor = Gross Profit / Gross Loss" };
    case "win_rate":
      return { requirement: `Maintain ${value}%+ win rate`, statLabel: "Win Rate", targetValue: `${value}%`, extras };
    case "consecutive_profitable_days":
      return { requirement: `Be profitable for ${value} consecutive days`, statLabel: "Profitable Days", targetValue: value || 7, extras };
    case "drawdown_recovery":
      return { requirement: "Recover from a losing streak to profitability", statLabel: "Recovery", targetValue: "Yes", extras };

    // Risk
    case "no_liquidations":
      return { requirement: "Trade without getting liquidated", statLabel: "Liquidations", targetValue: "0", extras, tip: "Complete competitions with 5+ trades each" };
    case "zero_liquidations_lifetime":
      return { requirement: "Never get liquidated in your entire career", statLabel: "Lifetime Liquidations", targetValue: "0", extras };
    case "max_drawdown":
      return { requirement: `Keep max drawdown under ${value}%`, statLabel: "Max Drawdown", targetValue: `≤${value}%`, extras };
    case "average_loss_small":
      return { requirement: "Keep average loss below $50", statLabel: "Average Loss", targetValue: "< $50", extras };
    case "always_uses_sl":
      return { requirement: "Use stop loss on every trade", statLabel: "SL Usage", targetValue: "100%", extras, tip: "At least 3 stop losses must have triggered" };
    case "always_uses_tp":
      return { requirement: "Use take profit on every trade", statLabel: "TP Usage", targetValue: "100%", extras, tip: "At least 3 take profits must have triggered" };
    case "risk_discipline":
      return { requirement: "Always use SL & TP, never get liquidated", statLabel: "Discipline", targetValue: "Perfect", extras };
    case "average_leverage_low":
      return { requirement: "Use conservative position sizing", statLabel: "Avg Position Size", targetValue: "≤1x", extras };
    case "balanced_risk_reward":
      return { requirement: "Maintain 1.5+ profit factor with 45-60% win rate", statLabel: "Risk/Reward", targetValue: "Balanced", extras };
    case "sharpe_ratio_high":
      return { requirement: "Achieve 2.0+ Sharpe ratio", statLabel: "Sharpe Ratio", targetValue: "≥2.0", extras };
    case "low_volatility":
      return { requirement: "Trade with low profit volatility and 55%+ win rate", statLabel: "Volatility", targetValue: "Low", extras };
    case "optimal_position_sizing":
      return { requirement: "Use smart position sizing with no liquidations", statLabel: "Position Sizing", targetValue: "Optimal", extras };
    case "strategy_diversity":
      return { requirement: "Trade 5+ different pairs with diverse strategies", statLabel: "Strategies Used", targetValue: "5+", extras };
    case "hedging_strategy":
      return { requirement: "Use hedging with stop losses on 3+ pairs", statLabel: "Hedging", targetValue: "Active", extras };
    case "exceptional_dd_control":
      return { requirement: "Keep max drawdown under 5%", statLabel: "Max Drawdown", targetValue: "≤5%", extras };

    // Speed
    case "fast_order_execution":
      return { requirement: "Execute 10+ trades under 5 minutes", statLabel: "Fast Trades", targetValue: "10+", extras };
    case "ultra_fast_execution":
      return { requirement: "Execute 5+ trades under 1 minute", statLabel: "Ultra-Fast Trades", targetValue: "5+", extras };
    case "quick_scalps":
      return { requirement: `Execute ${value || 50}+ sub-5-minute scalps`, statLabel: "Quick Scalps", targetValue: value || 50, extras };
    case "closes_all_daily":
      return { requirement: "Close all trades within the same day", statLabel: "Overnight Trades", targetValue: "0", extras };
    case "swing_trading_style":
      return { requirement: `Hold ${value || 15}+ trades for more than 1 day`, statLabel: "Multi-Day Trades", targetValue: value || 15, extras };
    case "position_trading_style":
      return { requirement: `Hold ${value || 10}+ trades for over a week`, statLabel: "Week+ Trades", targetValue: value || 10, extras };
    case "precise_entry_timing":
      return { requirement: "Achieve 70%+ win rate with precise entries", statLabel: "Win Rate", targetValue: "≥70%", extras };
    case "ninja_trading":
      return { requirement: "Execute 20+ quick trades with 60%+ win rate", statLabel: "Ninja Trades", targetValue: "20+", extras };
    case "patient_trading":
      return { requirement: "Average trade duration 60+ minutes with 55%+ win rate", statLabel: "Avg Duration", targetValue: "60+ min", extras };
    case "trades_at_open":
      return { requirement: `Place ${value || 20}+ trades at market open`, statLabel: "Market Open Trades", targetValue: value || 20, extras };
    case "trades_at_close":
      return { requirement: `Place ${value || 20}+ trades at market close`, statLabel: "Market Close Trades", targetValue: value || 20, extras };
    case "trades_all_hours":
      return { requirement: "Trade across all hours on 5+ pairs", statLabel: "24/7 Trading", targetValue: "Active", extras };

    // Consistency
    case "daily_trading_streak":
      return { requirement: `Trade for ${value} consecutive days`, statLabel: "Daily Streak", targetValue: `${value} days`, extras };
    case "weekly_trading_streak":
      return { requirement: `Trade for ${value} consecutive weeks`, statLabel: "Weekly Streak", targetValue: `${value} weeks`, extras };
    case "monthly_trading_streak":
      return { requirement: `Trade for ${value} consecutive months`, statLabel: "Monthly Streak", targetValue: `${value} months`, extras };
    case "low_return_variance":
      return { requirement: "Maintain stable returns with 50%+ win rate", statLabel: "Stability", targetValue: "Consistent", extras };
    case "predictable_results":
      return { requirement: "Achieve predictable results with 55%+ win rate", statLabel: "Predictability", targetValue: "High", extras };
    case "perfect_attendance":
      return { requirement: "Trade every day for 90+ consecutive days", statLabel: "Streak", targetValue: "90+ days", extras };

    // Strategy
    case "trend_following":
      return { requirement: "Follow market trends with 50%+ win rate", statLabel: "Trend Trading", targetValue: "Active", extras };
    case "counter_trend":
      return { requirement: "Trade reversals with 45%+ win rate", statLabel: "Counter-Trend", targetValue: "Active", extras };
    case "breakout_trading":
      return { requirement: "Catch breakouts with $300+ best trade", statLabel: "Best Breakout", targetValue: "$300+", extras };
    case "range_trading":
      return { requirement: "Trade ranges with 55%+ win rate", statLabel: "Range Trading", targetValue: "Active", extras };
    case "momentum_trading":
      return { requirement: "Ride momentum with 5+ win streak", statLabel: "Max Streak", targetValue: "5+", extras };
    case "mean_reversion":
      return { requirement: "Trade mean reversion with 50%+ win rate", statLabel: "Mean Reversion", targetValue: "Active", extras };
    case "news_trading":
      return { requirement: "Trade 10+ times at market open", statLabel: "News Trades", targetValue: "10+", extras };
    case "technical_analysis":
      return { requirement: "Use take profit on all trades (TA-focused)", statLabel: "TP Usage", targetValue: "100%", extras };
    case "multiple_strategies":
      return { requirement: "Trade 5+ pairs with 100+ trades", statLabel: "Strategies", targetValue: "5+", extras };
    case "unique_strategy":
      return { requirement: "Achieve 3+ profit factor on 8+ pairs", statLabel: "Unique Style", targetValue: "3+ PF", extras };

    // Social
    case "first_deposit":
      return { requirement: "Make your first deposit", statLabel: "Deposits", targetValue: "1+", extras: [] };
    case "total_deposited":
      return { requirement: `Deposit ${value}+ credits total`, statLabel: "Total Deposited", targetValue: `${value}+ credits`, extras };
    case "total_deposits":
      return { requirement: `Make ${value}+ deposits`, statLabel: "Deposit Count", targetValue: value || 1, extras };
    case "total_withdrawals":
      return { requirement: `Make ${value}+ withdrawals`, statLabel: "Withdrawals", targetValue: value || 1, extras };
    case "large_withdrawal":
      return { requirement: "Withdraw 500+ credits at once", statLabel: "Largest Withdrawal", targetValue: "500+", extras };
    case "net_profit_lifetime":
      return { requirement: "Withdraw more than you deposited", statLabel: "Net Profit", targetValue: "Positive", extras, tip: "Total withdrawals must exceed total deposits" };
    case "platform_age":
      return { requirement: `Be active for ${value}+ days`, statLabel: "Account Age", targetValue: `${value} days`, extras };
    case "early_adopter":
      return { requirement: "Be among the first platform users", statLabel: "Account Age", targetValue: "30+ days", extras };
    case "kyc_verified":
      return { requirement: "Complete KYC verification", statLabel: "KYC Status", targetValue: "Verified", extras: [] };
    case "first_trade":
      return { requirement: "Place your first trade", statLabel: "Total Trades", targetValue: "1+", extras: [] };

    // Global rank
    case "global_rank":
      if (comparison === "eq") return { requirement: `Reach Global Rank #${value}`, statLabel: "Global Rank", targetValue: `#${value}`, extras };
      return { requirement: `Reach Top ${value} globally`, statLabel: "Global Rank", targetValue: `Top ${value}`, extras };

    // Legendary
    case "undefeated_in_comps":
      return { requirement: "Win every competition you enter (10+ competitions)", statLabel: "Win Rate", targetValue: "100%", extras };
    case "all_legendary_badges":
      return { requirement: "Earn nearly all legendary badges", statLabel: "Legendary Badges", targetValue: "All", extras };
    case "perfect_month":
      return { requirement: "Trade for 30 days straight with 90%+ win rate", statLabel: "Perfect Month", targetValue: "30 days", extras };
    case "epic_comeback":
      return { requirement: "Win 3+ comebacks with $5,000+ total profit", statLabel: "Comebacks", targetValue: "3+", extras };
    case "perfect_year":
      return { requirement: "Trade every day for a year with positive P&L", statLabel: "Perfect Year", targetValue: "365 days", extras };
    case "hall_of_fame_status":
      return { requirement: "Win 20+ competitions with $50,000+ profit", statLabel: "Hall of Fame", targetValue: "Elite", extras };

    default:
      return { requirement: type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), statLabel: "Progress", targetValue: value || 1, extras };
  }
}

/**
 * Get the XP reward for a badge based on its rarity
 */
export function getBadgeXP(rarity: string): number {
  const XP_VALUES: Record<string, number> = {
    common: 10,
    rare: 25,
    epic: 50,
    legendary: 100,
  };
  return XP_VALUES[rarity] || 10;
}

/**
 * Get rarity description for display
 */
export function getRarityDescription(rarity: string): string {
  const descriptions: Record<string, string> = {
    common: "Achievable by active traders",
    rare: "Requires dedication and skill",
    epic: "Only the most skilled traders earn this",
    legendary: "The ultimate achievement - extremely rare",
  };
  return descriptions[rarity] || "";
}
