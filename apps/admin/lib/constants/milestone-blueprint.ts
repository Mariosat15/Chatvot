/**
 * MILESTONE BLUEPRINT V2 - State of the Art Journey Generation
 * 
 * STRICT RULES:
 * 1. ONBOARDING milestones ONLY in Map 1 (account, KYC, first deposit, first trade, etc.)
 * 2. NO DUPLICATE CONDITIONS across any maps - each type:value appears ONCE
 * 3. LOGICAL PREREQUISITE ORDERING:
 *    - Must ENTER competition before COMPLETE competition
 *    - Must COMPLETE competition before PODIUM finish
 *    - Must PODIUM before WIN (1st place)
 * 4. Variety of condition types - not just trades/wins
 * 5. Progressive difficulty that makes sense
 * 
 * CONDITION TYPES AVAILABLE:
 * - Onboarding: account_created, kyc_verified, first_deposit, first_trade, has_deposit
 * - Trading: total_trades, winning_trades, losing_trades, win_streak
 * - Assets: unique_pairs_traded, different_assets_traded, single_pair_focus
 * - Risk Management: always_uses_sl, always_uses_tp, no_liquidations, max_drawdown
 * - Competitions: competitions_entered, competitions_completed (MUST come in order!)
 * - Podiums: podium_finishes (top 3) - AFTER competitions_completed
 * - Wins: first_place_finishes - AFTER podium_finishes
 * - Streaks: daily_trading_streak, consecutive_profitable_days
 * - Special: comeback_victory, underdog_win, perfect_competition_trades
 * - Time: platform_age, trades_today, trades_this_week
 */

export interface MilestoneBlueprint {
  id: string;
  name: string;
  description: string;
  condition: {
    type: string;
    value?: number | string;
    comparison?: string;
  };
  xp: number;
  nodeType: "start" | "milestone" | "checkpoint" | "legendary";
  icon: string;
}

export const MAP_METADATA: Record<number, { mapId: string; name: string; theme: string; xpBudget: number }> = {
  1: { mapId: "pirate_cove", name: "Pirate Cove", theme: "pirate", xpBudget: 200 },
  2: { mapId: "space_station", name: "Space Station", theme: "space", xpBudget: 250 },
  3: { mapId: "medieval_castle", name: "Medieval Castle", theme: "medieval", xpBudget: 350 },
  4: { mapId: "cyber_city", name: "Cyber City", theme: "cyber", xpBudget: 450 },
  5: { mapId: "ancient_temple", name: "Ancient Temple", theme: "ancient", xpBudget: 600 },
  6: { mapId: "volcanic_island", name: "Volcanic Island", theme: "volcanic", xpBudget: 800 },
  7: { mapId: "arctic_fortress", name: "Arctic Fortress", theme: "arctic", xpBudget: 1100 },
  8: { mapId: "dragon_realm", name: "Dragon Realm", theme: "dragon", xpBudget: 1600 },
  9: { mapId: "celestial_kingdom", name: "Celestial Kingdom", theme: "celestial", xpBudget: 2600 },
  10: { mapId: "hall_of_legends", name: "Hall of Legends", theme: "legendary", xpBudget: 5500 },
};

/**
 * MAP 1: PIRATE COVE - Complete Onboarding Journey
 * ALL "first time" milestones go here and ONLY here
 * Logical order: Account → KYC → Deposit → First Trade → Learn basics
 */
