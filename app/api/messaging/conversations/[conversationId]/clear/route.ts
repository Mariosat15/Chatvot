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

    // Soft delete all messages in this conversation
    const result = await db.collection('messages').updateMany(
      { conversationId: convObjectId },
      { 
        $set: { 
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: session.user.id,
        } 
      }
    );

    // Add system message about clearing
    const systemMessage = {
      conversationId: convObjectId,
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      messageType: 'system',
      content: `🗑️ Chat history cleared`,
      status: 'sent',
      readBy: [],
      deliveredTo: [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('messages').insertOne(systemMessage);

    // Update conversation
    await db.collection('conversations').updateOne(
      { _id: convObjectId },
      {
        $set: {
          lastMessage: {
            content: 'Chat history cleared',
            senderId: 'system',
            senderName: 'System',
            senderType: 'system',
            timestamp: new Date(),
          },
          lastActivityAt: new Date(),
          lastResolvedAt: new Date(), // Reset AI counter
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
