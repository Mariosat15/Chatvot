import { connectToDatabase } from "@/database/mongoose";
import { ObjectId, ReadPreference } from "mongodb";
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
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      console.error("Database connection not found");
      return [];
    }

    // PERF FIX: Simple query with projection — filter in JS instead of
    // complex $and/$or that prevents index use (was 5.4s, should be <1s).
    const users = await db
      .collection("user")
      .find(
        {},
        {
          projection: {
            id: 1,
            _id: 1,
            email: 1,
            name: 1,
            profileImage: 1,
            image: 1,
            role: 1,
            emailVerified: 1,
          },
          readPreference: ReadPreference.SECONDARY_PREFERRED,
        }
      )
      .toArray();

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

      // Reason: Exclude users whose email is not verified. Unverified accounts
      // are spam signups or bots that never completed email confirmation and
      // must not appear on public leaderboards / matchmaking.
      if (user.emailVerified !== true) continue;

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

    /*
     * THREE WAYS TO BE THE SAME USER, exactly as `getUserById` above has always had.
     *
     * Reason: this used to filter on `{ id: { $in: uniqueIds } }` alone, which finds nothing
     * for an account whose document has no `id` field - and Better Auth's MongoDB adapter
     * stores the identity in `_id`, so `session.user.id` is an ObjectId string. The single
     * lookup carries all three fallbacks precisely because the shape varies; this one did not,
     * and the whole batch came back empty with no error and nothing in a log. That is what put
     * initials on every row of the game leaderboards after the owner asked for faces.
     */
    const objectIds = uniqueIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const idFilters: Record<string, unknown>[] = [{ id: { $in: uniqueIds } }];
    if (objectIds.length > 0) idFilters.push({ _id: { $in: objectIds } });
    // A string `_id` is the third shape `getUserById` handles, and `$in` may legitimately mix
    // types, so both go in rather than one being chosen.
    idFilters.push({ _id: { $in: uniqueIds } });

    const users = await db
      .collection("user")
      .find({ $or: idFilters }, { projection })
      .toArray();

    for (const user of users) {
      const declaredId = user.id ? String(user.id) : "";
      const documentId = user._id ? String(user._id) : "";
      const id = declaredId || documentId;
      if (!id) continue;

      const info: UserInfo = {
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
      };

      /*
       * KEYED UNDER BOTH IDS, because the caller looks the map up by the string it passed in.
       * A document found through `_id` whose `id` field says something else would otherwise be
       * fetched successfully and then missed on the way out - the same silent empty answer one
       * step later.
       */
      if (declaredId) userMap.set(declaredId, info);
      if (documentId) userMap.set(documentId, info);
    }

    return userMap;
  } catch (error) {
    console.error("Error fetching users:", error);
    return userMap;
  }
}
