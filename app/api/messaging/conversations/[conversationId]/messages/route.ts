import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import MessagingService from "@/lib/services/messaging/messaging.service";
import { wsNotifier } from "@/lib/services/messaging/websocket-notifier";
import { getUserById } from "@/lib/utils/user-lookup";
import { resolvePublicName } from "@/lib/utils/username";

/**
 * POST /api/messaging/conversations/[conversationId]/messages
 * Send a message to a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const { conversationId } = await params;
    const body = await request.json();
    const { content, messageType, attachments, replyTo } = body;

    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: "Message content or attachments required" },
        { status: 400 },
      );
    }

    // Verify user is participant
    const conversation = await MessagingService.getConversationById(
      conversationId,
      currentUserId,
    );

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 },
      );
    }

    // Reason: in a chat with another player the sender is shown by username only; a
    // support ticket is read by staff, who are entitled to the real name.
    // Reason: Better Auth session.image is often empty while the upload lives in
    // profileImage — using session alone stored blank senderAvatar forever.
    const sender = await getUserById(currentUserId);
    const currentUserName =
      conversation.type === "user-to-support"
        ? session.user.name || "User"
        : resolvePublicName({
            username: sender?.username,
            id: currentUserId,
          });
    const senderAvatar =
      sender?.profileImage || session.user.image || undefined;

    const { message, conversation: updatedConversation } =
      await MessagingService.sendMessage({
        conversationId,
        senderId: currentUserId,
        senderType: "user",
        senderName: currentUserName,
        senderAvatar,
        content: content || "",
        messageType: messageType || "text",
        attachments,
        replyTo,
      });

    // Broadcast via WebSocket (production: sends to chartvolt-websocket server)
    wsNotifier.notifyNewMessage(conversationId, message);

    // If this is a support chat and AI is handling, process with AI
    if (
      updatedConversation.type === "user-to-support" &&
      updatedConversation.isAIHandled
    ) {
      // Process AI response asynchronously
      processAIResponse(
        conversationId,
        content,
        currentUserId,
        currentUserName,
      ).catch((err) => {
        console.error("AI response error:", err);
      });
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
        replyTo: message.replyTo,
        status: message.status,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: (error instanceof Error && error.message) || "Failed to send message" },
      { status: 500 },
    );
  }
}

/**
 * Process AI response for support chat
 */
async function processAIResponse(
  conversationId: string,
  userMessage: string,
  userId: string,
  _userName: string,
) {
  try {
    const settings = await MessagingService.getSettings();

    // Reason: a "Contact us" Game Master package can only be enabled by an employee, so
    // the AI hands the chat over - to the assigned employee, else anyone available.
    const { detectContactUsPackageRequest, GM_CONTACT_US_ESCALATION_REASON, contactUsTransferMessage } =
      await import("@/lib/services/gamemaster/contact-us-support");
    const contactUsRequest = await detectContactUsPackageRequest(userMessage, userId);
    if (contactUsRequest) {
      await MessagingService.escalateFromAI(
        conversationId,
        GM_CONTACT_US_ESCALATION_REASON,
        (employeeName) => contactUsTransferMessage(contactUsRequest.packageName, employeeName),
      );
      return;
    }

    // Check for escalation keywords
    const escalation = (
      settings as unknown as {
        shouldEscalateAI: (
          msg: string,
          count: number,
        ) => { shouldEscalate: boolean; reason?: string };
      }
    ).shouldEscalateAI(userMessage, 0);

    if (escalation.shouldEscalate) {
      // Escalate to human
      await MessagingService.escalateFromAI(
        conversationId,
        escalation.reason || "User requested",
      );
      return;
    }

    // Get OpenAI client
    const OpenAI = (await import("openai")).default;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.error("OpenAI API key not configured for AI support");
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Get conversation history for context
    const messages = await MessagingService.getMessages(conversationId, {
      limit: 10,
    });

    const conversationHistory = messages.reverse().map((msg) => ({
      role:
        msg.senderType === "user" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    // Build system prompt
    const systemPrompt =
      settings.aiSystemPrompt ||
      `You are a helpful customer support assistant for a trading platform. 
Be friendly, professional, and helpful. If you cannot help with something or the user asks to speak with a human, 
acknowledge their request and let them know you'll transfer them to a human agent.

Key information:
- This is a trading competition platform
- Users can trade, join competitions, deposit/withdraw funds
- For account-specific issues, recommend speaking with a human agent
- Do not make up information - if unsure, offer to connect with a human`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (aiResponse) {
      // Check if AI response suggests escalation
      const responseEscalation = (
        settings as unknown as {
          shouldEscalateAI: (
            msg: string,
            count: number,
          ) => { shouldEscalate: boolean; reason?: string };
        }
      ).shouldEscalateAI(aiResponse, conversationHistory.length);

      // Send AI response
      const { message } = await MessagingService.sendMessage({
        conversationId,
        senderId: "ai-assistant",
        senderType: "ai",
        senderName: "AI Assistant",
        content: aiResponse,
        messageType: "ai-response",
      });

      // Broadcast AI response
      wsNotifier.notifyNewMessage(conversationId, message);

      // Escalate if needed
      if (responseEscalation.shouldEscalate) {
        await MessagingService.escalateFromAI(
          conversationId,
          responseEscalation.reason || "AI detected need for human",
        );
      }
    }
  } catch (error) {
    console.error("Error processing AI response:", error);

    // Send error message
    const { message } = await MessagingService.sendMessage({
      conversationId,
      senderId: "ai-assistant",
      senderType: "ai",
      senderName: "AI Assistant",
      content:
        "I'm having trouble processing your request. Let me connect you with a human agent who can help.",
      messageType: "ai-response",
    });

    wsNotifier.notifyNewMessage(conversationId, message);

    // Escalate on error
    await MessagingService.escalateFromAI(
      conversationId,
      "AI processing error",
    );
  }
}
