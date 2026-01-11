/**
 * Check if a user has any active restrictions
 */
export declare function getUserRestrictions(userId: string): Promise<any[]>;
/**
 * Check if user can perform a specific action
 */
export declare function canUserPerformAction(userId: string, action: 'trade' | 'enterCompetition' | 'deposit' | 'withdraw'): Promise<{
    allowed: boolean;
    reason?: string;
    restrictionType?: string;
}>;
/**
 * Get all restrictions for admin view
 */
export declare function getAllRestrictions(filters?: {
    userId?: string;
    restrictionType?: string;
    isActive?: boolean;
}): Promise<(import("mongoose").FlattenMaps<any> & Required<{
    _id: unknown;
}> & {
    __v: number;
})[]>;
/**
 * Unrestrict a user (unban/unsuspend)
 */
export declare function unrestrictUser(userId: string, adminUserId: string): Promise<boolean>;
//# sourceMappingURL=user-restriction.service.d.ts.map