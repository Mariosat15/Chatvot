import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { ObjectId } from 'mongodb';
import MessagingService from '@/lib/services/messaging/messaging.service';
import { wsNotifier } from '@/lib/services/messaging/websocket-notifier';
import { BlockedUser } from '@/database/models/messaging/blocked-user.model';
import { Friendship } from '@/database/models/messaging/friend.model';
import { sendFriendRequestNotification } from '@/lib/services/notification.service';

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
    const { toUserId, message } = body;

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

    // Fetch target user's details from database
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Check if blocked by either party
    const isBlockedByMe = await BlockedUser.isBlocked(session.user.id, toUserId);
    const isBlockedByThem = await BlockedUser.isBlocked(toUserId, session.user.id);
    
    // Also check friendship block
    const friendship = await Friendship.getFriendship(session.user.id, toUserId);
    const isFriendshipBlocked = friendship?.blockedBy != null;

    if (isBlockedByMe || isBlockedByThem || isFriendshipBlocked) {
      return NextResponse.json(
        { error: 'Cannot send friend request to this user' },
        { status: 400 }
      );
    }

    const targetUser = await db.collection('user').findOne(buildUserQuery(toUserId));
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if target user has disabled friend requests (check both paths)
    const allowsFriendRequests = 
      targetUser.privacySettings?.allowFriendRequests !== false && 
      targetUser.settings?.privacy?.allowFriendRequests !== false;

    if (!allowsFriendRequests) {
      return NextResponse.json(
        { error: 'This user has disabled friend requests' },
        { status: 400 }
      );
    }

    const targetUserName = targetUser.name || targetUser.email?.split('@')[0] || 'User';
    const targetUserAvatar = targetUser.profileImage || targetUser.image;

    const friendRequest = await MessagingService.sendFriendRequest(
      {
        id: session.user.id,
        name: session.user.name || session.user.email?.split('@')[0] || 'User',
        avatar: session.user.image,
      },
      {
        id: toUserId,
        name: targetUserName,
        avatar: targetUserAvatar,
      },
      message
    );

    // Notify recipient via WebSocket
    wsNotifier.notifyFriendRequest(toUserId, 'received', friendRequest);

    // Send in-app notification
    try {
      await sendFriendRequestNotification(
        toUserId,
        session.user.name || 'Someone',
        session.user.id
      );
    } catch (notifError) {
      console.error('Failed to send friend request notification:', notifError);
    }

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

