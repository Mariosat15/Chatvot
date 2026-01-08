import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * GET /api/messaging/search/users
 * Search for users to add as friends
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const users = await MessagingService.searchUsers(query, session.user.id, limit);

    // Get friendship status for each user
    const { Friendship, FriendRequest } = await import('@/database/models/messaging/friend.model');
    
    const usersWithStatus = await Promise.all(
      users.map(async user => {
        const areFriends = await Friendship.areFriends(session.user.id, user.id);
        const hasPendingRequest = await FriendRequest.hasPendingRequest(
          session.user.id,
          user.id
        );
        
        return {
          ...user,
          isFriend: areFriends,
          hasPendingRequest,
        };
      })
    );

    return NextResponse.json({
      users: usersWithStatus,
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}

