import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import mongoose, { Types } from 'mongoose';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * POST /api/messaging/support/new-ticket
 * Create a new support ticket, resolving the current active one if exists
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const userId = session.user.id;
    const userName = session.user.name || 'User';

    console.log(`🆕 [NewTicket] Creating new ticket for user: ${userName} (${userId})`);

    // Find current active (non-archived) support conversation
    const activeConversation = await db.collection('conversations').findOne({
      type: 'user-to-support',
      'participants.id': userId,
      'participants.type': 'user',
      $or: [
        { isArchived: { $ne: true } },
        { isResolved: { $ne: true } }
      ],
      status: { $ne: 'archived' }
    });

    // If there's an active conversation, archive it first
    if (activeConversation) {
      const ticketNumber = activeConversation.ticketNumber || 1;
      console.log(`📦 [NewTicket] Archiving current ticket #${ticketNumber}`);

      // Archive the current conversation
      await db.collection('conversations').updateOne(
        { _id: activeConversation._id },
        {
          $set: {
            isResolved: true,
            isArchived: true,
            status: 'archived',
            resolvedAt: new Date(),
            archivedAt: new Date(),
            resolvedBy: 'user',
            resolvedByName: 'User (started new ticket)',
            updatedAt: new Date(),
          }
        }
      );

      // Add system message about closure
      await db.collection('messages').insertOne({
        conversationId: activeConversation._id,
        senderId: 'system',
        senderType: 'system',
        senderName: 'System',
        content: `✅ Ticket #${ticketNumber} closed. User started a new conversation.`,
        messageType: 'system',
        status: 'sent',
        readBy: [],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`✅ [NewTicket] Archived ticket #${ticketNumber}`);
    }

    // Now create a new support conversation
    // getOrCreateSupportConversation will create a new one since we just archived the active one
    const conversation = await MessagingService.getOrCreateSupportConversation(
      userId,
      userName,
      session.user.image
    );

    console.log(`✅ [NewTicket] Created new ticket #${(conversation as any).ticketNumber || '?'}`);

    // Get messages for the new conversation
    const messages = await MessagingService.getMessages(
      conversation._id.toString(),
      { limit: 50 }
    );

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        ticketNumber: (conversation as any).ticketNumber || null,
        isArchived: false,
        participants: conversation.participants.filter(p => p.isActive),
        lastMessage: conversation.lastMessage,
        unreadCount: 0,
        isAIHandled: conversation.isAIHandled,
        assignedEmployeeName: conversation.assignedEmployeeName,
        assignedEmployeeId: conversation.assignedEmployeeId?.toString(),
        createdAt: conversation.createdAt,
        lastActivityAt: conversation.lastActivityAt,
      },
      messages: messages.reverse().map(msg => ({
        id: msg._id.toString(),
        senderId: msg.senderId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        senderAvatar: msg.senderAvatar,
        content: msg.content,
        messageType: msg.messageType,
        attachments: msg.attachments,
        replyTo: msg.replyTo,
        readBy: msg.readBy,
        reactions: msg.reactions,
        isEdited: msg.isEdited,
        createdAt: msg.createdAt,
      })),
      previousTicketArchived: !!activeConversation,
      previousTicketNumber: activeConversation?.ticketNumber || null,
    });
  } catch (error) {
    console.error('❌ [NewTicket] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create new ticket' },
      { status: 500 }
    );
  }
}
