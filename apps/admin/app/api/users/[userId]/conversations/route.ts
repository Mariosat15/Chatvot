import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";

/**
 * GET /api/users/[userId]/conversations
 * Get all conversations for a user including transfers, resolutions, etc.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    // Reason: R101b. This was a fifth, hand-rolled auth pattern - a bare `verify()` of the
    // admin_token signature with no employee lookup, so a token belonging to a deactivated
    // employee still passed until it expired, and no section grant was consulted at all.
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;

    const { userId } = await params;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "all"; // all, active, resolved
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 500 },
      );
    }

    // Build query - only show support conversations (not user-to-user direct messages)
    // Admins/employees should NOT see customer-to-customer private conversations
    const query: any = {
      "participants.id": userId,
      "participants.type": "user",
      type: "user-to-support", // Only show support tickets, not DMs between customers
    };

    if (status === "resolved") {
      query.isResolved = true;
    } else if (status === "active") {
      query.isResolved = { $ne: true };
    }

    // Get total count
    const total = await db.collection("conversations").countDocuments(query);

    // Get conversations with pagination
    const conversations = await db
      .collection("conversations")
      .find(query)
      .sort({ lastActivityAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get message counts and last messages for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const messageCount = await db.collection("messages").countDocuments({
          conversationId: conv._id,
          isDeleted: { $ne: true },
        });

        // Get transfer history details
        const transfers = conv.metadata?.transferHistory || [];

        // Get employee names involved
        const employeeParticipants = (conv.participants || [])
          .filter((p: any) => p.type === "employee")
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            joinedAt: p.joinedAt,
            leftAt: p.leftAt,
            isActive: p.isActive,
          }));

        return {
          id: conv._id.toString(),
          type: conv.type,
          status: conv.status,
          isResolved: conv.isResolved || false,
          resolvedAt: conv.resolvedAt,
          resolvedByName: conv.resolvedByName,
          isAIHandled: conv.isAIHandled || false,
          assignedEmployeeId: conv.assignedEmployeeId?.toString(),
          assignedEmployeeName: conv.assignedEmployeeName,
          messageCount,
          transfers: transfers.map((t: any) => ({
            fromEmployeeName: t.fromEmployeeName,
            toEmployeeName: t.toEmployeeName,
            reason: t.reason,
            transferredAt: t.transferredAt,
          })),
          employeeParticipants,
          lastMessage: conv.lastMessage,
          createdAt: conv.createdAt,
          lastActivityAt: conv.lastActivityAt,
        };
      }),
    );

    // Get summary stats - only support conversations
    const stats = {
      total: await db.collection("conversations").countDocuments({
        "participants.id": userId,
        "participants.type": "user",
        type: "user-to-support",
      }),
      resolved: await db.collection("conversations").countDocuments({
        "participants.id": userId,
        "participants.type": "user",
        type: "user-to-support",
        isResolved: true,
      }),
      active: await db.collection("conversations").countDocuments({
        "participants.id": userId,
        "participants.type": "user",
        type: "user-to-support",
        isResolved: { $ne: true },
      }),
      withTransfers: await db.collection("conversations").countDocuments({
        "participants.id": userId,
        "participants.type": "user",
        type: "user-to-support",
        "metadata.transferHistory.0": { $exists: true },
      }),
    };

    return NextResponse.json({
      conversations: conversationsWithDetails,
      total,
      page,
      limit,
      hasMore: page * limit < total,
      stats,
    });
  } catch (error) {
    console.error("Error fetching user conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}
