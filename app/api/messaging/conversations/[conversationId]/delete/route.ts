import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * DELETE /api/messaging/conversations/[conversationId]/delete
 * Delete a conversation from user's view (soft delete for user)
 * The conversation is hidden from the user but preserved for audit/admin purposes
 */
export async function DELETE(
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

    console.log(`🗑️ [Delete] User ${session.user.email} deleting conversation ${conversationId}`);

    // Add user to deletedBy array (soft delete for this user)
    // This allows us to hide it from the user while preserving it for admin/audit
    const result = await db.collection('conversations').updateOne(
      { _id: convObjectId },
      { 
        $addToSet: { 
          deletedByUsers: session.user.id 
        },
        $set: {
          [`userDeletedAt.${session.user.id}`]: new Date(),
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
