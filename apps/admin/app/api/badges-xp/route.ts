import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import UserLevel from "@/database/models/user-level.model";
import UserBadge from "@/database/models/user-badge.model";
import { BADGES } from "@/lib/constants/badges";
import { ObjectId } from "mongodb";

/**
 * Build a query that matches user by various ID formats.
 * Better Auth uses 'id' field, but MongoDB also has '_id'.
 * UserLevel.userId may store either format.
 */
function buildUserQuery(uid: string) {
  const queries: any[] = [{ id: uid }];
  if (ObjectId.isValid(uid)) {
    queries.push({ _id: new ObjectId(uid) });
  }
  queries.push({ _id: uid });
  return { $or: queries };
}

/**
 * Build a batch query that matches multiple user IDs by id / _id.
 */
function buildBatchUserQuery(uids: string[]) {
  const objectIds = uids
    .filter((uid) => ObjectId.isValid(uid))
    .map((uid) => new ObjectId(uid));
  return {
    $or: [
      { id: { $in: uids } },
      ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      { _id: { $in: uids } },
    ],
  };
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Get database connection
    const mongoose = await import("mongoose");
    const db = mongoose.default.connection.db;

    if (!db) {
      throw new Error("Database connection not found");
    }

    // ── Single-user detail view ────────────────────────────────────────
    if (userId) {
      const [userLevel, userBadges, userDoc] = await Promise.all([
        UserLevel.findOne({ userId }).lean(),
        UserBadge.find({ userId }).lean(),
        db.collection("user").findOne(buildUserQuery(userId)),
      ]);

      const user = userDoc
        ? {
            id: userDoc.id,
            name: userDoc.name,
            email: userDoc.email,
            image: userDoc.image || null,
          }
        : null;

      const badgesWithDetails = userBadges.map((ub) => {
        const badge = BADGES.find((b) => b.id === ub.badgeId);
        return {
          ...ub,
          badgeDetails: badge,
        };
      });

      return NextResponse.json({
        success: true,
        user: {
          id: userId,
          name: user?.name || "Unknown",
          email: user?.email || "",
          image: user?.image || null,
        },
        level: userLevel || {
          userId,
          currentXP: 0,
          currentLevel: 1,
          currentTitle: "Novice Trader",
          totalBadgesEarned: 0,
        },
        badges: badgesWithDetails,
      });
    }

    // ── Paginated user list ──────────────────────────────────────────────
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "25", 10)),
    );
    const search = (searchParams.get("search") || "").trim();
    const skip = (page - 1) * limit;

    // 1. Compute stats with aggregation (fast — no full scan to JS)
    const [statsResult] = await UserLevel.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalXPAwarded: { $sum: "$currentXP" },
          totalBadgesAwarded: { $sum: "$totalBadgesEarned" },
          averageLevel: { $avg: "$currentLevel" },
        },
      },
    ]);

    const stats = statsResult
      ? {
          totalUsers: statsResult.totalUsers,
          totalXPAwarded: statsResult.totalXPAwarded,
          totalBadgesAwarded: statsResult.totalBadgesAwarded,
          averageLevel: statsResult.averageLevel,
        }
      : { totalUsers: 0, totalXPAwarded: 0, totalBadgesAwarded: 0, averageLevel: 0 };

    // 2. If searching, resolve matching userIds from the user collection first
    let matchingUserIds: string[] | null = null; // null = no filter

    if (search) {
      // Reason: Escape user input to prevent ReDoS via crafted regex patterns
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      const matchedUsers = await db
        .collection("user")
        .find(
          { $or: [{ name: regex }, { email: regex }] },
          { projection: { id: 1, _id: 1 } },
        )
        .limit(500) // Reasonable cap — search should narrow results
        .toArray();

      // Collect BOTH id and _id formats so we match regardless of what UserLevel stores
      matchingUserIds = matchedUsers.flatMap(
        (u: any) => {
          const ids: string[] = [];
          if (u.id) ids.push(u.id);
          if (u._id) ids.push(u._id.toString());
          return ids;
        },
      );
      // Deduplicate
      matchingUserIds = [...new Set(matchingUserIds)];

      // No matches → return empty page immediately
      if (matchingUserIds.length === 0) {
        return NextResponse.json({
          success: true,
          users: [],
          stats,
          pagination: { page, limit, totalUsers: 0, totalPages: 0 },
        });
      }
    }

    // 3. Fetch paginated UserLevel docs (with optional userId filter for search)
    const levelFilter: Record<string, unknown> = {};
    if (matchingUserIds) {
      levelFilter.userId = { $in: matchingUserIds };
    }

    const [pagedLevels, filteredCount] = await Promise.all([
      UserLevel.find(levelFilter)
        .sort({ currentXP: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserLevel.countDocuments(levelFilter),
    ]);

    // 4. Batch-fetch only the users we need (tiny set: ≤ limit)
    const userIdsInPage = pagedLevels.map((ul) => ul.userId);

    // Use $or query to match by id, _id (ObjectId), or _id (string)
    const userDocs = userIdsInPage.length > 0
      ? await db
          .collection("user")
          .find(buildBatchUserQuery(userIdsInPage), { projection: { id: 1, name: 1, email: 1, image: 1, _id: 1 } })
          .toArray()
      : [];

    // Map users by BOTH id and _id.toString() so lookup works regardless of format
    const userMap = new Map<string, any>();
    for (const u of userDocs) {
      const userData = { id: u.id || u._id?.toString(), name: u.name, email: u.email, image: u.image || null };
      // Map by 'id' field
      if (u.id) userMap.set(u.id, userData);
      // Map by '_id' as string (handles case where UserLevel.userId = _id.toString())
      if (u._id) userMap.set(u._id.toString(), userData);
    }

    // 5. Assemble response
    const usersWithLevels = pagedLevels.map((ul) => {
      const user = userMap.get(ul.userId);
      return {
        userId: ul.userId,
        name:
          user?.name ||
          user?.email?.split("@")[0] ||
          `User ${ul.userId.slice(-4)}`,
        email: user?.email || "No email",
        image: user?.image || null,
        currentXP: ul.currentXP,
        currentLevel: ul.currentLevel,
        currentTitle: ul.currentTitle,
        totalBadgesEarned: ul.totalBadgesEarned,
        lastXPGain: ul.lastXPGain,
      };
    });

    const totalPages = Math.ceil(filteredCount / limit);

    return NextResponse.json({
      success: true,
      users: usersWithLevels,
      stats,
      pagination: {
        page,
        limit,
        totalUsers: filteredCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching badges/XP data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch data",
      },
      { status: 500 },
    );
  }
}
