import type { IJourneyZone } from "@/database/models/journey-map-config.model";
import type { IMilestoneCondition, IMilestoneReward, MilestoneNodeType } from "@/database/models/journey-milestone.model";

/**
 * Trader's Journey Map Template
 * Treasure Map themed progression system
 * 
 * Map dimensions: 1200 x 800
 * Islands positioned to match the treasure-map.png background
 */

// ============================================
// ZONES DEFINITION - Matching map regions
// ============================================

export const DEFAULT_ZONES: IJourneyZone[] = [
  {
    id: "starting_dock",
    name: "Starting Dock",
    description: "Where every trader's voyage begins",
    order: 1,
    position: { x: 120, y: 600 },
    color: "#22C55E",
    icon: "anchor",
    isUnlockable: false,
  },
  {
    id: "calm_waters",
    name: "Calm Waters",
    description: "Learn the basics in safe harbors",
    order: 2,
    position: { x: 350, y: 450 },
    color: "#3B82F6",
    icon: "compass",
    isUnlockable: true,
    unlockCondition: {
      type: "milestone_complete",
      value: "first_trade",
    },
  },
  {
    id: "trading_paths",
    name: "Trading Paths",
    description: "Choose your destiny",
    order: 3,
    position: { x: 580, y: 350 },
    color: "#8B5CF6",
    icon: "pirateMap",
    isUnlockable: true,
    unlockCondition: {
      type: "milestone_complete",
      value: "first_profit",
    },
  },
  {
    id: "competition_arena",
    name: "Competition Arena",
    description: "Battle other traders",
    order: 4,
    position: { x: 820, y: 320 },
    color: "#F59E0B",
    icon: "pirateSword",
    isUnlockable: true,
    unlockCondition: {
      type: "milestone_complete",
      value: "choose_path",
    },
  },
  {
    id: "mastery_islands",
    name: "Skull Island",
    description: "Legendary achievements await",
    order: 5,
    position: { x: 1050, y: 180 },
    color: "#EF4444",
    icon: "skull",
    isUnlockable: true,
    unlockCondition: {
      type: "milestone_complete",
      value: "first_podium",
    },
  },
];

// ============================================
// MILESTONE INTERFACE
// ============================================

export interface MilestoneTemplate {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  zoneId: string;
  position: { x: number; y: number };
  nodeType: MilestoneNodeType;
  icon: string;
  color: string;
  size: "small" | "medium" | "large";
  unlockCondition?: IMilestoneCondition;
  completeCondition: IMilestoneCondition;
  rewards: IMilestoneReward;
  connectedTo: string[];
  connectedFrom: string[];
  isRequired: boolean;
  isAutoComplete: boolean;
  order: number;
  tooltipText?: string;
  celebrationText?: string;
}

// ============================================
// MILESTONES - Positioned on treasure map islands
// ============================================