export const MAP_1_BLUEPRINT: MilestoneBlueprint[] = [
  // === ACCOUNT & IDENTITY ===
  {
    id: "welcome_aboard",
    name: "Welcome Aboard",
    description: "Create your trading account and join the adventure",
    condition: { type: "account_created", value: 1, comparison: "eq" },
    xp: 5,
    nodeType: "start",
    icon: "pirateShip",
  },
  {
    id: "identity_verified",
    name: "Identity Verified",
    description: "Complete KYC verification to unlock full features",
    condition: { type: "kyc_verified", value: 1, comparison: "eq" },
    xp: 15,
    nodeType: "milestone",
    icon: "shield1",
  },
  // === FUNDING ===
  {
    id: "treasure_chest",
    name: "Treasure Chest",
    description: "Make your first deposit and fund your account",
    condition: { type: "first_deposit", value: 1, comparison: "eq" },
    xp: 20,
    nodeType: "checkpoint",
    icon: "pirateCoins",
  },
  // === FIRST TRADES ===
  {
    id: "first_voyage",
    name: "First Voyage",
    description: "Execute your very first trade",
    condition: { type: "first_trade", value: 1, comparison: "eq" },
    xp: 15,
    nodeType: "milestone",
    icon: "compass",
  },
  {
    id: "first_victory",
    name: "First Victory",
    description: "Win your first trade - congratulations!",
    condition: { type: "winning_trades", value: 1, comparison: "gte" },
    xp: 20,
    nodeType: "checkpoint",
    icon: "treasure",
  },
  {
    id: "learning_loss",
    name: "Learning the Ropes",
    description: "Experience your first loss - it's part of the journey",
    condition: { type: "losing_trades", value: 1, comparison: "gte" },
    xp: 10,
    nodeType: "milestone",
    icon: "anchor",
  },
  // === RISK MANAGEMENT BASICS ===
  {
    id: "safety_net",
    name: "Safety Net",
    description: "Use a stop loss on a trade - protect your capital",
    condition: { type: "always_uses_sl", value: 1, comparison: "gte" },
    xp: 15,
    nodeType: "milestone",
    icon: "shield1",
  },
  {
    id: "profit_lock",
    name: "Profit Lock",
    description: "Use a take profit on a trade - secure your gains",
    condition: { type: "always_uses_tp", value: 1, comparison: "gte" },
    xp: 15,
    nodeType: "milestone",
    icon: "goldBars",
  },
  // === BUILDING MOMENTUM ===
  {
    id: "five_trades",
    name: "Getting Started",
    description: "Complete 5 total trades",
    condition: { type: "total_trades", value: 5, comparison: "gte" },
    xp: 20,
    nodeType: "milestone",
    icon: "sword",
  },
  {
    id: "three_wins",
    name: "Triple Treasure",
    description: "Achieve 3 winning trades",
    condition: { type: "winning_trades", value: 3, comparison: "gte" },
    xp: 25,
    nodeType: "checkpoint",
    icon: "gems",
  },
  {
    id: "first_streak",
    name: "Hot Streak",
    description: "Win 2 trades in a row",
    condition: { type: "win_streak", value: 2, comparison: "gte" },
    xp: 25,
    nodeType: "milestone",
    icon: "fireSpell",
  },
  {
    id: "pirate_complete",
    name: "Pirate Trader",
    description: "Complete 10 total trades and finish onboarding",
    condition: { type: "total_trades", value: 10, comparison: "gte" },
    xp: 30,
    nodeType: "legendary",
    icon: "skull",
  },
];

/**
 * MAP 2: SPACE STATION - Trading Foundations
 * Focus: Building trading volume, exploring assets, first streaks
 * NO competitions yet - still learning
 */
export const MAP_2_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "space_entry",
    name: "Launch Sequence",
    description: "Complete Pirate Cove and enter Space Station",
    condition: { type: "map_completed", value: "pirate_cove", comparison: "eq" },
    xp: 10,
    nodeType: "start",
    icon: "rocket",
  },
  {
    id: "fifteen_trades",
    name: "Orbital Momentum",
    description: "Execute 15 total trades",
    condition: { type: "total_trades", value: 15, comparison: "gte" },
    xp: 15,
    nodeType: "milestone",
    icon: "satellite",
  },
  {
    id: "five_wins",
    name: "Star Collector",
    description: "Achieve 5 winning trades",
    condition: { type: "winning_trades", value: 5, comparison: "gte" },
    xp: 20,
    nodeType: "checkpoint",
    icon: "star",
  },
  {
    id: "explore_assets",
    name: "Asset Explorer",
    description: "Trade 2 different asset pairs",
    condition: { type: "unique_pairs_traded", value: 2, comparison: "gte" },
    xp: 20,
    nodeType: "milestone",
    icon: "planet",
  },
  {
    id: "twenty_trades",
    name: "Escape Velocity",
    description: "Execute 20 total trades",
    condition: { type: "total_trades", value: 20, comparison: "gte" },
    xp: 20,
    nodeType: "milestone",
    icon: "comet",
  },
  {
    id: "streak_three",
    name: "Cosmic Streak",
    description: "Win 3 trades in a row",
    condition: { type: "win_streak", value: 3, comparison: "gte" },
    xp: 30,
    nodeType: "checkpoint",
    icon: "fireSpell",
  },
  {
    id: "eight_wins",
    name: "Nebula Navigator",
    description: "Achieve 8 winning trades",
    condition: { type: "winning_trades", value: 8, comparison: "gte" },
    xp: 25,
    nodeType: "milestone",
    icon: "galaxy",
  },
  {
    id: "three_assets",
    name: "Galaxy Explorer",
    description: "Trade 3 different asset pairs",
    condition: { type: "unique_pairs_traded", value: 3, comparison: "gte" },
    xp: 25,
    nodeType: "milestone",
    icon: "astronaut",
  },
  {
    id: "thirty_trades",
    name: "Light Speed",
    description: "Execute 30 total trades",
    condition: { type: "total_trades", value: 30, comparison: "gte" },
    xp: 25,
    nodeType: "checkpoint",
    icon: "starship",
  },
  {
    id: "space_commander",
    name: "Space Commander",
    description: "Achieve 12 winning trades",
    condition: { type: "winning_trades", value: 12, comparison: "gte" },
    xp: 35,
    nodeType: "legendary",
    icon: "commander",
  },
];

