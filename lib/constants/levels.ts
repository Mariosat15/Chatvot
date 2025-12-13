export interface TitleLevel {
  level: number;
  title: string;
  minXP: number;
  maxXP: number;
  color: string;
  icon: string;
  description: string;
}

// XP Values per Badge Rarity
export const BADGE_XP_VALUES = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
} as const;

// 10 Progressive Title Levels
export const TITLE_LEVELS: TitleLevel[] = [
  {
    level: 1,
    title: 'Novice Trader',
    minXP: 0,
    maxXP: 99,
    color: 'text-gray-400',
    icon: '🌱',
    description: 'Just starting the trading journey',
  },
  {
    level: 2,
    title: 'Apprentice Trader',
    minXP: 100,
    maxXP: 299,
    color: 'text-green-400',
    icon: '📚',
    description: 'Learning the basics of trading',
  },
  {
    level: 3,
    title: 'Skilled Trader',
    minXP: 300,
    maxXP: 599,
    color: 'text-blue-400',
    icon: '⚔️',
    description: 'Developing trading skills',
  },
  {
    level: 4,
    title: 'Expert Trader',
    minXP: 600,
    maxXP: 999,
    color: 'text-cyan-400',
    icon: '🎯',
    description: 'Mastering trading strategies',
  },
  {
    level: 5,
    title: 'Elite Trader',
    minXP: 1000,
    maxXP: 1599,
    color: 'text-purple-400',
    icon: '💎',
    description: 'Among the trading elite',
  },
  {
    level: 6,
    title: 'Master Trader',
    minXP: 1600,
    maxXP: 2399,
    color: 'text-pink-400',
    icon: '👑',
    description: 'A master of the markets',
  },
  {
    level: 7,
    title: 'Grand Master',
    minXP: 2400,
    maxXP: 3399,
    color: 'text-orange-400',
    icon: '🔥',
    description: 'Legendary trading prowess',
  },
  {
    level: 8,
    title: 'Trading Champion',
    minXP: 3400,
    maxXP: 4599,
    color: 'text-red-400',
    icon: '⚡',
    description: 'Champion of competitions',
  },
  {
    level: 9,
    title: 'Market Legend',
    minXP: 4600,
    maxXP: 5999,
    color: 'text-yellow-400',
    icon: '🌟',
    description: 'A living legend in trading',
  },
  {
    level: 10,
    title: 'Trading God',
    minXP: 6000,
    maxXP: Infinity,
    color: 'text-yellow-300',
    icon: '👑',
    description: 'The ultimate trading master',
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
  if (currentLevel >= 10) return null;
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
  const progressPercent = Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);
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
export function getXPForBadge(rarity: 'common' | 'rare' | 'epic' | 'legendary'): number {
  return BADGE_XP_VALUES[rarity];
}

