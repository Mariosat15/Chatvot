import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * POST /api/messaging/conversations/[conversationId]/clear
 * Clear all messages from a conversation (soft delete)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    // Reason: Messaging conversation view owns clear; section grant is the auth answer.
    const guard = await guardSection("messaging");
    if (!guard.ok) return guard.response;

    const { conversationId } = await params;

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 500 },
      );
    }

    let convObjectId;
    try {
      convObjectId = new Types.ObjectId(conversationId);
    } catch {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    const conversation = await db
      .collection("conversations")
      .findOne({ _id: convObjectId });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    console.log(
      `🗑️ [Clear] Clearing conversation ${conversationId} by ${guard.admin.email}`,
    );

    // Soft delete all messages in this conversation
    const result = await db.collection("messages").updateMany(
      { conversationId: convObjectId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: guard.admin.id,
        },
      },
    );

    // Add system message about clearing
    const systemMessage = {
      conversationId: convObjectId,
      senderId: "system",
      senderType: "system",
      senderName: "System",
      messageType: "system",
      content: `🗑️ Chat history cleared by ${guard.admin.name || guard.admin.email}`,
      status: "sent",
      readBy: [],
      deliveredTo: [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("messages").insertOne(systemMessage);

    // Update conversation
    await db.collection("conversations").updateOne(
      { _id: convObjectId },
      {
        $set: {
          lastMessage: {
            content: "Chat history cleared",
            senderId: "system",
            senderName: "System",
            senderType: "system",
            timestamp: new Date(),
          },
          lastActivityAt: new Date(),
          // Reset AI counter
          lastResolvedAt: new Date(),
        },
      },
    );

    // Log to customer audit trail if user-to-support conversation
    if (conversation.type === "user-to-support") {
      const userParticipant = conversation.participants?.find(
        (p: any) => p.type === "user",
      );
      if (userParticipant?.id) {
        await db.collection("customer_audit_trails").insertOne({
          customerId: userParticipant.id,
          action: "chat_cleared",
          category: "messaging",
          performedBy: {
            id: guard.admin.id,
            email: guard.admin.email,
            name: guard.admin.name || guard.admin.email,
            type: "employee",
          },
          details: {
            conversationId,
            messagesCleared: result.modifiedCount,
          },
          timestamp: new Date(),
          createdAt: new Date(),
        });
      }
    }

    // Broadcast via WebSocket to ALL servers (local + Redis pub/sub)
    try {
      const { broadcastWsEvent } = await import("@/lib/services/ws-broadcast.service");
      await broadcastWsEvent("/internal/message", {
        conversationId,
        message: {
          id: "clear-" + Date.now(),
          ...systemMessage,
          createdAt: systemMessage.createdAt.toISOString(),
        },
      });
    } catch (wsError) {
      console.warn("WebSocket notification failed:", wsError);
    }

    return NextResponse.json({
      success: true,
      messagesCleared: result.modifiedCount,
      message: "Chat history cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing conversation:", error);
    return NextResponse.json(
      { error: "Failed to clear conversation" },
      { status: 500 },
    );
  }
}
