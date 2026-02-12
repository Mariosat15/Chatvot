import type { MapTheme, IJourneyZone } from "@/database/models/journey-map-config.model";
import type { IMilestoneCondition, MilestoneNodeType } from "@/database/models/journey-milestone.model";

/**
 * @deprecated — DO NOT USE THIS FILE FOR NEW CODE.
 * 
 * This is the LEGACY multi-map journey sequence template.
 * The admin Gamification Wizard now generates milestones from
 * `apps/admin/lib/constants/milestone-blueprint.ts` and stores them
 * in the database. The backend reads FROM THE DATABASE only.
 * 
 * Original description:
 * 10-Map Journey Sequence
 * 
 * Complete configuration for the multi-map progression system.
 * Each map has:
 * - Unique theme and visual style
 * - Progressive difficulty scaling
 * - Front-loaded XP economy
 * - Theme-specific naming conventions
 */

// ============================================
// MAP SEQUENCE CONFIGURATION
// ============================================

export interface MapSequenceConfig {
  id: string;
  mapId: string;
  name: string;
  description: string;
  theme: MapTheme;
  sequenceOrder: number;
  difficulty: number;
  xpBudget: number;
  milestoneCount: number;
  requiredLevelToStart: number;
  backgroundColor: string;
  backgroundImage?: string;
  zones: IJourneyZone[];
  milestoneTemplates: MilestoneTemplate[];
}

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
  rewards: { xp: number; badgeId?: string; title?: string };
  connectedTo: string[];
  connectedFrom: string[];
  isRequired: boolean;
  order: number;
  celebrationText?: string;
}

// ============================================
// XP ECONOMY - FRONT-LOADED PROGRESSION
// ============================================

export const XP_ECONOMY = {
  // XP budget per map
  budgets: [150, 200, 300, 400, 500, 700, 1000, 1500, 2500, 5000] as const,
  
  // Milestone counts per map
  milestoneCounts: [12, 14, 16, 18, 18, 20, 22, 24, 26, 30] as const,
  
  // Level ranges per map
  levelRanges: [
    { min: 1, max: 3 },   // Map 1: Levels 1-3
    { min: 3, max: 5 },   // Map 2: Levels 3-5
    { min: 5, max: 7 },   // Map 3: Levels 5-7
    { min: 7, max: 9 },   // Map 4: Levels 7-9
    { min: 9, max: 10 },  // Map 5: Levels 9-10
    { min: 10, max: 12 }, // Map 6: Levels 10-12
    { min: 12, max: 14 }, // Map 7: Levels 12-14
    { min: 14, max: 16 }, // Map 8: Levels 14-16
    { min: 16, max: 18 }, // Map 9: Levels 16-18
    { min: 18, max: 20 }, // Map 10: Levels 18-20
  ] as const,
  
  // Calculate XP for a milestone
  calculateMilestoneXP(mapIndex: number, orderInMap: number): number {
    return 5 + (mapIndex * 3) + (orderInMap * 2);
  },
  
  // Get total expected XP at map completion
  getCumulativeXP(mapIndex: number): number {
    return this.budgets.slice(0, mapIndex).reduce((a, b) => a + b, 0);
  },
};

// ============================================
// THE 10 MAPS
// ============================================

