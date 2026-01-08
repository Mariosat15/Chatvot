import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';
import { wsNotifier } from '@/lib/services/messaging/websocket-notifier';

/**
 * GET /api/messaging/friends/requests
 * Get pending friend requests
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { received, sent } = await MessagingService.getPendingFriendRequests(
      session.user.id
    );

    return NextResponse.json({
      received: received.map(r => ({
        id: r._id.toString(),
        fromUserId: r.fromUserId,
        fromUserName: r.fromUserName,
        fromUserAvatar: r.fromUserAvatar,
        message: r.message,
        createdAt: r.createdAt,
      })),
      sent: sent.map(r => ({
        id: r._id.toString(),
        toUserId: r.toUserId,
        toUserName: r.toUserName,
        toUserAvatar: r.toUserAvatar,
        message: r.message,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friend requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messaging/friends/requests
 * Send a friend request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { toUserId, toUserName, toUserAvatar, message } = body;

    if (!toUserId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Cannot send friend request to yourself
    if (toUserId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot send friend request to yourself' },
        { status: 400 }
      );
    }

    const friendRequest = await MessagingService.sendFriendRequest(
      {
        id: session.user.id,
        name: session.user.name || 'User',
        avatar: session.user.image,
      },
      {
        id: toUserId,
        name: toUserName || 'User',
        avatar: toUserAvatar,
      },
      message
    );

    // Notify recipient via WebSocket
    wsNotifier.notifyFriendRequest(toUserId, 'received', friendRequest);

    return NextResponse.json({
      request: {
        id: friendRequest._id.toString(),
        toUserId: friendRequest.toUserId,
        toUserName: friendRequest.toUserName,
        toUserAvatar: friendRequest.toUserAvatar,
        message: friendRequest.message,
        status: friendRequest.status,
        createdAt: friendRequest.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error sending friend request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send friend request' },
      { status: 500 }
    );
  }
}

