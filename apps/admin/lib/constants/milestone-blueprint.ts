/**
 * MILESTONE BLUEPRINT - State of the Art Journey Generation
 * 
 * RULES:
 * 1. ONBOARDING milestones (account, KYC, first deposit, etc.) ONLY in Map 1
 * 2. NO DUPLICATE CONDITIONS across any maps
 * 3. Values MUST be strictly increasing within same condition type
 * 4. Each map has a THEME that dictates allowed milestone types
 * 5. Logical progression from beginner → legendary
 */

export type MilestoneConditionType =
  // === ONBOARDING (Map 1 ONLY) ===
  | "account_created"      // Create account
  | "kyc_verified"         // Complete KYC
  | "first_deposit"        // Make first deposit
  | "first_trade"          // Execute first trade
  | "first_winning_trade"  // Win first trade
  | "first_losing_trade"   // Experience first loss (learning)
  | "first_stop_loss"      // Set first stop loss
  | "first_take_profit"    // Set first take profit
  | "first_withdrawal"     // Make first withdrawal
  | "marketplace_purchase" // Buy from marketplace
  
  // === TRADING VOLUME (Maps 2-10, increasing values) ===
  | "total_trades"         // Total trades executed
  | "winning_trades"       // Total winning trades
  | "losing_trades"        // Total losing trades (for learning)
  
  // === STREAKS (Maps 2-10, increasing values) ===
  | "win_streak"           // Consecutive wins
  | "trading_days"         // Days actively trading
  
  // === COMPETITIONS (Maps 3-10) ===
  | "competitions_entered"    // Competitions joined
  | "competitions_completed"  // Competitions finished
  
  // === PODIUMS (Maps 5-10) ===
  | "podium_finishes"         // Top 3 finishes
  | "second_place_finishes"   // 2nd place
  | "third_place_finishes"    // 3rd place
  
  // === WINS (Maps 6-10) ===
  | "first_place_finishes"    // 1st place finishes
  
  // === SPECIAL (Various maps) ===
  | "total_pnl"               // Total profit
  | "single_trade_profit"     // Biggest single trade profit
  | "perfect_day"             // Day with no losing trades
  | "comeback_trade"          // Win after 3+ losses
  | "map_completed";          // Complete a specific map

/**
 * MILESTONE CATEGORY - Determines which maps can use which types
 */
export type MilestoneCategory = 
  | "onboarding"     // Map 1 ONLY
  | "trading"        // Maps 2+
  | "streaks"        // Maps 2+
  | "competitions"   // Maps 3+
  | "podiums"        // Maps 5+
  | "wins"           // Maps 6+
  | "legendary";     // Maps 8+

/**
 * Condition type to category mapping
 */
export const CONDITION_CATEGORIES: Record<MilestoneConditionType, MilestoneCategory> = {
  // Onboarding - Map 1 ONLY
  account_created: "onboarding",
  kyc_verified: "onboarding",
  first_deposit: "onboarding",
  first_trade: "onboarding",
  first_winning_trade: "onboarding",
  first_losing_trade: "onboarding",
  first_stop_loss: "onboarding",
  first_take_profit: "onboarding",
  first_withdrawal: "onboarding",
  marketplace_purchase: "onboarding",
  
  // Trading - Maps 2+
  total_trades: "trading",
  winning_trades: "trading",
  losing_trades: "trading",
  
  // Streaks - Maps 2+
  win_streak: "streaks",
  trading_days: "streaks",
  
  // Competitions - Maps 3+
  competitions_entered: "competitions",
  competitions_completed: "competitions",
  
  // Podiums - Maps 5+
  podium_finishes: "podiums",
  second_place_finishes: "podiums",
  third_place_finishes: "podiums",
  
  // Wins - Maps 6+
  first_place_finishes: "wins",
  
  // Special
  total_pnl: "trading",
  single_trade_profit: "trading",
  perfect_day: "streaks",
  comeback_trade: "streaks",
  map_completed: "trading",
};

/**
 * Which categories are allowed in which maps
 */
