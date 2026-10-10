import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import MessagingService, {
  unreadFromCounts,
} from "@/lib/services/messaging/messaging.service";
import { getUsersByIds } from "@/lib/utils/user-lookup";

/**
 * GET /api/messaging/conversations/[conversationId]
 * Get conversation details with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");

    const conversation = await MessagingService.getConversationById(
      conversationId,
      session.user.id,
    );

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Reason (7 Oct 2026, owner): never log happy-path polls — this GET is
    // hit about once a minute per open chat and was flooding PM2 with every
    // message body. Keep console.error on the catch path only.
    // Reason (7 Oct 2026): GET is read-only. Marking read is POST /read so
    // polls cannot write the conversation on every tick.
    const messages = await MessagingService.getMessages(conversationId, {
      limit,
      before: before ? new Date(before) : undefined,
      userId: session.user.id, // Filter out messages cleared by this user
    });

    const ticketFields = conversation as unknown as {
      isArchived?: boolean;
      isResolved?: boolean;
      archivedAt?: Date;
      resolvedAt?: Date;
      resolvedByName?: string;
      ticketNumber?: string;
    };

    const unreadCount = unreadFromCounts(
      conversation.unreadCounts as
        | Map<string, number>
        | Record<string, number>
        | undefined,
      session.user.id,
    );

    // Reason: same live-avatar overlay as the conversation list — bubbles fall
    // back to participant.avatar when an old message has no senderAvatar.
    const otherUserIds = conversation.participants
      .filter((p) => p.isActive && p.type === "user" && p.id !== session.user.id)
      .map((p) => p.id);
    const liveUsers = await getUsersByIds(otherUserIds);
    const participants = conversation.participants
      .filter((p) => p.isActive)
      .map((p) => {
        if (p.id === session.user.id || p.type !== "user") return p;
        const liveAvatar = liveUsers.get(p.id)?.profileImage?.trim();
        if (!liveAvatar) return p;
        return { ...p, avatar: liveAvatar };
      });

    // Reason: fill blank message snapshots from the live participant face so a
    // correctly-profiled user is not stuck as a letter inside the thread.
    const avatarBySender = new Map(
      participants
        .filter((p) => p.avatar)
        .map((p) => [p.id, p.avatar as string]),
    );

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        participants,
        lastMessage: conversation.lastMessage,
        unreadCount,
        isAIHandled: conversation.isAIHandled,
        assignedEmployeeName: conversation.assignedEmployeeName,
        // Include archived/resolved fields
        isArchived: ticketFields.isArchived || false,
        isResolved: ticketFields.isResolved || false,
        archivedAt: ticketFields.archivedAt,
        resolvedAt: ticketFields.resolvedAt,
        resolvedByName: ticketFields.resolvedByName,
        ticketNumber: ticketFields.ticketNumber,
        metadata: conversation.metadata,
        createdAt: conversation.createdAt,
        lastActivityAt: conversation.lastActivityAt,
      },
      messages: messages.reverse().map((msg) => ({
        id: msg._id.toString(),
        senderId: msg.senderId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        senderAvatar:
          msg.senderAvatar || avatarBySender.get(msg.senderId) || undefined,
        content: msg.content,
        messageType: msg.messageType,
        attachments: msg.attachments,
        replyTo: msg.replyTo,
        readBy: msg.readBy,
        reactions: msg.reactions,
        isEdited: msg.isEdited,
        createdAt: msg.createdAt,
      })),
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/messaging/conversations/[conversationId]
 * Leave/close a conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    const conversation = await MessagingService.getConversationById(
      conversationId,
      session.user.id,
    );

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // For user-to-user, remove participant
    // For support, archive the conversation
    if (conversation.type === "user-to-user") {
      const participant = conversation.participants.find(
        (p) => p.id === session.user.id,
      );
      if (participant) {
        participant.isActive = false;
        participant.leftAt = new Date();
        await conversation.save();
      }
    } else if (conversation.type === "user-to-support") {
      conversation.status = "archived";
      await conversation.save();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error leaving conversation:", error);
    return NextResponse.json(
      { error: "Failed to leave conversation" },
      { status: 500 },
    );
  }
}
