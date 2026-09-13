import type { GameIconName } from "@/lib/constants/game-icons";

export interface TitleLevel {
  level: number;
  title: string;
  minXP: number;
  maxXP: number;
  color: string;
  icon: GameIconName; // GameIcon name from game-icons.ts
  description: string;
}

// XP Values per Badge Rarity
export const BADGE_XP_VALUES = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
} as const;

// 20 Progressive Title Levels
// Tier 1: Beginner (1-5) - 0-499 XP
// Tier 2: Intermediate (6-10) - 500-1999 XP
// Tier 3: Advanced (11-15) - 2000-4999 XP
// Tier 4: Elite (16-20) - 5000+ XP
export const TITLE_LEVELS: TitleLevel[] = [
  // ============================================
  // TIER 1: BEGINNER (Levels 1-5)
  // ============================================
  {
    level: 1,
    title: "Novice Trader",
    minXP: 0,
    maxXP: 49,
    color: "text-gray-400",
    icon: "starBadge",
    description: "Just starting the trading journey",
  },
  {
    level: 2,
    title: "Apprentice",
    minXP: 50,
    maxXP: 124,
    color: "text-gray-300",
    icon: "guideBook",
    description: "Learning the basics of trading",
  },
  {
    level: 3,
    title: "Trainee",
    minXP: 125,
    maxXP: 249,
    color: "text-green-500",
    icon: "sword",
    description: "Practicing trading fundamentals",
  },
  {
    level: 4,
    title: "Junior Trader",
    minXP: 250,
    maxXP: 374,
    color: "text-green-400",
    icon: "trade",
    description: "Building trading experience",
  },
  {
    level: 5,
    title: "Rising Trader",
    minXP: 375,
    maxXP: 499,
    color: "text-teal-400",
    icon: "profit",
    description: "Showing promise in the markets",
  },

  // ============================================
  // TIER 2: INTERMEDIATE (Levels 6-10)
  // ============================================
  {
    level: 6,
    title: "Skilled Trader",
    minXP: 500,
    maxXP: 749,
    color: "text-blue-400",
    icon: "target",
    description: "Developing solid trading skills",
  },
  {
    level: 7,
    title: "Competent Trader",
    minXP: 750,
    maxXP: 1099,
    color: "text-blue-300",
    icon: "archer",
    description: "Consistently making good trades",
  },
  {
    level: 8,
    title: "Proficient Trader",
    minXP: 1100,
    maxXP: 1449,
    color: "text-cyan-400",
    icon: "shield1",
    description: "Mastering risk management",
  },
  {
    level: 9,
    title: "Expert Trader",
    minXP: 1450,
    maxXP: 1799,
    color: "text-cyan-300",
    icon: "swordNumbered",
    description: "Expertise in trading strategies",
  },
  {
    level: 10,
    title: "Senior Trader",
    minXP: 1800,
    maxXP: 1999,
    color: "text-purple-400",
    icon: "gems",
    description: "A respected market participant",
  },

  // ============================================
  // TIER 3: ADVANCED (Levels 11-15)
  // ============================================
  {
    level: 11,
    title: "Elite Trader",
    minXP: 2000,
    maxXP: 2499,
    color: "text-purple-300",
    icon: "star1",
    description: "Among the trading elite",
  },
  {
    level: 12,
    title: "Master Trader",
    minXP: 2500,
    maxXP: 2999,
    color: "text-pink-400",
    icon: "crown",
    description: "Mastery of the markets",
  },
  {
    level: 13,
    title: "Grand Master",
    minXP: 3000,
    maxXP: 3499,
    color: "text-pink-300",
    icon: "fireSpell",
    description: "Legendary trading prowess",
  },
  {
    level: 14,
    title: "Trading Virtuoso",
    minXP: 3500,
    maxXP: 3999,
    color: "text-orange-400",
    icon: "blueFireSpell",
    description: "Virtuoso of market timing",
  },
  {
    level: 15,
    title: "Trading Champion",
    minXP: 4000,
    maxXP: 4999,
    color: "text-orange-300",
    icon: "trophy",
    description: "Champion of competitions",
  },

  // ============================================
  // TIER 4: ELITE (Levels 16-20)
  // ============================================
  {
    level: 16,
    title: "Market Legend",
    minXP: 5000,
    maxXP: 5999,
    color: "text-yellow-400",
    icon: "starAward",
    description: "A living legend in trading",
  },
  {
    level: 17,
    title: "Trading Titan",
    minXP: 6000,
    maxXP: 7499,
    color: "text-yellow-300",
    icon: "goldMedal",
    description: "Titan among traders",
  },
  {
    level: 18,
    title: "Market Overlord",
    minXP: 7500,
    maxXP: 9999,
    color: "text-red-400",
    icon: "lord",
    description: "Overlord of the markets",
  },
  {
    level: 19,
    title: "Trading Immortal",
    minXP: 10000,
    maxXP: 14999,
    color: "text-red-300",
    icon: "champion",
    description: "Immortal trading legacy",
  },
  {
    level: 20,
    title: "Trading God",
    minXP: 15000,
    maxXP: Infinity,
    color: "text-amber-400",
    icon: "victory",
    description: "The ultimate trading master",
  },
];

/**
 * Get title level by XP amount
 */
export function getTitleByXP(xp: number): TitleLevel {
  for (let i = TITLE_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= TITLE_LEVELS[i].minXP) {
      return TITLE_LEVELS[i];
    }
  }
  return TITLE_LEVELS[0];
}

/**
 * Get next title level
 */
export function getNextTitle(currentLevel: number): TitleLevel | null {
  if (currentLevel >= 20) return null;
  return TITLE_LEVELS[currentLevel]; // currentLevel is 1-based, array is 0-based, so [currentLevel] gives next
}

/**
 * Calculate XP progress to next level
 */
export function calculateXPProgress(currentXP: number): {
  currentLevel: TitleLevel;
  nextLevel: TitleLevel | null;
  progressPercent: number;
  xpToNext: number;
} {
  const currentLevel = getTitleByXP(currentXP);
  const nextLevel = getNextTitle(currentLevel.level);

  if (!nextLevel) {
    return {
      currentLevel,
      nextLevel: null,
      progressPercent: 100,
      xpToNext: 0,
    };
  }

  const xpInCurrentLevel = currentXP - currentLevel.minXP;
  const xpNeededForNextLevel = nextLevel.minXP - currentLevel.minXP;
  const progressPercent = Math.min(
    100,
    (xpInCurrentLevel / xpNeededForNextLevel) * 100,
  );
  const xpToNext = nextLevel.minXP - currentXP;

  return {
    currentLevel,
    nextLevel,
    progressPercent,
    xpToNext,
  };
}

/**
 * Get XP value for a badge rarity
 */
export function getXPForBadge(
  rarity: "common" | "rare" | "epic" | "legendary",
): number {
  return BADGE_XP_VALUES[rarity];
}

/**
 * Get tier name by level
 */
export function getTierByLevel(level: number): string {
  if (level <= 5) return "Beginner";
  if (level <= 10) return "Intermediate";
  if (level <= 15) return "Advanced";
  return "Elite";
}

/**
 * Get tier color by level
 */
export function getTierColorByLevel(level: number): string {
  if (level <= 5) return "text-green-400";
  if (level <= 10) return "text-blue-400";
  if (level <= 15) return "text-purple-400";
  return "text-yellow-400";
}
