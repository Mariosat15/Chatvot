import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { Friendship } from '@/database/models/messaging/friend.model';
import { BlockedUser } from '@/database/models/messaging/blocked-user.model';

/**
 * GET /api/messaging/blocked
 * Get list of users blocked by the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get blocked non-friends
    const blockedUsers = await BlockedUser.getBlockedByUser(session.user.id);

    // Get blocked friends (friendships where blockedBy is current user)
    const blockedFriendships = await Friendship.getBlockedUsers(session.user.id);

    // Combine both lists
    const allBlocked = [
      ...blockedUsers.map(b => ({
        id: b.blockedUserId,
        name: b.blockedUserName,
        blockedAt: b.createdAt,
        type: 'user' as const,
      })),
      ...blockedFriendships.map(f => {
        const otherUser = f.userDetails.find(u => u.userId !== session.user.id);
        return {
          id: otherUser?.userId || '',
          name: otherUser?.userName || 'Unknown',
          avatar: otherUser?.userAvatar,
          blockedAt: f.blockedAt,
          type: 'friend' as const,
        };
      }),
    ];

    // Sort by blocked date
    allBlocked.sort((a, b) => 
      new Date(b.blockedAt || 0).getTime() - new Date(a.blockedAt || 0).getTime()
    );

    return NextResponse.json({
      blockedUsers: allBlocked,
      total: allBlocked.length,
    });
  } catch (error) {
    console.error('Error getting blocked users:', error);
    return NextResponse.json(
      { error: 'Failed to get blocked users' },
      { status: 500 }
    );
  }
}
