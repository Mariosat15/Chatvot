import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * GET /api/messaging/friends
 * Get user's friends list
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const friendships = await MessagingService.getFriends(session.user.id);

    const friends = friendships.map(f => {
      const friend = f.userDetails.find(u => u.userId !== session.user.id);
      return {
        id: f._id.toString(),
        friendId: friend?.userId,
        friendName: friend?.userName,
        friendAvatar: friend?.userAvatar,
        isMuted: f.mutedBy.includes(session.user.id),
        createdAt: f.createdAt,
      };
    });

    return NextResponse.json({
      friends,
      total: friends.length,
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messaging/friends
 * Remove a friend
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { friendId } = body;

    if (!friendId) {
      return NextResponse.json(
        { error: 'Friend ID is required' },
        { status: 400 }
      );
    }

    await MessagingService.removeFriend(session.user.id, friendId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing friend:', error);
    return NextResponse.json(
      { error: 'Failed to remove friend' },
      { status: 500 }
    );
  }
}

