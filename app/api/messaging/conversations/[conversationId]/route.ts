import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * GET /api/messaging/conversations/[conversationId]
 * Get conversation details with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    const conversation = await MessagingService.getConversationById(
      conversationId,
      session.user.id
    );

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    console.log(`📩 [ConvAPI] Fetching messages for conv: ${conversationId}, user: ${session.user.id}`);
    
    const messages = await MessagingService.getMessages(conversationId, {
      limit,
      before: before ? new Date(before) : undefined,
      userId: session.user.id, // Filter out messages cleared by this user
    });

    console.log(`📩 [ConvAPI] Got ${messages.length} messages:`);
    messages.forEach((m: any, i: number) => {
      console.log(`   ${i+1}. ${m.senderType}/${m.senderId}: "${m.content?.slice(0, 30)}..."`);
    });

    // Mark messages as read
    await MessagingService.markMessagesAsRead(
      conversationId,
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
        unreadCount: 0, // We just marked as read
        isAIHandled: conversation.isAIHandled,
        assignedEmployeeName: conversation.assignedEmployeeName,
        // Include archived/resolved fields
        isArchived: (conversation as any).isArchived || false,
        isResolved: (conversation as any).isResolved || false,
        archivedAt: (conversation as any).archivedAt,
        resolvedAt: (conversation as any).resolvedAt,
        resolvedByName: (conversation as any).resolvedByName,
        ticketNumber: (conversation as any).ticketNumber,
        metadata: conversation.metadata,
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
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messaging/conversations/[conversationId]
 * Leave/close a conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;

    const conversation = await MessagingService.getConversationById(
      conversationId,
      session.user.id
    );

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // For user-to-user, remove participant
    // For support, archive the conversation
    if (conversation.type === 'user-to-user') {
      const participant = conversation.participants.find(
        p => p.id === session.user.id
      );
      if (participant) {
        participant.isActive = false;
        participant.leftAt = new Date();
        await conversation.save();
      }
    } else if (conversation.type === 'user-to-support') {
      conversation.status = 'archived';
      await conversation.save();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error leaving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to leave conversation' },
      { status: 500 }
    );
  }
}

