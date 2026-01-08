import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import MessagingService from '@/lib/services/messaging/messaging.service';
import { wsNotifier } from '@/lib/services/messaging/websocket-notifier';

/**
 * POST /api/messaging/friends/requests/[requestId]
 * Accept or decline a friend request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "accept" or "decline"' },
        { status: 400 }
      );
    }

    const { request: friendRequest, friendship } = await MessagingService.respondToFriendRequest(
      requestId,
      action,
      session.user.id
    );

    // Notify sender via WebSocket
    wsNotifier.notifyFriendRequest(
      friendRequest.fromUserId,
      action === 'accept' ? 'accepted' : 'declined',
      friendRequest
    );

    return NextResponse.json({
      request: {
        id: friendRequest._id.toString(),
        status: friendRequest.status,
        respondedAt: friendRequest.respondedAt,
      },
      friendship: friendship
        ? {
            id: friendship._id.toString(),
            createdAt: friendship.createdAt,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error responding to friend request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to respond to friend request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messaging/friends/requests/[requestId]
 * Cancel a sent friend request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = await params;

    const cancelledRequest = await MessagingService.cancelFriendRequest(
      requestId,
      session.user.id
    );

    // Notify recipient that request was cancelled
    wsNotifier.notifyFriendRequest(
      cancelledRequest.toUserId,
      'cancelled',
      cancelledRequest
    );

    return NextResponse.json({
      success: true,
      request: {
        id: cancelledRequest._id.toString(),
        status: cancelledRequest.status,
      },
    });
  } catch (error: any) {
    console.error('Error cancelling friend request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel friend request' },
      { status: 500 }
    );
  }
}

