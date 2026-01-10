import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { ObjectId } from 'mongodb';

/**
 * Helper to build query filter for user
 */
function buildUserQuery(userId: string) {
  const queries: any[] = [{ id: userId }];
  
  if (ObjectId.isValid(userId)) {
    queries.push({ _id: new ObjectId(userId) });
  }
  queries.push({ _id: userId });
  
  return { $or: queries };
}

/**
 * GET /api/messaging/friends/status/[userId]
 * Check friendship status with a user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    
    // Can't check status with yourself
    if (userId === session.user.id) {
      return NextResponse.json({ 
        isFriend: false, 
        hasPendingRequest: false,
        disabled: false 
      });
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    
    const { Friendship, FriendRequest } = await import('@/database/models/messaging/friend.model');

    // Check if the target user has disabled friend requests
    const targetUser = await db.collection('user').findOne(buildUserQuery(userId));
    const allowFriendRequests = targetUser?.settings?.privacy?.allowFriendRequests ?? true;

    // Check friendship
    const areFriends = await Friendship.areFriends(session.user.id, userId);
    
    // Check pending requests (either direction)
    const hasPendingRequest = await FriendRequest.hasPendingRequest(session.user.id, userId);

    return NextResponse.json({
      isFriend: areFriends,
      hasPendingRequest,
      disabled: !allowFriendRequests,
    });
  } catch (error) {
    console.error('Error checking friend status:', error);
    return NextResponse.json(
      { error: 'Failed to check friend status' },
      { status: 500 }
    );
  }
}
