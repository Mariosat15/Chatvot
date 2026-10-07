import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import MessagingService from "@/lib/services/messaging/messaging.service";

/**
 * GET /api/messaging/support
 * Get or create support conversation for user
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Reason (7 Oct 2026, owner): support GET is polled while a chat is open.
    // Happy-path console.log (user id, every message count) flooded PM2 the same
    // way as [ConvAPI]. Keep console.error on the catch path only.

    const conversation = await MessagingService.getOrCreateSupportConversation(
      session.user.id,
      session.user.name || "User",
      session.user.image ?? undefined,
    );

    // Get recent messages
    const messages = await MessagingService.getMessages(
      conversation._id.toString(),
      { limit: 50 },
    );

    // Mark as read
    await MessagingService.markMessagesAsRead(
      conversation._id.toString(),
      session.user.id,
      session.user.name || "User",
    );

    const ticket = conversation as unknown as {
      ticketNumber?: string;
      isArchived?: boolean;
      archivedAt?: Date;
      resolvedByName?: string;
    };

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        // Ticket system fields
        ticketNumber: ticket.ticketNumber || null,
        isArchived: ticket.isArchived || false,
        archivedAt: ticket.archivedAt || null,
        resolvedByName: ticket.resolvedByName || null,
        // Participants
        participants: conversation.participants.filter((p) => p.isActive),
        lastMessage: conversation.lastMessage,
        unreadCount: 0,
        isAIHandled: conversation.isAIHandled,
        assignedEmployeeName: conversation.assignedEmployeeName,
        assignedEmployeeId: conversation.assignedEmployeeId?.toString(),
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
        createdAt: msg.createdAt,
      })),
    });
  } catch (error) {
    console.error("❌ [Support GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to get support conversation" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/messaging/support
 * Send a message to customer support
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content, attachments } = body;

    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: "Message content or attachments required" },
        { status: 400 },
      );
    }

    // Get or create support conversation
    const conversation = await MessagingService.getOrCreateSupportConversation(
      session.user.id,
      session.user.name || "User",
      session.user.image ?? undefined,
    );

    const { message } = await MessagingService.sendMessage({
      conversationId: conversation._id.toString(),
      senderId: session.user.id,
      senderType: "user",
      senderName: session.user.name || "User",
      senderAvatar: session.user.image ?? undefined,
      content: content || "",
      messageType: "text",
      attachments,
    });

    // Broadcast via WebSocket
    const { wsNotifier } =
      await import("@/lib/services/messaging/websocket-notifier");
    wsNotifier.notifyNewMessage(conversation._id.toString(), message);

    // Handle AI response if conversation is AI-handled
    let aiResponse = null;

    if (conversation.isAIHandled) {
      try {
        aiResponse = await handleAIResponse(
          conversation._id.toString(),
          session.user.id,
          session.user.name || "User",
          content,
        );

        if (aiResponse) {
          wsNotifier.notifyNewMessage(conversation._id.toString(), aiResponse);
        }
      } catch (aiError) {
        console.error(
          "🤖 [Support POST] Error generating AI response:",
          aiError,
        );
      }
    }

    return NextResponse.json({
      message: {
        id: message._id.toString(),
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: message.senderName,
        senderAvatar: message.senderAvatar,
        content: message.content,
        messageType: message.messageType,
        attachments: message.attachments,
        status: message.status,
        readBy: [],
        isEdited: false,
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt.toISOString()
            : message.createdAt,
      },
      aiResponse: aiResponse
        ? {
            id: aiResponse._id.toString(),
            senderId: aiResponse.senderId,
            senderType: aiResponse.senderType,
            senderName: aiResponse.senderName,
            content: aiResponse.content,
            messageType: aiResponse.messageType,
            readBy: [],
            isEdited: false,
            createdAt:
              aiResponse.createdAt instanceof Date
                ? aiResponse.createdAt.toISOString()
                : aiResponse.createdAt,
          }
        : null,
      conversationId: conversation._id.toString(),
    });
  } catch (error: unknown) {
    console.error("Error sending support message:", error);
    return NextResponse.json(
      { error: (error instanceof Error && error.message) || "Failed to send message" },
      { status: 500 },
    );
  }
}

/**
 * Handle AI response generation
 */
