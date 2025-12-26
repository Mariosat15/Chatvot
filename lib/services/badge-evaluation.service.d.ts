import { Badge } from '@/lib/constants/badges';
/**
 * Evaluate all badges for a user and award new ones
 */
export declare function evaluateUserBadges(userId: string): Promise<{
    newBadges: Badge[];
    totalBadges: number;
}>;
/**
 * Get user badges with progress
 */
export declare function getUserBadges(userId: string): Promise<any>;