/**
 * MAP 3: MEDIEVAL CASTLE - Competition Introduction
 * Focus: ENTER first competitions (must enter before complete!)
 * Logical: trades → enter comp → more trades → complete comp
 */
export const MAP_3_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "castle_gates",
    name: "Castle Gates",
    description: "Complete Space Station and enter the Castle",
    condition: { type: "map_completed", value: "space_station", comparison: "eq" },
    xp: 15,
    nodeType: "start",
    icon: "castle",
  },
  {
    id: "forty_trades",
    name: "Squire Training",
    description: "Execute 40 total trades",
    condition: { type: "total_trades", value: 40, comparison: "gte" },
    xp: 20,
    nodeType: "milestone",
    icon: "sword",
  },
  {
    id: "fifteen_wins",
    name: "Shield Bearer",
    description: "Achieve 15 winning trades",
    condition: { type: "winning_trades", value: 15, comparison: "gte" },
    xp: 25,
    nodeType: "checkpoint",
    icon: "shield",
  },
  // === FIRST COMPETITION ENTRY (must come BEFORE completion!) ===
  {
    id: "first_tournament",
    name: "Tournament Entry",
    description: "Enter your first competition - brave warrior!",
    condition: { type: "competitions_entered", value: 1, comparison: "gte" },
    xp: 35,
    nodeType: "checkpoint",
    icon: "arena",
  },
  {
    id: "streak_four",
    name: "Knight's Streak",
    description: "Win 4 trades in a row",
    condition: { type: "win_streak", value: 4, comparison: "gte" },
    xp: 30,
    nodeType: "milestone",
    icon: "horse",
  },
  {
    id: "fifty_trades",
    name: "Veteran Warrior",
    description: "Execute 50 total trades",
    condition: { type: "total_trades", value: 50, comparison: "gte" },
    xp: 25,
    nodeType: "milestone",
    icon: "axe",
  },
  {
    id: "twenty_wins",
    name: "Battle Hardened",
    description: "Achieve 20 winning trades",
    condition: { type: "winning_trades", value: 20, comparison: "gte" },
    xp: 30,
    nodeType: "checkpoint",
    icon: "helmet",
  },
  // === FIRST COMPETITION COMPLETE (after entry!) ===
  {
    id: "first_complete",
    name: "Tournament Finisher",
    description: "Complete your first competition - well fought!",
    condition: { type: "competitions_completed", value: 1, comparison: "gte" },
    xp: 45,
    nodeType: "checkpoint",
    icon: "trophy",
  },
  {
    id: "four_assets",
    name: "Kingdom Explorer",
    description: "Trade 4 different asset pairs",
    condition: { type: "unique_pairs_traded", value: 4, comparison: "gte" },
    xp: 30,
    nodeType: "milestone",
    icon: "map",
  },
  {
    id: "castle_champion",
    name: "Castle Champion",
    description: "Achieve 25 winning trades",
    condition: { type: "winning_trades", value: 25, comparison: "gte" },
    xp: 50,
    nodeType: "legendary",
    icon: "crown",
  },
];

/**
 * MAP 4: CYBER CITY - Advanced Competition
 * Focus: Multiple competitions, growing streaks, risk management
 * Must have completed competitions before podiums
 */