export const MAP_SEQUENCE: MapSequenceConfig[] = [
  // ============================================
  // MAP 1: PIRATE COVE (Introduction)
  // ============================================
  {
    id: "map_1_pirate",
    mapId: "map_1_pirate",
    name: "Pirate Cove",
    description: "Begin your trading voyage! Learn the basics as a young pirate.",
    theme: "pirate",
    sequenceOrder: 1,
    difficulty: 1,
    xpBudget: 150,
    milestoneCount: 12,
    requiredLevelToStart: 1,
    backgroundColor: "#1a3a5c",
    backgroundImage: "/assets/maps/pirate-cove.png",
    zones: [
      { id: "dock", name: "Starting Dock", description: "Where every voyage begins", order: 1, position: { x: 100, y: 600 }, color: "#22C55E", icon: "anchor", isUnlockable: false },
      { id: "harbor", name: "Harbor Town", description: "Learn trading basics", order: 2, position: { x: 350, y: 450 }, color: "#3B82F6", icon: "compass", isUnlockable: true },
      { id: "cove", name: "Secret Cove", description: "Your first treasure awaits", order: 3, position: { x: 600, y: 300 }, color: "#F59E0B", icon: "treasure", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "p1_set_sail", name: "Set Sail", description: "Your pirate journey begins!", shortDescription: "Create account", zoneId: "dock", position: { x: 100, y: 600 }, nodeType: "start", icon: "pirateShip", color: "#22C55E", size: "large", completeCondition: { type: "account_created" }, rewards: { xp: 5 }, connectedTo: ["p1_load_cargo"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "Welcome aboard, Captain!" },
      { id: "p1_load_cargo", name: "Load Cargo", description: "Stock your ship with gold", shortDescription: "First deposit", zoneId: "dock", position: { x: 180, y: 550 }, nodeType: "milestone", icon: "pirateCoins", color: "#22C55E", size: "medium", unlockCondition: { type: "account_created" }, completeCondition: { type: "first_deposit" }, rewards: { xp: 15 }, connectedTo: ["p1_first_voyage"], connectedFrom: ["p1_set_sail"], isRequired: true, order: 2, celebrationText: "Cargo loaded!" },
      { id: "p1_first_voyage", name: "First Voyage", description: "Make your first trade", shortDescription: "1 trade", zoneId: "dock", position: { x: 260, y: 500 }, nodeType: "milestone", icon: "compass", color: "#22C55E", size: "medium", unlockCondition: { type: "first_deposit" }, completeCondition: { type: "total_trades", value: 1, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["p1_calm_waters"], connectedFrom: ["p1_load_cargo"], isRequired: true, order: 3 },
      { id: "p1_calm_waters", name: "Calm Waters", description: "Complete 3 trades", shortDescription: "3 trades", zoneId: "harbor", position: { x: 350, y: 450 }, nodeType: "milestone", icon: "buy", color: "#3B82F6", size: "small", unlockCondition: { type: "total_trades", value: 1, comparison: "gte" }, completeCondition: { type: "total_trades", value: 3, comparison: "gte" }, rewards: { xp: 10 }, connectedTo: ["p1_safe_harbor"], connectedFrom: ["p1_first_voyage"], isRequired: true, order: 4 },
      { id: "p1_safe_harbor", name: "Safe Harbor", description: "Close a position", shortDescription: "Close trade", zoneId: "harbor", position: { x: 420, y: 400 }, nodeType: "milestone", icon: "anchor", color: "#3B82F6", size: "medium", unlockCondition: { type: "total_trades", value: 3, comparison: "gte" }, completeCondition: { type: "total_trades", value: 5, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["p1_first_gold"], connectedFrom: ["p1_calm_waters"], isRequired: true, order: 5 },
      { id: "p1_first_gold", name: "First Gold", description: "Win your first trade!", shortDescription: "1 win", zoneId: "harbor", position: { x: 490, y: 350 }, nodeType: "checkpoint", icon: "treasure", color: "#F59E0B", size: "large", unlockCondition: { type: "total_trades", value: 5, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 1, comparison: "gte" }, rewards: { xp: 20 }, connectedTo: ["p1_crew_builder"], connectedFrom: ["p1_safe_harbor"], isRequired: true, order: 6, celebrationText: "First treasure found!" },
      { id: "p1_crew_builder", name: "Crew Builder", description: "Build your trading momentum", shortDescription: "7 trades", zoneId: "harbor", position: { x: 520, y: 290 }, nodeType: "milestone", icon: "pirateHat", color: "#3B82F6", size: "small", unlockCondition: { type: "winning_trades", value: 1, comparison: "gte" }, completeCondition: { type: "total_trades", value: 7, comparison: "gte" }, rewards: { xp: 10 }, connectedTo: ["p1_seasoned"], connectedFrom: ["p1_first_gold"], isRequired: true, order: 7 },
      { id: "p1_seasoned", name: "Seasoned Sailor", description: "10 voyages complete", shortDescription: "10 trades", zoneId: "cove", position: { x: 580, y: 250 }, nodeType: "checkpoint", icon: "pirateFlag", color: "#F59E0B", size: "medium", unlockCondition: { type: "total_trades", value: 7, comparison: "gte" }, completeCondition: { type: "total_trades", value: 10, comparison: "gte" }, rewards: { xp: 20 }, connectedTo: ["p1_win_streak"], connectedFrom: ["p1_crew_builder"], isRequired: true, order: 8 },
      { id: "p1_win_streak", name: "Lucky Streak", description: "Win 2 in a row", shortDescription: "2 win streak", zoneId: "cove", position: { x: 650, y: 200 }, nodeType: "milestone", icon: "parrot", color: "#22C55E", size: "medium", unlockCondition: { type: "total_trades", value: 10, comparison: "gte" }, completeCondition: { type: "win_streak", value: 2, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["p1_treasure_hunter"], connectedFrom: ["p1_seasoned"], isRequired: true, order: 9 },
      { id: "p1_treasure_hunter", name: "Treasure Hunter", description: "3 profitable trades", shortDescription: "3 wins", zoneId: "cove", position: { x: 700, y: 160 }, nodeType: "milestone", icon: "chest", color: "#F59E0B", size: "medium", unlockCondition: { type: "win_streak", value: 2, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 3, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["p1_cove_master"], connectedFrom: ["p1_win_streak"], isRequired: true, order: 10 },
      { id: "p1_cove_master", name: "Cove Master", description: "Complete Map 1", shortDescription: "15 trades", zoneId: "cove", position: { x: 750, y: 120 }, nodeType: "legendary", icon: "skull", color: "#EF4444", size: "large", unlockCondition: { type: "winning_trades", value: 3, comparison: "gte" }, completeCondition: { type: "total_trades", value: 15, comparison: "gte" }, rewards: { xp: 10, title: "Pirate Apprentice" }, connectedTo: [], connectedFrom: ["p1_treasure_hunter"], isRequired: true, order: 11, celebrationText: "Map 1 Complete! Space awaits..." },
    ],
  },

  // ============================================
  // MAP 2: SPACE STATION (Intermediate)
  // ============================================
  {
    id: "map_2_space",
    mapId: "map_2_space",
    name: "Space Station",
    description: "Launch into the cosmos! Trade among the stars.",
    theme: "space",
    sequenceOrder: 2,
    difficulty: 2,
    xpBudget: 200,
    milestoneCount: 14,
    requiredLevelToStart: 3,
    backgroundColor: "#0F0F2D",
    backgroundImage: "/assets/maps/space-station.png",
    zones: [
      { id: "launch", name: "Launch Bay", description: "Prepare for liftoff", order: 1, position: { x: 100, y: 600 }, color: "#8B5CF6", icon: "rocket", isUnlockable: false },
      { id: "orbit", name: "Orbital Deck", description: "Zero gravity trading", order: 2, position: { x: 400, y: 400 }, color: "#06B6D4", icon: "planet", isUnlockable: true },
      { id: "cosmos", name: "Deep Space", description: "Galactic profits await", order: 3, position: { x: 700, y: 200 }, color: "#F59E0B", icon: "star", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "s2_launch", name: "Launch Sequence", description: "Begin space trading", shortDescription: "Enter space", zoneId: "launch", position: { x: 100, y: 600 }, nodeType: "start", icon: "rocket", color: "#8B5CF6", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_1_pirate" }, rewards: { xp: 10 }, connectedTo: ["s2_zero_g"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "3... 2... 1... Liftoff!" },
      { id: "s2_zero_g", name: "Zero Gravity", description: "Trade in weightlessness", shortDescription: "20 trades", zoneId: "launch", position: { x: 180, y: 540 }, nodeType: "milestone", icon: "astronaut", color: "#8B5CF6", size: "medium", unlockCondition: { type: "total_trades", value: 15, comparison: "gte" }, completeCondition: { type: "total_trades", value: 20, comparison: "gte" }, rewards: { xp: 12 }, connectedTo: ["s2_satellite"], connectedFrom: ["s2_launch"], isRequired: true, order: 2 },
      { id: "s2_satellite", name: "Satellite Link", description: "5 winning trades", shortDescription: "5 wins", zoneId: "launch", position: { x: 260, y: 480 }, nodeType: "milestone", icon: "satellite", color: "#06B6D4", size: "medium", unlockCondition: { type: "total_trades", value: 20, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 5, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["s2_orbit_stable"], connectedFrom: ["s2_zero_g"], isRequired: true, order: 3 },
      { id: "s2_orbit_stable", name: "Stable Orbit", description: "25 total trades", shortDescription: "25 trades", zoneId: "orbit", position: { x: 350, y: 420 }, nodeType: "checkpoint", icon: "planet", color: "#06B6D4", size: "medium", unlockCondition: { type: "winning_trades", value: 5, comparison: "gte" }, completeCondition: { type: "total_trades", value: 25, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["s2_win_streak_3"], connectedFrom: ["s2_satellite"], isRequired: true, order: 4 },
      { id: "s2_win_streak_3", name: "Comet Trail", description: "3 wins in a row", shortDescription: "3 win streak", zoneId: "orbit", position: { x: 420, y: 380 }, nodeType: "milestone", icon: "comet", color: "#F59E0B", size: "medium", unlockCondition: { type: "total_trades", value: 25, comparison: "gte" }, completeCondition: { type: "win_streak", value: 3, comparison: "gte" }, rewards: { xp: 18 }, connectedTo: ["s2_astronaut"], connectedFrom: ["s2_orbit_stable"], isRequired: true, order: 5 },
      { id: "s2_astronaut", name: "Astronaut Class", description: "30 trades complete", shortDescription: "30 trades", zoneId: "orbit", position: { x: 480, y: 340 }, nodeType: "milestone", icon: "astronaut", color: "#06B6D4", size: "small", unlockCondition: { type: "win_streak", value: 3, comparison: "gte" }, completeCondition: { type: "total_trades", value: 30, comparison: "gte" }, rewards: { xp: 12 }, connectedTo: ["s2_wins_8"], connectedFrom: ["s2_win_streak_3"], isRequired: true, order: 6 },
      { id: "s2_wins_8", name: "Star Collector", description: "8 winning trades", shortDescription: "8 wins", zoneId: "orbit", position: { x: 540, y: 300 }, nodeType: "milestone", icon: "star", color: "#F59E0B", size: "medium", unlockCondition: { type: "total_trades", value: 30, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 8, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["s2_deep_space"], connectedFrom: ["s2_astronaut"], isRequired: true, order: 7 },
      { id: "s2_deep_space", name: "Deep Space Entry", description: "35 trades into the void", shortDescription: "35 trades", zoneId: "cosmos", position: { x: 600, y: 260 }, nodeType: "checkpoint", icon: "blackHole", color: "#8B5CF6", size: "large", unlockCondition: { type: "winning_trades", value: 8, comparison: "gte" }, completeCondition: { type: "total_trades", value: 35, comparison: "gte" }, rewards: { xp: 18 }, connectedTo: ["s2_nebula"], connectedFrom: ["s2_wins_8"], isRequired: true, order: 8 },
      { id: "s2_nebula", name: "Nebula Navigator", description: "Win streak of 4", shortDescription: "4 win streak", zoneId: "cosmos", position: { x: 660, y: 220 }, nodeType: "milestone", icon: "galaxy", color: "#06B6D4", size: "medium", unlockCondition: { type: "total_trades", value: 35, comparison: "gte" }, completeCondition: { type: "win_streak", value: 4, comparison: "gte" }, rewards: { xp: 20 }, connectedTo: ["s2_galaxy"], connectedFrom: ["s2_deep_space"], isRequired: true, order: 9 },
      { id: "s2_galaxy", name: "Galaxy Explorer", description: "40 total trades", shortDescription: "40 trades", zoneId: "cosmos", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "ufo", color: "#F59E0B", size: "medium", unlockCondition: { type: "win_streak", value: 4, comparison: "gte" }, completeCondition: { type: "total_trades", value: 40, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["s2_commander"], connectedFrom: ["s2_nebula"], isRequired: true, order: 10 },
      { id: "s2_commander", name: "Galactic Commander", description: "Complete Space Station", shortDescription: "12 wins", zoneId: "cosmos", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "starship", color: "#EF4444", size: "large", unlockCondition: { type: "total_trades", value: 40, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 12, comparison: "gte" }, rewards: { xp: 30, title: "Space Commander" }, connectedTo: [], connectedFrom: ["s2_galaxy"], isRequired: true, order: 11, celebrationText: "Map 2 Complete! Medieval times await..." },
    ],
  },

  // ============================================
  // MAP 3: MEDIEVAL CASTLE
  // ============================================
  {
    id: "map_3_medieval",
    mapId: "map_3_medieval",
    name: "Medieval Castle",
    description: "Storm the castle! Battle your way to trading nobility.",
    theme: "medieval",
    sequenceOrder: 3,
    difficulty: 3,
    xpBudget: 300,
    milestoneCount: 16,
    requiredLevelToStart: 5,
    backgroundColor: "#2D1F1A",
    backgroundImage: "/assets/maps/medieval-castle.png",
    zones: [
      { id: "village", name: "Village Gate", description: "Begin your quest", order: 1, position: { x: 100, y: 600 }, color: "#92400E", icon: "castle", isUnlockable: false },
      { id: "training", name: "Training Grounds", description: "Hone your skills", order: 2, position: { x: 400, y: 400 }, color: "#EF4444", icon: "shield", isUnlockable: true },
      { id: "throne", name: "Throne Room", description: "Claim your crown", order: 3, position: { x: 700, y: 200 }, color: "#F59E0B", icon: "crown", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "m3_knight", name: "Knight's Oath", description: "Pledge to the trading kingdom", shortDescription: "Enter castle", zoneId: "village", position: { x: 100, y: 600 }, nodeType: "start", icon: "sword", color: "#92400E", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_2_space" }, rewards: { xp: 15 }, connectedTo: ["m3_squire"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "For honor and profit!" },
      { id: "m3_squire", name: "Squire Training", description: "45 trades complete", shortDescription: "45 trades", zoneId: "village", position: { x: 180, y: 540 }, nodeType: "milestone", icon: "helmet", color: "#92400E", size: "medium", unlockCondition: { type: "total_trades", value: 40, comparison: "gte" }, completeCondition: { type: "total_trades", value: 45, comparison: "gte" }, rewards: { xp: 15 }, connectedTo: ["m3_arena"], connectedFrom: ["m3_knight"], isRequired: true, order: 2 },
      { id: "m3_arena", name: "Arena Entry", description: "Enter your first competition", shortDescription: "1 competition", zoneId: "village", position: { x: 260, y: 480 }, nodeType: "checkpoint", icon: "arena", color: "#EF4444", size: "large", unlockCondition: { type: "total_trades", value: 45, comparison: "gte" }, completeCondition: { type: "competitions_entered", value: 1, comparison: "gte" }, rewards: { xp: 25 }, connectedTo: ["m3_swordsman"], connectedFrom: ["m3_squire"], isRequired: true, order: 3, celebrationText: "The tournament begins!" },
      { id: "m3_swordsman", name: "Swordsman", description: "50 trades wielded", shortDescription: "50 trades", zoneId: "training", position: { x: 350, y: 420 }, nodeType: "milestone", icon: "sword", color: "#EF4444", size: "medium", unlockCondition: { type: "competitions_entered", value: 1, comparison: "gte" }, completeCondition: { type: "total_trades", value: 50, comparison: "gte" }, rewards: { xp: 18 }, connectedTo: ["m3_shield"], connectedFrom: ["m3_arena"], isRequired: true, order: 4 },
      { id: "m3_shield", name: "Shield Bearer", description: "15 winning trades", shortDescription: "15 wins", zoneId: "training", position: { x: 420, y: 380 }, nodeType: "milestone", icon: "shield", color: "#EF4444", size: "medium", unlockCondition: { type: "total_trades", value: 50, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 15, comparison: "gte" }, rewards: { xp: 20 }, connectedTo: ["m3_joust"], connectedFrom: ["m3_swordsman"], isRequired: true, order: 5 },
      { id: "m3_joust", name: "Joust Champion", description: "Win streak of 5", shortDescription: "5 win streak", zoneId: "training", position: { x: 480, y: 340 }, nodeType: "checkpoint", icon: "horse", color: "#F59E0B", size: "large", unlockCondition: { type: "winning_trades", value: 15, comparison: "gte" }, completeCondition: { type: "win_streak", value: 5, comparison: "gte" }, rewards: { xp: 25 }, connectedTo: ["m3_crusader"], connectedFrom: ["m3_shield"], isRequired: true, order: 6, celebrationText: "Unhorsed your opponent!" },
      { id: "m3_crusader", name: "Crusader", description: "60 trades complete", shortDescription: "60 trades", zoneId: "training", position: { x: 540, y: 300 }, nodeType: "milestone", icon: "cross", color: "#EF4444", size: "medium", unlockCondition: { type: "win_streak", value: 5, comparison: "gte" }, completeCondition: { type: "total_trades", value: 60, comparison: "gte" }, rewards: { xp: 18 }, connectedTo: ["m3_dragon"], connectedFrom: ["m3_joust"], isRequired: true, order: 7 },
      { id: "m3_dragon", name: "Dragon Slayer", description: "20 winning trades", shortDescription: "20 wins", zoneId: "training", position: { x: 600, y: 260 }, nodeType: "milestone", icon: "dragon", color: "#EF4444", size: "large", unlockCondition: { type: "total_trades", value: 60, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 20, comparison: "gte" }, rewards: { xp: 22 }, connectedTo: ["m3_noble"], connectedFrom: ["m3_crusader"], isRequired: true, order: 8 },
      { id: "m3_noble", name: "Noble Knight", description: "Complete first competition", shortDescription: "1 comp done", zoneId: "throne", position: { x: 660, y: 220 }, nodeType: "checkpoint", icon: "banner", color: "#F59E0B", size: "medium", unlockCondition: { type: "winning_trades", value: 20, comparison: "gte" }, completeCondition: { type: "competitions_completed", value: 1, comparison: "gte" }, rewards: { xp: 30 }, connectedTo: ["m3_royal"], connectedFrom: ["m3_dragon"], isRequired: true, order: 9 },
      { id: "m3_royal", name: "Royal Guard", description: "70 trades complete", shortDescription: "70 trades", zoneId: "throne", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "royalGuard", color: "#F59E0B", size: "medium", unlockCondition: { type: "competitions_completed", value: 1, comparison: "gte" }, completeCondition: { type: "total_trades", value: 70, comparison: "gte" }, rewards: { xp: 20 }, connectedTo: ["m3_king"], connectedFrom: ["m3_noble"], isRequired: true, order: 10 },
      { id: "m3_king", name: "Royal Champion", description: "Complete Medieval Castle", shortDescription: "25 wins", zoneId: "throne", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "crown", color: "#EF4444", size: "large", unlockCondition: { type: "total_trades", value: 70, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 25, comparison: "gte" }, rewards: { xp: 40, title: "Royal Champion" }, connectedTo: [], connectedFrom: ["m3_royal"], isRequired: true, order: 11, celebrationText: "Map 3 Complete! The future calls..." },
    ],
  },

  // ============================================
  // MAP 4: CYBER CITY
  // ============================================
  {
    id: "map_4_cyber",
    mapId: "map_4_cyber",
    name: "Cyber City",
    description: "Jack into the matrix! Trade at the speed of light.",
    theme: "cyber",
    sequenceOrder: 4,
    difficulty: 4,
    xpBudget: 400,
    milestoneCount: 18,
    requiredLevelToStart: 7,
    backgroundColor: "#0D1117",
    backgroundImage: "/assets/maps/cyber-city.png",
    zones: [
      { id: "terminal", name: "Terminal Hub", description: "Boot up", order: 1, position: { x: 100, y: 600 }, color: "#00FFFF", icon: "computer", isUnlockable: false },
      { id: "network", name: "Neural Network", description: "Process data", order: 2, position: { x: 400, y: 400 }, color: "#FF00FF", icon: "brain", isUnlockable: true },
      { id: "core", name: "System Core", description: "Full access", order: 3, position: { x: 700, y: 200 }, color: "#FFD700", icon: "cpu", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "c4_boot", name: "System Boot", description: "Initialize cyber trading", shortDescription: "Enter cyber", zoneId: "terminal", position: { x: 100, y: 600 }, nodeType: "start", icon: "power", color: "#00FFFF", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_3_medieval" }, rewards: { xp: 20 }, connectedTo: ["c4_upload"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "System online!" },
      { id: "c4_upload", name: "Data Upload", description: "75 trades processed", shortDescription: "75 trades", zoneId: "terminal", position: { x: 180, y: 540 }, nodeType: "milestone", icon: "upload", color: "#00FFFF", size: "medium", unlockCondition: { type: "total_trades", value: 70, comparison: "gte" }, completeCondition: { type: "total_trades", value: 75, comparison: "gte" }, rewards: { xp: 18 }, connectedTo: ["c4_hack"], connectedFrom: ["c4_boot"], isRequired: true, order: 2 },
      { id: "c4_hack", name: "First Hack", description: "30 winning trades", shortDescription: "30 wins", zoneId: "terminal", position: { x: 260, y: 480 }, nodeType: "milestone", icon: "hack", color: "#00FFFF", size: "medium", unlockCondition: { type: "total_trades", value: 75, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 30, comparison: "gte" }, rewards: { xp: 22 }, connectedTo: ["c4_firewall"], connectedFrom: ["c4_upload"], isRequired: true, order: 3 },
      { id: "c4_firewall", name: "Firewall Breach", description: "80 trades complete", shortDescription: "80 trades", zoneId: "network", position: { x: 350, y: 420 }, nodeType: "checkpoint", icon: "firewall", color: "#FF00FF", size: "large", unlockCondition: { type: "winning_trades", value: 30, comparison: "gte" }, completeCondition: { type: "total_trades", value: 80, comparison: "gte" }, rewards: { xp: 25 }, connectedTo: ["c4_virus"], connectedFrom: ["c4_hack"], isRequired: true, order: 4 },
      { id: "c4_virus", name: "Viral Spread", description: "Win streak of 6", shortDescription: "6 win streak", zoneId: "network", position: { x: 420, y: 380 }, nodeType: "milestone", icon: "virus", color: "#FF00FF", size: "medium", unlockCondition: { type: "total_trades", value: 80, comparison: "gte" }, completeCondition: { type: "win_streak", value: 6, comparison: "gte" }, rewards: { xp: 28 }, connectedTo: ["c4_neural"], connectedFrom: ["c4_firewall"], isRequired: true, order: 5 },
      { id: "c4_neural", name: "Neural Link", description: "35 winning trades", shortDescription: "35 wins", zoneId: "network", position: { x: 480, y: 340 }, nodeType: "milestone", icon: "brain", color: "#FF00FF", size: "medium", unlockCondition: { type: "win_streak", value: 6, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 35, comparison: "gte" }, rewards: { xp: 25 }, connectedTo: ["c4_matrix"], connectedFrom: ["c4_virus"], isRequired: true, order: 6 },
      { id: "c4_matrix", name: "Matrix Entry", description: "90 trades complete", shortDescription: "90 trades", zoneId: "network", position: { x: 540, y: 300 }, nodeType: "checkpoint", icon: "matrix", color: "#00FFFF", size: "large", unlockCondition: { type: "winning_trades", value: 35, comparison: "gte" }, completeCondition: { type: "total_trades", value: 90, comparison: "gte" }, rewards: { xp: 30 }, connectedTo: ["c4_comp2"], connectedFrom: ["c4_neural"], isRequired: true, order: 7 },
      { id: "c4_comp2", name: "Tournament Entry", description: "2 competitions complete", shortDescription: "2 comps done", zoneId: "network", position: { x: 600, y: 260 }, nodeType: "milestone", icon: "trophy", color: "#FFD700", size: "medium", unlockCondition: { type: "total_trades", value: 90, comparison: "gte" }, completeCondition: { type: "competitions_completed", value: 2, comparison: "gte" }, rewards: { xp: 35 }, connectedTo: ["c4_core"], connectedFrom: ["c4_matrix"], isRequired: true, order: 8 },
      { id: "c4_core", name: "Core Access", description: "100 trades milestone", shortDescription: "100 trades", zoneId: "core", position: { x: 660, y: 220 }, nodeType: "checkpoint", icon: "cpu", color: "#FFD700", size: "large", unlockCondition: { type: "competitions_completed", value: 2, comparison: "gte" }, completeCondition: { type: "total_trades", value: 100, comparison: "gte" }, rewards: { xp: 35 }, connectedTo: ["c4_ai"], connectedFrom: ["c4_comp2"], isRequired: true, order: 9, celebrationText: "100 trades achieved!" },
      { id: "c4_ai", name: "AI Protocol", description: "40 winning trades", shortDescription: "40 wins", zoneId: "core", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "robot", color: "#FFD700", size: "medium", unlockCondition: { type: "total_trades", value: 100, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 40, comparison: "gte" }, rewards: { xp: 30 }, connectedTo: ["c4_overlord"], connectedFrom: ["c4_core"], isRequired: true, order: 10 },
      { id: "c4_overlord", name: "Neural Overlord", description: "Complete Cyber City", shortDescription: "7 win streak", zoneId: "core", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "cyborg", color: "#EF4444", size: "large", unlockCondition: { type: "winning_trades", value: 40, comparison: "gte" }, completeCondition: { type: "win_streak", value: 7, comparison: "gte" }, rewards: { xp: 50, title: "Neural Overlord" }, connectedTo: [], connectedFrom: ["c4_ai"], isRequired: true, order: 11, celebrationText: "Map 4 Complete! Ancient mysteries await..." },
    ],
  },

  // ============================================
  // MAP 5: ANCIENT TEMPLE
  // ============================================
  {
    id: "map_5_ancient",
    mapId: "map_5_ancient",
    name: "Ancient Temple",
    description: "Uncover ancient trading secrets! Navigate the temple of wealth.",
    theme: "ancient",
    sequenceOrder: 5,
    difficulty: 5,
    xpBudget: 500,
    milestoneCount: 18,
    requiredLevelToStart: 9,
    backgroundColor: "#2A2520",
    backgroundImage: "/assets/maps/ancient-temple.png",
    zones: [
      { id: "entrance", name: "Temple Entrance", description: "Ancient gates open", order: 1, position: { x: 100, y: 600 }, color: "#D4A373", icon: "temple", isUnlockable: false },
      { id: "chambers", name: "Hidden Chambers", description: "Secrets revealed", order: 2, position: { x: 400, y: 400 }, color: "#E9C46A", icon: "scroll", isUnlockable: true },
      { id: "sanctum", name: "Inner Sanctum", description: "Ultimate wisdom", order: 3, position: { x: 700, y: 200 }, color: "#F4A261", icon: "pyramid", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "a5_entry", name: "Temple Entry", description: "Enter the ancient realm", shortDescription: "Enter temple", zoneId: "entrance", position: { x: 100, y: 600 }, nodeType: "start", icon: "temple", color: "#D4A373", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_4_cyber" }, rewards: { xp: 25 }, connectedTo: ["a5_hieroglyph"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "The temple welcomes you!" },
      { id: "a5_hieroglyph", name: "Hieroglyph Reader", description: "105 trades decoded", shortDescription: "105 trades", zoneId: "entrance", position: { x: 180, y: 540 }, nodeType: "milestone", icon: "scroll", color: "#D4A373", size: "medium", unlockCondition: { type: "total_trades", value: 100, comparison: "gte" }, completeCondition: { type: "total_trades", value: 105, comparison: "gte" }, rewards: { xp: 22 }, connectedTo: ["a5_scarab"], connectedFrom: ["a5_entry"], isRequired: true, order: 2 },
      { id: "a5_scarab", name: "Scarab Hunter", description: "45 winning trades", shortDescription: "45 wins", zoneId: "entrance", position: { x: 260, y: 480 }, nodeType: "milestone", icon: "scarab", color: "#D4A373", size: "medium", unlockCondition: { type: "total_trades", value: 105, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 45, comparison: "gte" }, rewards: { xp: 28 }, connectedTo: ["a5_pyramid"], connectedFrom: ["a5_hieroglyph"], isRequired: true, order: 3 },
      { id: "a5_pyramid", name: "Pyramid Climber", description: "115 trades complete", shortDescription: "115 trades", zoneId: "chambers", position: { x: 350, y: 420 }, nodeType: "checkpoint", icon: "pyramid", color: "#E9C46A", size: "large", unlockCondition: { type: "winning_trades", value: 45, comparison: "gte" }, completeCondition: { type: "total_trades", value: 115, comparison: "gte" }, rewards: { xp: 32 }, connectedTo: ["a5_mummy"], connectedFrom: ["a5_scarab"], isRequired: true, order: 4 },
      { id: "a5_mummy", name: "Mummy's Curse", description: "Win streak of 8", shortDescription: "8 win streak", zoneId: "chambers", position: { x: 420, y: 380 }, nodeType: "milestone", icon: "mummy", color: "#E9C46A", size: "medium", unlockCondition: { type: "total_trades", value: 115, comparison: "gte" }, completeCondition: { type: "win_streak", value: 8, comparison: "gte" }, rewards: { xp: 35 }, connectedTo: ["a5_sphinx"], connectedFrom: ["a5_pyramid"], isRequired: true, order: 5 },
      { id: "a5_sphinx", name: "Sphinx Riddle", description: "50 winning trades", shortDescription: "50 wins", zoneId: "chambers", position: { x: 480, y: 340 }, nodeType: "milestone", icon: "sphinx", color: "#E9C46A", size: "medium", unlockCondition: { type: "win_streak", value: 8, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 50, comparison: "gte" }, rewards: { xp: 30 }, connectedTo: ["a5_podium"], connectedFrom: ["a5_mummy"], isRequired: true, order: 6 },
      { id: "a5_podium", name: "First Podium", description: "Finish top 3 in competition", shortDescription: "1 podium", zoneId: "chambers", position: { x: 540, y: 300 }, nodeType: "checkpoint", icon: "podium", color: "#F4A261", size: "large", unlockCondition: { type: "winning_trades", value: 50, comparison: "gte" }, completeCondition: { type: "podium_finishes", value: 1, comparison: "gte" }, rewards: { xp: 45 }, connectedTo: ["a5_tomb"], connectedFrom: ["a5_sphinx"], isRequired: true, order: 7, celebrationText: "First podium finish!" },
      { id: "a5_tomb", name: "Tomb Raider", description: "125 trades complete", shortDescription: "125 trades", zoneId: "chambers", position: { x: 600, y: 260 }, nodeType: "milestone", icon: "tomb", color: "#E9C46A", size: "medium", unlockCondition: { type: "podium_finishes", value: 1, comparison: "gte" }, completeCondition: { type: "total_trades", value: 125, comparison: "gte" }, rewards: { xp: 28 }, connectedTo: ["a5_pharaoh"], connectedFrom: ["a5_podium"], isRequired: true, order: 8 },
      { id: "a5_pharaoh", name: "Pharaoh's Blessing", description: "55 winning trades", shortDescription: "55 wins", zoneId: "sanctum", position: { x: 660, y: 220 }, nodeType: "milestone", icon: "pharaoh", color: "#F4A261", size: "medium", unlockCondition: { type: "total_trades", value: 125, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 55, comparison: "gte" }, rewards: { xp: 35 }, connectedTo: ["a5_anubis"], connectedFrom: ["a5_tomb"], isRequired: true, order: 9 },
      { id: "a5_anubis", name: "Anubis Guardian", description: "3 competitions complete", shortDescription: "3 comps done", zoneId: "sanctum", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "anubis", color: "#F4A261", size: "medium", unlockCondition: { type: "winning_trades", value: 55, comparison: "gte" }, completeCondition: { type: "competitions_completed", value: 3, comparison: "gte" }, rewards: { xp: 40 }, connectedTo: ["a5_ra"], connectedFrom: ["a5_pharaoh"], isRequired: true, order: 10 },
      { id: "a5_ra", name: "Eye of Ra", description: "Complete Ancient Temple", shortDescription: "60 wins", zoneId: "sanctum", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "eye", color: "#EF4444", size: "large", unlockCondition: { type: "competitions_completed", value: 3, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 60, comparison: "gte" }, rewards: { xp: 60, title: "Temple Master" }, connectedTo: [], connectedFrom: ["a5_anubis"], isRequired: true, order: 11, celebrationText: "Map 5 Complete! The volcano erupts..." },
    ],
  },

  // ============================================
  // MAP 6: VOLCANIC ISLAND
  // ============================================
  {
    id: "map_6_volcanic",
    mapId: "map_6_volcanic",
    name: "Volcanic Island",
    description: "Trade in the fires of fortune! Survive the eruption.",
    theme: "volcanic",
    sequenceOrder: 6,
    difficulty: 6,
    xpBudget: 700,
    milestoneCount: 20,
    requiredLevelToStart: 10,
    backgroundColor: "#1A0F0F",
    backgroundImage: "/assets/maps/volcanic-island.png",
    zones: [
      { id: "shore", name: "Burning Shore", description: "Feel the heat", order: 1, position: { x: 100, y: 600 }, color: "#DC2626", icon: "fire", isUnlockable: false },
      { id: "lava", name: "Lava Fields", description: "Navigate danger", order: 2, position: { x: 400, y: 400 }, color: "#F97316", icon: "volcano", isUnlockable: true },
      { id: "crater", name: "Volcano Crater", description: "Maximum heat", order: 3, position: { x: 700, y: 200 }, color: "#FBBF24", icon: "magma", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "v6_landing", name: "Inferno Landing", description: "Arrive at the volcano", shortDescription: "Enter volcano", zoneId: "shore", position: { x: 100, y: 600 }, nodeType: "start", icon: "fire", color: "#DC2626", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_5_ancient" }, rewards: { xp: 30 }, connectedTo: ["v6_heat"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "Feel the heat!" },
      { id: "v6_heat", name: "Heat Resistance", description: "130 trades in the fire", shortDescription: "130 trades", zoneId: "shore", position: { x: 180, y: 540 }, nodeType: "milestone", icon: "thermometer", color: "#DC2626", size: "medium", unlockCondition: { type: "total_trades", value: 125, comparison: "gte" }, completeCondition: { type: "total_trades", value: 130, comparison: "gte" }, rewards: { xp: 28 }, connectedTo: ["v6_flames"], connectedFrom: ["v6_landing"], isRequired: true, order: 2 },
      { id: "v6_flames", name: "Flame Walker", description: "65 winning trades", shortDescription: "65 wins", zoneId: "shore", position: { x: 260, y: 480 }, nodeType: "milestone", icon: "flames", color: "#DC2626", size: "medium", unlockCondition: { type: "total_trades", value: 130, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 65, comparison: "gte" }, rewards: { xp: 32 }, connectedTo: ["v6_lava"], connectedFrom: ["v6_heat"], isRequired: true, order: 3 },
      { id: "v6_lava", name: "Lava Crosser", description: "140 trades complete", shortDescription: "140 trades", zoneId: "lava", position: { x: 350, y: 420 }, nodeType: "checkpoint", icon: "lava", color: "#F97316", size: "large", unlockCondition: { type: "winning_trades", value: 65, comparison: "gte" }, completeCondition: { type: "total_trades", value: 140, comparison: "gte" }, rewards: { xp: 38 }, connectedTo: ["v6_streak"], connectedFrom: ["v6_flames"], isRequired: true, order: 4 },
      { id: "v6_streak", name: "Burning Streak", description: "Win streak of 9", shortDescription: "9 win streak", zoneId: "lava", position: { x: 420, y: 380 }, nodeType: "milestone", icon: "fireSpell", color: "#F97316", size: "medium", unlockCondition: { type: "total_trades", value: 140, comparison: "gte" }, completeCondition: { type: "win_streak", value: 9, comparison: "gte" }, rewards: { xp: 42 }, connectedTo: ["v6_magma"], connectedFrom: ["v6_lava"], isRequired: true, order: 5 },
      { id: "v6_magma", name: "Magma Master", description: "70 winning trades", shortDescription: "70 wins", zoneId: "lava", position: { x: 480, y: 340 }, nodeType: "milestone", icon: "magma", color: "#F97316", size: "medium", unlockCondition: { type: "win_streak", value: 9, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 70, comparison: "gte" }, rewards: { xp: 38 }, connectedTo: ["v6_comp_win"], connectedFrom: ["v6_streak"], isRequired: true, order: 6 },
      { id: "v6_comp_win", name: "First Victory", description: "Win a competition!", shortDescription: "1st place", zoneId: "lava", position: { x: 540, y: 300 }, nodeType: "checkpoint", icon: "trophy", color: "#FBBF24", size: "large", unlockCondition: { type: "winning_trades", value: 70, comparison: "gte" }, completeCondition: { type: "first_place_finishes", value: 1, comparison: "gte" }, rewards: { xp: 60 }, connectedTo: ["v6_eruption"], connectedFrom: ["v6_magma"], isRequired: true, order: 7, celebrationText: "CHAMPION! First competition win!" },
      { id: "v6_eruption", name: "Eruption Survivor", description: "150 trades complete", shortDescription: "150 trades", zoneId: "lava", position: { x: 600, y: 260 }, nodeType: "milestone", icon: "explosion", color: "#F97316", size: "medium", unlockCondition: { type: "first_place_finishes", value: 1, comparison: "gte" }, completeCondition: { type: "total_trades", value: 150, comparison: "gte" }, rewards: { xp: 35 }, connectedTo: ["v6_phoenix"], connectedFrom: ["v6_comp_win"], isRequired: true, order: 8 },
      { id: "v6_phoenix", name: "Phoenix Rising", description: "75 winning trades", shortDescription: "75 wins", zoneId: "crater", position: { x: 660, y: 220 }, nodeType: "milestone", icon: "phoenix", color: "#FBBF24", size: "medium", unlockCondition: { type: "total_trades", value: 150, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 75, comparison: "gte" }, rewards: { xp: 40 }, connectedTo: ["v6_podium2"], connectedFrom: ["v6_eruption"], isRequired: true, order: 9 },
      { id: "v6_podium2", name: "Double Podium", description: "2 podium finishes", shortDescription: "2 podiums", zoneId: "crater", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "medal", color: "#FBBF24", size: "medium", unlockCondition: { type: "winning_trades", value: 75, comparison: "gte" }, completeCondition: { type: "podium_finishes", value: 2, comparison: "gte" }, rewards: { xp: 50 }, connectedTo: ["v6_god"], connectedFrom: ["v6_phoenix"], isRequired: true, order: 10 },
      { id: "v6_god", name: "Volcano God", description: "Complete Volcanic Island", shortDescription: "10 win streak", zoneId: "crater", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "volcanoGod", color: "#EF4444", size: "large", unlockCondition: { type: "podium_finishes", value: 2, comparison: "gte" }, completeCondition: { type: "win_streak", value: 10, comparison: "gte" }, rewards: { xp: 75, title: "Volcano God" }, connectedTo: [], connectedFrom: ["v6_podium2"], isRequired: true, order: 11, celebrationText: "Map 6 Complete! The frozen north awaits..." },
    ],
  },

  // ============================================
  // MAP 7: ARCTIC FORTRESS
  // ============================================
  {
    id: "map_7_arctic",
    mapId: "map_7_arctic",
    name: "Arctic Fortress",
    description: "Conquer the frozen markets! Only the strong survive.",
    theme: "arctic",
    sequenceOrder: 7,
    difficulty: 7,
    xpBudget: 1000,
    milestoneCount: 22,
    requiredLevelToStart: 12,
    backgroundColor: "#0F172A",
    backgroundImage: "/assets/maps/arctic-fortress.png",
    zones: [
      { id: "tundra", name: "Frozen Tundra", description: "The cold begins", order: 1, position: { x: 100, y: 600 }, color: "#38BDF8", icon: "snowflake", isUnlockable: false },
      { id: "glacier", name: "Glacier Pass", description: "Navigate the ice", order: 2, position: { x: 400, y: 400 }, color: "#06B6D4", icon: "iceberg", isUnlockable: true },
      { id: "fortress", name: "Ice Fortress", description: "Ultimate cold", order: 3, position: { x: 700, y: 200 }, color: "#E2E8F0", icon: "fortress", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "a7_arrival", name: "Arctic Arrival", description: "Brave the frozen north", shortDescription: "Enter arctic", zoneId: "tundra", position: { x: 100, y: 600 }, nodeType: "start", icon: "snowflake", color: "#38BDF8", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_6_volcanic" }, rewards: { xp: 40 }, connectedTo: ["a7_frost"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "Brace for the cold!" },
      { id: "a7_frost", name: "Frost Trader", description: "160 trades in the cold", shortDescription: "160 trades", zoneId: "tundra", position: { x: 180, y: 540 }, nodeType: "milestone", icon: "frost", color: "#38BDF8", size: "medium", unlockCondition: { type: "total_trades", value: 150, comparison: "gte" }, completeCondition: { type: "total_trades", value: 160, comparison: "gte" }, rewards: { xp: 38 }, connectedTo: ["a7_blizzard"], connectedFrom: ["a7_arrival"], isRequired: true, order: 2 },
      { id: "a7_blizzard", name: "Blizzard Survivor", description: "80 winning trades", shortDescription: "80 wins", zoneId: "tundra", position: { x: 260, y: 480 }, nodeType: "milestone", icon: "blizzard", color: "#38BDF8", size: "medium", unlockCondition: { type: "total_trades", value: 160, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 80, comparison: "gte" }, rewards: { xp: 45 }, connectedTo: ["a7_iceberg"], connectedFrom: ["a7_frost"], isRequired: true, order: 3 },
      { id: "a7_iceberg", name: "Iceberg Navigator", description: "175 trades complete", shortDescription: "175 trades", zoneId: "glacier", position: { x: 350, y: 420 }, nodeType: "checkpoint", icon: "iceberg", color: "#06B6D4", size: "large", unlockCondition: { type: "winning_trades", value: 80, comparison: "gte" }, completeCondition: { type: "total_trades", value: 175, comparison: "gte" }, rewards: { xp: 50 }, connectedTo: ["a7_comp5"], connectedFrom: ["a7_blizzard"], isRequired: true, order: 4 },
      { id: "a7_comp5", name: "Tournament Veteran", description: "5 competitions complete", shortDescription: "5 comps done", zoneId: "glacier", position: { x: 420, y: 380 }, nodeType: "milestone", icon: "tournament", color: "#06B6D4", size: "medium", unlockCondition: { type: "total_trades", value: 175, comparison: "gte" }, completeCondition: { type: "competitions_completed", value: 5, comparison: "gte" }, rewards: { xp: 55 }, connectedTo: ["a7_avalanche"], connectedFrom: ["a7_iceberg"], isRequired: true, order: 5 },
      { id: "a7_avalanche", name: "Avalanche Rider", description: "Win streak of 10+", shortDescription: "10 win streak", zoneId: "glacier", position: { x: 480, y: 340 }, nodeType: "checkpoint", icon: "avalanche", color: "#06B6D4", size: "large", unlockCondition: { type: "competitions_completed", value: 5, comparison: "gte" }, completeCondition: { type: "win_streak", value: 10, comparison: "gte" }, rewards: { xp: 60 }, connectedTo: ["a7_polar"], connectedFrom: ["a7_comp5"], isRequired: true, order: 6, celebrationText: "Unstoppable streak!" },
      { id: "a7_polar", name: "Polar Master", description: "90 winning trades", shortDescription: "90 wins", zoneId: "glacier", position: { x: 540, y: 300 }, nodeType: "milestone", icon: "polarBear", color: "#06B6D4", size: "medium", unlockCondition: { type: "win_streak", value: 10, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 90, comparison: "gte" }, rewards: { xp: 50 }, connectedTo: ["a7_2wins"], connectedFrom: ["a7_avalanche"], isRequired: true, order: 7 },
      { id: "a7_2wins", name: "Double Champion", description: "2 competition wins", shortDescription: "2 wins", zoneId: "glacier", position: { x: 600, y: 260 }, nodeType: "milestone", icon: "doubleTrophy", color: "#E2E8F0", size: "medium", unlockCondition: { type: "winning_trades", value: 90, comparison: "gte" }, completeCondition: { type: "first_place_finishes", value: 2, comparison: "gte" }, rewards: { xp: 70 }, connectedTo: ["a7_fortress"], connectedFrom: ["a7_polar"], isRequired: true, order: 8 },
      { id: "a7_fortress", name: "Fortress Breach", description: "200 trades milestone", shortDescription: "200 trades", zoneId: "fortress", position: { x: 660, y: 220 }, nodeType: "checkpoint", icon: "castle", color: "#E2E8F0", size: "large", unlockCondition: { type: "first_place_finishes", value: 2, comparison: "gte" }, completeCondition: { type: "total_trades", value: 200, comparison: "gte" }, rewards: { xp: 65 }, connectedTo: ["a7_podium5"], connectedFrom: ["a7_2wins"], isRequired: true, order: 9, celebrationText: "200 trades achieved!" },
      { id: "a7_podium5", name: "Podium Elite", description: "5 podium finishes", shortDescription: "5 podiums", zoneId: "fortress", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "podium", color: "#E2E8F0", size: "medium", unlockCondition: { type: "total_trades", value: 200, comparison: "gte" }, completeCondition: { type: "podium_finishes", value: 5, comparison: "gte" }, rewards: { xp: 75 }, connectedTo: ["a7_king"], connectedFrom: ["a7_fortress"], isRequired: true, order: 10 },
      { id: "a7_king", name: "Ice King", description: "Complete Arctic Fortress", shortDescription: "100 wins", zoneId: "fortress", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "iceKing", color: "#EF4444", size: "large", unlockCondition: { type: "podium_finishes", value: 5, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 100, comparison: "gte" }, rewards: { xp: 100, title: "Ice King" }, connectedTo: [], connectedFrom: ["a7_podium5"], isRequired: true, order: 11, celebrationText: "Map 7 Complete! Dragons await..." },
    ],
  },

  // ============================================
  // MAP 8: DRAGON REALM
  // ============================================
  {
    id: "map_8_dragon",
    mapId: "map_8_dragon",
    name: "Dragon Realm",
    description: "Face the dragons! Only legends survive this realm.",
    theme: "dragon",
    sequenceOrder: 8,
    difficulty: 8,
    xpBudget: 1500,
    milestoneCount: 24,
    requiredLevelToStart: 14,
    backgroundColor: "#1F1520",
    backgroundImage: "/assets/maps/dragon-realm.png",
    zones: [
      { id: "lair_entry", name: "Dragon's Gate", description: "Enter the lair", order: 1, position: { x: 100, y: 600 }, color: "#A855F7", icon: "dragonGate", isUnlockable: false },
      { id: "caverns", name: "Dragon Caverns", description: "Navigate the depths", order: 2, position: { x: 400, y: 400 }, color: "#EF4444", icon: "cave", isUnlockable: true },
      { id: "throne", name: "Dragon Throne", description: "Face the king", order: 3, position: { x: 700, y: 200 }, color: "#FFD700", icon: "dragonThrone", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "d8_enter", name: "Dragon's Gate", description: "Enter the realm of dragons", shortDescription: "Enter realm", zoneId: "lair_entry", position: { x: 100, y: 600 }, nodeType: "start", icon: "dragonEgg", color: "#A855F7", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_7_arctic" }, rewards: { xp: 60 }, connectedTo: ["d8_hatchling"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "The dragons sense your presence!" },
      { id: "d8_hatchling", name: "Hatchling Hunter", description: "210 trades complete", shortDescription: "210 trades", zoneId: "lair_entry", position: { x: 180, y: 540 }, nodeType: "milestone", icon: "dragon", color: "#A855F7", size: "medium", unlockCondition: { type: "total_trades", value: 200, comparison: "gte" }, completeCondition: { type: "total_trades", value: 210, comparison: "gte" }, rewards: { xp: 55 }, connectedTo: ["d8_fire"], connectedFrom: ["d8_enter"], isRequired: true, order: 2 },
      { id: "d8_fire", name: "Fire Breather", description: "110 winning trades", shortDescription: "110 wins", zoneId: "lair_entry", position: { x: 260, y: 480 }, nodeType: "milestone", icon: "dragonFire", color: "#A855F7", size: "medium", unlockCondition: { type: "total_trades", value: 210, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 110, comparison: "gte" }, rewards: { xp: 65 }, connectedTo: ["d8_cave"], connectedFrom: ["d8_hatchling"], isRequired: true, order: 3 },
      { id: "d8_cave", name: "Cavern Explorer", description: "225 trades complete", shortDescription: "225 trades", zoneId: "caverns", position: { x: 350, y: 420 }, nodeType: "checkpoint", icon: "cave", color: "#EF4444", size: "large", unlockCondition: { type: "winning_trades", value: 110, comparison: "gte" }, completeCondition: { type: "total_trades", value: 225, comparison: "gte" }, rewards: { xp: 70 }, connectedTo: ["d8_3wins"], connectedFrom: ["d8_fire"], isRequired: true, order: 4 },
      { id: "d8_3wins", name: "Triple Crown", description: "3 competition wins", shortDescription: "3 wins", zoneId: "caverns", position: { x: 420, y: 380 }, nodeType: "checkpoint", icon: "tripleCrown", color: "#EF4444", size: "large", unlockCondition: { type: "total_trades", value: 225, comparison: "gte" }, completeCondition: { type: "first_place_finishes", value: 3, comparison: "gte" }, rewards: { xp: 100 }, connectedTo: ["d8_scales"], connectedFrom: ["d8_cave"], isRequired: true, order: 5, celebrationText: "Triple champion!" },
      { id: "d8_scales", name: "Scale Collector", description: "120 winning trades", shortDescription: "120 wins", zoneId: "caverns", position: { x: 480, y: 340 }, nodeType: "milestone", icon: "dragonScale", color: "#EF4444", size: "medium", unlockCondition: { type: "first_place_finishes", value: 3, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 120, comparison: "gte" }, rewards: { xp: 70 }, connectedTo: ["d8_wing"], connectedFrom: ["d8_3wins"], isRequired: true, order: 6 },
      { id: "d8_wing", name: "Wing Walker", description: "Win streak of 12", shortDescription: "12 win streak", zoneId: "caverns", position: { x: 540, y: 300 }, nodeType: "milestone", icon: "dragonWing", color: "#EF4444", size: "medium", unlockCondition: { type: "winning_trades", value: 120, comparison: "gte" }, completeCondition: { type: "win_streak", value: 12, comparison: "gte" }, rewards: { xp: 85 }, connectedTo: ["d8_treasure"], connectedFrom: ["d8_scales"], isRequired: true, order: 7 },
      { id: "d8_treasure", name: "Dragon Hoard", description: "250 trades milestone", shortDescription: "250 trades", zoneId: "caverns", position: { x: 600, y: 260 }, nodeType: "checkpoint", icon: "hoard", color: "#FFD700", size: "large", unlockCondition: { type: "win_streak", value: 12, comparison: "gte" }, completeCondition: { type: "total_trades", value: 250, comparison: "gte" }, rewards: { xp: 90 }, connectedTo: ["d8_podium10"], connectedFrom: ["d8_wing"], isRequired: true, order: 8, celebrationText: "250 trades achieved!" },
      { id: "d8_podium10", name: "Podium Legend", description: "10 podium finishes", shortDescription: "10 podiums", zoneId: "throne", position: { x: 660, y: 220 }, nodeType: "milestone", icon: "legendPodium", color: "#FFD700", size: "medium", unlockCondition: { type: "total_trades", value: 250, comparison: "gte" }, completeCondition: { type: "podium_finishes", value: 10, comparison: "gte" }, rewards: { xp: 100 }, connectedTo: ["d8_slayer"], connectedFrom: ["d8_treasure"], isRequired: true, order: 9 },
      { id: "d8_slayer", name: "Dragon Slayer", description: "130 winning trades", shortDescription: "130 wins", zoneId: "throne", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "dragonSlayer", color: "#FFD700", size: "medium", unlockCondition: { type: "podium_finishes", value: 10, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 130, comparison: "gte" }, rewards: { xp: 90 }, connectedTo: ["d8_king"], connectedFrom: ["d8_podium10"], isRequired: true, order: 10 },
      { id: "d8_king", name: "Dragon King", description: "Complete Dragon Realm", shortDescription: "5 wins", zoneId: "throne", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "dragonKing", color: "#EF4444", size: "large", unlockCondition: { type: "winning_trades", value: 130, comparison: "gte" }, completeCondition: { type: "first_place_finishes", value: 5, comparison: "gte" }, rewards: { xp: 150, title: "Dragon King" }, connectedTo: [], connectedFrom: ["d8_slayer"], isRequired: true, order: 11, celebrationText: "Map 8 Complete! The heavens await..." },
    ],
  },

  // ============================================
  // MAP 9: CELESTIAL KINGDOM
  // ============================================
  {
    id: "map_9_celestial",
    mapId: "map_9_celestial",
    name: "Celestial Kingdom",
    description: "Ascend to the heavens! Trade among the gods.",
    theme: "celestial",
    sequenceOrder: 9,
    difficulty: 9,
    xpBudget: 2500,
    milestoneCount: 26,
    requiredLevelToStart: 16,
    backgroundColor: "#0C0C1E",
    backgroundImage: "/assets/maps/celestial-kingdom.png",
    zones: [
      { id: "gates", name: "Heaven's Gates", description: "Enter the divine", order: 1, position: { x: 100, y: 600 }, color: "#FFD700", icon: "gates", isUnlockable: false },
      { id: "clouds", name: "Cloud Palace", description: "Walk among clouds", order: 2, position: { x: 400, y: 400 }, color: "#F0F8FF", icon: "cloud", isUnlockable: true },
      { id: "throne_divine", name: "Divine Throne", description: "Ultimate ascension", order: 3, position: { x: 700, y: 200 }, color: "#FFD700", icon: "divineThrone", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "c9_ascend", name: "Divine Ascension", description: "Rise to the celestial realm", shortDescription: "Enter heaven", zoneId: "gates", position: { x: 100, y: 600 }, nodeType: "start", icon: "angel", color: "#FFD700", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_8_dragon" }, rewards: { xp: 100 }, connectedTo: ["c9_halo"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "You've transcended mortality!" },
      { id: "c9_halo", name: "Halo Bearer", description: "275 trades divine", shortDescription: "275 trades", zoneId: "gates", position: { x: 180, y: 540 }, nodeType: "milestone", icon: "halo", color: "#FFD700", size: "medium", unlockCondition: { type: "total_trades", value: 250, comparison: "gte" }, completeCondition: { type: "total_trades", value: 275, comparison: "gte" }, rewards: { xp: 90 }, connectedTo: ["c9_wings"], connectedFrom: ["c9_ascend"], isRequired: true, order: 2 },
      { id: "c9_wings", name: "Angel Wings", description: "150 winning trades", shortDescription: "150 wins", zoneId: "gates", position: { x: 260, y: 480 }, nodeType: "milestone", icon: "angelWings", color: "#FFD700", size: "medium", unlockCondition: { type: "total_trades", value: 275, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 150, comparison: "gte" }, rewards: { xp: 110 }, connectedTo: ["c9_cloud"], connectedFrom: ["c9_halo"], isRequired: true, order: 3 },
      { id: "c9_cloud", name: "Cloud Walker", description: "300 trades milestone", shortDescription: "300 trades", zoneId: "clouds", position: { x: 350, y: 420 }, nodeType: "checkpoint", icon: "cloud", color: "#F0F8FF", size: "large", unlockCondition: { type: "winning_trades", value: 150, comparison: "gte" }, completeCondition: { type: "total_trades", value: 300, comparison: "gte" }, rewards: { xp: 120 }, connectedTo: ["c9_star"], connectedFrom: ["c9_wings"], isRequired: true, order: 4, celebrationText: "300 trades achieved!" },
      { id: "c9_star", name: "Star Collector", description: "Win streak of 15", shortDescription: "15 win streak", zoneId: "clouds", position: { x: 420, y: 380 }, nodeType: "checkpoint", icon: "star", color: "#F0F8FF", size: "large", unlockCondition: { type: "total_trades", value: 300, comparison: "gte" }, completeCondition: { type: "win_streak", value: 15, comparison: "gte" }, rewards: { xp: 150 }, connectedTo: ["c9_constellation"], connectedFrom: ["c9_cloud"], isRequired: true, order: 5, celebrationText: "15 wins in a row!" },
      { id: "c9_constellation", name: "Constellation Master", description: "170 winning trades", shortDescription: "170 wins", zoneId: "clouds", position: { x: 480, y: 340 }, nodeType: "milestone", icon: "constellation", color: "#F0F8FF", size: "medium", unlockCondition: { type: "win_streak", value: 15, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 170, comparison: "gte" }, rewards: { xp: 130 }, connectedTo: ["c9_comp10"], connectedFrom: ["c9_star"], isRequired: true, order: 6 },
      { id: "c9_comp10", name: "Tournament Legend", description: "10 competitions complete", shortDescription: "10 comps done", zoneId: "clouds", position: { x: 540, y: 300 }, nodeType: "milestone", icon: "legendTrophy", color: "#F0F8FF", size: "medium", unlockCondition: { type: "winning_trades", value: 170, comparison: "gte" }, completeCondition: { type: "competitions_completed", value: 10, comparison: "gte" }, rewards: { xp: 140 }, connectedTo: ["c9_seraph"], connectedFrom: ["c9_constellation"], isRequired: true, order: 7 },
      { id: "c9_seraph", name: "Seraphim Rank", description: "7 competition wins", shortDescription: "7 wins", zoneId: "clouds", position: { x: 600, y: 260 }, nodeType: "checkpoint", icon: "seraph", color: "#FFD700", size: "large", unlockCondition: { type: "competitions_completed", value: 10, comparison: "gte" }, completeCondition: { type: "first_place_finishes", value: 7, comparison: "gte" }, rewards: { xp: 180 }, connectedTo: ["c9_archangel"], connectedFrom: ["c9_comp10"], isRequired: true, order: 8, celebrationText: "7 championship victories!" },
      { id: "c9_archangel", name: "Archangel", description: "350 trades complete", shortDescription: "350 trades", zoneId: "throne_divine", position: { x: 660, y: 220 }, nodeType: "milestone", icon: "archangel", color: "#FFD700", size: "medium", unlockCondition: { type: "first_place_finishes", value: 7, comparison: "gte" }, completeCondition: { type: "total_trades", value: 350, comparison: "gte" }, rewards: { xp: 160 }, connectedTo: ["c9_podium20"], connectedFrom: ["c9_seraph"], isRequired: true, order: 9 },
      { id: "c9_podium20", name: "Eternal Podium", description: "20 podium finishes", shortDescription: "20 podiums", zoneId: "throne_divine", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "eternalPodium", color: "#FFD700", size: "medium", unlockCondition: { type: "total_trades", value: 350, comparison: "gte" }, completeCondition: { type: "podium_finishes", value: 20, comparison: "gte" }, rewards: { xp: 180 }, connectedTo: ["c9_titan"], connectedFrom: ["c9_archangel"], isRequired: true, order: 10 },
      { id: "c9_titan", name: "Trading Titan", description: "Complete Celestial Kingdom", shortDescription: "200 wins", zoneId: "throne_divine", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "titan", color: "#EF4444", size: "large", unlockCondition: { type: "podium_finishes", value: 20, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 200, comparison: "gte" }, rewards: { xp: 250, title: "Trading Titan" }, connectedTo: [], connectedFrom: ["c9_podium20"], isRequired: true, order: 11, celebrationText: "Map 9 Complete! Only legends remain..." },
    ],
  },

  // ============================================
  // MAP 10: HALL OF LEGENDS (Final)
  // ============================================
  {
    id: "map_10_legendary",
    mapId: "map_10_legendary",
    name: "Hall of Legends",
    description: "The ultimate challenge! Etch your name in trading history.",
    theme: "legendary",
    sequenceOrder: 10,
    difficulty: 10,
    xpBudget: 5000,
    milestoneCount: 30,
    requiredLevelToStart: 18,
    backgroundColor: "#1A1A2E",
    backgroundImage: "/assets/maps/hall-of-legends.png",
    zones: [
      { id: "entrance_hall", name: "Grand Entrance", description: "Enter the hall", order: 1, position: { x: 100, y: 600 }, color: "#FFD700", icon: "grandEntrance", isUnlockable: false },
      { id: "hall", name: "Hall of Fame", description: "Among the greats", order: 2, position: { x: 400, y: 400 }, color: "#FF6B6B", icon: "hallOfFame", isUnlockable: true },
      { id: "god_throne", name: "Throne of Gods", description: "Ultimate glory", order: 3, position: { x: 700, y: 200 }, color: "#FFD700", icon: "godThrone", isUnlockable: true },
    ],
    milestoneTemplates: [
      { id: "l10_enter", name: "Legend Entry", description: "Enter the Hall of Legends", shortDescription: "Enter hall", zoneId: "entrance_hall", position: { x: 100, y: 600 }, nodeType: "start", icon: "legend", color: "#FFD700", size: "large", completeCondition: { type: "map_completed", milestoneId: "map_9_celestial" }, rewards: { xp: 200 }, connectedTo: ["l10_400trades"], connectedFrom: [], isRequired: true, order: 1, celebrationText: "The legends welcome you!" },
      { id: "l10_400trades", name: "400 Club", description: "400 trades milestone", shortDescription: "400 trades", zoneId: "entrance_hall", position: { x: 180, y: 540 }, nodeType: "checkpoint", icon: "milestone400", color: "#FFD700", size: "large", unlockCondition: { type: "total_trades", value: 350, comparison: "gte" }, completeCondition: { type: "total_trades", value: 400, comparison: "gte" }, rewards: { xp: 200 }, connectedTo: ["l10_master"], connectedFrom: ["l10_enter"], isRequired: true, order: 2, celebrationText: "400 trades club member!" },
      { id: "l10_master", name: "Market Master", description: "225 winning trades", shortDescription: "225 wins", zoneId: "entrance_hall", position: { x: 260, y: 480 }, nodeType: "milestone", icon: "marketMaster", color: "#FFD700", size: "medium", unlockCondition: { type: "total_trades", value: 400, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 225, comparison: "gte" }, rewards: { xp: 180 }, connectedTo: ["l10_10wins"], connectedFrom: ["l10_400trades"], isRequired: true, order: 3 },
      { id: "l10_10wins", name: "Decathlon Champion", description: "10 competition wins", shortDescription: "10 wins", zoneId: "hall", position: { x: 350, y: 420 }, nodeType: "checkpoint", icon: "decathlon", color: "#FF6B6B", size: "large", unlockCondition: { type: "winning_trades", value: 225, comparison: "gte" }, completeCondition: { type: "first_place_finishes", value: 10, comparison: "gte" }, rewards: { xp: 300 }, connectedTo: ["l10_streak20"], connectedFrom: ["l10_master"], isRequired: true, order: 4, celebrationText: "10-time champion!" },
      { id: "l10_streak20", name: "Immortal Streak", description: "Win streak of 20", shortDescription: "20 win streak", zoneId: "hall", position: { x: 420, y: 380 }, nodeType: "checkpoint", icon: "immortalStreak", color: "#FF6B6B", size: "large", unlockCondition: { type: "first_place_finishes", value: 10, comparison: "gte" }, completeCondition: { type: "win_streak", value: 20, comparison: "gte" }, rewards: { xp: 350 }, connectedTo: ["l10_podium30"], connectedFrom: ["l10_10wins"], isRequired: true, order: 5, celebrationText: "20 wins straight! Immortal!" },
      { id: "l10_podium30", name: "Podium Immortal", description: "30 podium finishes", shortDescription: "30 podiums", zoneId: "hall", position: { x: 480, y: 340 }, nodeType: "milestone", icon: "immortalPodium", color: "#FF6B6B", size: "medium", unlockCondition: { type: "win_streak", value: 20, comparison: "gte" }, completeCondition: { type: "podium_finishes", value: 30, comparison: "gte" }, rewards: { xp: 280 }, connectedTo: ["l10_500trades"], connectedFrom: ["l10_streak20"], isRequired: true, order: 6 },
      { id: "l10_500trades", name: "500 Legend", description: "500 trades milestone", shortDescription: "500 trades", zoneId: "hall", position: { x: 540, y: 300 }, nodeType: "checkpoint", icon: "legend500", color: "#FF6B6B", size: "large", unlockCondition: { type: "podium_finishes", value: 30, comparison: "gte" }, completeCondition: { type: "total_trades", value: 500, comparison: "gte" }, rewards: { xp: 350 }, connectedTo: ["l10_comp20"], connectedFrom: ["l10_podium30"], isRequired: true, order: 7, celebrationText: "500 trades legend!" },
      { id: "l10_comp20", name: "Tournament God", description: "20 competitions complete", shortDescription: "20 comps done", zoneId: "hall", position: { x: 600, y: 260 }, nodeType: "milestone", icon: "tournamentGod", color: "#FFD700", size: "medium", unlockCondition: { type: "total_trades", value: 500, comparison: "gte" }, completeCondition: { type: "competitions_completed", value: 20, comparison: "gte" }, rewards: { xp: 300 }, connectedTo: ["l10_300wins"], connectedFrom: ["l10_500trades"], isRequired: true, order: 8 },
      { id: "l10_300wins", name: "Triple Century", description: "300 winning trades", shortDescription: "300 wins", zoneId: "god_throne", position: { x: 660, y: 220 }, nodeType: "checkpoint", icon: "tripleCentury", color: "#FFD700", size: "large", unlockCondition: { type: "competitions_completed", value: 20, comparison: "gte" }, completeCondition: { type: "winning_trades", value: 300, comparison: "gte" }, rewards: { xp: 400 }, connectedTo: ["l10_15wins"], connectedFrom: ["l10_comp20"], isRequired: true, order: 9, celebrationText: "300 victories!" },
      { id: "l10_15wins", name: "Grand Champion", description: "15 competition wins", shortDescription: "15 wins", zoneId: "god_throne", position: { x: 720, y: 180 }, nodeType: "milestone", icon: "grandChampion", color: "#FFD700", size: "medium", unlockCondition: { type: "winning_trades", value: 300, comparison: "gte" }, completeCondition: { type: "first_place_finishes", value: 15, comparison: "gte" }, rewards: { xp: 450 }, connectedTo: ["l10_god"], connectedFrom: ["l10_300wins"], isRequired: true, order: 10 },
      { id: "l10_god", name: "Trading God", description: "Complete the Journey - Become a Legend!", shortDescription: "Journey Complete", zoneId: "god_throne", position: { x: 780, y: 140 }, nodeType: "legendary", icon: "tradingGod", color: "#EF4444", size: "large", unlockCondition: { type: "first_place_finishes", value: 15, comparison: "gte" }, completeCondition: { type: "all_maps_completed" }, rewards: { xp: 500, title: "Trading God", badgeId: "journey_legend" }, connectedTo: [], connectedFrom: ["l10_15wins"], isRequired: true, order: 11, celebrationText: "YOU ARE A TRADING GOD! ALL MAPS COMPLETE!" },
    ],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getMapByOrder(order: number): MapSequenceConfig | undefined {
  return MAP_SEQUENCE.find(m => m.sequenceOrder === order);
}

export function getMapById(mapId: string): MapSequenceConfig | undefined {
  return MAP_SEQUENCE.find(m => m.mapId === mapId);
}

export function getMapByTheme(theme: MapTheme): MapSequenceConfig | undefined {
  return MAP_SEQUENCE.find(m => m.theme === theme);
}

export function getTotalXPFromAllMaps(): number {
  return MAP_SEQUENCE.reduce((total, map) => total + map.xpBudget, 0);
}

export function getTotalMilestonesFromAllMaps(): number {
  return MAP_SEQUENCE.reduce((total, map) => total + map.milestoneCount, 0);
}

export function getMapXPBudget(sequenceOrder: number): number {
  return XP_ECONOMY.budgets[sequenceOrder - 1] || 150;
}

export function getCumulativeXP(upToMapOrder: number): number {
  return XP_ECONOMY.budgets.slice(0, upToMapOrder).reduce((a, b) => a + b, 0);
}
