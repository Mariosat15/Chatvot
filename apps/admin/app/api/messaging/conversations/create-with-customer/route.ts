import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * POST /api/messaging/conversations/create-with-customer
 * Create or get existing conversation with a customer (for admin/employee to initiate)
 */
export async function POST(request: NextRequest) {
  try {
    // Reason: Messaging inbox owns customer chat creation; section grant is the auth answer.
    const guard = await guardSection("messaging");
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { customerId, customerName, customerAvatar } = body;

    console.log(
      `💬 [CreateWithCustomer] Employee: ${guard.admin.email} (${guard.admin.id})`,
    );
    console.log(
      `💬 [CreateWithCustomer] Customer: ${customerName || "Unknown"} (${customerId})`,
    );

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
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

    // Get employee details
    const employee = await db.collection("admins").findOne({
      _id: new Types.ObjectId(guard.admin.id),
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Get customer details
    let customer;
    try {
      customer = await db.collection("user").findOne({
        _id: new Types.ObjectId(customerId),
      });
    } catch {
      customer = await db.collection("user").findOne({
        _id: customerId,
      });
    }

    const finalCustomerName =
      customerName ||
      customer?.name ||
      customer?.email?.split("@")[0] ||
      "Customer";
    const finalCustomerAvatar = customerAvatar || customer?.image;

    // Check if conversation already exists
    const existingConversation = await db.collection("conversations").findOne({
      type: "user-to-support",
      status: "active",
      "participants.id": customerId,
      "participants.type": "user",
    });

    if (existingConversation) {
      // Add employee as participant if not already
      const hasEmployee = existingConversation.participants?.some(
        (p: any) => p.id === guard.admin.id && p.type === "employee",
      );

      if (!hasEmployee) {
        await db.collection("conversations").updateOne(
          { _id: existingConversation._id },
          {
            $push: {
              participants: {
                id: guard.admin.id,
                type: "employee",
                name: employee.name || employee.email.split("@")[0],
                avatar: employee.profileImage,
                joinedAt: new Date(),
                isActive: true,
              },
            },
            $set: {
              assignedEmployeeId: guard.admin.id,
              assignedEmployeeName:
                employee.name || employee.email.split("@")[0],
              isAIHandled: false,
            },
          },
        );
      }

      return NextResponse.json({
        conversation: {
          id: existingConversation._id.toString(),
          type: existingConversation.type,
          status: existingConversation.status,
          participants: existingConversation.participants,
          isNew: false,
        },
      });
    }

    // Create new conversation
    const newConversation = {
      type: "user-to-support",
      status: "active",
      participants: [
        {
          id: customerId,
          type: "user",
          name: finalCustomerName,
          avatar: finalCustomerAvatar,
          joinedAt: new Date(),
          isActive: true,
        },
        {
          id: guard.admin.id,
          type: "employee",
          name: employee.name || employee.email.split("@")[0],
          avatar: employee.profileImage,
          joinedAt: new Date(),
          isActive: true,
        },
      ],
      assignedEmployeeId: guard.admin.id,
      assignedEmployeeName: employee.name || employee.email.split("@")[0],
      isAIHandled: false,
      unreadCounts: {},
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    const result = await db
      .collection("conversations")
      .insertOne(newConversation);

    // Send welcome message from employee
    const welcomeMessage = {
      conversationId: result.insertedId,
      senderId: guard.admin.id,
      senderType: "employee",
      senderName: employee.name || employee.email.split("@")[0],
      senderAvatar: employee.profileImage,
      content: `Hello ${finalCustomerName}! I'm reaching out to assist you. How can I help you today?`,
      messageType: "text",
      status: "sent",
      readBy: [{ participantId: guard.admin.id, readAt: new Date() }],
      createdAt: new Date(),
    };

    await db.collection("messages").insertOne(welcomeMessage);

    // Update conversation with last message
    await db.collection("conversations").updateOne(
      { _id: result.insertedId },
      {
        $set: {
          lastMessage: {
            content: welcomeMessage.content,
            senderId: guard.admin.id,
            senderName: welcomeMessage.senderName,
            timestamp: new Date(),
          },
        },
      },
    );

    console.log(
      `📧 [Messaging] Employee ${employee.email} started conversation with customer ${finalCustomerName}`,
    );

    return NextResponse.json({
      conversation: {
        id: result.insertedId.toString(),
        type: "user-to-support",
        status: "active",
        participants: newConversation.participants,
        isNew: true,
      },
    });
  } catch (error) {
    console.error("Error creating conversation with customer:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}