export const MAP_4_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "cyber_entry",
    name: "System Boot",
    description: "Complete Medieval Castle and enter Cyber City",
    condition: { type: "map_completed", value: "medieval_castle", comparison: "eq" },
    xp: 20,
    nodeType: "start",
    icon: "computer",
  },
  {
    id: "seventy_trades",
    name: "Data Stream",
    description: "Execute 70 total trades",
    condition: { type: "total_trades", value: 70, comparison: "gte" },
    xp: 25,
    nodeType: "milestone",
    icon: "chip",
  },
  {
    id: "thirty_wins",
    name: "Algorithm Success",
    description: "Achieve 30 winning trades",
    condition: { type: "winning_trades", value: 30, comparison: "gte" },
    xp: 30,
    nodeType: "checkpoint",
    icon: "code",
  },
  {
    id: "three_comps_entered",
    name: "Competition Circuit",
    description: "Enter 3 competitions",
    condition: { type: "competitions_entered", value: 3, comparison: "gte" },
    xp: 35,
    nodeType: "milestone",
    icon: "network",
  },
  {
    id: "streak_five",
    name: "Neural Streak",
    description: "Win 5 trades in a row",
    condition: { type: "win_streak", value: 5, comparison: "gte" },
    xp: 40,
    nodeType: "checkpoint",
    icon: "brain",
  },
  {
    id: "two_comps_complete",
    name: "Double Finisher",
    description: "Complete 2 competitions",
    condition: { type: "competitions_completed", value: 2, comparison: "gte" },
    xp: 45,
    nodeType: "milestone",
    icon: "binary",
  },
  {
    id: "hundred_trades",
    name: "Century Code",
    description: "Execute 100 total trades",
    condition: { type: "total_trades", value: 100, comparison: "gte" },
    xp: 40,
    nodeType: "checkpoint",
    icon: "server",
  },
  {
    id: "forty_wins",
    name: "Matrix Master",
    description: "Achieve 40 winning trades",
    condition: { type: "winning_trades", value: 40, comparison: "gte" },
    xp: 45,
    nodeType: "milestone",
    icon: "matrix",
  },
  {
    id: "five_assets",
    name: "Network Navigator",
    description: "Trade 5 different asset pairs",
    condition: { type: "unique_pairs_traded", value: 5, comparison: "gte" },
    xp: 35,
    nodeType: "milestone",
    icon: "globe",
  },
  {
    id: "cyber_lord",
    name: "Cyber Lord",
    description: "Complete 3 competitions and prove your worth",
    condition: { type: "competitions_completed", value: 3, comparison: "gte" },
    xp: 60,
    nodeType: "legendary",
    icon: "cyborg",
  },
];

/**
 * MAP 5: ANCIENT TEMPLE - First Podiums
 * Focus: Now that competitions are mastered, aim for TOP 3
 * PODIUMS unlock here (after multiple competition completions)
 */
export const MAP_5_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "temple_entry",
    name: "Temple Gates",
    description: "Complete Cyber City and enter the Ancient Temple",
    condition: { type: "map_completed", value: "cyber_city", comparison: "eq" },
    xp: 25,
    nodeType: "start",
    icon: "temple",
  },
  {
    id: "one_fifty_trades",
    name: "Ancient Wisdom",
    description: "Execute 150 total trades",
    condition: { type: "total_trades", value: 150, comparison: "gte" },
    xp: 35,
    nodeType: "milestone",
    icon: "scroll",
  },
  {
    id: "fifty_wins",
    name: "Oracle's Path",
    description: "Achieve 50 winning trades",
    condition: { type: "winning_trades", value: 50, comparison: "gte" },
    xp: 40,
    nodeType: "checkpoint",
    icon: "eye",
  },
  {
    id: "five_comps_entered",
    name: "Temple Warrior",
    description: "Enter 5 competitions",
    condition: { type: "competitions_entered", value: 5, comparison: "gte" },
    xp: 40,
    nodeType: "milestone",
    icon: "pyramid",
  },
  // === FIRST PODIUM (after multiple completions) ===
  {
    id: "first_podium",
    name: "First Podium",
    description: "Finish in TOP 3 of a competition - amazing!",
    condition: { type: "podium_finishes", value: 1, comparison: "gte" },
    xp: 75,
    nodeType: "checkpoint",
    icon: "trophy",
  },
  {
    id: "streak_seven",
    name: "Pharaoh's Streak",
    description: "Win 7 trades in a row",
    condition: { type: "win_streak", value: 7, comparison: "gte" },
    xp: 55,
    nodeType: "milestone",
    icon: "pharaoh",
  },
  {
    id: "four_comps_complete",
    name: "Arena Veteran",
    description: "Complete 4 competitions",
    condition: { type: "competitions_completed", value: 4, comparison: "gte" },
    xp: 50,
    nodeType: "milestone",
    icon: "sphinx",
  },
  {
    id: "sixty_wins",
    name: "Temple Guardian",
    description: "Achieve 60 winning trades",
    condition: { type: "winning_trades", value: 60, comparison: "gte" },
    xp: 50,
    nodeType: "checkpoint",
    icon: "scarab",
  },
  {
    id: "trading_days_seven",
    name: "Weekly Devotion",
    description: "Trade for 7 consecutive days",
    condition: { type: "daily_trading_streak", value: 7, comparison: "gte" },
    xp: 45,
    nodeType: "milestone",
    icon: "sun",
  },
  {
    id: "temple_master",
    name: "Temple Master",
    description: "Achieve 2 podium finishes",
    condition: { type: "podium_finishes", value: 2, comparison: "gte" },
    xp: 85,
    nodeType: "legendary",
    icon: "ankh",
  },
];

