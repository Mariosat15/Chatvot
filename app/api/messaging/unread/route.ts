import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * GET /api/messaging/unread
 * Get unread message count
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const unreadCount = await MessagingService.getUnreadCount(session.user.id);

    return NextResponse.json({
      unreadCount,
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return NextResponse.json(
      { error: 'Failed to get unread count' },
      { status: 500 }
    );
  }
}