async function handleAIResponse(
  conversationId: string,
  userId: string,
  userName: string,
  userMessage: string,
) {
  const { connectToDatabase } = await import("@/database/mongoose");
  const mongoose = await import("mongoose");

  await connectToDatabase();

  const db = mongoose.default.connection.db;
  if (!db) {
    console.error("🤖 [AI] Database not connected");
    return null;
  }

  // Get messaging settings
  const settingsDoc = await db.collection("messaging_settings").findOne({});
  const settings = (settingsDoc || {}) as {
    enableAISupport?: boolean;
    maxAIResponsesBeforeEscalation?: number;
  };

  if (!settings.enableAISupport) {
    return null;
  }

  // Get conversation to check AI response count
  const conversation = await db.collection("conversations").findOne({
    _id: new mongoose.default.Types.ObjectId(conversationId),
  });

  if (!conversation) return null;

  // Count AI messages in this conversation
  // IMPORTANT: Only count messages AFTER lastResolvedAt to reset counter on resolve
  const aiMessageQuery: Record<string, unknown> = {
    conversationId: new mongoose.default.Types.ObjectId(conversationId),
    senderType: "ai",
  };

  // If conversation was previously resolved, only count AI messages after that time
  if (conversation.lastResolvedAt) {
    aiMessageQuery.createdAt = { $gt: conversation.lastResolvedAt };
  }

  const aiMessageCount = await db
    .collection("messages")
    .countDocuments(aiMessageQuery);

  // Check for escalation keywords
  const escalationKeywords = (settings as { aiEscalationKeywords?: string[] })
    .aiEscalationKeywords || [
    "human",
    "agent",
    "person",
    "real person",
    "talk to someone",
    "representative",
  ];
  const lowerMessage = userMessage.toLowerCase();
  const shouldEscalate = escalationKeywords.some((kw: string) =>
    lowerMessage.includes(kw.toLowerCase()),
  );

  // Check max responses before escalation
  const maxResponses =
    (settings as { aiMaxResponsesBeforeEscalation?: number })
      .aiMaxResponsesBeforeEscalation || 10;
  const shouldAutoEscalate = aiMessageCount >= maxResponses;

  // Reason: a "Contact us" Game Master package can only be enabled by an employee, so the
  // AI must hand the chat over rather than answer - to the assigned employee, else anyone.
  const { detectContactUsPackageRequest, GM_CONTACT_US_ESCALATION_REASON, contactUsTransferMessage } =
    await import("@/lib/services/gamemaster/contact-us-support");
  const contactUsRequest = await detectContactUsPackageRequest(userMessage, userId);
  if (contactUsRequest) {
    return await escalateToHuman(
      conversationId,
      userId,
      userName,
      GM_CONTACT_US_ESCALATION_REASON,
      (employeeName) => contactUsTransferMessage(contactUsRequest.packageName, employeeName),
    );
  }

  if (shouldEscalate || shouldAutoEscalate) {
    // Escalate to human - find assigned employee or any available
    return await escalateToHuman(
      conversationId,
      userId,
      userName,
      shouldEscalate
        ? "User requested human assistance"
        : "Maximum AI responses reached",
    );
  }

  // Generate AI response using RAG-only service (NO company data access)
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.error("🤖 [AI] OpenAI API key not configured");
      return null;
    }

    // Get conversation history for context
    const recentMessages = await db
      .collection("messages")
      .find({
        conversationId: new mongoose.default.Types.ObjectId(conversationId),
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    const conversationHistory = recentMessages.reverse().map((m) => ({
      role: m.senderType === "user" ? "user" : "assistant",
      content: m.content,
    }));

    // Use RAG-only service - NO company data access
    const { generateCustomerSupportResponse } =
      await import("@/lib/services/customer-ai.service");

    const platformName =
      (settings as unknown as { platformName?: string }).platformName ||
      "ChartVolt";

    const aiResult = await generateCustomerSupportResponse(
      userMessage,
      conversationHistory,
      platformName,
    );

    const aiContent = aiResult.content;

    if (aiResult.noKnowledge) {
      console.warn(
        "⚠️ [AI] No knowledge-base content — customer received the fallback reply",
      );
    }

    if (!aiContent) {
      console.error("🤖 [AI] No content in AI response");
      return null;
    }

    // Save AI message
    const aiMessage = {
      conversationId: new mongoose.default.Types.ObjectId(conversationId),
      senderId: "ai-assistant",
      senderType: "ai",
      senderName: "AI Assistant",
      content: aiContent,
      messageType: "ai-response",
      status: "sent",
      readBy: [],
      isDeleted: false, // Required for message queries
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("messages").insertOne(aiMessage);

    // Update conversation lastMessage
    await db.collection("conversations").updateOne(
      { _id: new mongoose.default.Types.ObjectId(conversationId) },
      {
        $set: {
          lastMessage: {
            content: aiContent.substring(0, 100),
            senderId: "ai-assistant",
            senderName: "AI Assistant",
            senderType: "ai",
            timestamp: new Date(),
          },
          lastActivityAt: new Date(),
        },
      },
    );

    return { ...aiMessage, _id: result.insertedId };
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return null;
  }
}

/**
 * Escalate conversation from AI to human.
 * Reason: one path only — MessagingService.escalateFromAI owns the assignment
 * rules (customer_assignments first). A second copy here used to prefer a stale
 * ticket stamp and fall back to the first Full Admin in the collection.
 */
async function escalateToHuman(
  conversationId: string,
  _userId: string,
  _userName: string,
  reason: string,
  transferContent?: (employeeName: string) => string,
) {
  await MessagingService.escalateFromAI(
    conversationId,
    reason,
    transferContent,
  );

  // Return the farewell message so Support POST can broadcast it as aiResponse.
  const messages = await MessagingService.getMessages(conversationId, {
    limit: 1,
  });
  return messages[0] ?? null;
}