export const MAP_ALLOWED_CATEGORIES: Record<number, MilestoneCategory[]> = {
  1: ["onboarding"], // Map 1: ONLY onboarding
  2: ["trading", "streaks"],
  3: ["trading", "streaks", "competitions"],
  4: ["trading", "streaks", "competitions"],
  5: ["trading", "streaks", "competitions", "podiums"],
  6: ["trading", "streaks", "competitions", "podiums", "wins"],
  7: ["trading", "streaks", "competitions", "podiums", "wins"],
  8: ["trading", "streaks", "competitions", "podiums", "wins", "legendary"],
  9: ["trading", "streaks", "competitions", "podiums", "wins", "legendary"],
  10: ["trading", "streaks", "competitions", "podiums", "wins", "legendary"],
};

/**
 * COMPLETE MAP BLUEPRINTS - Exactly what each map should contain
 */
export interface MilestoneBlueprint {
  id: string;
  name: string;
  description: string;
  condition: {
    type: MilestoneConditionType;
    value?: number | string;
    comparison?: string;
  };
  xp: number;
  nodeType: "start" | "milestone" | "checkpoint" | "legendary";
  icon: string;
}

/**
 * MAP 1: PIRATE COVE - Onboarding Journey
 * All "first time" milestones go here and ONLY here
 */
export const MAP_1_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "welcome_aboard",
    name: "Welcome Aboard",
    description: "Create your trading account",
    condition: { type: "account_created", value: 1, comparison: "eq" },
    xp: 5,
    nodeType: "start",
    icon: "pirateShip",
  },
  {
    id: "identity_verified",
    name: "Identity Verified",
    description: "Complete KYC verification",
    condition: { type: "kyc_verified", value: 1, comparison: "eq" },
    xp: 10,
    nodeType: "milestone",
    icon: "shield1",
  },
  {
    id: "treasure_chest",
    name: "Treasure Chest",
    description: "Make your first deposit",
    condition: { type: "first_deposit", value: 1, comparison: "eq" },
    xp: 15,
    nodeType: "checkpoint",
    icon: "pirateCoins",
  },
  {
    id: "first_voyage",
    name: "First Voyage",
    description: "Execute your first trade",
    condition: { type: "first_trade", value: 1, comparison: "eq" },
    xp: 15,
    nodeType: "milestone",
    icon: "compass",
  },
  {
    id: "first_victory",
    name: "First Victory",
    description: "Win your first trade",
    condition: { type: "first_winning_trade", value: 1, comparison: "eq" },
    xp: 20,
    nodeType: "checkpoint",
    icon: "treasure",
  },
  {
    id: "learning_the_ropes",
    name: "Learning the Ropes",
    description: "Experience your first losing trade (it's part of learning!)",
    condition: { type: "first_losing_trade", value: 1, comparison: "eq" },
    xp: 10,
    nodeType: "milestone",
    icon: "anchor",
  },
  {
    id: "safety_first",
    name: "Safety First",
    description: "Set your first stop loss",
    condition: { type: "first_stop_loss", value: 1, comparison: "eq" },
    xp: 15,
    nodeType: "milestone",
    icon: "shield1",
  },
  {
    id: "profit_secured",
    name: "Profit Secured",
    description: "Set your first take profit",
    condition: { type: "first_take_profit", value: 1, comparison: "eq" },
    xp: 15,
    nodeType: "milestone",
    icon: "goldBars",
  },
  {
    id: "cashing_out",
    name: "Cashing Out",
    description: "Make your first withdrawal",
    condition: { type: "first_withdrawal", value: 1, comparison: "eq" },
    xp: 20,
    nodeType: "checkpoint",
    icon: "pirateCoins",
  },
  {
    id: "pirate_trader",
    name: "Pirate Trader",
    description: "Complete 5 total trades",
    condition: { type: "total_trades", value: 5, comparison: "gte" },
    xp: 25,
    nodeType: "legendary",
    icon: "skull",
  },
];

/**
 * MAP 2: SPACE STATION - Learning to Trade
 * Basic trading volume and first streaks
 */
