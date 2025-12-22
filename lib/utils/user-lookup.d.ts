export interface UserInfo {
    id: string;
    email: string;
    name: string;
    profileImage?: string;
    bio?: string;
    role?: string;
    country?: string;
    address?: string;
    city?: string;
    postalCode?: string;
}
/**
 * Get user information from better-auth user collection by userId
 * Users are stored in a native MongoDB 'user' collection by better-auth
 *
 * PERFORMANCE: Uses LRU cache with 30s TTL to avoid repeated DB queries
 * Cache hit: ~0.1ms | Cache miss: ~50-100ms
 */
export declare function getUserById(userId: string): Promise<UserInfo | null>;
/**
 * Get ALL traders from the database (only users with role='trader' or no role set)
 * Identifies traders by EMAIL and ROLE field (not by name)
 * Returns an array of all trader users, deduplicated by email
 */
export declare function getAllUsers(): Promise<UserInfo[]>;
/**
 * Get multiple users by their IDs
 * Returns a Map keyed by the original userIds passed in
 */
export declare function getUsersByIds(userIds: string[]): Promise<Map<string, UserInfo>>;
//# sourceMappingURL=user-lookup.d.ts.map