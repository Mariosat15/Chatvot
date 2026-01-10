import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * POST /api/messaging/conversations/[conversationId]/clear
 * Clear all messages from a conversation (user-side)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    let convObjectId;
    try {
      convObjectId = new Types.ObjectId(conversationId);
    } catch {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    // Verify user is a participant
    const conversation = await db.collection('conversations').findOne({ 
      _id: convObjectId,
      'participants.id': session.user.id,
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    console.log(`🗑️ [Clear] User ${session.user.email} clearing conversation ${conversationId}`);

    // Mark this user's view of messages as cleared (add to clearedByUsers array)
    // This preserves messages for admin/employee while hiding from the user
    const result = await db.collection('messages').updateMany(
      { conversationId: convObjectId },
      { 
        $addToSet: { 
          clearedByUsers: session.user.id 
        } 
      }
    );

    // Mark conversation as cleared by this user (for tracking)
    await db.collection('conversations').updateOne(
      { _id: convObjectId },
      {
        $addToSet: {
          messagesClearedByUsers: session.user.id,
        },
        $set: {
          [`messagesClearedAt.${session.user.id}`]: new Date(),
        },
      }
    );

    return NextResponse.json({ 
      success: true, 
      messagesCleared: result.modifiedCount,
      message: 'Chat history cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    return NextResponse.json(
      { error: 'Failed to clear conversation' },
      { status: 500 }
    );
  }
}
