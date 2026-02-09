import { connectToDatabase } from "@/database/mongoose";
import { ReadPreference } from "mongodb";
import { userCache } from "./cache";

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  bio?: string;
  role?: string; // 'trader', 'admin', 'backoffice'
  country?: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

// Projection to only fetch fields we need (reduces data transfer)
const USER_PROJECTION = {
  id: 1,
  _id: 1,
  email: 1,
  name: 1,
  profileImage: 1,
  image: 1, // better-auth uses 'image' field
  bio: 1,
  role: 1,
  country: 1,
  address: 1,
  city: 1,
  postalCode: 1,
};

/**
 * Get user information from better-auth user collection by userId
 * Users are stored in a native MongoDB 'user' collection by better-auth
 *
 * PERFORMANCE: Uses LRU cache with 30s TTL to avoid repeated DB queries
 * Cache hit: ~0.1ms | Cache miss: ~50-100ms
 */
export async function getUserById(userId: string): Promise<UserInfo | null> {
  if (!userId) return null;

  const cacheKey = `user:${userId}`;

  // Check cache first
  const cached = userCache.get(cacheKey);
  if (cached) {
    return cached as UserInfo;
  }

  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      console.error("Database connection not found");
      return null;
    }

    // Try finding by 'id' field first (better-auth uses this)
    // PERFORMANCE: Use projection to only fetch needed fields
    let user = await db
      .collection("user")
      .findOne({ id: userId }, { projection: USER_PROJECTION });

    // If not found, try by _id as ObjectId
    if (!user) {
      try {
        const { ObjectId } = await import("mongodb");
        if (ObjectId.isValid(userId)) {
          user = await db
            .collection("user")
            .findOne(
              { _id: new ObjectId(userId) },
              { projection: USER_PROJECTION },
            );
        }
      } catch {
        // Not a valid ObjectId, skip
      }
    }

    // If still not found, try as string _id
    if (!user) {
      user = await db
        .collection("user")
        .findOne({ _id: userId } as Record<string, unknown>, {
          projection: USER_PROJECTION,
        });
    }

    if (!user) {
      return null;
    }

    const userInfo: UserInfo = {
      id: user.id || user._id?.toString() || userId,
      email: user.email || "unknown",
      name: user.name || user.email || "Unknown User",
      profileImage: user.profileImage || user.image, // Check both profileImage and image (better-auth)
      bio: user.bio,
      role: user.role || "trader",
      country: user.country,
      address: user.address,
      city: user.city,
      postalCode: user.postalCode,
    };

    // Cache the result
    userCache.set(cacheKey, userInfo);

    return userInfo;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

/**
 * Get ALL traders from the database (only users with role='trader' or no role set)
 * Identifies traders by EMAIL and ROLE field (not by name)
 * Returns an array of all trader users, deduplicated by email
 */
export async function getAllUsers(): Promise<UserInfo[]> {
  try {
    // #region agent log
    const _allUsersT0 = Date.now();
    // #endregion
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      console.error("Database connection not found");
      return [];
    }

    // PERF FIX: Simple query with projection — filter in JS instead of
    // complex $and/$or that prevents index use (was 5.4s, should be <1s).
    // #region agent log
    const _queryT0 = Date.now();
    // #endregion
    const users = await db
      .collection("user")
      .find(
        {},
        {
          projection: { id: 1, _id: 1, email: 1, name: 1, profileImage: 1, image: 1, role: 1 },
          readPreference: ReadPreference.SECONDARY_PREFERRED,
        }
      )
      .toArray();
    // #region agent log
    console.log(`[PERF] getAllUsers DB query: ${Date.now()-_queryT0}ms userCount=${users.length}`);
    // #endregion

    // Filter in JS (fast for ~5000 docs): traders only, dedupe by email
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || "";
    const uniqueUsersMap = new Map<string, UserInfo>();

    for (const user of users) {
      const id = user.id || user._id?.toString() || "";
      const email = (user.email || "").toLowerCase();

      if (!id || !email) continue;
      if (uniqueUsersMap.has(email)) continue;

      // Only traders: role='trader', undefined, or null
      const role = user.role || "trader";
      if (role !== "trader") continue;

      // Skip admin
      if (adminEmail && email === adminEmail) continue;

      uniqueUsersMap.set(email, {
        id,
        email,
        name: user.name || email.split("@")[0] || "Unknown User",
        profileImage: user.profileImage || user.image,
        bio: user.bio,
        role: "trader",
        country: user.country,
        address: user.address,
        city: user.city,
        postalCode: user.postalCode,
      });
    }

    return Array.from(uniqueUsersMap.values());
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
}

/**
 * Get multiple users by their IDs
 * Returns a Map keyed by the original userIds passed in
 * Uses a single find with $in for scale (no N+1 queries)
 */
export async function getUsersByIds(
  userIds: string[],
): Promise<Map<string, UserInfo>> {
  const userMap = new Map<string, UserInfo>();
  if (userIds.length === 0) return userMap;

  const uniqueIds = [...new Set(userIds)];

  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      console.error("Database connection not found");
      return userMap;
    }

    const projection = {
      id: 1,
      _id: 1,
      email: 1,
      name: 1,
      profileImage: 1,
      image: 1,
      bio: 1,
      role: 1,
      country: 1,
      address: 1,
      city: 1,
      postalCode: 1,
    };

    const users = await db
      .collection("user")
      .find({ id: { $in: uniqueIds } }, { projection })
      .toArray();

    for (const user of users) {
      const id = user.id || user._id?.toString() || "";
      if (!id) continue;
      userMap.set(id, {
        id,
        email: user.email || "unknown",
        name: user.name || user.email || "Unknown User",
        profileImage: user.profileImage || user.image,
        bio: user.bio,
        role: user.role || "trader",
        country: user.country,
        address: user.address,
        city: user.city,
        postalCode: user.postalCode,
      });
    }

    return userMap;
  } catch (error) {
    console.error("Error fetching users:", error);
    return userMap;
  }
}
