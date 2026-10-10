/**
 * All Milestone Condition Types
 * Comprehensive list of conditions for journey milestones
 * Organized by category for multi-map variety
 */

export const MILESTONE_CONDITION_TYPES = {
  // ============================================
  // ACCOUNT & ONBOARDING CONDITIONS
  // ============================================
  ACCOUNT: {
    account_created: { label: "Account Created", description: "User has created an account", category: "account" },
    kyc_verified: { label: "KYC Verified", description: "User has completed KYC verification", category: "account" },
    profile_complete: { label: "Profile Complete", description: "User has filled out all profile fields", category: "account" },
    first_deposit: { label: "First Deposit", description: "User has made their first deposit", category: "account" },
    first_withdrawal: { label: "First Withdrawal", description: "User has made their first withdrawal", category: "account" },
    account_age_days: { label: "Account Age (Days)", description: "Number of days since account creation", category: "account", hasValue: true },
    login_streak: { label: "Login Streak", description: "Consecutive days of logging in", category: "account", hasValue: true },
    referral_count: { label: "Referral Count", description: "Number of successful referrals", category: "account", hasValue: true },
    email_verified: { label: "Email Verified", description: "User has verified their email", category: "account" },
    two_factor_enabled: { label: "2FA Enabled", description: "User has enabled two-factor authentication", category: "account" },
  },

  // ============================================
  // TRADING CONDITIONS
  // ============================================
  TRADING: {
    total_trades: { label: "Total Trades", description: "Total number of trades placed", category: "trading", hasValue: true },
    winning_trades: { label: "Winning Trades", description: "Number of profitable trades", category: "trading", hasValue: true },
    losing_trades: { label: "Losing Trades", description: "Number of losing trades", category: "trading", hasValue: true },
    win_streak: { label: "Win Streak", description: "Consecutive winning trades", category: "trading", hasValue: true },
    trades_today: { label: "Trades Today", description: "Number of trades placed today", category: "trading", hasValue: true },
    trades_this_week: { label: "Trades This Week", description: "Number of trades placed this week", category: "trading", hasValue: true },
    trades_this_month: { label: "Trades This Month", description: "Number of trades placed this month", category: "trading", hasValue: true },
    open_positions: { label: "Open Positions", description: "Number of currently open positions", category: "trading", hasValue: true },
    closed_positions: { label: "Closed Positions", description: "Number of closed positions", category: "trading", hasValue: true },
    long_positions: { label: "Long Positions", description: "Number of buy/long positions taken", category: "trading", hasValue: true },
    short_positions: { label: "Short Positions", description: "Number of sell/short positions taken", category: "trading", hasValue: true },
    average_trade_size: { label: "Average Trade Size", description: "Average position size in trades", category: "trading", hasValue: true },
    largest_trade: { label: "Largest Trade", description: "Biggest single trade size", category: "trading", hasValue: true },
    smallest_trade: { label: "Smallest Trade", description: "Smallest single trade size", category: "trading", hasValue: true },
  },

  // ============================================
  // PROFIT & PERFORMANCE CONDITIONS
  // ============================================
  PERFORMANCE: {
    total_profit: { label: "Total Profit", description: "Total profit across all trades", category: "performance", hasValue: true },
    total_loss: { label: "Total Loss", description: "Total loss across all trades", category: "performance", hasValue: true },
    win_rate: { label: "Win Rate (%)", description: "Percentage of winning trades", category: "performance", hasValue: true },
    profit_factor: { label: "Profit Factor", description: "Ratio of gross profit to gross loss", category: "performance", hasValue: true },
    max_drawdown: { label: "Max Drawdown", description: "Maximum peak-to-trough decline", category: "performance", hasValue: true },
    best_trade_profit: { label: "Best Trade Profit", description: "Largest single trade profit", category: "performance", hasValue: true },
    worst_trade_loss: { label: "Worst Trade Loss", description: "Largest single trade loss", category: "performance", hasValue: true },
    average_profit: { label: "Average Profit", description: "Average profit per winning trade", category: "performance", hasValue: true },
    average_loss: { label: "Average Loss", description: "Average loss per losing trade", category: "performance", hasValue: true },
    roi_percentage: { label: "ROI Percentage", description: "Return on investment percentage", category: "performance", hasValue: true },
    sharpe_ratio: { label: "Sharpe Ratio", description: "Risk-adjusted return metric", category: "performance", hasValue: true },
  },

  // ============================================
  // COMPETITION CONDITIONS
  // ============================================
  COMPETITION: {
    competitions_entered: { label: "Competitions Entered", description: "Total competitions joined", category: "competition", hasValue: true },
    competitions_completed: { label: "Competitions Completed", description: "Total competitions finished", category: "competition", hasValue: true },
    competition_wins: { label: "Competition Wins", description: "Number of 1st place finishes", category: "competition", hasValue: true },
    first_place_finishes: { label: "1st Place Finishes", description: "Number of 1st place finishes", category: "competition", hasValue: true },
    second_place_finishes: { label: "2nd Place Finishes", description: "Number of 2nd place finishes", category: "competition", hasValue: true },
    third_place_finishes: { label: "3rd Place Finishes", description: "Number of 3rd place finishes", category: "competition", hasValue: true },
    podium_finishes: { label: "Podium Finishes", description: "Total top 3 finishes", category: "competition", hasValue: true },
    competition_profit: { label: "Competition Profit", description: "Total profit from competitions", category: "competition", hasValue: true },
    competition_rank_average: { label: "Average Competition Rank", description: "Average finishing position", category: "competition", hasValue: true },
    competitions_in_week: { label: "Competitions This Week", description: "Competitions entered this week", category: "competition", hasValue: true },
    active_competition: { label: "Active Competition", description: "Currently in a competition", category: "competition" },
  },

  // ============================================
  // VOLUME & FINANCIAL CONDITIONS
  // ============================================
  VOLUME: {
    total_volume: { label: "Total Trading Volume", description: "Total trading volume in $", category: "volume", hasValue: true },
    volume_today: { label: "Volume Today", description: "Trading volume today", category: "volume", hasValue: true },
    volume_this_week: { label: "Volume This Week", description: "Trading volume this week", category: "volume", hasValue: true },
    volume_this_month: { label: "Volume This Month", description: "Trading volume this month", category: "volume", hasValue: true },
    deposit_amount: { label: "Total Deposited", description: "Total amount deposited", category: "volume", hasValue: true },
    withdrawal_amount: { label: "Total Withdrawn", description: "Total amount withdrawn", category: "volume", hasValue: true },
    account_balance: { label: "Account Balance", description: "Current account balance", category: "volume", hasValue: true },
    highest_balance: { label: "Highest Balance", description: "All-time high balance", category: "volume", hasValue: true },
  },

  // ============================================
  // ASSET & MARKET CONDITIONS
  // ============================================
  ASSET: {
    unique_assets_traded: { label: "Unique Assets Traded", description: "Number of different assets traded", category: "asset", hasValue: true },
    crypto_trades: { label: "Crypto Trades", description: "Trades on crypto pairs", category: "asset", hasValue: true },
    forex_trades: { label: "Forex Trades", description: "Trades on forex pairs", category: "asset", hasValue: true },
    stock_trades: { label: "Stock Trades", description: "Trades on stocks", category: "asset", hasValue: true },
    commodity_trades: { label: "Commodity Trades", description: "Trades on commodities", category: "asset", hasValue: true },
    index_trades: { label: "Index Trades", description: "Trades on indices", category: "asset", hasValue: true },
    favorite_asset_trades: { label: "Favorite Asset Trades", description: "Trades on most traded asset", category: "asset", hasValue: true },
  },

  // ============================================
  // MULTI-MAP JOURNEY CONDITIONS (NEW)
  // ============================================
  MAP: {
    map_completed: { label: "Map Completed", description: "Specific map has been completed", category: "map", hasMapId: true },
    maps_completed_count: { label: "Maps Completed Count", description: "Number of maps completed", category: "map", hasValue: true },
    current_map_index: { label: "Current Map Index", description: "Current map in sequence", category: "map", hasValue: true },
    total_journey_xp: { label: "Total Journey XP", description: "Total XP from all journey maps", category: "map", hasValue: true },
    map_milestones_completed: { label: "Map Milestones Completed", description: "Milestones completed in current map", category: "map", hasValue: true },
    all_maps_completed: { label: "All Maps Completed", description: "All 10 maps have been completed", category: "map" },
    map_completion_percentage: { label: "Map Completion %", description: "Percentage of current map completed", category: "map", hasValue: true },
  },

  // ============================================
  // SPECIAL ACHIEVEMENT CONDITIONS (NEW)
  // ============================================
  SPECIAL: {
    consecutive_wins_in_map: { label: "Consecutive Wins in Map", description: "Win streak within the current map", category: "special", hasValue: true },
    no_losses_in_zone: { label: "No Losses in Zone", description: "Complete a zone without any losing trades", category: "special", hasZoneId: true },
    speed_run: { label: "Speed Run", description: "Complete milestone within time limit (hours)", category: "special", hasValue: true },
    multi_asset_master: { label: "Multi-Asset Master", description: "Trade X different assets in one session", category: "special", hasValue: true },
    perfect_day: { label: "Perfect Day", description: "All winning trades in a day (min trades)", category: "special", hasValue: true },
    comeback_trade: { label: "Comeback Trade", description: "Recover from X% drawdown", category: "special", hasValue: true },
    first_trade_of_day: { label: "First Trade of Day", description: "Be the first to trade today", category: "special" },
    weekend_warrior: { label: "Weekend Warrior", description: "Trade on weekend markets", category: "special" },
    night_owl: { label: "Night Owl", description: "Trade during night hours", category: "special" },
    early_bird: { label: "Early Bird", description: "Trade in early morning hours", category: "special" },
    marathon_trader: { label: "Marathon Trader", description: "Trade for X consecutive hours", category: "special", hasValue: true },
    diverse_trader: { label: "Diverse Trader", description: "Trade X different asset classes", category: "special", hasValue: true },
  },

  // ============================================
  // SOCIAL & COMMUNITY CONDITIONS
  // ============================================
  SOCIAL: {
    followers_count: { label: "Followers Count", description: "Number of followers", category: "social", hasValue: true },
    following_count: { label: "Following Count", description: "Number of traders following", category: "social", hasValue: true },
    copy_traders_count: { label: "Copy Traders", description: "Number of copy traders", category: "social", hasValue: true },
    trades_copied: { label: "Trades Copied", description: "Number of times trades were copied", category: "social", hasValue: true },
    profile_views: { label: "Profile Views", description: "Number of profile views", category: "social", hasValue: true },
    leaderboard_rank: { label: "Leaderboard Rank", description: "Current leaderboard position", category: "social", hasValue: true },
    achievements_shared: { label: "Achievements Shared", description: "Number of achievements shared", category: "social", hasValue: true },
  },

  // ============================================
  // BADGE & XP CONDITIONS
  // ============================================
  BADGE: {
    badge_earned: { label: "Badge Earned", description: "Specific badge has been earned", category: "badge", hasBadgeId: true },
    total_badges: { label: "Total Badges", description: "Total number of badges earned", category: "badge", hasValue: true },
    badges_in_category: { label: "Badges in Category", description: "Badges earned in a specific category", category: "badge", hasValue: true },
    current_level: { label: "Current Level", description: "User's current level", category: "badge", hasValue: true },
    total_xp: { label: "Total XP", description: "Total XP earned", category: "badge", hasValue: true },
    xp_this_week: { label: "XP This Week", description: "XP earned this week", category: "badge", hasValue: true },
    xp_this_month: { label: "XP This Month", description: "XP earned this month", category: "badge", hasValue: true },
  },

  // ============================================
  // MILESTONE CONDITIONS
  // ============================================
  MILESTONE: {
    milestone_complete: { label: "Milestone Complete", description: "Specific milestone completed", category: "milestone", hasMilestoneId: true },
    zone_complete: { label: "Zone Complete", description: "All milestones in zone completed", category: "milestone", hasZoneId: true },
    milestones_in_zone: { label: "Milestones in Zone", description: "X milestones completed in zone", category: "milestone", hasValue: true, hasZoneId: true },
    total_milestones: { label: "Total Milestones", description: "Total milestones completed", category: "milestone", hasValue: true },
    consecutive_milestones: { label: "Consecutive Milestones", description: "Milestones completed in a row", category: "milestone", hasValue: true },
    milestone_streak_days: { label: "Milestone Streak (Days)", description: "Consecutive days with milestone progress", category: "milestone", hasValue: true },
  },

  // ============================================
  // TIME-BASED CONDITIONS
  // ============================================
  TIME: {
    trading_days: { label: "Trading Days", description: "Number of days with at least one trade", category: "time", hasValue: true },
    active_hours: { label: "Active Hours", description: "Total hours spent trading", category: "time", hasValue: true },
    session_duration: { label: "Session Duration", description: "Current session length in minutes", category: "time", hasValue: true },
    time_since_last_trade: { label: "Time Since Last Trade", description: "Minutes since last trade", category: "time", hasValue: true },
    trades_in_hour: { label: "Trades in Hour", description: "Trades placed in last hour", category: "time", hasValue: true },
    peak_hours_traded: { label: "Peak Hours Traded", description: "Trades during peak market hours", category: "time", hasValue: true },
  },
} as const;

