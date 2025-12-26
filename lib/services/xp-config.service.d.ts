import { TitleLevel } from '@/lib/constants/levels';
/**
 * Get Badge XP Values from database
 */
export declare function getBadgeXPValues(): Promise<{
    readonly common: 10;
    readonly rare: 25;
    readonly epic: 50;
    readonly legendary: 100;
} | {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
}>;
/**
 * Get Level Progression from database
 */
export declare function getTitleLevels(): Promise<TitleLevel[]>;
/**
 * Get title level by XP amount (from database)
 */
export declare function getTitleByXP(xp: number): Promise<TitleLevel>;
/**
 * Get next title level (from database)
 */
export declare function getNextTitle(currentLevel: number): Promise<TitleLevel | null>;
/**
 * Calculate XP progress to next level (from database)
 */
export declare function calculateXPProgress(currentXP: number): Promise<{
    currentLevel: TitleLevel;
    nextLevel: TitleLevel | null;
    progressPercent: number;
    xpToNext: number;
}>;
/**
 * Get XP value for a badge rarity (from database)
 */
export declare function getXPForBadge(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Promise<number>;
//# sourceMappingURL=xp-config.service.d.ts.map