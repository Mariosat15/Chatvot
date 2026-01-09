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

    console.log(`✅ [Resolve] Archiving conversation/ticket ${conversationId} by ${decoded.email}`);

    // Update conversation to ARCHIVED state - this conversation is now closed
    // Customer will get a NEW ticket when they send a new message
    const ticketNumber = conversation.ticketNumber || 1;
    
    await db.collection('conversations').updateOne(
      { _id: convObjectId },
      {
        $set: {
          // Mark as resolved AND archived
          isResolved: true,
          isArchived: true,
          status: 'archived', // Change status from 'active' to 'archived'
          resolvedAt: new Date(),
          archivedAt: new Date(),
          resolvedBy: decoded.adminId,
          resolvedByName: decoded.name || decoded.email,
          // This conversation is done - new messages will create a new ticket
          isAIHandled: false,
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
      content: `✅ Ticket #${ticketNumber} resolved and archived by ${decoded.name || decoded.email}. For new inquiries, please start a new conversation.`,
      status: 'sent',
      readBy: [],
      deliveredTo: [],
      isDeleted: false,
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

    // Log to customer audit trail
    const userParticipant = conversation.participants?.find((p: any) => p.type === 'user');
    if (userParticipant?.id) {
      await db.collection('customer_audit_trails').insertOne({
        customerId: userParticipant.id,
        action: 'ticket_resolved',
        category: 'messaging',
        performedBy: {
          id: decoded.adminId,
          email: decoded.email,
          name: decoded.name || decoded.email,
          type: 'employee',
        },
        details: {
          conversationId,
          ticketNumber,
          action: 'archived',
        },
        timestamp: new Date(),
        createdAt: new Date(),
      });
    }

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
      message: `Ticket #${ticketNumber} has been resolved and archived. Customer will get a new ticket for new inquiries.` 
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
 * Reopen an archived ticket (employee takes over again)
 * This un-archives the ticket and allows new messages
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

    const conversation = await db.collection('conversations').findOne({ _id: convObjectId });
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const ticketNumber = conversation.ticketNumber || 1;

    console.log(`🔄 [Reopen] Reopening ticket #${ticketNumber} (${conversationId}) by ${decoded.email}`);

    await db.collection('conversations').updateOne(
      { _id: convObjectId },
      {
        $set: {
          isResolved: false,
          isArchived: false,
          status: 'active',
          isAIHandled: false,
          assignedEmployeeId: new Types.ObjectId(decoded.adminId),
          assignedEmployeeName: decoded.name || decoded.email,
          reopenedAt: new Date(),
          reopenedBy: decoded.adminId,
          reopenedByName: decoded.name || decoded.email,
          updatedAt: new Date(),
        },
        $unset: {
          resolvedAt: 1,
          resolvedBy: 1,
          resolvedByName: 1,
          archivedAt: 1,
        },
      }
    );

    // Add system message
    await db.collection('messages').insertOne({
      conversationId: convObjectId,
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      messageType: 'system',
      content: `🔄 Ticket #${ticketNumber} reopened by ${decoded.name || decoded.email}`,
      status: 'sent',
      readBy: [],
      deliveredTo: [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Log to audit trail
    const userParticipant = conversation.participants?.find((p: any) => p.type === 'user');
    if (userParticipant?.id) {
      await db.collection('customer_audit_trails').insertOne({
        customerId: userParticipant.id,
        action: 'ticket_reopened',
        category: 'messaging',
        performedBy: {
          id: decoded.adminId,
          email: decoded.email,
          name: decoded.name || decoded.email,
          type: 'employee',
        },
        details: {
          conversationId,
          ticketNumber,
        },
        timestamp: new Date(),
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Ticket #${ticketNumber} reopened. You are now handling this conversation.` 
    });
  } catch (error) {
    console.error('Error reopening conversation:', error);
    return NextResponse.json(
      { error: 'Failed to reopen conversation' },
      { status: 500 }
    );
  }
}