/**
 * MAP 6: VOLCANIC ISLAND - First Wins
 * Focus: Now aim for 1ST PLACE (after multiple podiums)
 * WINS unlock here
 */
export const MAP_6_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "volcano_entry",
    name: "Volcano Landing",
    description: "Complete Ancient Temple and enter Volcanic Island",
    condition: { type: "map_completed", value: "ancient_temple", comparison: "eq" },
    xp: 35,
    nodeType: "start",
    icon: "volcano",
  },
  {
    id: "two_hundred_trades",
    name: "Lava Flow",
    description: "Execute 200 total trades",
    condition: { type: "total_trades", value: 200, comparison: "gte" },
    xp: 45,
    nodeType: "milestone",
    icon: "magma",
  },
  {
    id: "seventy_wins",
    name: "Inferno Trader",
    description: "Achieve 70 winning trades",
    condition: { type: "winning_trades", value: 70, comparison: "gte" },
    xp: 50,
    nodeType: "checkpoint",
    icon: "flames",
  },
  {
    id: "three_podiums",
    name: "Podium Regular",
    description: "Achieve 3 podium finishes (top 3)",
    condition: { type: "podium_finishes", value: 3, comparison: "gte" },
    xp: 70,
    nodeType: "milestone",
    icon: "medal",
  },
  // === FIRST WIN (after multiple podiums) ===
  {
    id: "first_victory_comp",
    name: "First Champion",
    description: "Win your first competition (1st place) - LEGENDARY!",
    condition: { type: "first_place_finishes", value: 1, comparison: "gte" },
    xp: 100,
    nodeType: "checkpoint",
    icon: "crown",
  },
  {
    id: "streak_ten",
    name: "Phoenix Streak",
    description: "Win 10 trades in a row",
    condition: { type: "win_streak", value: 10, comparison: "gte" },
    xp: 65,
    nodeType: "milestone",
    icon: "phoenix",
  },
  {
    id: "six_comps_complete",
    name: "Eruption Champion",
    description: "Complete 6 competitions",
    condition: { type: "competitions_completed", value: 6, comparison: "gte" },
    xp: 55,
    nodeType: "milestone",
    icon: "eruption",
  },
  {
    id: "eighty_wins",
    name: "Fire Master",
    description: "Achieve 80 winning trades",
    condition: { type: "winning_trades", value: 80, comparison: "gte" },
    xp: 55,
    nodeType: "checkpoint",
    icon: "fireball",
  },
  {
    id: "six_assets",
    name: "Lava Diversifier",
    description: "Trade 6 different asset pairs",
    condition: { type: "unique_pairs_traded", value: 6, comparison: "gte" },
    xp: 45,
    nodeType: "milestone",
    icon: "gems",
  },
  {
    id: "volcano_god",
    name: "Volcano God",
    description: "Win 2 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 2, comparison: "gte" },
    xp: 120,
    nodeType: "legendary",
    icon: "volcanoGod",
  },
];

/**
 * MAP 7: ARCTIC FORTRESS - Multiple Wins
 * Focus: Stack up wins and podiums, build consistency
 */
