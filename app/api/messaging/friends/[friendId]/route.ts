import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { Friendship } from '@/database/models/messaging/friend.model';
import { BlockedUser } from '@/database/models/messaging/blocked-user.model';
import { createUserNotification } from '@/lib/services/notification.service';

/**
 * DELETE /api/messaging/friends/[friendId]
 * Unfriend a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { friendId } = await params;
    await connectToDatabase();

    // Find the friendship
    const sortedUsers = [session.user.id, friendId].sort() as [string, string];
    const friendship = await Friendship.findOne({ users: sortedUsers });

    if (!friendship) {
      return NextResponse.json({ error: 'Friendship not found' }, { status: 404 });
    }

    // Get the other user's details for notification
    const otherUser = friendship.userDetails.find(u => u.userId === friendId);

    // Delete the friendship
    await Friendship.deleteOne({ _id: friendship._id });

    console.log(`👋 [Unfriend] ${session.user.name} unfriended ${otherUser?.userName || friendId}`);

    // Send notification to the unfriended user
    try {
      await createUserNotification({
        userId: friendId,
        type: 'friend_removed',
        title: 'Friendship Ended',
        message: `${session.user.name} has removed you from their friends list.`,
        metadata: {
          removedBy: session.user.id,
          removedByName: session.user.name,
        },
      });
    } catch (notifError) {
      console.error('Failed to send unfriend notification:', notifError);
    }

    return NextResponse.json({
      success: true,
      message: 'Unfriended successfully',
    });
  } catch (error) {
    console.error('Error unfriending:', error);
    return NextResponse.json(
      { error: 'Failed to unfriend user' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messaging/friends/[friendId]
 * Block or unblock a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { friendId } = await params;
    const body = await request.json();
    const { action, reason } = body; // action: 'block' | 'unblock'

    if (!['block', 'unblock'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await connectToDatabase();

    // Check if there's a friendship
    const sortedUsers = [session.user.id, friendId].sort() as [string, string];
    const friendship = await Friendship.findOne({ users: sortedUsers });

    if (action === 'block') {
      if (friendship) {
        // Block in friendship
        friendship.blockedBy = session.user.id;
        friendship.blockedAt = new Date();
        await friendship.save();
      } else {
        // Block non-friend - get target user name
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        const targetUser = await db.collection('user').findOne({
          $or: [{ id: friendId }, { _id: friendId }],
        });

        await BlockedUser.create({
          blockerUserId: session.user.id,
          blockerUserName: session.user.name || 'Unknown',
          blockedUserId: friendId,
          blockedUserName: targetUser?.name || 'Unknown',
          reason,
        });
      }

      console.log(`🚫 [Block] ${session.user.name} blocked user ${friendId}`);

      // Send notification to blocked user
      try {
        await createUserNotification({
          userId: friendId,
          type: 'blocked',
          title: 'You have been blocked',
          message: `${session.user.name} has blocked you. You can no longer send them messages or friend requests.`,
          metadata: {
            blockedBy: session.user.id,
            blockedByName: session.user.name,
          },
        });
      } catch (notifError) {
        console.error('Failed to send block notification:', notifError);
      }

      return NextResponse.json({
        success: true,
        message: 'User blocked successfully',
      });
    } else {
      // Unblock
      if (friendship) {
        if (friendship.blockedBy !== session.user.id) {
          return NextResponse.json(
            { error: 'You did not block this user' },
            { status: 403 }
          );
        }
        friendship.blockedBy = undefined;
        friendship.blockedAt = undefined;
        await friendship.save();
      } else {
        await BlockedUser.deleteOne({
          blockerUserId: session.user.id,
          blockedUserId: friendId,
        });
      }

      console.log(`✅ [Unblock] ${session.user.name} unblocked user ${friendId}`);

      return NextResponse.json({
        success: true,
        message: 'User unblocked successfully',
      });
    }
  } catch (error) {
    console.error('Error blocking/unblocking:', error);
    return NextResponse.json(
      { error: 'Failed to block/unblock user' },
      { status: 500 }
    );
  }
}
