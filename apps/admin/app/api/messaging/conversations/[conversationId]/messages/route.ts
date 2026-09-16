import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * POST /api/messaging/conversations/[conversationId]/messages
 * Send message as employee
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    // Reason: Messaging conversation view owns send; section grant is the auth answer.
    const guard = await guardSection("messaging");
    if (!guard.ok) return guard.response;

    const { conversationId } = await params;
    const body = await request.json();
    const { content, messageType, attachments, replyTo } = body;

    console.log(
      `📤 [SendMsg] From: ${guard.admin.email} (${guard.admin.id}) to conv: ${conversationId}`,
    );
    console.log(`📤 [SendMsg] Content: "${content?.substring(0, 50)}..."`);

    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: "Message content or attachments required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 500 },
      );
    }

    // Find conversation
    let convObjectId;
    try {
      convObjectId = new Types.ObjectId(conversationId);
    } catch {
      console.log(`❌ [SendMsg] Invalid conversationId: ${conversationId}`);
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    const conversation = await db
      .collection("conversations")
      .findOne({ _id: convObjectId });

    if (!conversation) {
      console.log(`❌ [SendMsg] Conversation not found: ${conversationId}`);
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    console.log(
      `📤 [SendMsg] Conversation type: ${conversation.type}, participants: ${conversation.participants?.length}`,
    );

    // Create message
    const messageDoc = {
      conversationId: convObjectId,
      senderId: guard.admin.id,
      senderType: "employee",
      senderName: guard.admin.name || guard.admin.email,
      messageType: messageType || "text",
      content: content || "",
      attachments: attachments || [],
      replyTo: replyTo
        ? {
            messageId: new Types.ObjectId(replyTo.messageId),
            content: replyTo.content,
            senderName: replyTo.senderName,
          }
        : undefined,
      status: "sent",
      readBy: [],
      deliveredTo: [],
      isDeleted: false, // IMPORTANT: Required for message queries
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const msgResult = await db.collection("messages").insertOne(messageDoc);
    console.log(`📤 [SendMsg] Message created: ${msgResult.insertedId}`);

    // Build unread counts update - use object notation for MongoDB
    const unreadCountsUpdate: Record<string, number> = {};
    for (const participant of conversation.participants || []) {
      if (participant.id !== guard.admin.id && participant.isActive) {
        const currentCount = conversation.unreadCounts?.[participant.id] || 0;
        unreadCountsUpdate[`unreadCounts.${participant.id}`] = currentCount + 1;
        console.log(
          `📤 [SendMsg] Incrementing unread for ${participant.name} (${participant.id}): ${currentCount} -> ${currentCount + 1}`,
        );
      }
    }

    // Update conversation
    const updateDoc: any = {
      $set: {
        lastMessage: {
          messageId: msgResult.insertedId,
          content: content?.substring(0, 100) || "[Attachment]",
          senderId: guard.admin.id,
          senderName: guard.admin.name || guard.admin.email,
          senderType: "employee",
          timestamp: new Date(),
        },
        lastActivityAt: new Date(),
        updatedAt: new Date(),
        ...unreadCountsUpdate,
      },
    };

    // If AI was handling support chat, take over
    if (conversation.isAIHandled && conversation.type === "user-to-support") {
      updateDoc.$set.isAIHandled = false;
      updateDoc.$set.aiHandledUntil = new Date();
      updateDoc.$set.assignedEmployeeId = new Types.ObjectId(guard.admin.id);
      updateDoc.$set.assignedEmployeeName = guard.admin.name || guard.admin.email;

      // Add employee to participants if not present
      const existingParticipant = conversation.participants?.find(
        (p: any) => p.id === guard.admin.id,
      );
      if (!existingParticipant) {
        updateDoc.$push = {
          participants: {
            id: guard.admin.id,
            type: "employee",
            name: guard.admin.name || guard.admin.email,
            joinedAt: new Date(),
            isActive: true,
          },
        };
      }
    }

    await db
      .collection("conversations")
      .updateOne({ _id: convObjectId }, updateDoc);
    console.log(`📤 [SendMsg] Conversation updated successfully`);

    // Build message object for response
    const messageResponse = {
      id: msgResult.insertedId.toString(),
      senderId: guard.admin.id,
      senderType: "employee",
      senderName: guard.admin.name || guard.admin.email,
      content: content || "",
      messageType: messageType || "text",
      attachments: attachments || [],
      replyTo: replyTo,
      status: "sent",
      createdAt: new Date(),
    };

    // Broadcast via WebSocket to ALL servers (local + Redis pub/sub)
    try {
      const { broadcastWsEvent } = await import("@/lib/services/ws-broadcast.service");
      await broadcastWsEvent("/internal/message", {
        conversationId,
        message: messageResponse,
      });
    } catch (wsError) {
      console.warn(`⚠️ [SendMsg] WebSocket notification failed:`, wsError);
    }

    return NextResponse.json({ message: messageResponse });
  } catch (error) {
    console.error("❌ [SendMsg] Error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