// Flatten all condition types for easy access
export const ALL_CONDITION_TYPES = {
  ...MILESTONE_CONDITION_TYPES.ACCOUNT,
  ...MILESTONE_CONDITION_TYPES.TRADING,
  ...MILESTONE_CONDITION_TYPES.PERFORMANCE,
  ...MILESTONE_CONDITION_TYPES.COMPETITION,
  ...MILESTONE_CONDITION_TYPES.VOLUME,
  ...MILESTONE_CONDITION_TYPES.ASSET,
  ...MILESTONE_CONDITION_TYPES.MAP,
  ...MILESTONE_CONDITION_TYPES.SPECIAL,
  ...MILESTONE_CONDITION_TYPES.SOCIAL,
  ...MILESTONE_CONDITION_TYPES.BADGE,
  ...MILESTONE_CONDITION_TYPES.MILESTONE,
  ...MILESTONE_CONDITION_TYPES.TIME,
} as const;

// Type for condition keys
export type MilestoneConditionType = keyof typeof ALL_CONDITION_TYPES;

// Categories for UI grouping
export const CONDITION_CATEGORIES = [
  { id: "account", label: "Account & Onboarding", icon: "user" },
  { id: "trading", label: "Trading Activity", icon: "chart" },
  { id: "performance", label: "Performance & Profit", icon: "trending-up" },
  { id: "competition", label: "Competitions", icon: "trophy" },
  { id: "volume", label: "Volume & Financial", icon: "dollar" },
  { id: "asset", label: "Assets & Markets", icon: "coins" },
  { id: "map", label: "Journey Maps", icon: "map" },
  { id: "special", label: "Special Achievements", icon: "star" },
  { id: "social", label: "Social & Community", icon: "users" },
  { id: "badge", label: "Badges & XP", icon: "award" },
  { id: "milestone", label: "Milestones", icon: "flag" },
  { id: "time", label: "Time-Based", icon: "clock" },
] as const;

// Get conditions by category
export function getConditionsByCategory(category: string) {
  return Object.entries(ALL_CONDITION_TYPES).filter(
    ([, config]) => config.category === category
  );
}

// Get all condition type keys as array
export function getAllConditionTypeKeys(): string[] {
  return Object.keys(ALL_CONDITION_TYPES);
}

// Check if a condition type requires a value
export function conditionRequiresValue(type: string): boolean {
  const config = ALL_CONDITION_TYPES[type as MilestoneConditionType] as { hasValue?: boolean } | undefined;
  return config?.hasValue === true;
}

// Get condition info
export function getConditionInfo(type: string) {
  return ALL_CONDITION_TYPES[type as MilestoneConditionType];
}
