import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * POST /api/messaging/conversations/[conversationId]/typing
 * Send typing indicator
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
    const body = await request.json();
    const { isTyping } = body;

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

    if (isTyping) {
      await MessagingService.setTyping(session.user.id, conversationId);
    } else {
      await MessagingService.stopTyping(session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating typing status:', error);
    return NextResponse.json(
      { error: 'Failed to update typing status' },
      { status: 500 }
    );
  }
}