export const DEFAULT_MILESTONES: MilestoneTemplate[] = [
  // ========================================
  // ZONE 1: STARTING DOCK (Bottom-left ship area)
  // ========================================
  {
    id: "account_created",
    name: "Set Sail",
    description: "Your trading adventure begins! Welcome aboard, captain!",
    shortDescription: "Account created",
    zoneId: "starting_dock",
    position: { x: 85, y: 680 }, // Near the ship
    nodeType: "start",
    icon: "pirateShip",
    color: "#22C55E",
    size: "large",
    completeCondition: { type: "account_created" },
    rewards: { xp: 5 },
    connectedTo: ["first_deposit"],
    connectedFrom: [],
    isRequired: true,
    isAutoComplete: true,
    order: 1,
    celebrationText: "Welcome aboard, Captain! Your treasure hunting begins!",
  },
  {
    id: "first_deposit",
    name: "First Treasure",
    description: "Load your ship with gold to begin your voyage",
    shortDescription: "First deposit made",
    zoneId: "starting_dock",
    position: { x: 165, y: 590 }, // Dock island
    nodeType: "milestone",
    icon: "pirateCoins",
    color: "#22C55E",
    size: "medium",
    unlockCondition: { type: "account_created" },
    completeCondition: { type: "first_deposit" },
    rewards: { xp: 0, badgeId: "social_deposit" }, // Badge gives XP, not milestone
    connectedTo: ["first_trade"],
    connectedFrom: ["account_created"],
    isRequired: true,
    isAutoComplete: false,
    order: 2,
    tooltipText: "Deposit gold to fund your expedition",
    celebrationText: "Your ship is loaded! Time to seek fortune!",
  },
  {
    id: "first_trade",
    name: "First Voyage",
    description: "Execute your first trade and set sail into the markets",
    shortDescription: "First trade placed",
    zoneId: "starting_dock",
    position: { x: 260, y: 510 }, // Island with trees
    nodeType: "milestone",
    icon: "compass",
    color: "#22C55E",
    size: "medium",
    unlockCondition: { type: "first_deposit" },
    completeCondition: { type: "total_trades", value: 1, comparison: "gte" },
    rewards: { xp: 0, badgeId: "trade_first" },
    connectedTo: ["first_buy", "first_sell"],
    connectedFrom: ["first_deposit"],
    isRequired: true,
    isAutoComplete: false,
    order: 3,
    tooltipText: "Make your first market move",
    celebrationText: "You've set sail! The markets await your conquest!",
  },

  // ========================================
  // ZONE 2: CALM WATERS (Middle-left islands)
  // ========================================
  {
    id: "first_buy",
    name: "Rising Tide",
    description: "Open a long position - ride the wave up!",
    shortDescription: "First buy order",
    zoneId: "calm_waters",
    position: { x: 340, y: 440 }, // Small island
    nodeType: "milestone",
    icon: "buy",
    color: "#3B82F6",
    size: "small",
    unlockCondition: { type: "total_trades", value: 1, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 2, comparison: "gte" },
    rewards: { xp: 10 },
    connectedTo: ["close_trade"],
    connectedFrom: ["first_trade"],
    isRequired: false,
    isAutoComplete: false,
    order: 4,
    tooltipText: "Execute a buy order",
  },
  {
    id: "first_sell",
    name: "Falling Anchor",
    description: "Open a short position - profit from the descent!",
    shortDescription: "First sell order",
    zoneId: "calm_waters",
    position: { x: 340, y: 560 }, // Lower island
    nodeType: "milestone",
    icon: "sell",
    color: "#3B82F6",
    size: "small",
    unlockCondition: { type: "total_trades", value: 1, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 3, comparison: "gte" },
    rewards: { xp: 10 },
    connectedTo: ["close_trade"],
    connectedFrom: ["first_trade"],
    isRequired: false,
    isAutoComplete: false,
    order: 5,
    tooltipText: "Execute a sell order",
  },
  {
    id: "close_trade",
    name: "Safe Harbor",
    description: "Successfully close a position and secure your loot",
    shortDescription: "Trade closed",
    zoneId: "calm_waters",
    position: { x: 430, y: 490 }, // Island with waterfall
    nodeType: "milestone",
    icon: "anchor",
    color: "#3B82F6",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 2, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 5, comparison: "gte" },
    rewards: { xp: 15 },
    connectedTo: ["first_profit", "market_lesson"],
    connectedFrom: ["first_buy", "first_sell"],
    isRequired: true,
    isAutoComplete: false,
    order: 6,
    tooltipText: "Close your position for treasure",
    celebrationText: "You've mastered the art of securing profits!",
  },
  {
    id: "first_profit",
    name: "Golden Doubloons",
    description: "Claim your first profitable bounty!",
    shortDescription: "First winning trade",
    zoneId: "calm_waters",
    position: { x: 520, y: 410 }, // Island with cave
    nodeType: "milestone",
    icon: "treasure",
    color: "#22C55E",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 5, comparison: "gte" },
    completeCondition: { type: "winning_trades", value: 1, comparison: "gte" },
    rewards: { xp: 0, badgeId: "profit_first" },
    connectedTo: ["active_trader", "choose_path"],
    connectedFrom: ["close_trade"],
    isRequired: true,
    isAutoComplete: false,
    order: 7,
    tooltipText: "Close a trade in profit",
    celebrationText: "Gold! You've found your first treasure!",
  },
  {
    id: "market_lesson",
    name: "Stormy Seas",
    description: "Every captain faces rough waters - learn from losses",
    shortDescription: "First loss learned",
    zoneId: "calm_waters",
    position: { x: 520, y: 570 }, // Rocky island
    nodeType: "lesson",
    icon: "barrel",
    color: "#F59E0B",
    size: "small",
    unlockCondition: { type: "total_trades", value: 5, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 10, comparison: "gte" },
    rewards: { xp: 15 },
    connectedTo: ["active_trader"],
    connectedFrom: ["close_trade"],
    isRequired: false,
    isAutoComplete: false,
    order: 8,
    tooltipText: "Losses teach valuable lessons",
    celebrationText: "A wise captain learns from every storm!",
  },
  {
    id: "active_trader",
    name: "Seasoned Sailor",
    description: "Complete 10 voyages to prove your worth",
    shortDescription: "10 trades completed",
    zoneId: "calm_waters",
    position: { x: 610, y: 490 }, // Larger middle island
    nodeType: "checkpoint",
    icon: "pirateHat",
    color: "#3B82F6",
    size: "medium",
    unlockCondition: { type: "winning_trades", value: 1, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 10, comparison: "gte" },
    rewards: { xp: 0, badgeId: "trade_10" },
    connectedTo: ["choose_path"],
    connectedFrom: ["first_profit", "market_lesson"],
    isRequired: true,
    isAutoComplete: false,
    order: 9,
    tooltipText: "Reach 10 total voyages",
    celebrationText: "You're becoming a true sea trader!",
  },

  // ========================================
  // ZONE 3: TRADING PATHS (Center - Red gate island area)
  // ========================================
  {
    id: "choose_path",
    name: "Crossroads Isle",
    description: "Choose your trading destiny at the ancient gates",
    shortDescription: "Path selection",
    zoneId: "trading_paths",
    position: { x: 560, y: 270 }, // Island with red gate
    nodeType: "branch",
    icon: "pirateMap",
    color: "#8B5CF6",
    size: "large",
    unlockCondition: { type: "total_trades", value: 10, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 15, comparison: "gte" },
    rewards: { xp: 20 },
    connectedTo: ["speed_demon", "patient_trader", "risk_guardian"],
    connectedFrom: ["first_profit", "active_trader"],
    isRequired: true,
    isAutoComplete: false,
    order: 10,
    tooltipText: "Choose your trading style",
    celebrationText: "The ancient gates reveal three paths...",
  },
  {
    id: "speed_demon",
    name: "Lightning Bay",
    description: "Master the art of quick strikes",
    shortDescription: "Fast trading path",
    zoneId: "trading_paths",
    position: { x: 650, y: 200 }, // Upper island
    nodeType: "milestone",
    icon: "pirateCannon",
    color: "#F59E0B",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 15, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 25, comparison: "gte" },
    rewards: { xp: 35 },
    connectedTo: ["scalper_cove"],
    connectedFrom: ["choose_path"],
    isRequired: false,
    isAutoComplete: false,
    order: 11,
    tooltipText: "Focus on quick trades",
    celebrationText: "Speed is your weapon!",
  },
  {
    id: "patient_trader",
    name: "Wisdom Shores",
    description: "Learn patience - hold positions for bigger rewards",
    shortDescription: "Swing trading path",
    zoneId: "trading_paths",
    position: { x: 650, y: 290 }, // Middle island
    nodeType: "milestone",
    icon: "longTermInvestment",
    color: "#3B82F6",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 15, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 25, comparison: "gte" },
    rewards: { xp: 35 },
    connectedTo: ["consistent_winner"],
    connectedFrom: ["choose_path"],
    isRequired: false,
    isAutoComplete: false,
    order: 12,
    tooltipText: "Hold for bigger moves",
    celebrationText: "Patience rewards those who wait!",
  },
  {
    id: "risk_guardian",
    name: "Shield Island",
    description: "Master the art of protecting your treasure",
    shortDescription: "Risk management path",
    zoneId: "trading_paths",
    position: { x: 650, y: 380 }, // Lower island
    nodeType: "milestone",
    icon: "shield1",
    color: "#22C55E",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 15, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 25, comparison: "gte" },
    rewards: { xp: 0, badgeId: "risk_survivor" },
    connectedTo: ["risk_master"],
    connectedFrom: ["choose_path"],
    isRequired: false,
    isAutoComplete: false,
    order: 13,
    tooltipText: "Learn risk management",
    celebrationText: "A protected treasure is a kept treasure!",
  },
  {
    id: "scalper_cove",
    name: "Scalper's Cove",
    description: "Execute 50 lightning-fast raids",
    shortDescription: "50 trades completed",
    zoneId: "trading_paths",
    position: { x: 740, y: 200 }, // Upper right island
    nodeType: "checkpoint",
    icon: "piratePistol",
    color: "#F59E0B",
    size: "small",
    unlockCondition: { type: "total_trades", value: 25, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 50, comparison: "gte" },
    rewards: { xp: 0, badgeId: "trade_50" },
    connectedTo: ["enter_arena"],
    connectedFrom: ["speed_demon"],
    isRequired: false,
    isAutoComplete: false,
    order: 14,
  },
  {
    id: "consistent_winner",
    name: "Victory Streak",
    description: "Achieve 5 consecutive winning battles",
    shortDescription: "5 win streak",
    zoneId: "trading_paths",
    position: { x: 740, y: 290 }, // Middle right island
    nodeType: "checkpoint",
    icon: "star1",
    color: "#3B82F6",
    size: "small",
    unlockCondition: { type: "total_trades", value: 25, comparison: "gte" },
    completeCondition: { type: "win_streak", value: 5, comparison: "gte" },
    rewards: { xp: 0, badgeId: "profit_win_streak_5" },
    connectedTo: ["enter_arena"],
    connectedFrom: ["patient_trader"],
    isRequired: false,
    isAutoComplete: false,
    order: 15,
    celebrationText: "5 victories in a row! Unstoppable!",
  },
  {
    id: "risk_master",
    name: "Fortress Isle",
    description: "Trade without catastrophic losses for 50 voyages",
    shortDescription: "No liquidation",
    zoneId: "trading_paths",
    position: { x: 740, y: 380 }, // Lower right island
    nodeType: "checkpoint",
    icon: "magicShield3D",
    color: "#22C55E",
    size: "small",
    unlockCondition: { type: "total_trades", value: 25, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 50, comparison: "gte" },
    rewards: { xp: 0, badgeId: "risk_iron_man" },
    connectedTo: ["enter_arena"],
    connectedFrom: ["risk_guardian"],
    isRequired: false,
    isAutoComplete: false,
    order: 16,
    celebrationText: "Your fortress stands strong!",
  },

  // ========================================
  // ZONE 4: COMPETITION ARENA (Right side islands)
  // ========================================
  {
    id: "enter_arena",
    name: "Battle Arena",
    description: "Enter the grand colosseum and face other captains",
    shortDescription: "First competition",
    zoneId: "competition_arena",
    position: { x: 830, y: 290 }, // Arena island
    nodeType: "milestone",
    icon: "pirateSword",
    color: "#F59E0B",
    size: "large",
    unlockCondition: { type: "total_trades", value: 30, comparison: "gte" },
    completeCondition: { type: "competitions_entered", value: 1, comparison: "gte" },
    rewards: { xp: 0, badgeId: "comp_first_entry" },
    connectedTo: ["competition_regular", "first_podium"],
    connectedFrom: ["scalper_cove", "consistent_winner", "risk_master"],
    isRequired: true,
    isAutoComplete: false,
    order: 17,
    tooltipText: "Join the battle!",
    celebrationText: "Welcome to the Arena, warrior!",
  },
  {
    id: "competition_regular",
    name: "Arena Regular",
    description: "Complete 3 glorious battles",
    shortDescription: "3 competitions done",
    zoneId: "competition_arena",
    position: { x: 900, y: 210 }, // Upper arena island
    nodeType: "milestone",
    icon: "pirateFlag",
    color: "#F59E0B",
    size: "medium",
    unlockCondition: { type: "competitions_entered", value: 1, comparison: "gte" },
    completeCondition: { type: "competitions_completed", value: 3, comparison: "gte" },
    rewards: { xp: 40 },
    connectedTo: ["first_podium"],
    connectedFrom: ["enter_arena"],
    isRequired: false,
    isAutoComplete: false,
    order: 18,
    tooltipText: "Complete 3 competitions",
    celebrationText: "A true arena warrior!",
  },
  {
    id: "first_podium",
    name: "Podium Glory",
    description: "Claim your place among the top 3 champions",
    shortDescription: "Top 3 finish",
    zoneId: "competition_arena",
    position: { x: 900, y: 360 }, // Lower arena island
    nodeType: "checkpoint",
    icon: "pirateHook",
    color: "#F59E0B",
    size: "large",
    unlockCondition: { type: "competitions_entered", value: 1, comparison: "gte" },
    completeCondition: { type: "podium_finishes", value: 1, comparison: "gte" },
    rewards: { xp: 0, badgeId: "comp_podium" },
    connectedTo: ["champion", "hot_streak"],
    connectedFrom: ["enter_arena", "competition_regular"],
    isRequired: true,
    isAutoComplete: false,
    order: 19,
    tooltipText: "Achieve a top 3 finish",
    celebrationText: "The crowd roars your name!",
  },

  // ========================================
  // ZONE 5: SKULL ISLAND - MASTERY (Top-right volcano)
  // ========================================
  {
    id: "champion",
    name: "Champion's Peak",
    description: "Claim ultimate victory - 1st place!",
    shortDescription: "First win",
    zoneId: "mastery_islands",
    position: { x: 1000, y: 200 }, // Near skull volcano
    nodeType: "legendary",
    icon: "parrot",
    color: "#EF4444",
    size: "large",
    unlockCondition: { type: "podium_finishes", value: 1, comparison: "gte" },
    completeCondition: { type: "first_place_finishes", value: 1, comparison: "gte" },
    rewards: { xp: 0, badgeId: "comp_first_win" },
    connectedTo: ["legendary_captain"],
    connectedFrom: ["first_podium"],
    isRequired: false,
    isAutoComplete: false,
    order: 20,
    tooltipText: "Win a competition!",
    celebrationText: "CHAMPION! The treasure is yours!",
  },
  {
    id: "hot_streak",
    name: "Inferno Ridge",
    description: "Achieve 10 consecutive victories - unstoppable!",
    shortDescription: "10 win streak",
    zoneId: "mastery_islands",
    position: { x: 1000, y: 300 }, // Volcano slope
    nodeType: "legendary",
    icon: "fireSpell",
    color: "#EF4444",
    size: "medium",
    unlockCondition: { type: "podium_finishes", value: 1, comparison: "gte" },
    completeCondition: { type: "win_streak", value: 10, comparison: "gte" },
    rewards: { xp: 0, badgeId: "profit_win_streak_10" },
    connectedTo: ["legendary_captain"],
    connectedFrom: ["first_podium"],
    isRequired: false,
    isAutoComplete: false,
    order: 21,
    tooltipText: "Get 10 wins in a row",
    celebrationText: "ON FIRE! Nothing can stop you!",
  },
  {
    id: "legendary_captain",
    name: "Pirate King",
    description: "Reach the pinnacle - become a legend",
    shortDescription: "Legendary status",
    zoneId: "mastery_islands",
    position: { x: 1100, y: 150 }, // Skull volcano peak
    nodeType: "legendary",
    icon: "skull",
    color: "#EF4444",
    size: "large",
    unlockCondition: { type: "first_place_finishes", value: 1, comparison: "gte" },
    completeCondition: { type: "first_place_finishes", value: 3, comparison: "gte" },
    rewards: { xp: 0, badgeId: "comp_3_wins" },
    connectedTo: [],
    connectedFrom: ["champion", "hot_streak"],
    isRequired: false,
    isAutoComplete: false,
    order: 22,
    tooltipText: "Win 3 competitions to become legendary",
    celebrationText: "ALL HAIL THE PIRATE KING!",
  },

  // ========================================
  // BONUS: TREASURE CHEST (Bottom-right area)
  // ========================================
  {
    id: "treasure_hunter",
    name: "Treasure Found",
    description: "Discover the legendary treasure chest!",
    shortDescription: "100 trades milestone",
    zoneId: "competition_arena",
    position: { x: 1050, y: 580 }, // Treasure chest location
    nodeType: "legendary",
    icon: "chest",
    color: "#F59E0B",
    size: "large",
    unlockCondition: { type: "total_trades", value: 50, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 100, comparison: "gte" },
    rewards: { xp: 0, badgeId: "trade_100" },
    connectedTo: [],
    connectedFrom: ["first_podium"],
    isRequired: false,
    isAutoComplete: false,
    order: 23,
    tooltipText: "Complete 100 trades",
    celebrationText: "X marks the spot! You found the treasure!",
  },
];

// ============================================
// MAP CONFIG
// ============================================

export const DEFAULT_MAP_CONFIG = {
  mapId: "traders_journey",
  name: "Trader's Journey",
  description: "Navigate the seas from novice to legendary captain",
  zones: DEFAULT_ZONES,
  defaultStartNode: "account_created",
  backgroundColor: "#1a3a5c",
  backgroundImage: "/assets/treasure-map.png",
  isActive: true,
  version: 1,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getMilestoneById(id: string): MilestoneTemplate | undefined {
  return DEFAULT_MILESTONES.find(m => m.id === id);
}

export function getMilestonesByZone(zoneId: string): MilestoneTemplate[] {
  return DEFAULT_MILESTONES.filter(m => m.zoneId === zoneId);
}

export function getZoneById(id: string): IJourneyZone | undefined {
  return DEFAULT_ZONES.find(z => z.id === id);
}
