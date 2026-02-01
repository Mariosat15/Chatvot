import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { ObjectId } from "mongodb";
import { BlockedUser } from "@/database/models/messaging/blocked-user.model";

/**
 * Helper to build query filter for user
 */
function buildUserQuery(userId: string) {
  const queries: any[] = [{ id: userId }];

  if (ObjectId.isValid(userId)) {
    queries.push({ _id: new ObjectId(userId) });
  }
  queries.push({ _id: userId });

  return { $or: queries };
}

/**
 * GET /api/messaging/friends/status/[userId]
 * Check friendship status with a user including block status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const { userId } = await params;

    // Can't check status with yourself
    if (userId === currentUserId) {
      return NextResponse.json({
        isFriend: false,
        hasPendingRequest: false,
        hasReceivedRequest: false,
        canReceiveRequests: true,
        isBlocked: false,
        isBlockedByThem: false,
      });
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    const { Friendship, FriendRequest } =
      await import("@/database/models/messaging/friend.model");

    // Check if the target user has disabled friend requests (check both paths)
    const targetUser = await db
      .collection("user")
      .findOne(buildUserQuery(userId));
    const allowFriendRequests =
      targetUser?.privacySettings?.allowFriendRequests !== false &&
      targetUser?.settings?.privacy?.allowFriendRequests !== false;

    // Check friendship and block status
    const friendship = await (
      Friendship as unknown as {
        getFriendship: (
          u1: string,
          u2: string,
        ) => Promise<{ blockedBy?: string } | null>;
      }
    ).getFriendship(currentUserId, userId);
    const areFriends = friendship && !friendship.blockedBy;
    const isFriendshipBlockedByMe = friendship?.blockedBy === currentUserId;
    const isFriendshipBlockedByThem = friendship?.blockedBy === userId;

    // Check non-friendship blocks
    const isBlockedByMe = await (
      BlockedUser as unknown as {
        isBlocked: (u1: string, u2: string) => Promise<boolean>;
      }
    ).isBlocked(currentUserId, userId);
    const isBlockedByThem = await (
      BlockedUser as unknown as {
        isBlocked: (u1: string, u2: string) => Promise<boolean>;
      }
    ).isBlocked(userId, currentUserId);

    // Check pending requests
    // hasPendingRequest = I sent a request to them
    const sentRequest = await FriendRequest.findOne({
      fromUserId: currentUserId,
      toUserId: userId,
      status: "pending",
    });

    // hasReceivedRequest = They sent a request to me
    const receivedRequest = await FriendRequest.findOne({
      fromUserId: userId,
      toUserId: currentUserId,
      status: "pending",
    });

    return NextResponse.json({
      isFriend: !!areFriends,
      hasPendingRequest: !!sentRequest,
      hasReceivedRequest: !!receivedRequest,
      canReceiveRequests: allowFriendRequests,
      isBlocked: isBlockedByMe || isFriendshipBlockedByMe,
      isBlockedByThem: isBlockedByThem || isFriendshipBlockedByThem,
    });
  } catch (error) {
    console.error("Error checking friend status:", error);
    return NextResponse.json(
      { error: "Failed to check friend status" },
      { status: 500 },
    );
  }
}
