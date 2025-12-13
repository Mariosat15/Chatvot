import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { notificationService } from '@/lib/services/notification.service';
import { checkAndSeedTemplates } from '@/lib/services/notification-seed.service';

// GET - Get user's notifications
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Auto-seed templates if none exist
    await checkAndSeedTemplates();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const category = searchParams.get('category');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (action === 'count') {
      // Get unread count only
      const count = await notificationService.getUnreadCount(session.user.id);
      return NextResponse.json({ count });
    }

    // Get notifications
    const notifications = await notificationService.getUserNotifications(
      session.user.id,
      {
        limit,
        offset,
        category: category as any || undefined,
        unreadOnly,
      }
    );

    const unreadCount = await notificationService.getUnreadCount(session.user.id);

    return NextResponse.json({
      notifications,
      unreadCount,
      hasMore: notifications.length === limit,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST - Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notificationId } = body;

    if (action === 'mark_read') {
      if (notificationId) {
        // Mark single notification as read
        const success = await notificationService.markAsRead(notificationId, session.user.id);
        return NextResponse.json({ success });
      } else {
        // Mark all as read
        const count = await notificationService.markAllAsRead(session.user.id);
        return NextResponse.json({ success: true, count });
      }
    }

    if (action === 'clear_all') {
      const count = await notificationService.clearAllNotifications(session.user.id);
      return NextResponse.json({ success: true, count });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    const success = await notificationService.deleteNotification(notificationId, session.user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}

