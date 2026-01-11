/**
 * Award XP to user for earning a badge
 */
export declare function awardXPForBadge(userId: string, badgeId: string): Promise<{
    xpGained: number;
    newXP: number;
    newLevel: number;
    newTitle: string;
    leveledUp: boolean;
    oldLevel?: number;
    oldTitle?: string;
}>;
/**
 * Get user's current level and XP
 * Always fetches title, icon, and description from database configuration
 */
export declare function getUserLevel(userId: string): Promise<any>;
/**
 * Recalculate user level based on badges
 */
export declare function recalculateUserLevel(userId: string): Promise<any>;
/**
 * Get leaderboard with titles
 */
export declare function getUsersWithTitles(userIds: string[]): Promise<Map<any, import("mongoose").FlattenMaps<any> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>>;
//# sourceMappingURL=xp-level.service.d.ts.map