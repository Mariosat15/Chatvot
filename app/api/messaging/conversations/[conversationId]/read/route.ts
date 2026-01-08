import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';
import { wsNotifier } from '@/lib/services/messaging/websocket-notifier';

/**
 * POST /api/messaging/conversations/[conversationId]/read
 * Mark messages as read
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;

    // Verify user is participant
    const conversation = await MessagingService.getConversationById(
      conversationId,
      session.user.id
    );

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    await MessagingService.markMessagesAsRead(
      conversationId,
      session.user.id,
      session.user.name || 'User'
    );

    // Broadcast read receipt via WebSocket
    wsNotifier.notifyRead(
      conversationId,
      session.user.id,
      session.user.name || 'User'
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    );
  }
}

