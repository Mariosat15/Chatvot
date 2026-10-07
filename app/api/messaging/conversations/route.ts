import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { ObjectId } from "mongodb";
import MessagingService from "@/lib/services/messaging/messaging.service";
import { getUserById, getUsersByIds } from "@/lib/utils/user-lookup";
import { resolvePublicName } from "@/lib/utils/username";

/**
 * Helper to build query filter for user
 */
function buildUserQuery(userId: string) {
  const queries: Record<string, unknown>[] = [{ id: userId }];

  if (ObjectId.isValid(userId)) {
    queries.push({ _id: new ObjectId(userId) });
  }
  queries.push({ _id: userId });

  return { $or: queries };
}

/**
 * GET /api/messaging/conversations
 * Get user's conversations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as
      | "user-to-user"
      | "user-to-support"
      | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const conversations = await MessagingService.getUserConversations(
      session.user.id,
      { type: type || undefined, limit, offset },
    );

    // Reason: participant.avatar is a create-time snapshot. Users who set a
    // profile picture later (or whose face lived only in profileImage) showed a
    // letter in the list while their profile had a real image. Overlay live
    // faces on read; do not write back here — profile-sync owns persistence.
    const allParticipantIds = new Set<string>();
    for (const conv of conversations) {
      for (const p of conv.participants) {
        if (p.id !== session.user.id && p.type === "user") {
          allParticipantIds.add(p.id);
        }
      }
    }
    const liveUsers = await getUsersByIds([...allParticipantIds]);

    return NextResponse.json({
      conversations: conversations.map((conv) => ({
        id: conv._id.toString(),
        type: conv.type,
        status: conv.status,
        participants: conv.participants
          .filter((p) => p.isActive)
          .map((p) => {
            if (p.id === session.user.id || p.type !== "user") return p;
            const live = liveUsers.get(p.id);
            const liveAvatar = live?.profileImage?.trim();
            if (!liveAvatar) return p;
            return { ...p, avatar: liveAvatar };
          }),
        lastMessage: conv.lastMessage,
        unreadCount: typeof conv.unreadCounts?.get === "function"
          ? conv.unreadCounts.get(session.user.id) || 0
          : (conv.unreadCounts as unknown as Record<string, number> | undefined)?.[session.user.id] || 0,
        isAIHandled: conv.isAIHandled,
        assignedEmployeeName: conv.assignedEmployeeName,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastActivityAt: conv.lastActivityAt,
      })),
      total: conversations.length,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/messaging/conversations
 * Create a new conversation (direct message)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const body = await request.json();
    const { participantId } = body;

    if (!participantId) {
      return NextResponse.json(
        { error: "Participant ID is required" },
        { status: 400 },
      );
    }

    // Get messaging settings
    const settings = await MessagingService.getSettings();

    if (!settings.allowUserToUserChat) {
      return NextResponse.json(
        { error: "User-to-user chat is disabled" },
        { status: 403 },
      );
    }

    // Check friendship if required
    if (settings.requireFriendshipForChat) {
      const friendModel =
        await import("@/database/models/messaging/friend.model");
      const Friendship = friendModel.Friendship as unknown as {
        areFriends: (u1: string, u2: string) => Promise<boolean>;
      };
      const areFriends = await Friendship.areFriends(
        currentUserId,
        participantId,
      );

      if (!areFriends) {
        return NextResponse.json(
          {
            error: "You must be friends with this user to start a conversation",
          },
          { status: 403 },
        );
      }
    }

    // Fetch participant's details from database
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    const participantUser = await db
      .collection("user")
      .findOne(buildUserQuery(participantId));
    if (!participantUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Reason: a direct conversation is between two players, so each sees the other's
    // username only.
    const participantName = resolvePublicName({
      username: participantUser.username,
      id: participantId,
    });
    const participantAvatar =
      participantUser.profileImage || participantUser.image;

    // Reason: session.user.image often misses uploads stored as profileImage.
    const me = await getUserById(session.user.id);

    const conversation = await MessagingService.findOrCreateDirectConversation(
      {
        id: session.user.id,
        name: me?.publicName || resolvePublicName({ id: session.user.id }),
        avatar: me?.profileImage || session.user.image || undefined,
      },
      {
        id: participantId,
        name: participantName,
        avatar: participantAvatar,
      },
    );

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        participants: conversation.participants,
        lastMessage: conversation.lastMessage,
        unreadCount: typeof conversation.unreadCounts?.get === "function"
          ? conversation.unreadCounts.get(session.user.id) || 0
          : (conversation.unreadCounts as unknown as Record<string, number> | undefined)?.[session.user.id] || 0,
        createdAt: conversation.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: (error instanceof Error && error.message) || "Failed to create conversation" },
      { status: 500 },
    );
  }
}