export const MAP_2_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "space_cadet",
    name: "Space Cadet",
    description: "Complete Map 1: Pirate Cove",
    condition: { type: "map_completed", value: "pirate_cove", comparison: "eq" },
    xp: 10,
    nodeType: "start",
    icon: "rocket",
  },
  {
    id: "ten_trades",
    name: "Lift Off",
    description: "Execute 10 total trades",
    condition: { type: "total_trades", value: 10, comparison: "gte" },
    xp: 15,
    nodeType: "milestone",
    icon: "rocket",
  },
  {
    id: "five_wins",
    name: "Star Collector",
    description: "Achieve 5 winning trades",
    condition: { type: "winning_trades", value: 5, comparison: "gte" },
    xp: 20,
    nodeType: "milestone",
    icon: "star",
  },
  {
    id: "first_streak",
    name: "First Streak",
    description: "Win 2 trades in a row",
    condition: { type: "win_streak", value: 2, comparison: "gte" },
    xp: 25,
    nodeType: "checkpoint",
    icon: "fireSpell",
  },
  {
    id: "twenty_trades",
    name: "Orbital Trader",
    description: "Execute 20 total trades",
    condition: { type: "total_trades", value: 20, comparison: "gte" },
    xp: 20,
    nodeType: "milestone",
    icon: "satellite",
  },
  {
    id: "ten_wins",
    name: "Nebula Navigator",
    description: "Achieve 10 winning trades",
    condition: { type: "winning_trades", value: 10, comparison: "gte" },
    xp: 25,
    nodeType: "checkpoint",
    icon: "planet",
  },
  {
    id: "streak_three",
    name: "Comet Trail",
    description: "Win 3 trades in a row",
    condition: { type: "win_streak", value: 3, comparison: "gte" },
    xp: 30,
    nodeType: "milestone",
    icon: "comet",
  },
  {
    id: "thirty_trades",
    name: "Galaxy Explorer",
    description: "Execute 30 total trades",
    condition: { type: "total_trades", value: 30, comparison: "gte" },
    xp: 25,
    nodeType: "milestone",
    icon: "galaxy",
  },
  {
    id: "space_commander",
    name: "Space Commander",
    description: "Achieve 15 winning trades",
    condition: { type: "winning_trades", value: 15, comparison: "gte" },
    xp: 35,
    nodeType: "legendary",
    icon: "astronaut",
  },
];

/**
 * MAP 3: MEDIEVAL CASTLE - Competition Introduction
 * First competitions + continued trading
 */
export const MAP_3_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "castle_gates",
    name: "Castle Gates",
    description: "Complete Map 2: Space Station",
    condition: { type: "map_completed", value: "space_station", comparison: "eq" },
    xp: 15,
    nodeType: "start",
    icon: "castle",
  },
  {
    id: "forty_trades",
    name: "Knight's Training",
    description: "Execute 40 total trades",
    condition: { type: "total_trades", value: 40, comparison: "gte" },
    xp: 20,
    nodeType: "milestone",
    icon: "sword",
  },
  {
    id: "first_competition",
    name: "Tournament Entry",
    description: "Enter your first competition",
    condition: { type: "competitions_entered", value: 1, comparison: "gte" },
    xp: 30,
    nodeType: "checkpoint",
    icon: "arena",
  },
  {
    id: "twenty_wins",
    name: "Battle Tested",
    description: "Achieve 20 winning trades",
    condition: { type: "winning_trades", value: 20, comparison: "gte" },
    xp: 25,
    nodeType: "milestone",
    icon: "shield",
  },
  {
    id: "streak_five",
    name: "Winning Streak",
    description: "Win 5 trades in a row",
    condition: { type: "win_streak", value: 5, comparison: "gte" },
    xp: 35,
    nodeType: "checkpoint",
    icon: "fireSpell",
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
    id: "three_competitions",
    name: "Tournament Regular",
    description: "Enter 3 competitions",
    condition: { type: "competitions_entered", value: 3, comparison: "gte" },
    xp: 35,
    nodeType: "milestone",
    icon: "banner",
  },
  {
    id: "first_completed",
    name: "Tournament Finisher",
    description: "Complete your first competition",
    condition: { type: "competitions_completed", value: 1, comparison: "gte" },
    xp: 40,
    nodeType: "checkpoint",
    icon: "trophy",
  },
  {
    id: "castle_champion",
    name: "Castle Champion",
    description: "Achieve 30 winning trades",
    condition: { type: "winning_trades", value: 30, comparison: "gte" },
    xp: 50,
    nodeType: "legendary",
    icon: "crown",
  },
];

