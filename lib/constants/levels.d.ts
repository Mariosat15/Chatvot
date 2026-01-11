export interface TitleLevel {
    level: number;
    title: string;
    minXP: number;
    maxXP: number;
    color: string;
    icon: string;
    description: string;
}
export declare const BADGE_XP_VALUES: {
    readonly common: 10;
    readonly rare: 25;
    readonly epic: 50;
    readonly legendary: 100;
};
export declare const TITLE_LEVELS: TitleLevel[];
/**
 * Get title level by XP amount
 */
export declare function getTitleByXP(xp: number): TitleLevel;
/**
 * Get next title level
 */
export declare function getNextTitle(currentLevel: number): TitleLevel | null;
/**
 * Calculate XP progress to next level
 */
export declare function calculateXPProgress(currentXP: number): {
    currentLevel: TitleLevel;
    nextLevel: TitleLevel | null;
    progressPercent: number;
    xpToNext: number;
};
/**
 * Get XP value for a badge rarity
 */
export declare function getXPForBadge(rarity: 'common' | 'rare' | 'epic' | 'legendary'): number;
//# sourceMappingURL=levels.d.ts.map