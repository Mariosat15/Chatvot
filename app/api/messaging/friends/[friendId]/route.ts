import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { Friendship } from "@/database/models/messaging/friend.model";
import { BlockedUser } from "@/database/models/messaging/blocked-user.model";
import { createUserNotification } from "@/lib/services/notification.service";

/**
 * DELETE /api/messaging/friends/[friendId]
 * Unfriend a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const currentUserName = session.user.name || "Unknown";
    const { friendId } = await params;
    await connectToDatabase();

    // Find the friendship
    const sortedUsers = [currentUserId, friendId].sort() as [string, string];
    const friendship = (await Friendship.findOne({ users: sortedUsers })) as {
      _id: { toString(): string };
      userDetails: Array<{
        userId: string;
        userName: string;
        userAvatar?: string;
      }>;
    } | null;

    if (!friendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 },
      );
    }

    // Get the other user's details for notification
    const otherUser = friendship.userDetails.find((u) => u.userId === friendId);

    // Delete the friendship
    await Friendship.deleteOne({ _id: friendship._id });

    console.log(
      `👋 [Unfriend] ${currentUserName} unfriended ${otherUser?.userName || friendId}`,
    );

    // Send notification to the unfriended user
    try {
      await createUserNotification({
        userId: friendId,
        type: "friend_removed",
        title: "Friendship Ended",
        message: `${currentUserName} has removed you from their friends list.`,
        metadata: {
          removedBy: currentUserId,
          removedByName: currentUserName,
        },
      });
    } catch (notifError) {
      console.error("Failed to send unfriend notification:", notifError);
    }

    return NextResponse.json({
      success: true,
      message: "Unfriended successfully",
    });
  } catch (error) {
    console.error("Error unfriending:", error);
    return NextResponse.json(
      { error: "Failed to unfriend user" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/messaging/friends/[friendId]
 * Block or unblock a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const currentUserName = session.user.name || "Unknown";
    const { friendId } = await params;
    const body = await request.json();
    const { action, reason } = body; // action: 'block' | 'unblock'

    if (!["block", "unblock"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await connectToDatabase();

    // Check if there's a friendship
    const sortedUsers = [currentUserId, friendId].sort() as [string, string];
    const friendship = await Friendship.findOne({ users: sortedUsers });

    if (action === "block") {
      if (friendship) {
        // Block in friendship
        friendship.blockedBy = currentUserId;
        friendship.blockedAt = new Date();
        await friendship.save();
      } else {
        // Block non-friend - get target user name
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        const { ObjectId } = await import("mongodb");
        const targetUser = db
          ? await db.collection("user").findOne({
              $or: [
                { id: friendId },
                ...(ObjectId.isValid(friendId)
                  ? [{ _id: new ObjectId(friendId) }]
                  : []),
              ],
            })
          : null;

        await BlockedUser.create({
          blockerUserId: currentUserId,
          blockerUserName: currentUserName,
          blockedUserId: friendId,
          blockedUserName: targetUser?.name || "Unknown",
          reason,
        });
      }

      console.log("🚫 [Block]", currentUserName, "blocked user", friendId);

      // Send notification to blocked user
      try {
        await createUserNotification({
          userId: friendId,
          type: "blocked",
          title: "You have been blocked",
          message: `${currentUserName} has blocked you. You can no longer send them messages or friend requests.`,
          metadata: {
            blockedBy: currentUserId,
            blockedByName: currentUserName,
          },
        });
      } catch (notifError) {
        console.error("Failed to send block notification:", notifError);
      }

      return NextResponse.json({
        success: true,
        message: "User blocked successfully",
      });
    } else {
      // Unblock
      if (friendship) {
        if (friendship.blockedBy !== currentUserId) {
          return NextResponse.json(
            { error: "You did not block this user" },
            { status: 403 },
          );
        }
        friendship.blockedBy = undefined;
        friendship.blockedAt = undefined;
        await friendship.save();
      } else {
        await BlockedUser.deleteOne({
          blockerUserId: currentUserId,
          blockedUserId: friendId,
        });
      }

      console.log("✅ [Unblock]", currentUserName, "unblocked user", friendId);

      return NextResponse.json({
        success: true,
        message: "User unblocked successfully",
      });
    }
  } catch (error) {
    console.error("Error blocking/unblocking:", error);
    return NextResponse.json(
      { error: "Failed to block/unblock user" },
      { status: 500 },
    );
  }
}