/**
 * MAP 4: CYBER CITY - Advanced Trading
 */
export const MAP_4_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "cyber_entry",
    name: "System Boot",
    description: "Complete Map 3: Medieval Castle",
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
    id: "forty_wins",
    name: "Algorithm Master",
    description: "Achieve 40 winning trades",
    condition: { type: "winning_trades", value: 40, comparison: "gte" },
    xp: 30,
    nodeType: "checkpoint",
    icon: "code",
  },
  {
    id: "streak_seven",
    name: "Neural Link",
    description: "Win 7 trades in a row",
    condition: { type: "win_streak", value: 7, comparison: "gte" },
    xp: 40,
    nodeType: "milestone",
    icon: "brain",
  },
  {
    id: "five_competitions",
    name: "Cyber Tournaments",
    description: "Enter 5 competitions",
    condition: { type: "competitions_entered", value: 5, comparison: "gte" },
    xp: 35,
    nodeType: "milestone",
    icon: "gamepad",
  },
  {
    id: "hundred_trades",
    name: "Century Trader",
    description: "Execute 100 total trades",
    condition: { type: "total_trades", value: 100, comparison: "gte" },
    xp: 40,
    nodeType: "checkpoint",
    icon: "server",
  },
  {
    id: "three_completed",
    name: "Competition Veteran",
    description: "Complete 3 competitions",
    condition: { type: "competitions_completed", value: 3, comparison: "gte" },
    xp: 45,
    nodeType: "milestone",
    icon: "medal",
  },
  {
    id: "fifty_wins",
    name: "Binary Champion",
    description: "Achieve 50 winning trades",
    condition: { type: "winning_trades", value: 50, comparison: "gte" },
    xp: 50,
    nodeType: "checkpoint",
    icon: "binary",
  },
  {
    id: "cyber_lord",
    name: "Cyber Lord",
    description: "Win 10 trades in a row",
    condition: { type: "win_streak", value: 10, comparison: "gte" },
    xp: 60,
    nodeType: "legendary",
    icon: "cyborg",
  },
];

/**
 * MAP 5: ANCIENT TEMPLE - First Podiums
 */
export const MAP_5_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "temple_entry",
    name: "Temple Gates",
    description: "Complete Map 4: Cyber City",
    condition: { type: "map_completed", value: "cyber_city", comparison: "eq" },
    xp: 25,
    nodeType: "start",
    icon: "temple",
  },
  {
    id: "one_fifty_trades",
    name: "Ancient Trader",
    description: "Execute 150 total trades",
    condition: { type: "total_trades", value: 150, comparison: "gte" },
    xp: 35,
    nodeType: "milestone",
    icon: "scroll",
  },
  {
    id: "seventy_wins",
    name: "Oracle's Blessing",
    description: "Achieve 70 winning trades",
    condition: { type: "winning_trades", value: 70, comparison: "gte" },
    xp: 40,
    nodeType: "checkpoint",
    icon: "eye",
  },
  {
    id: "first_podium",
    name: "First Podium",
    description: "Finish in top 3 of a competition",
    condition: { type: "podium_finishes", value: 1, comparison: "gte" },
    xp: 60,
    nodeType: "checkpoint",
    icon: "trophy",
  },
  {
    id: "ten_competitions",
    name: "Tournament Seeker",
    description: "Enter 10 competitions",
    condition: { type: "competitions_entered", value: 10, comparison: "gte" },
    xp: 45,
    nodeType: "milestone",
    icon: "pyramid",
  },
  {
    id: "streak_twelve",
    name: "Pharaoh's Streak",
    description: "Win 12 trades in a row",
    condition: { type: "win_streak", value: 12, comparison: "gte" },
    xp: 55,
    nodeType: "milestone",
    icon: "pharaoh",
  },
  {
    id: "five_completed",
    name: "Arena Veteran",
    description: "Complete 5 competitions",
    condition: { type: "competitions_completed", value: 5, comparison: "gte" },
    xp: 50,
    nodeType: "milestone",
    icon: "sphinx",
  },
  {
    id: "ninety_wins",
    name: "Temple Guardian",
    description: "Achieve 90 winning trades",
    condition: { type: "winning_trades", value: 90, comparison: "gte" },
    xp: 55,
    nodeType: "checkpoint",
    icon: "scarab",
  },
  {
    id: "temple_master",
    name: "Temple Master",
    description: "Finish in top 3 of 3 competitions",
    condition: { type: "podium_finishes", value: 3, comparison: "gte" },
    xp: 75,
    nodeType: "legendary",
    icon: "ankh",
  },
];