export const MAP_7_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "arctic_entry",
    name: "Arctic Arrival",
    description: "Complete Volcanic Island and enter Arctic Fortress",
    condition: { type: "map_completed", value: "volcanic_island", comparison: "eq" },
    xp: 45,
    nodeType: "start",
    icon: "snowflake",
  },
  {
    id: "three_hundred_trades",
    name: "Blizzard Trader",
    description: "Execute 300 total trades",
    condition: { type: "total_trades", value: 300, comparison: "gte" },
    xp: 60,
    nodeType: "milestone",
    icon: "blizzard",
  },
  {
    id: "hundred_wins",
    name: "Frost Champion",
    description: "Achieve 100 winning trades",
    condition: { type: "winning_trades", value: 100, comparison: "gte" },
    xp: 70,
    nodeType: "checkpoint",
    icon: "frost",
  },
  {
    id: "five_podiums",
    name: "Podium Master",
    description: "Achieve 5 podium finishes",
    condition: { type: "podium_finishes", value: 5, comparison: "gte" },
    xp: 85,
    nodeType: "milestone",
    icon: "medal",
  },
  {
    id: "four_wins",
    name: "Ice Champion",
    description: "Win 4 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 4, comparison: "gte" },
    xp: 110,
    nodeType: "checkpoint",
    icon: "iceKing",
  },
  {
    id: "streak_twelve",
    name: "Avalanche Streak",
    description: "Win 12 trades in a row",
    condition: { type: "win_streak", value: 12, comparison: "gte" },
    xp: 80,
    nodeType: "milestone",
    icon: "avalanche",
  },
  {
    id: "ten_comps_complete",
    name: "Arctic Veteran",
    description: "Complete 10 competitions",
    condition: { type: "competitions_completed", value: 10, comparison: "gte" },
    xp: 75,
    nodeType: "milestone",
    icon: "iceberg",
  },
  {
    id: "one_twenty_wins",
    name: "Glacier Lord",
    description: "Achieve 120 winning trades",
    condition: { type: "winning_trades", value: 120, comparison: "gte" },
    xp: 80,
    nodeType: "checkpoint",
    icon: "glacier",
  },
  {
    id: "trading_days_fourteen",
    name: "Frost Dedication",
    description: "Trade for 14 consecutive days",
    condition: { type: "daily_trading_streak", value: 14, comparison: "gte" },
    xp: 65,
    nodeType: "milestone",
    icon: "aurora",
  },
  {
    id: "ice_emperor",
    name: "Ice Emperor",
    description: "Win 6 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 6, comparison: "gte" },
    xp: 150,
    nodeType: "legendary",
    icon: "iceEmperor",
  },
];

/**
 * MAP 8: DRAGON REALM - Champion Status
 * Focus: Dominating competitions, exceptional streaks
 */
export const MAP_8_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "dragon_entry",
    name: "Dragon's Gate",
    description: "Complete Arctic Fortress and enter Dragon Realm",
    condition: { type: "map_completed", value: "arctic_fortress", comparison: "eq" },
    xp: 55,
    nodeType: "start",
    icon: "dragonGate",
  },
  {
    id: "four_hundred_trades",
    name: "Dragon Trader",
    description: "Execute 400 total trades",
    condition: { type: "total_trades", value: 400, comparison: "gte" },
    xp: 80,
    nodeType: "milestone",
    icon: "dragonFire",
  },
  {
    id: "one_fifty_wins",
    name: "Fire Breather",
    description: "Achieve 150 winning trades",
    condition: { type: "winning_trades", value: 150, comparison: "gte" },
    xp: 95,
    nodeType: "checkpoint",
    icon: "dragonHead",
  },
  {
    id: "eight_podiums",
    name: "Dragon Champion",
    description: "Achieve 8 podium finishes",
    condition: { type: "podium_finishes", value: 8, comparison: "gte" },
    xp: 100,
    nodeType: "milestone",
    icon: "dragonScale",
  },
  {
    id: "ten_wins",
    name: "Dragon Slayer",
    description: "Win 10 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 10, comparison: "gte" },
    xp: 150,
    nodeType: "checkpoint",
    icon: "dragonSlayer",
  },
  {
    id: "streak_fifteen",
    name: "Dragon's Fury",
    description: "Win 15 trades in a row",
    condition: { type: "win_streak", value: 15, comparison: "gte" },
    xp: 100,
    nodeType: "milestone",
    icon: "dragonWing",
  },
  {
    id: "fifteen_comps_complete",
    name: "Realm Conqueror",
    description: "Complete 15 competitions",
    condition: { type: "competitions_completed", value: 15, comparison: "gte" },
    xp: 90,
    nodeType: "milestone",
    icon: "cave",
  },
  {
    id: "two_hundred_wins",
    name: "Dragon Lord",
    description: "Achieve 200 winning trades",
    condition: { type: "winning_trades", value: 200, comparison: "gte" },
    xp: 120,
    nodeType: "checkpoint",
    icon: "dragonThrone",
  },
  {
    id: "comeback",
    name: "Dragon's Comeback",
    description: "Win a competition after being in bottom half at midpoint",
    condition: { type: "comeback_victory", value: 1, comparison: "gte" },
    xp: 100,
    nodeType: "milestone",
    icon: "phoenix",
  },
  {
    id: "dragon_king",
    name: "Dragon King",
    description: "Win 15 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 15, comparison: "gte" },
    xp: 200,
    nodeType: "legendary",
    icon: "dragonKing",
  },
];

