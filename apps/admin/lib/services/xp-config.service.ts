'use server';

import { connectToDatabase } from '@/database/mongoose';
import XPConfig from '@/database/models/xp-config.model';
import { BADGE_XP_VALUES, TITLE_LEVELS, TitleLevel } from '@/lib/constants/levels';

/**
 * Get Badge XP Values from database
 */
export async function getBadgeXPValues() {
  try {
    await connectToDatabase();
    
    const config = await XPConfig.findOne({ configType: 'badge_xp', isActive: true }).lean();
    
    if (config && config.data) {
      return config.data as { common: number; rare: number; epic: number; legendary: number };
    }
    
    // Fallback to constants
    return BADGE_XP_VALUES;
  } catch (error) {
    console.error('Error fetching badge XP values, using defaults:', error);
    return BADGE_XP_VALUES;
  }
}

/**
 * Get Level Progression from database
 */
export async function getTitleLevels(): Promise<TitleLevel[]> {
  try {
    await connectToDatabase();
    
    const config = await XPConfig.findOne({ configType: 'level_progression', isActive: true }).lean();
    
    if (config && config.data && config.data.levels) {
      return config.data.levels as TitleLevel[];
    }
    
    // Fallback to constants
    return TITLE_LEVELS;
  } catch (error) {
    console.error('Error fetching title levels, using defaults:', error);
    return TITLE_LEVELS;
  }
}

/**
 * Get title level by XP amount (from database)
 */
export async function getTitleByXP(xp: number): Promise<TitleLevel> {
  const levels = await getTitleLevels();
  
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i].minXP) {
      return levels[i];
    }
  }
  return levels[0];
}

/**
 * Get next title level (from database)
 */
export async function getNextTitle(currentLevel: number): Promise<TitleLevel | null> {
  const levels = await getTitleLevels();
  
  if (currentLevel >= levels.length) return null;
  return levels[currentLevel]; // currentLevel is 1-based, array is 0-based
}

/**
 * Calculate XP progress to next level (from database)
 */
export async function calculateXPProgress(currentXP: number): Promise<{
  currentLevel: TitleLevel;
  nextLevel: TitleLevel | null;
  progressPercent: number;
  xpToNext: number;
}> {
  const currentLevel = await getTitleByXP(currentXP);
  const nextLevel = await getNextTitle(currentLevel.level);

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
 * Get XP value for a badge rarity (from database)
 */
export async function getXPForBadge(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Promise<number> {
  const xpValues = await getBadgeXPValues();
  return xpValues[rarity];
}