/**
 * MAP 6: VOLCANIC ISLAND - First Wins
 */
export const MAP_6_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "volcano_landing",
    name: "Volcano Landing",
    description: "Complete Map 5: Ancient Temple",
    condition: { type: "map_completed", value: "ancient_temple", comparison: "eq" },
    xp: 30,
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
    id: "first_win",
    name: "First Victory",
    description: "Win your first competition (1st place)",
    condition: { type: "first_place_finishes", value: 1, comparison: "gte" },
    xp: 80,
    nodeType: "checkpoint",
    icon: "crown",
  },
  {
    id: "hundred_wins",
    name: "Inferno Trader",
    description: "Achieve 100 winning trades",
    condition: { type: "winning_trades", value: 100, comparison: "gte" },
    xp: 55,
    nodeType: "milestone",
    icon: "flames",
  },
  {
    id: "streak_fifteen",
    name: "Phoenix Streak",
    description: "Win 15 trades in a row",
    condition: { type: "win_streak", value: 15, comparison: "gte" },
    xp: 65,
    nodeType: "checkpoint",
    icon: "phoenix",
  },
  {
    id: "five_podiums",
    name: "Podium Regular",
    description: "Finish in top 3 of 5 competitions",
    condition: { type: "podium_finishes", value: 5, comparison: "gte" },
    xp: 70,
    nodeType: "milestone",
    icon: "medal",
  },
  {
    id: "ten_completed",
    name: "Eruption Champion",
    description: "Complete 10 competitions",
    condition: { type: "competitions_completed", value: 10, comparison: "gte" },
    xp: 60,
    nodeType: "milestone",
    icon: "eruption",
  },
  {
    id: "one_thirty_wins",
    name: "Fire Master",
    description: "Achieve 130 winning trades",
    condition: { type: "winning_trades", value: 130, comparison: "gte" },
    xp: 70,
    nodeType: "checkpoint",
    icon: "fireball",
  },
  {
    id: "volcano_god",
    name: "Volcano God",
    description: "Win 3 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 3, comparison: "gte" },
    xp: 100,
    nodeType: "legendary",
    icon: "volcanoGod",
  },
];

/**
 * MAP 7: ARCTIC FORTRESS - Multiple Wins
 */
