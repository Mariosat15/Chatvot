import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose, { Types, ClientSession } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';

/**
 * POST /api/messaging/conversations/[conversationId]/transfer-back
 * Transfer a chat back to the original employee
 * 
 * This returns the chat to whoever had it before the transfer.
 * Used after the receiving employee has handled the issue.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  let session: ClientSession | null = null;

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
      role: string;
      isSuperAdmin?: boolean;
    };

    const { conversationId } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body; // Optional notes about resolution

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

    // Check if chat is actually transferred
    if (!conversation.isChatTransferred) {
      return NextResponse.json(
        { error: 'This chat is not transferred. No transfer-back needed.' },
        { status: 400 }
      );
    }

    // Verify current user is the one who received the transfer (or super admin)
    if (!decoded.isSuperAdmin && conversation.chatTransferredTo !== decoded.adminId) {
      return NextResponse.json(
        { error: 'Only the employee who received the transfer can transfer back' },
        { status: 403 }
      );
    }

    const originalEmployeeId = conversation.chatTransferredFrom;
    const originalEmployeeName = conversation.chatTransferredFromName;

    if (!originalEmployeeId) {
      return NextResponse.json(
        { error: 'Original employee information not found' },
        { status: 400 }
      );
    }

    console.log(`🔙 [TransferBack] Starting transfer back: ${conversationId}`);
    console.log(`   From: ${decoded.email} (${decoded.adminId})`);
    console.log(`   Back to: ${originalEmployeeName} (${originalEmployeeId})`);

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update conversation - remove transfer state, restore original
      const updateResult = await db.collection('conversations').updateOne(
        { _id: convObjectId },
        {
          $set: {
            isChatTransferred: false,
            assignedEmployeeId: new Types.ObjectId(originalEmployeeId),
            assignedEmployeeName: originalEmployeeName,
            lastActivityAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: {
            chatTransferredTo: '',
            chatTransferredToName: '',
            chatTransferredFrom: '',
            chatTransferredFromName: '',
          },
          $push: {
            'metadata.transferHistory': {
              type: 'transfer_back',
              fromEmployeeId: decoded.adminId,
              fromEmployeeName: decoded.name || decoded.email,
              toEmployeeId: originalEmployeeId,
              toEmployeeName: originalEmployeeName,
              notes,
              transferredAt: new Date(),
            },
          },
        },
        { session }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error('Failed to update conversation');
      }

      // Update participants
      await db.collection('conversations').updateOne(
        { 
          _id: convObjectId,
          'participants.id': decoded.adminId,
        },
        {
          $set: {
            'participants.$.isActive': false,
            'participants.$.leftAt': new Date(),
          },
        },
        { session }
      );

      await db.collection('conversations').updateOne(
        { 
          _id: convObjectId,
          'participants.id': originalEmployeeId,
        },
        {
          $set: {
            'participants.$.isActive': true,
            'participants.$.leftAt': null,
          },
        },
        { session }
      );

      // Create system message
      const systemMessage = {
        conversationId: convObjectId,
        senderId: 'system',
        senderType: 'system',
        senderName: 'System',
        content: `🔙 Chat transferred back to ${originalEmployeeName}${notes ? ` - Notes: ${notes}` : ''}`,
        messageType: 'system',
        status: 'sent',
        readBy: [],
        deliveredTo: [],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('messages').insertOne(systemMessage, { session });

      // Log to audit trail
      const userParticipant = conversation.participants?.find((p: any) => p.type === 'user');
      if (userParticipant?.id) {
        await db.collection('customer_audit_trails').insertOne({
          customerId: userParticipant.id,
          action: 'chat_transferred_back',
          category: 'messaging',
          performedBy: {
            id: decoded.adminId,
            email: decoded.email,
            name: decoded.name || decoded.email,
            type: 'employee',
          },
          details: {
            conversationId,
            fromEmployeeId: decoded.adminId,
            fromEmployeeName: decoded.name || decoded.email,
            toEmployeeId: originalEmployeeId,
            toEmployeeName: originalEmployeeName,
            notes,
          },
          timestamp: new Date(),
          createdAt: new Date(),
        }, { session });
      }

      // Create notification for original employee
      await db.collection('employee_notifications').insertOne({
        employeeId: originalEmployeeId,
        type: 'chat_transfer_returned',
        title: 'Chat Returned',
        message: `${decoded.name || decoded.email} returned a chat to you${notes ? `: ${notes}` : ''}`,
        data: {
          conversationId,
          fromEmployeeId: decoded.adminId,
          fromEmployeeName: decoded.name || decoded.email,
          customerName: userParticipant?.name || 'Customer',
        },
        isRead: false,
        createdAt: new Date(),
      }, { session });

      // Commit transaction
      await session.commitTransaction();
      console.log(`✅ [TransferBack] Transfer back successful: ${conversationId}`);

      // Notify via WebSocket
      try {
        const wsInternalUrl = process.env.WS_INTERNAL_URL || 'http://localhost:3003';
        
        await fetch(`${wsInternalUrl}/internal/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'chat_transferred',
            conversationId,
            data: {
              isChatTransferred: false,
              assignedEmployeeId: originalEmployeeId,
              assignedEmployeeName: originalEmployeeName,
            },
          }),
        });

        await fetch(`${wsInternalUrl}/internal/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            message: {
              id: 'transfer-back-' + Date.now(),
              ...systemMessage,
              createdAt: systemMessage.createdAt.toISOString(),
            },
          }),
        });
      } catch (wsError) {
        console.warn('⚠️ [TransferBack] WebSocket notification failed:', wsError);
      }

      return NextResponse.json({
        success: true,
        message: `Chat transferred back to ${originalEmployeeName}`,
        conversation: {
          id: conversationId,
          isChatTransferred: false,
          assignedEmployeeId: originalEmployeeId,
          assignedEmployeeName: originalEmployeeName,
        },
      });

    } catch (transactionError) {
      console.error('❌ [TransferBack] Transaction error:', transactionError);
      await session.abortTransaction();
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ [TransferBack] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to transfer back conversation' },
      { status: 500 }
    );
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