/**
 * MAP 9: CELESTIAL KINGDOM - Near Legendary
 * Focus: Elite status, massive stats, exceptional achievements
 */
export const MAP_9_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "celestial_entry",
    name: "Celestial Ascension",
    description: "Complete Dragon Realm and ascend to the Celestial Kingdom",
    condition: { type: "map_completed", value: "dragon_realm", comparison: "eq" },
    xp: 75,
    nodeType: "start",
    icon: "angel",
  },
  {
    id: "five_hundred_trades",
    name: "Star Trader",
    description: "Execute 500 total trades",
    condition: { type: "total_trades", value: 500, comparison: "gte" },
    xp: 100,
    nodeType: "milestone",
    icon: "star",
  },
  {
    id: "two_fifty_wins",
    name: "Constellation Master",
    description: "Achieve 250 winning trades",
    condition: { type: "winning_trades", value: 250, comparison: "gte" },
    xp: 120,
    nodeType: "checkpoint",
    icon: "constellation",
  },
  {
    id: "twelve_podiums",
    name: "Celestial Regular",
    description: "Achieve 12 podium finishes",
    condition: { type: "podium_finishes", value: 12, comparison: "gte" },
    xp: 130,
    nodeType: "milestone",
    icon: "halo",
  },
  {
    id: "twenty_wins",
    name: "Divine Champion",
    description: "Win 20 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 20, comparison: "gte" },
    xp: 200,
    nodeType: "checkpoint",
    icon: "divineThrone",
  },
  {
    id: "streak_twenty",
    name: "Stellar Streak",
    description: "Win 20 trades in a row",
    condition: { type: "win_streak", value: 20, comparison: "gte" },
    xp: 150,
    nodeType: "milestone",
    icon: "comet",
  },
  {
    id: "twenty_comps_complete",
    name: "Tournament Titan",
    description: "Complete 20 competitions",
    condition: { type: "competitions_completed", value: 20, comparison: "gte" },
    xp: 120,
    nodeType: "milestone",
    icon: "seraph",
  },
  {
    id: "three_hundred_wins",
    name: "Archangel Trader",
    description: "Achieve 300 winning trades",
    condition: { type: "winning_trades", value: 300, comparison: "gte" },
    xp: 150,
    nodeType: "checkpoint",
    icon: "archangel",
  },
  {
    id: "trading_days_thirty",
    name: "Monthly Devotion",
    description: "Trade for 30 consecutive days",
    condition: { type: "daily_trading_streak", value: 30, comparison: "gte" },
    xp: 130,
    nodeType: "milestone",
    icon: "moon",
  },
  {
    id: "trading_titan",
    name: "Trading Titan",
    description: "Win 25 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 25, comparison: "gte" },
    xp: 300,
    nodeType: "legendary",
    icon: "titan",
  },
];

/**
 * MAP 10: HALL OF LEGENDS - God Status
 * Focus: Ultimate achievements, legendary trader status
 */