export const MAP_7_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "arctic_arrival",
    name: "Arctic Arrival",
    description: "Complete Map 6: Volcanic Island",
    condition: { type: "map_completed", value: "volcanic_island", comparison: "eq" },
    xp: 40,
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
    id: "one_sixty_wins",
    name: "Frost Champion",
    description: "Achieve 160 winning trades",
    condition: { type: "winning_trades", value: 160, comparison: "gte" },
    xp: 75,
    nodeType: "checkpoint",
    icon: "frost",
  },
  {
    id: "five_wins",
    name: "Ice Champion",
    description: "Win 5 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 5, comparison: "gte" },
    xp: 100,
    nodeType: "checkpoint",
    icon: "iceKing",
  },
  {
    id: "streak_twenty",
    name: "Avalanche Streak",
    description: "Win 20 trades in a row",
    condition: { type: "win_streak", value: 20, comparison: "gte" },
    xp: 90,
    nodeType: "milestone",
    icon: "avalanche",
  },
  {
    id: "ten_podiums",
    name: "Podium Master",
    description: "Finish in top 3 of 10 competitions",
    condition: { type: "podium_finishes", value: 10, comparison: "gte" },
    xp: 85,
    nodeType: "milestone",
    icon: "polarBear",
  },
  {
    id: "fifteen_completed",
    name: "Arctic Veteran",
    description: "Complete 15 competitions",
    condition: { type: "competitions_completed", value: 15, comparison: "gte" },
    xp: 80,
    nodeType: "milestone",
    icon: "iceberg",
  },
  {
    id: "two_hundred_wins",
    name: "Glacier Lord",
    description: "Achieve 200 winning trades",
    condition: { type: "winning_trades", value: 200, comparison: "gte" },
    xp: 95,
    nodeType: "checkpoint",
    icon: "glacier",
  },
  {
    id: "ice_emperor",
    name: "Ice Emperor",
    description: "Win 8 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 8, comparison: "gte" },
    xp: 150,
    nodeType: "legendary",
    icon: "iceEmperor",
  },
];

/**
 * MAP 8: DRAGON REALM - Champion Status
 */
