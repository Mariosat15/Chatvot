import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';

/**
 * POST /api/messaging/conversations/[conversationId]/resolve
 * Mark a conversation as resolved - AI will take over for next customer message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as {
      adminId: string;
      email: string;
      name?: string;
    };

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

    const conversation = await db.collection('conversations').findOne({ _id: convObjectId });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Only support conversations can be resolved
    if (conversation.type !== 'user-to-support') {
      return NextResponse.json({ error: 'Only support conversations can be resolved' }, { status: 400 });
    }

    console.log(`✅ [Resolve] Marking conversation ${conversationId} as resolved by ${decoded.email}`);

    // Update conversation to resolved state
    // IMPORTANT: lastResolvedAt is used to reset AI response count - only count AI messages AFTER this time
    await db.collection('conversations').updateOne(
      { _id: convObjectId },
      {
        $set: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: decoded.adminId,
          resolvedByName: decoded.name || decoded.email,
          // When resolved, AI should handle next message
          isAIHandled: true,
          // This timestamp resets the AI response counter - messages before this don't count
          lastResolvedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Add system message about resolution
    const systemMessage = {
      conversationId: convObjectId,
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      messageType: 'system',
      content: `✅ Conversation resolved by ${decoded.name || decoded.email}. If you have a new question, our AI assistant will help you first.`,
      status: 'sent',
      readBy: [],
      deliveredTo: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('messages').insertOne(systemMessage);

    // Update last message
    await db.collection('conversations').updateOne(
      { _id: convObjectId },
      {
        $set: {
          lastMessage: {
            messageId: systemMessage.conversationId,
            content: 'Conversation resolved',
            senderId: 'system',
            senderName: 'System',
            senderType: 'system',
            timestamp: new Date(),
          },
        },
      }
    );

    // Notify via WebSocket (use internal URL for server-to-server)
    try {
      const wsInternalUrl = process.env.WS_INTERNAL_URL || 'http://localhost:3003';
      
      await fetch(`${wsInternalUrl}/internal/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: {
            id: systemMessage.conversationId?.toString(),
            ...systemMessage,
            createdAt: systemMessage.createdAt.toISOString(),
          },
        }),
      });
    } catch (wsError) {
      console.warn('WebSocket notification failed:', wsError);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation marked as resolved. AI will handle next customer message.' 
    });
  } catch (error) {
    console.error('Error resolving conversation:', error);
    return NextResponse.json(
      { error: 'Failed to resolve conversation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messaging/conversations/[conversationId]/resolve
 * Reopen a resolved conversation (employee takes over again)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as {
      adminId: string;
      email: string;
      name?: string;
    };

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

    console.log(`🔄 [Reopen] Reopening conversation ${conversationId} by ${decoded.email}`);

    await db.collection('conversations').updateOne(
      { _id: convObjectId },
      {
        $set: {
          isResolved: false,
          isAIHandled: false,
          assignedEmployeeId: new Types.ObjectId(decoded.adminId),
          assignedEmployeeName: decoded.name || decoded.email,
          updatedAt: new Date(),
        },
        $unset: {
          resolvedAt: 1,
          resolvedBy: 1,
          resolvedByName: 1,
        },
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation reopened. You are now handling this conversation.' 
    });
  } catch (error) {
    console.error('Error reopening conversation:', error);
    return NextResponse.json(
      { error: 'Failed to reopen conversation' },
      { status: 500 }
    );
  }
}