export const MAP_10_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "legend_entry",
    name: "Legend Entry",
    description: "Complete Celestial Kingdom and enter the Hall of Legends",
    condition: { type: "map_completed", value: "celestial_kingdom", comparison: "eq" },
    xp: 100,
    nodeType: "start",
    icon: "legend",
  },
  {
    id: "seven_fifty_trades",
    name: "Legendary Trader",
    description: "Execute 750 total trades",
    condition: { type: "total_trades", value: 750, comparison: "gte" },
    xp: 150,
    nodeType: "milestone",
    icon: "infinity",
  },
  {
    id: "four_hundred_wins",
    name: "Master of Victory",
    description: "Achieve 400 winning trades",
    condition: { type: "winning_trades", value: 400, comparison: "gte" },
    xp: 180,
    nodeType: "checkpoint",
    icon: "grandChampion",
  },
  {
    id: "twenty_podiums",
    name: "Eternal Podium",
    description: "Achieve 20 podium finishes",
    condition: { type: "podium_finishes", value: 20, comparison: "gte" },
    xp: 200,
    nodeType: "milestone",
    icon: "colosseum",
  },
  {
    id: "thirty_five_wins",
    name: "Legendary Champion",
    description: "Win 35 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 35, comparison: "gte" },
    xp: 350,
    nodeType: "checkpoint",
    icon: "godThrone",
  },
  {
    id: "streak_thirty",
    name: "Immortal Streak",
    description: "Win 30 trades in a row - INCREDIBLE!",
    condition: { type: "win_streak", value: 30, comparison: "gte" },
    xp: 250,
    nodeType: "milestone",
    icon: "immortal",
  },
  {
    id: "thirty_comps_complete",
    name: "Tournament God",
    description: "Complete 30 competitions",
    condition: { type: "competitions_completed", value: 30, comparison: "gte" },
    xp: 180,
    nodeType: "milestone",
    icon: "olympus",
  },
  {
    id: "five_hundred_wins",
    name: "God of Wins",
    description: "Achieve 500 winning trades",
    condition: { type: "winning_trades", value: 500, comparison: "gte" },
    xp: 280,
    nodeType: "checkpoint",
    icon: "crown",
  },
  {
    id: "thousand_trades",
    name: "Trading Immortal",
    description: "Execute 1000 total trades",
    condition: { type: "total_trades", value: 1000, comparison: "gte" },
    xp: 350,
    nodeType: "checkpoint",
    icon: "tradingGod",
  },
  {
    id: "trading_god",
    name: "Trading God",
    description: "Win 50 competitions (1st place) - ULTIMATE ACHIEVEMENT",
    condition: { type: "first_place_finishes", value: 50, comparison: "gte" },
    xp: 1000,
    nodeType: "legendary",
    icon: "godStatus",
  },
];

/**
 * ALL MAP BLUEPRINTS
 */
export const MAP_BLUEPRINTS: Record<number, MilestoneBlueprint[]> = {
  1: MAP_1_BLUEPRINT,
  2: MAP_2_BLUEPRINT,
  3: MAP_3_BLUEPRINT,
  4: MAP_4_BLUEPRINT,
  5: MAP_5_BLUEPRINT,
  6: MAP_6_BLUEPRINT,
  7: MAP_7_BLUEPRINT,
  8: MAP_8_BLUEPRINT,
  9: MAP_9_BLUEPRINT,
  10: MAP_10_BLUEPRINT,
};

/**
 * Validate blueprints - ensure no duplicates and logical ordering
 */
export function validateBlueprints(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const usedConditions = new Set<string>();
  
  // Track progression milestones
  let hasEnteredComp = false;
  let hasCompletedComp = false;
  let hasPodium = false;
  
  for (let mapNum = 1; mapNum <= 10; mapNum++) {
    const blueprint = MAP_BLUEPRINTS[mapNum];
    if (!blueprint) continue;
    
    for (const milestone of blueprint) {
      const condKey = `${milestone.condition.type}:${milestone.condition.value}`;
      
      // Check duplicates
      if (usedConditions.has(condKey)) {
        errors.push(`Duplicate: ${condKey} in Map ${mapNum}, milestone ${milestone.id}`);
      }
      usedConditions.add(condKey);
      
      // Check logical ordering
      const type = milestone.condition.type;
      
      if (type === "competitions_entered") hasEnteredComp = true;
      if (type === "competitions_completed") {
        if (!hasEnteredComp) {
          errors.push(`Map ${mapNum}: competitions_completed before competitions_entered`);
        }
        hasCompletedComp = true;
      }
      if (type === "podium_finishes") {
        if (!hasCompletedComp) {
          errors.push(`Map ${mapNum}: podium_finishes before competitions_completed`);
        }
        hasPodium = true;
      }
      if (type === "first_place_finishes") {
        if (!hasPodium) {
          errors.push(`Map ${mapNum}: first_place_finishes before podium_finishes`);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}
