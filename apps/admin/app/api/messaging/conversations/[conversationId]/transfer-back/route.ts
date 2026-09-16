import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types, ClientSession } from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * POST /api/messaging/conversations/[conversationId]/transfer-back
 * Transfer a chat back to the original employee
 *
 * This returns the chat to whoever had it before the transfer.
 * Used after the receiving employee has handled the issue.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  let session: ClientSession | null = null;

  try {
    // Reason: Messaging conversation view owns transfer-back; section grant is the auth answer.
    const guard = await guardSection("messaging");
    if (!guard.ok) return guard.response;

    const { conversationId } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body; // Optional notes about resolution

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

    // Check if chat is actually transferred
    if (!conversation.isChatTransferred) {
      return NextResponse.json(
        { error: "This chat is not transferred. No transfer-back needed." },
        { status: 400 },
      );
    }

    // Verify current user is the one who received the transfer (or super admin)
    if (
      guard.admin.role !== "super_admin" &&
      conversation.chatTransferredTo !== guard.admin.id
    ) {
      return NextResponse.json(
        {
          error:
            "Only the employee who received the transfer can transfer back",
        },
        { status: 403 },
      );
    }

    const originalEmployeeId = conversation.chatTransferredFrom;
    const originalEmployeeName = conversation.chatTransferredFromName;

    if (!originalEmployeeId) {
      return NextResponse.json(
        { error: "Original employee information not found" },
        { status: 400 },
      );
    }

    console.log(`🔙 [TransferBack] Starting transfer back: ${conversationId}`);
    console.log(`   From: ${guard.admin.email} (${guard.admin.id})`);
    console.log(`   Back to: ${originalEmployeeName} (${originalEmployeeId})`);

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update conversation - remove transfer state, restore original
      const updateResult = await db.collection("conversations").updateOne(
        { _id: convObjectId },
        {
          $set: {
            isChatTransferred: false,
            assignedEmployeeId: new Types.ObjectId(originalEmployeeId),
            assignedEmployeeName: originalEmployeeName,
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: {
            chatTransferredTo: "",
            chatTransferredToName: "",
            chatTransferredFrom: "",
            chatTransferredFromName: "",
          },
          $push: {
            "metadata.transferHistory": {
              type: "transfer_back",
              fromEmployeeId: guard.admin.id,
              fromEmployeeName: guard.admin.name || guard.admin.email,
              toEmployeeId: originalEmployeeId,
              toEmployeeName: originalEmployeeName,
              notes,
              transferredAt: new Date(),
            },
          },
        },
        { session },
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error("Failed to update conversation");
      }

      // Update participants
      await db.collection("conversations").updateOne(
        {
          _id: convObjectId,
          "participants.id": guard.admin.id,
        },
        {
          $set: {
            "participants.$.isActive": false,
            "participants.$.leftAt": new Date(),
          },
        },
        { session },
      );

      await db.collection("conversations").updateOne(
        {
          _id: convObjectId,
          "participants.id": originalEmployeeId,
        },
        {
          $set: {
            "participants.$.isActive": true,
            "participants.$.leftAt": null,
          },
        },
        { session },
      );

      // Create system message
      const systemMessage = {
        conversationId: convObjectId,
        senderId: "system",
        senderType: "system",
        senderName: "System",
        content: `🔙 Chat transferred back to ${originalEmployeeName}${notes ? ` - Notes: ${notes}` : ""}`,
        messageType: "system",
        status: "sent",
        readBy: [],
        deliveredTo: [],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection("messages").insertOne(systemMessage, { session });

      // Log to audit trail
      const userParticipant = conversation.participants?.find(
        (p: any) => p.type === "user",
      );
      if (userParticipant?.id) {
        await db.collection("customer_audit_trails").insertOne(
          {
            customerId: userParticipant.id,
            action: "chat_transferred_back",
            category: "messaging",
            performedBy: {
              id: guard.admin.id,
              email: guard.admin.email,
              name: guard.admin.name || guard.admin.email,
              type: "employee",
            },
            details: {
              conversationId,
              fromEmployeeId: guard.admin.id,
              fromEmployeeName: guard.admin.name || guard.admin.email,
              toEmployeeId: originalEmployeeId,
              toEmployeeName: originalEmployeeName,
              notes,
            },
            timestamp: new Date(),
            createdAt: new Date(),
          },
          { session },
        );
      }

      // Create notification for original employee
      await db.collection("employee_notifications").insertOne(
        {
          employeeId: originalEmployeeId,
          type: "chat_transfer_returned",
          title: "Chat Returned",
          message: `${guard.admin.name || guard.admin.email} returned a chat to you${notes ? `: ${notes}` : ""}`,
          data: {
            conversationId,
            fromEmployeeId: guard.admin.id,
            fromEmployeeName: guard.admin.name || guard.admin.email,
            customerName: userParticipant?.name || "Customer",
          },
          isRead: false,
          createdAt: new Date(),
        },
        { session },
      );

      // Commit transaction
      await session.commitTransaction();
      console.log(
        `✅ [TransferBack] Transfer back successful: ${conversationId}`,
      );

      // Broadcast via WebSocket to ALL servers (local + Redis pub/sub)
      try {
        const { broadcastWsEvent } = await import("@/lib/services/ws-broadcast.service");
        await broadcastWsEvent("/internal/chat-transferred", {
          conversationId,
          isChatTransferred: false,
          assignedEmployeeId: originalEmployeeId,
          assignedEmployeeName: originalEmployeeName,
          chatTransferredTo: null,
          chatTransferredToName: null,
          chatTransferredFrom: null,
          chatTransferredFromName: null,
        });
        await broadcastWsEvent("/internal/message", {
          conversationId,
          message: {
            id: "transfer-back-" + Date.now(),
            ...systemMessage,
            createdAt: systemMessage.createdAt.toISOString(),
          },
        });
      } catch (wsError) {
        console.warn(
          "⚠️ [TransferBack] WebSocket notification failed:",
          wsError,
        );
      }

      return NextResponse.json({
        success: true,
        message: `Chat transferred back to ${originalEmployeeName}`,
        conversation: {
          id: conversationId,
          isChatTransferred: false,
          assignedEmployeeId: originalEmployeeId,
          assignedEmployeeName: originalEmployeeName,
        },
      });
    } catch (transactionError) {
      console.error("❌ [TransferBack] Transaction error:", transactionError);
      await session.abortTransaction();
      throw transactionError;
    }
  } catch (error) {
    console.error("❌ [TransferBack] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to transfer back conversation",
      },
      { status: 500 },
    );
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
