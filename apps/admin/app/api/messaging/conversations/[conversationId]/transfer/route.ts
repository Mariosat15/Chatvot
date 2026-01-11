import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose, { Types, ClientSession } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';

interface TransferResult {
  success: boolean;
  conversationId: string;
  previousState?: any;
  error?: string;
}

/**
 * POST /api/messaging/conversations/[conversationId]/transfer
 * Transfer a conversation to another employee (chat-only transfer)
 * 
 * This is a TEMPORARY transfer - the chat is handled by another employee
 * but the customer assignment remains the same.
 * 
 * The original employee sees "Handled by [employee]" and cannot reply
 * until the chat is transferred back.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  let session: ClientSession | null = null;
  let previousState: any = null;

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
    const body = await request.json();
    const { toEmployeeId, toEmployeeName, reason, transferType = 'chat', transferAllConversations = false } = body;

    // Validate required fields
    if (!toEmployeeId || !toEmployeeName) {
      return NextResponse.json(
        { error: 'Target employee ID and name are required' },
        { status: 400 }
      );
    }

    // Cannot transfer to self
    if (toEmployeeId === decoded.adminId) {
      return NextResponse.json(
        { error: 'Cannot transfer to yourself' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    // Check if chat transfers are enabled (unless super admin)
    if (!decoded.isSuperAdmin) {
      const settings = await db.collection('messaging_settings').findOne({});
      if (settings?.allowChatTransfer === false) {
        return NextResponse.json(
          { error: 'Chat transfers are currently disabled by administrator' },
          { status: 403 }
        );
      }
    }

    // Validate conversation exists
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

    if (conversation.type !== 'user-to-support') {
      return NextResponse.json(
        { error: 'Only support conversations can be transferred' },
        { status: 400 }
      );
    }

    // Verify target employee exists
    const targetEmployee = await db.collection('admins').findOne({
      _id: new Types.ObjectId(toEmployeeId),
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Target employee not found' }, { status: 404 });
    }

    // Store previous state for potential rollback
    previousState = {
      assignedEmployeeId: conversation.assignedEmployeeId?.toString(),
      assignedEmployeeName: conversation.assignedEmployeeName,
      chatTransferredTo: conversation.chatTransferredTo,
      chatTransferredToName: conversation.chatTransferredToName,
      chatTransferredFrom: conversation.chatTransferredFrom,
      chatTransferredFromName: conversation.chatTransferredFromName,
      isChatTransferred: conversation.isChatTransferred,
      participants: conversation.participants,
    };

    console.log(`🔄 [Transfer] Starting ${transferAllConversations ? 'ALL conversations' : 'chat'} transfer: ${conversationId}`);
    console.log(`   From: ${decoded.email} (${decoded.adminId})`);
    console.log(`   To: ${toEmployeeName} (${toEmployeeId})`);
    console.log(`   Transfer All: ${transferAllConversations}`);

    // Get customer info from this conversation
    const userParticipant = conversation.participants?.find((p: any) => p.type === 'user');
    const customerId = userParticipant?.id;
    const customerName = userParticipant?.name || 'Customer';

    // If transferring all conversations, find them all
    let conversationsToTransfer = [convObjectId];
    if (transferAllConversations && customerId) {
      const allConversations = await db.collection('conversations').find({
        type: 'user-to-support',
        'participants.id': customerId,
        'participants.type': 'user',
      }).toArray();
      conversationsToTransfer = allConversations.map(c => c._id);
      console.log(`📋 [Transfer] Found ${conversationsToTransfer.length} conversations to transfer for customer ${customerName}`);
    }

    // Start MongoDB session for atomic operations
    session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Determine the original handler
      const originalEmployeeId = conversation.chatTransferredFrom || conversation.assignedEmployeeId?.toString() || decoded.adminId;
      const originalEmployeeName = conversation.chatTransferredFromName || conversation.assignedEmployeeName || decoded.name || decoded.email;

      // Transfer each conversation
      const transferredConversations: Types.ObjectId[] = [];
      const systemMessages: any[] = [];

      for (const convId of conversationsToTransfer) {
        const conv = convId.equals(convObjectId) ? conversation : await db.collection('conversations').findOne({ _id: convId }, { session });
        if (!conv) continue;

        const ticketNumber = conv.ticketNumber || 1;

        // Update conversation with transfer info
        const updateResult = await db.collection('conversations').updateOne(
          { _id: convId },
          {
            $set: {
              // Mark as transferred
              isChatTransferred: true,
              chatTransferredTo: toEmployeeId,
              chatTransferredToName: toEmployeeName,
              // Store original handler for transfer-back
              chatTransferredFrom: originalEmployeeId,
              chatTransferredFromName: originalEmployeeName,
              // Update assigned employee (for visibility)
              assignedEmployeeId: new Types.ObjectId(toEmployeeId),
              assignedEmployeeName: toEmployeeName,
              isAIHandled: false,
              lastActivityAt: new Date(),
              updatedAt: new Date(),
            },
            $push: {
              'metadata.transferHistory': {
                type: transferAllConversations ? 'bulk_transfer' : transferType,
                fromEmployeeId: decoded.adminId,
                fromEmployeeName: decoded.name || decoded.email,
                toEmployeeId,
                toEmployeeName,
                reason: reason || (transferAllConversations ? 'All conversations transferred' : 'Chat transfer'),
                transferredAt: new Date(),
              },
            },
          },
          { session }
        );

        if (updateResult.modifiedCount === 0) {
          console.warn(`⚠️ [Transfer] Could not update conversation ${convId}`);
          continue;
        }

        transferredConversations.push(convId);

        // Update participants - mark old employee as inactive
        await db.collection('conversations').updateOne(
          { 
            _id: convId,
            'participants.id': decoded.adminId,
            'participants.type': 'employee',
          },
          {
            $set: {
              'participants.$.isActive': false,
              'participants.$.leftAt': new Date(),
            },
          },
          { session }
        );

        // Add new employee as participant if not already
        const hasNewEmployee = conv.participants?.some((p: any) => p.id === toEmployeeId);
        if (!hasNewEmployee) {
          await db.collection('conversations').updateOne(
            { _id: convId },
            {
              $push: {
                participants: {
                  id: toEmployeeId,
                  type: 'employee',
                  name: toEmployeeName,
                  joinedAt: new Date(),
                  isActive: true,
                },
              },
            },
            { session }
          );
        } else {
          // Reactivate existing participant
          await db.collection('conversations').updateOne(
            { 
              _id: convId,
              'participants.id': toEmployeeId,
            },
            {
              $set: {
                'participants.$.isActive': true,
                'participants.$.leftAt': null,
              },
            },
            { session }
          );
        }

        // Create system message for this conversation
        const sysMsg = {
          conversationId: convId,
          senderId: 'system',
          senderType: 'system',
          senderName: 'System',
          content: transferAllConversations 
            ? `📋 Ticket #${ticketNumber} transferred to ${toEmployeeName} (bulk transfer)${reason ? ` - ${reason}` : ''}`
            : `💬 Ticket #${ticketNumber} transferred from ${decoded.name || decoded.email} to ${toEmployeeName}${reason ? ` - ${reason}` : ''}`,
          messageType: 'system',
          status: 'sent',
          readBy: [],
          deliveredTo: [],
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.collection('messages').insertOne(sysMsg, { session });
        systemMessages.push(sysMsg);
      }

      // Use the first system message for the primary conversation
      const systemMessage = systemMessages.find(m => m.conversationId.equals(convObjectId)) || systemMessages[0];

      // Log to audit trail
      if (customerId) {
        await db.collection('customer_audit_trails').insertOne({
          customerId,
          action: transferAllConversations ? 'all_conversations_transferred' : 'chat_transferred',
          category: 'messaging',
          performedBy: {
            id: decoded.adminId,
            email: decoded.email,
            name: decoded.name || decoded.email,
            type: 'employee',
          },
          details: {
            conversationId,
            transferType: transferAllConversations ? 'bulk' : transferType,
            conversationsTransferred: transferredConversations.length,
            conversationIds: transferredConversations.map(id => id.toString()),
            fromEmployeeId: decoded.adminId,
            fromEmployeeName: decoded.name || decoded.email,
            toEmployeeId,
            toEmployeeName,
            reason,
            originalEmployeeId,
            originalEmployeeName,
          },
          timestamp: new Date(),
          createdAt: new Date(),
        }, { session });
      }

      // Create notification for receiving employee
      await db.collection('employee_notifications').insertOne({
        employeeId: toEmployeeId,
        type: transferAllConversations ? 'bulk_chat_transfer_received' : 'chat_transfer_received',
        title: transferAllConversations ? 'Customer Chats Transferred' : 'New Chat Transferred',
        message: transferAllConversations 
          ? `${decoded.name || decoded.email} transferred all ${transferredConversations.length} conversation(s) with ${customerName} to you${reason ? `: ${reason}` : ''}`
          : `${decoded.name || decoded.email} transferred a chat to you${reason ? `: ${reason}` : ''}`,
        data: {
          conversationId,
          conversationsTransferred: transferredConversations.length,
          fromEmployeeId: decoded.adminId,
          fromEmployeeName: decoded.name || decoded.email,
          customerName,
        },
        isRead: false,
        createdAt: new Date(),
      }, { session });

      // Commit transaction
      await session.commitTransaction();
      console.log(`✅ [Transfer] Chat transfer successful: ${conversationId}`);

      // Notify via WebSocket (outside transaction)
      try {
        const wsInternalUrl = process.env.WS_INTERNAL_URL || 'http://localhost:3003';
        
        // Notify both employees and customer
        await fetch(`${wsInternalUrl}/internal/chat-transferred`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            isChatTransferred: true,
            chatTransferredTo: toEmployeeId,
            chatTransferredToName: toEmployeeName,
            chatTransferredFrom: originalEmployeeId,
            chatTransferredFromName: originalEmployeeName,
            assignedEmployeeId: toEmployeeId,
            assignedEmployeeName: toEmployeeName,
          }),
        });

        // Send system message via WebSocket
        await fetch(`${wsInternalUrl}/internal/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            message: {
              id: systemMessage._id?.toString() || 'transfer-' + Date.now(),
              ...systemMessage,
              createdAt: systemMessage.createdAt.toISOString(),
            },
          }),
        });
      } catch (wsError) {
        console.warn('⚠️ [Transfer] WebSocket notification failed:', wsError);
      }

      return NextResponse.json({
        success: true,
        message: transferAllConversations 
          ? `All ${transferredConversations.length} conversation(s) transferred to ${toEmployeeName}`
          : `Chat transferred to ${toEmployeeName}`,
        conversation: {
          id: conversationId,
          isChatTransferred: true,
          assignedEmployeeId: toEmployeeId,
          assignedEmployeeName: toEmployeeName,
          chatTransferredFrom: originalEmployeeId,
          chatTransferredFromName: originalEmployeeName,
        },
        transferredCount: transferredConversations.length,
      });

    } catch (transactionError) {
      // Rollback transaction
      console.error('❌ [Transfer] Transaction error, rolling back:', transactionError);
      await session.abortTransaction();
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ [Transfer] Error:', error);
    
    // If we have previous state and session was aborted, attempt manual rollback
    if (previousState && session?.transaction?.isActive === false) {
      try {
        const db = mongoose.connection.db;
        if (db) {
          const { conversationId } = await params;
          await db.collection('conversations').updateOne(
            { _id: new Types.ObjectId(conversationId) },
            { $set: previousState }
          );
          console.log('🔙 [Transfer] Manual rollback completed');
        }
      } catch (rollbackError) {
        console.error('❌ [Transfer] Rollback failed:', rollbackError);
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to transfer conversation' },
      { status: 500 }
    );
  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
