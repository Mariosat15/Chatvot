import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * GET /api/messaging/conversations/[conversationId]
 * Get conversation details with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    // Reason: Messaging conversation view owns this route; section grant is the auth answer.
    const guard = await guardSection("messaging");
    if (!guard.ok) return guard.response;

    const { conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const before = searchParams.get("before");

    await connectToDatabase();

    const Conversation =
      mongoose.models.Conversation ||
      mongoose.model(
        "Conversation",
        new mongoose.Schema({}, { strict: false, collection: "conversations" }),
      );
    const Message =
      mongoose.models.Message ||
      mongoose.model(
        "Message",
        new mongoose.Schema({}, { strict: false, collection: "messages" }),
      );

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Get messages
    const messageQuery: Record<string, unknown> = {
      conversationId: new Types.ObjectId(conversationId),
      isDeleted: { $ne: true },
    };

    if (before) {
      messageQuery.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(messageQuery)
      .sort({ createdAt: -1 })
      .limit(limit);

    // Reason: only write when this employee still has unread — poll fallback
    // must not updateMany + $set on every tick when the badge is already 0.
    const counts = conversation.unreadCounts as
      | Map<string, number>
      | Record<string, number>
      | undefined;
    let priorUnread = 0;
    if (counts) {
      if (typeof (counts as Map<string, number>).get === "function") {
        priorUnread = (counts as Map<string, number>).get(guard.admin.id) || 0;
      } else {
        priorUnread =
          new Map(Object.entries(counts as Record<string, number>)).get(
            guard.admin.id,
          ) || 0;
      }
    }

    if (priorUnread > 0) {
      await Message.updateMany(
        {
          conversationId: new Types.ObjectId(conversationId),
          senderId: { $ne: guard.admin.id },
          "readBy.participantId": { $ne: guard.admin.id },
        },
        {
          $push: {
            readBy: {
              participantId: guard.admin.id,
              participantName: guard.admin.name || guard.admin.email,
              readAt: new Date(),
            },
          },
          $set: { status: "read" },
        },
      );

      const db = mongoose.connection.db;
      if (db) {
        await db.collection("conversations").updateOne(
          { _id: new Types.ObjectId(conversationId) },
          { $set: { [`unreadCounts.${guard.admin.id}`]: 0 } },
        );
      }
    }

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        participants:
          (
            conversation.participants as
              | Array<{ isActive?: boolean }>
              | undefined
          )?.filter((p) => p.isActive) || [],
        lastMessage: conversation.lastMessage,
        unreadCount: 0,
        isAIHandled: conversation.isAIHandled,
        isResolved: conversation.isResolved || false,
        assignedEmployeeId: conversation.assignedEmployeeId?.toString(),
        assignedEmployeeName: conversation.assignedEmployeeName,
        originalEmployeeId: conversation.originalEmployeeId?.toString(),
        originalEmployeeName: conversation.originalEmployeeName,
        // Chat transfer fields
        isChatTransferred: conversation.isChatTransferred || false,
        chatTransferredTo: conversation.chatTransferredTo?.toString(),
        chatTransferredToName: conversation.chatTransferredToName,
        chatTransferredFrom: conversation.chatTransferredFrom?.toString(),
        chatTransferredFromName: conversation.chatTransferredFromName,
        temporarilyRedirected: conversation.temporarilyRedirected || false,
        redirectedAt: conversation.redirectedAt,
        metadata: conversation.metadata,
        createdAt: conversation.createdAt,
        lastActivityAt: conversation.lastActivityAt,
      },
      messages: messages.reverse().map((msg) => ({
        id: msg._id.toString(),
        senderId: msg.senderId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        senderAvatar: msg.senderAvatar,
        content: msg.content,
        messageType: msg.messageType,
        attachments: msg.attachments,
        replyTo: msg.replyTo,
        readBy: msg.readBy,
        reactions: msg.reactions,
        isEdited: msg.isEdited,
        isModerated: msg.isModerated,
        moderationReason: msg.moderationReason,
        aiMetadata: msg.aiMetadata,
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