export const MAP_8_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "dragon_gates",
    name: "Dragon's Gate",
    description: "Complete Map 7: Arctic Fortress",
    condition: { type: "map_completed", value: "arctic_fortress", comparison: "eq" },
    xp: 50,
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
    id: "two_fifty_wins",
    name: "Fire Breather",
    description: "Achieve 250 winning trades",
    condition: { type: "winning_trades", value: 250, comparison: "gte" },
    xp: 100,
    nodeType: "checkpoint",
    icon: "dragonHead",
  },
  {
    id: "twelve_wins",
    name: "Dragon Slayer",
    description: "Win 12 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 12, comparison: "gte" },
    xp: 150,
    nodeType: "checkpoint",
    icon: "dragonSlayer",
  },
  {
    id: "streak_twenty_five",
    name: "Dragon's Fury",
    description: "Win 25 trades in a row",
    condition: { type: "win_streak", value: 25, comparison: "gte" },
    xp: 120,
    nodeType: "milestone",
    icon: "dragonWing",
  },
  {
    id: "fifteen_podiums",
    name: "Dragon Champion",
    description: "Finish in top 3 of 15 competitions",
    condition: { type: "podium_finishes", value: 15, comparison: "gte" },
    xp: 110,
    nodeType: "milestone",
    icon: "dragonScale",
  },
  {
    id: "twenty_completed",
    name: "Realm Conqueror",
    description: "Complete 20 competitions",
    condition: { type: "competitions_completed", value: 20, comparison: "gte" },
    xp: 100,
    nodeType: "milestone",
    icon: "cave",
  },
  {
    id: "three_hundred_wins",
    name: "Dragon Lord",
    description: "Achieve 300 winning trades",
    condition: { type: "winning_trades", value: 300, comparison: "gte" },
    xp: 130,
    nodeType: "checkpoint",
    icon: "dragonThrone",
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
 */
export const MAP_9_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "celestial_ascension",
    name: "Celestial Ascension",
    description: "Complete Map 8: Dragon Realm",
    condition: { type: "map_completed", value: "dragon_realm", comparison: "eq" },
    xp: 70,
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
    id: "three_fifty_wins",
    name: "Constellation Master",
    description: "Achieve 350 winning trades",
    condition: { type: "winning_trades", value: 350, comparison: "gte" },
    xp: 130,
    nodeType: "checkpoint",
    icon: "constellation",
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
    id: "streak_thirty",
    name: "Stellar Streak",
    description: "Win 30 trades in a row",
    condition: { type: "win_streak", value: 30, comparison: "gte" },
    xp: 160,
    nodeType: "milestone",
    icon: "comet",
  },
  {
    id: "twenty_podiums",
    name: "Celestial Regular",
    description: "Finish in top 3 of 20 competitions",
    condition: { type: "podium_finishes", value: 20, comparison: "gte" },
    xp: 150,
    nodeType: "milestone",
    icon: "halo",
  },
  {
    id: "thirty_completed",
    name: "Tournament Titan",
    description: "Complete 30 competitions",
    condition: { type: "competitions_completed", value: 30, comparison: "gte" },
    xp: 140,
    nodeType: "milestone",
    icon: "seraph",
  },
  {
    id: "four_hundred_wins",
    name: "Archangel Trader",
    description: "Achieve 400 winning trades",
    condition: { type: "winning_trades", value: 400, comparison: "gte" },
    xp: 170,
    nodeType: "checkpoint",
    icon: "archangel",
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
 */
export const MAP_10_BLUEPRINT: MilestoneBlueprint[] = [
  {
    id: "legend_entry",
    name: "Legend Entry",
    description: "Complete Map 9: Celestial Kingdom",
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
    id: "five_hundred_wins",
    name: "Master of Wins",
    description: "Achieve 500 winning trades",
    condition: { type: "winning_trades", value: 500, comparison: "gte" },
    xp: 200,
    nodeType: "checkpoint",
    icon: "grandChampion",
  },
  {
    id: "thirty_wins",
    name: "Legendary Champion",
    description: "Win 30 competitions (1st place)",
    condition: { type: "first_place_finishes", value: 30, comparison: "gte" },
    xp: 350,
    nodeType: "checkpoint",
    icon: "godThrone",
  },
  {
    id: "streak_fifty",
    name: "Immortal Streak",
    description: "Win 50 trades in a row",
    condition: { type: "win_streak", value: 50, comparison: "gte" },
    xp: 300,
    nodeType: "milestone",
    icon: "immortal",
  },
  {
    id: "thirty_podiums",
    name: "Eternal Podium",
    description: "Finish in top 3 of 30 competitions",
    condition: { type: "podium_finishes", value: 30, comparison: "gte" },
    xp: 250,
    nodeType: "milestone",
    icon: "colosseum",
  },
  {
    id: "fifty_completed",
    name: "Tournament God",
    description: "Complete 50 competitions",
    condition: { type: "competitions_completed", value: 50, comparison: "gte" },
    xp: 220,
    nodeType: "milestone",
    icon: "olympus",
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
    description: "Win 50 competitions (1st place) - Ultimate Achievement",
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
 * MAP METADATA
 */
export const MAP_METADATA: Record<number, { mapId: string; name: string; theme: string; xpBudget: number }> = {
  1: { mapId: "pirate_cove", name: "Pirate Cove", theme: "pirate", xpBudget: 150 },
  2: { mapId: "space_station", name: "Space Station", theme: "space", xpBudget: 200 },
  3: { mapId: "medieval_castle", name: "Medieval Castle", theme: "medieval", xpBudget: 300 },
  4: { mapId: "cyber_city", name: "Cyber City", theme: "cyber", xpBudget: 400 },
  5: { mapId: "ancient_temple", name: "Ancient Temple", theme: "ancient", xpBudget: 500 },
  6: { mapId: "volcanic_island", name: "Volcanic Island", theme: "volcanic", xpBudget: 700 },
  7: { mapId: "arctic_fortress", name: "Arctic Fortress", theme: "arctic", xpBudget: 1000 },
  8: { mapId: "dragon_realm", name: "Dragon Realm", theme: "dragon", xpBudget: 1500 },
  9: { mapId: "celestial_kingdom", name: "Celestial Kingdom", theme: "celestial", xpBudget: 2500 },
  10: { mapId: "hall_of_legends", name: "Hall of Legends", theme: "legendary", xpBudget: 5000 },
};

/**
 * Validate that no conditions are duplicated across all maps
 */
export function validateBlueprints(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const usedConditions = new Set<string>();
  
  for (let mapNum = 1; mapNum <= 10; mapNum++) {
    const blueprint = MAP_BLUEPRINTS[mapNum];
    if (!blueprint) continue;
    
    for (const milestone of blueprint) {
      const condKey = `${milestone.condition.type}:${milestone.condition.value}`;
      
      if (usedConditions.has(condKey)) {
        errors.push(`Duplicate condition: ${condKey} in Map ${mapNum}, milestone ${milestone.id}`);
      }
      usedConditions.add(condKey);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
