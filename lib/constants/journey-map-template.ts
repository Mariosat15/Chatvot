import type { IJourneyZone } from "@/database/models/journey-map-config.model";
import type { IMilestoneCondition, IMilestoneReward, MilestoneNodeType } from "@/database/models/journey-milestone.model";

/**
 * Default Journey Map Template
 * "The Trader's Journey" - A pirate-themed progression map
 */

// ============================================
// ZONES DEFINITION
// ============================================

export const DEFAULT_ZONES: IJourneyZone[] = [
  {
    id: "starting_dock",
    name: "Starting Dock",
    description: "Where every trader's journey begins",
    order: 1,
    position: { x: 100, y: 400 },
    color: "#22C55E",
    icon: "flag",
    isUnlockable: false, // Always unlocked
  },
  {
    id: "calm_waters",
    name: "Calm Waters",
    description: "Learn the basics of trading",
    order: 2,
    position: { x: 300, y: 350 },
    color: "#3B82F6",
    icon: "guideBook",
    isUnlockable: true,
    unlockCondition: {
      type: "milestone_complete",
      value: "first_trade",
    },
  },
  {
    id: "trading_paths",
    name: "Trading Paths",
    description: "Choose your trading style",
    order: 3,
    position: { x: 500, y: 300 },
    color: "#8B5CF6",
    icon: "maps",
    isUnlockable: true,
    unlockCondition: {
      type: "milestone_complete",
      value: "first_profit",
    },
  },
  {
    id: "competition_arena",
    name: "Competition Arena",
    description: "Test your skills against others",
    order: 4,
    position: { x: 700, y: 250 },
    color: "#F59E0B",
    icon: "trophy",
    isUnlockable: true,
    unlockCondition: {
      type: "milestone_complete",
      value: "choose_path",
    },
  },
  {
    id: "mastery_islands",
    name: "Mastery Islands",
    description: "Advanced achievements await",
    order: 5,
    position: { x: 900, y: 200 },
    color: "#EF4444",
    icon: "crown",
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
// MILESTONES DEFINITION
// ============================================

export const DEFAULT_MILESTONES: MilestoneTemplate[] = [
  // ========================================
  // ZONE 1: STARTING DOCK
  // ========================================
  {
    id: "account_created",
    name: "Journey Begins",
    description: "You've created your account and your trading journey starts here!",
    shortDescription: "Account created",
    zoneId: "starting_dock",
    position: { x: 80, y: 400 },
    nodeType: "start",
    icon: "rookie",
    color: "#22C55E",
    size: "large",
    completeCondition: { type: "account_created" },
    rewards: { xp: 5 },
    connectedTo: ["first_deposit"],
    connectedFrom: [],
    isRequired: true,
    isAutoComplete: true,
    order: 1,
    celebrationText: "Welcome aboard, trader! Your journey begins now.",
  },
  {
    id: "first_deposit",
    name: "First Capital",
    description: "Make your first deposit to fund your trading journey",
    shortDescription: "First deposit made",
    zoneId: "starting_dock",
    position: { x: 150, y: 380 },
    nodeType: "milestone",
    icon: "moneyDeposit",
    color: "#22C55E",
    size: "medium",
    unlockCondition: { type: "account_created" },
    completeCondition: { type: "first_deposit" },
    rewards: { xp: 15, badgeId: "social_deposit" },
    connectedTo: ["first_trade"],
    connectedFrom: ["account_created"],
    isRequired: true,
    isAutoComplete: false,
    order: 2,
    tooltipText: "Deposit funds to start trading",
    celebrationText: "Excellent! You've funded your account. Time to trade!",
  },
  {
    id: "first_trade",
    name: "First Trade",
    description: "Execute your first trade and enter the markets",
    shortDescription: "First trade placed",
    zoneId: "starting_dock",
    position: { x: 220, y: 360 },
    nodeType: "milestone",
    icon: "trade",
    color: "#22C55E",
    size: "medium",
    unlockCondition: { type: "first_deposit" },
    completeCondition: { type: "total_trades", value: 1, comparison: "gte" },
    rewards: { xp: 20, badgeId: "trade_first" },
    connectedTo: ["first_buy", "first_sell"],
    connectedFrom: ["first_deposit"],
    isRequired: true,
    isAutoComplete: false,
    order: 3,
    tooltipText: "Place your first market order",
    celebrationText: "You've made your first trade! The adventure continues.",
  },

  // ========================================
  // ZONE 2: CALM WATERS
  // ========================================
  {
    id: "first_buy",
    name: "First Buy",
    description: "Open a long position (buy)",
    shortDescription: "First buy order",
    zoneId: "calm_waters",
    position: { x: 290, y: 340 },
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
    name: "First Sell",
    description: "Open a short position (sell)",
    shortDescription: "First sell order",
    zoneId: "calm_waters",
    position: { x: 290, y: 380 },
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
    name: "Close a Trade",
    description: "Successfully close a trading position",
    shortDescription: "Trade closed",
    zoneId: "calm_waters",
    position: { x: 360, y: 360 },
    nodeType: "milestone",
    icon: "target",
    color: "#3B82F6",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 2, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 5, comparison: "gte" },
    rewards: { xp: 15 },
    connectedTo: ["first_profit", "first_loss"],
    connectedFrom: ["first_buy", "first_sell"],
    isRequired: true,
    isAutoComplete: false,
    order: 6,
    tooltipText: "Close your position for profit or loss",
    celebrationText: "You've learned to close trades. Understanding exits is crucial!",
  },
  {
    id: "first_profit",
    name: "First Profit",
    description: "Make your first profitable trade",
    shortDescription: "First winning trade",
    zoneId: "calm_waters",
    position: { x: 430, y: 340 },
    nodeType: "milestone",
    icon: "profit",
    color: "#22C55E",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 5, comparison: "gte" },
    completeCondition: { type: "winning_trades", value: 1, comparison: "gte" },
    rewards: { xp: 25, badgeId: "profit_first" },
    connectedTo: ["ten_trades", "choose_path"],
    connectedFrom: ["close_trade"],
    isRequired: true,
    isAutoComplete: false,
    order: 7,
    tooltipText: "Close a trade in profit",
    celebrationText: "Your first profit! The market rewarded your patience.",
  },
  {
    id: "first_loss",
    name: "Market Lesson",
    description: "Experience your first loss - an important lesson",
    shortDescription: "First loss learned",
    zoneId: "calm_waters",
    position: { x: 430, y: 380 },
    nodeType: "lesson",
    icon: "guideBook",
    color: "#F59E0B",
    size: "small",
    unlockCondition: { type: "total_trades", value: 5, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 10, comparison: "gte" },
    rewards: { xp: 15 },
    connectedTo: ["ten_trades"],
    connectedFrom: ["close_trade"],
    isRequired: false,
    isAutoComplete: false,
    order: 8,
    tooltipText: "Losses are part of trading - learn from them",
    celebrationText: "Every trader faces losses. What matters is how you learn from them.",
  },
  {
    id: "ten_trades",
    name: "Active Trader",
    description: "Complete 10 trades total",
    shortDescription: "10 trades completed",
    zoneId: "calm_waters",
    position: { x: 500, y: 360 },
    nodeType: "checkpoint",
    icon: "starBadge",
    color: "#3B82F6",
    size: "medium",
    unlockCondition: { type: "winning_trades", value: 1, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 10, comparison: "gte" },
    rewards: { xp: 30, badgeId: "trade_10" },
    connectedTo: ["choose_path"],
    connectedFrom: ["first_profit", "first_loss"],
    isRequired: true,
    isAutoComplete: false,
    order: 9,
    tooltipText: "Reach 10 total trades",
    celebrationText: "10 trades completed! You're getting the hang of this.",
  },

  // ========================================
  // ZONE 3: TRADING PATHS (Branching)
  // ========================================
  {
    id: "choose_path",
    name: "Choose Your Path",
    description: "Select your trading style focus",
    shortDescription: "Path selection",
    zoneId: "trading_paths",
    position: { x: 570, y: 320 },
    nodeType: "branch",
    icon: "maps",
    color: "#8B5CF6",
    size: "large",
    unlockCondition: { type: "total_trades", value: 10, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 15, comparison: "gte" },
    rewards: { xp: 20 },
    connectedTo: ["fast_trades_path", "swing_trades_path", "risk_control_path"],
    connectedFrom: ["first_profit", "ten_trades"],
    isRequired: true,
    isAutoComplete: false,
    order: 10,
    tooltipText: "Choose your preferred trading style",
    celebrationText: "Time to specialize! Choose the path that suits your style.",
  },
  {
    id: "fast_trades_path",
    name: "Speed Demon",
    description: "Master quick trades and scalping",
    shortDescription: "Fast trading path",
    zoneId: "trading_paths",
    position: { x: 640, y: 280 },
    nodeType: "milestone",
    icon: "lightningSpell",
    color: "#F59E0B",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 15, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 25, comparison: "gte" },
    rewards: { xp: 35 },
    connectedTo: ["scalper_badge"],
    connectedFrom: ["choose_path"],
    isRequired: false,
    isAutoComplete: false,
    order: 11,
    tooltipText: "Focus on quick entry and exit",
    celebrationText: "Speed is your ally! Quick trades can be very profitable.",
  },
  {
    id: "swing_trades_path",
    name: "Patient Trader",
    description: "Learn to hold positions longer",
    shortDescription: "Swing trading path",
    zoneId: "trading_paths",
    position: { x: 640, y: 320 },
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
    tooltipText: "Hold positions for bigger moves",
    celebrationText: "Patience pays! Swing trading captures larger market moves.",
  },
  {
    id: "risk_control_path",
    name: "Risk Guardian",
    description: "Focus on protecting your capital",
    shortDescription: "Risk management path",
    zoneId: "trading_paths",
    position: { x: 640, y: 360 },
    nodeType: "milestone",
    icon: "shield1",
    color: "#22C55E",
    size: "medium",
    unlockCondition: { type: "total_trades", value: 15, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 25, comparison: "gte" },
    rewards: { xp: 35, badgeId: "risk_survivor" },
    connectedTo: ["risk_master"],
    connectedFrom: ["choose_path"],
    isRequired: false,
    isAutoComplete: false,
    order: 13,
    tooltipText: "Learn to manage risk effectively",
    celebrationText: "Risk management is the foundation of trading longevity!",
  },
  {
    id: "scalper_badge",
    name: "Scalper",
    description: "Execute 50 quick trades",
    shortDescription: "50 trades completed",
    zoneId: "trading_paths",
    position: { x: 710, y: 280 },
    nodeType: "checkpoint",
    icon: "archer",
    color: "#F59E0B",
    size: "small",
    unlockCondition: { type: "total_trades", value: 25, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 50, comparison: "gte" },
    rewards: { xp: 40, badgeId: "trade_50" },
    connectedTo: ["join_competition"],
    connectedFrom: ["fast_trades_path"],
    isRequired: false,
    isAutoComplete: false,
    order: 14,
  },
  {
    id: "consistent_winner",
    name: "Consistent Winner",
    description: "Achieve 5 winning trades in a row",
    shortDescription: "5 win streak",
    zoneId: "trading_paths",
    position: { x: 710, y: 320 },
    nodeType: "checkpoint",
    icon: "star1",
    color: "#3B82F6",
    size: "small",
    unlockCondition: { type: "total_trades", value: 25, comparison: "gte" },
    completeCondition: { type: "win_streak", value: 5, comparison: "gte" },
    rewards: { xp: 50, badgeId: "profit_win_streak_5" },
    connectedTo: ["join_competition"],
    connectedFrom: ["swing_trades_path"],
    isRequired: false,
    isAutoComplete: false,
    order: 15,
    celebrationText: "5 wins in a row! Your consistency is improving!",
  },
  {
    id: "risk_master",
    name: "Risk Master",
    description: "Trade without liquidation for 20 trades",
    shortDescription: "No liquidation",
    zoneId: "trading_paths",
    position: { x: 710, y: 360 },
    nodeType: "checkpoint",
    icon: "magicShield3D",
    color: "#22C55E",
    size: "small",
    unlockCondition: { type: "total_trades", value: 25, comparison: "gte" },
    completeCondition: { type: "total_trades", value: 50, comparison: "gte", minTrades: 50 },
    rewards: { xp: 50, badgeId: "risk_iron_man" },
    connectedTo: ["join_competition"],
    connectedFrom: ["risk_control_path"],
    isRequired: false,
    isAutoComplete: false,
    order: 16,
    celebrationText: "Excellent risk management! Your capital is protected.",
  },

  // ========================================
  // ZONE 4: COMPETITION ARENA
  // ========================================
  {
    id: "join_competition",
    name: "Enter the Arena",
    description: "Join your first trading competition",
    shortDescription: "First competition",
    zoneId: "competition_arena",
    position: { x: 780, y: 280 },
    nodeType: "milestone",
    icon: "trophy",
    color: "#F59E0B",
    size: "large",
    unlockCondition: { type: "total_trades", value: 30, comparison: "gte" },
    completeCondition: { type: "competitions_entered", value: 1, comparison: "gte" },
    rewards: { xp: 30, badgeId: "comp_first_entry" },
    connectedTo: ["complete_competitions", "first_podium"],
    connectedFrom: ["scalper_badge", "consistent_winner", "risk_master"],
    isRequired: true,
    isAutoComplete: false,
    order: 17,
    tooltipText: "Join a competition to test your skills",
    celebrationText: "Welcome to the arena! Compete against other traders.",
  },
  {
    id: "complete_competitions",
    name: "Competition Regular",
    description: "Complete 3 competitions",
    shortDescription: "3 competitions done",
    zoneId: "competition_arena",
    position: { x: 850, y: 260 },
    nodeType: "milestone",
    icon: "trophyStar",
    color: "#F59E0B",
    size: "medium",
    unlockCondition: { type: "competitions_entered", value: 1, comparison: "gte" },
    completeCondition: { type: "competitions_completed", value: 3, comparison: "gte" },
    rewards: { xp: 40 },
    connectedTo: ["first_podium"],
    connectedFrom: ["join_competition"],
    isRequired: false,
    isAutoComplete: false,
    order: 18,
    tooltipText: "Complete 3 competitions",
    celebrationText: "You're becoming a competition regular!",
  },
  {
    id: "first_podium",
    name: "First Podium",
    description: "Finish in the top 3 of a competition",
    shortDescription: "Top 3 finish",
    zoneId: "competition_arena",
    position: { x: 850, y: 300 },
    nodeType: "checkpoint",
    icon: "goldMedal",
    color: "#F59E0B",
    size: "large",
    unlockCondition: { type: "competitions_entered", value: 1, comparison: "gte" },
    completeCondition: { type: "podium_finishes", value: 1, comparison: "gte" },
    rewards: { xp: 75, badgeId: "comp_podium" },
    connectedTo: ["first_victory", "win_streak_master"],
    connectedFrom: ["join_competition", "complete_competitions"],
    isRequired: true,
    isAutoComplete: false,
    order: 19,
    tooltipText: "Achieve a top 3 finish",
    celebrationText: "Podium finish! You're among the best!",
  },

  // ========================================
  // ZONE 5: MASTERY ISLANDS
  // ========================================
  {
    id: "first_victory",
    name: "Champion",
    description: "Win a competition (1st place)",
    shortDescription: "First win",
    zoneId: "mastery_islands",
    position: { x: 920, y: 260 },
    nodeType: "legendary",
    icon: "champion",
    color: "#EF4444",
    size: "large",
    unlockCondition: { type: "podium_finishes", value: 1, comparison: "gte" },
    completeCondition: { type: "first_place_finishes", value: 1, comparison: "gte" },
    rewards: { xp: 100, badgeId: "comp_first_win" },
    connectedTo: ["legendary_trader"],
    connectedFrom: ["first_podium"],
    isRequired: false,
    isAutoComplete: false,
    order: 20,
    tooltipText: "Win your first competition",
    celebrationText: "CHAMPION! You've won your first competition!",
  },
  {
    id: "win_streak_master",
    name: "Hot Streak",
    description: "Achieve a 10-trade win streak",
    shortDescription: "10 win streak",
    zoneId: "mastery_islands",
    position: { x: 920, y: 300 },
    nodeType: "legendary",
    icon: "fireSpell",
    color: "#EF4444",
    size: "medium",
    unlockCondition: { type: "podium_finishes", value: 1, comparison: "gte" },
    completeCondition: { type: "win_streak", value: 10, comparison: "gte" },
    rewards: { xp: 80, badgeId: "profit_win_streak_10" },
    connectedTo: ["legendary_trader"],
    connectedFrom: ["first_podium"],
    isRequired: false,
    isAutoComplete: false,
    order: 21,
    tooltipText: "Get 10 winning trades in a row",
    celebrationText: "UNSTOPPABLE! 10 wins in a row!",
  },
  {
    id: "legendary_trader",
    name: "Legendary Trader",
    description: "Reach the pinnacle of trading achievement",
    shortDescription: "Legendary status",
    zoneId: "mastery_islands",
    position: { x: 990, y: 280 },
    nodeType: "legendary",
    icon: "crown",
    color: "#EF4444",
    size: "large",
    unlockCondition: { type: "first_place_finishes", value: 1, comparison: "gte" },
    completeCondition: { type: "first_place_finishes", value: 3, comparison: "gte" },
    rewards: { xp: 200, badgeId: "comp_3_wins" },
    connectedTo: [],
    connectedFrom: ["first_victory", "win_streak_master"],
    isRequired: false,
    isAutoComplete: false,
    order: 22,
    tooltipText: "Win 3 competitions to become legendary",
    celebrationText: "LEGENDARY! You've achieved trading mastery!",
  },
];

// ============================================
// MAP CONFIG
// ============================================

export const DEFAULT_MAP_CONFIG = {
  mapId: "traders_journey",
  name: "Trader's Journey",
  description: "Your path from novice to legendary trader",
  zones: DEFAULT_ZONES,
  defaultStartNode: "account_created",
  backgroundColor: "#0F172A",
  isActive: true,
  version: 1,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get milestone by ID
 */
export function getMilestoneById(id: string): MilestoneTemplate | undefined {
  return DEFAULT_MILESTONES.find(m => m.id === id);
}

/**
 * Get milestones by zone
 */
export function getMilestonesByZone(zoneId: string): MilestoneTemplate[] {
  return DEFAULT_MILESTONES.filter(m => m.zoneId === zoneId);
}

/**
 * Get zone by ID
 */
export function getZoneById(id: string): IJourneyZone | undefined {
  return DEFAULT_ZONES.find(z => z.id === id);
}
