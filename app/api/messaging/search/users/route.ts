import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';
import { connectToDatabase } from '@/database/mongoose';

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

    // Get friendship/block status for each user
    const { Friendship, FriendRequest } = await import('@/database/models/messaging/friend.model');
    const { BlockedUser } = await import('@/database/models/messaging/blocked-user.model');
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    const usersWithStatus = await Promise.all(
      users.map(async user => {
        // Check if blocked (by either party)
        const isBlockedByMe = await BlockedUser.isBlocked(session.user.id, user.id);
        const isBlockedByThem = await BlockedUser.isBlocked(user.id, session.user.id);
        
        // Also check friendship block status
        const friendship = await Friendship.getFriendship(session.user.id, user.id);
        const isFriendshipBlocked = friendship?.blockedBy != null;
        
        if (isBlockedByMe || isBlockedByThem || isFriendshipBlocked) {
          // Don't show blocked users in search results
          return null;
        }
        
        // Check if user allows friend requests
        const userDoc = await db.collection('user').findOne(
          { $or: [{ id: user.id }, { _id: user.id }] },
          { projection: { 'privacySettings.allowFriendRequests': 1 } }
        );
        const allowsFriendRequests = userDoc?.privacySettings?.allowFriendRequests !== false;
        
        const areFriends = friendship && !friendship.blockedBy;
        const hasPendingRequest = await FriendRequest.hasPendingRequest(
          session.user.id,
          user.id
        );
        
        return {
          ...user,
          isFriend: !!areFriends,
          hasPendingRequest,
          allowsFriendRequests,
        };
      })
    );

    // Filter out null (blocked) users
    const filteredUsers = usersWithStatus.filter(u => u !== null);

    return NextResponse.json({
      users: filteredUsers,
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}

