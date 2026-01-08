import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * GET /api/messaging/support
 * Get or create support conversation for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversation = await MessagingService.getOrCreateSupportConversation(
      session.user.id,
      session.user.name || 'User',
      session.user.image
    );

    // Get recent messages
    const messages = await MessagingService.getMessages(
      conversation._id.toString(),
      { limit: 50 }
    );

    // Mark as read
    await MessagingService.markMessagesAsRead(
      conversation._id.toString(),
      session.user.id,
      session.user.name || 'User'
    );

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        participants: conversation.participants.filter(p => p.isActive),
        lastMessage: conversation.lastMessage,
        unreadCount: 0,
        isAIHandled: conversation.isAIHandled,
        assignedEmployeeName: conversation.assignedEmployeeName,
        createdAt: conversation.createdAt,
        lastActivityAt: conversation.lastActivityAt,
      },
      messages: messages.reverse().map(msg => ({
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
    console.error('Error getting support conversation:', error);
    return NextResponse.json(
      { error: 'Failed to get support conversation' },
      { status: 500 }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, attachments } = body;

    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Message content or attachments required' },
        { status: 400 }
      );
    }

    // Get or create support conversation
    const conversation = await MessagingService.getOrCreateSupportConversation(
      session.user.id,
      session.user.name || 'User',
      session.user.image
    );

    const { message } = await MessagingService.sendMessage({
      conversationId: conversation._id.toString(),
      senderId: session.user.id,
      senderType: 'user',
      senderName: session.user.name || 'User',
      senderAvatar: session.user.image,
      content: content || '',
      messageType: 'text',
      attachments,
    });

    // Broadcast via WebSocket
    const { wsNotifier } = await import('@/lib/services/messaging/websocket-notifier');
    wsNotifier.notifyNewMessage(conversation._id.toString(), message);

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
        createdAt: message.createdAt,
      },
      conversationId: conversation._id.toString(),
    });
  } catch (error: any) {
    console.error('Error sending support message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

