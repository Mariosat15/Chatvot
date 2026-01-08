import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * POST /api/messaging/conversations/[conversationId]/messages
 * Send message as employee
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

    const jwtSecret = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';
    const decoded = verify(token, jwtSecret) as {
      id: string;
      email: string;
      name: string;
      role: string;
    };

    const { conversationId } = await params;
    const body = await request.json();
    const { content, messageType, attachments, replyTo } = body;

    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Message content or attachments required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const Conversation = mongoose.models.Conversation || 
      mongoose.model('Conversation', new mongoose.Schema({}, { strict: false, collection: 'conversations' }));
    const Message = mongoose.models.Message || 
      mongoose.model('Message', new mongoose.Schema({}, { strict: false, collection: 'messages' }));

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Create message
    const message = await Message.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: decoded.id,
      senderType: 'employee',
      senderName: decoded.name || decoded.email,
      messageType: messageType || 'text',
      content: content || '',
      attachments,
      replyTo: replyTo ? {
        messageId: new Types.ObjectId(replyTo.messageId),
        content: replyTo.content,
        senderName: replyTo.senderName,
      } : undefined,
      status: 'sent',
      readBy: [],
      deliveredTo: [],
    });

    // Update conversation
    conversation.lastMessage = {
      messageId: message._id,
      content: content?.substring(0, 100) || '[Attachment]',
      senderId: decoded.id,
      senderName: decoded.name || decoded.email,
      senderType: 'employee',
      timestamp: message.createdAt,
    };
    conversation.lastActivityAt = new Date();
    
    // If AI was handling, add employee as participant and disable AI
    if (conversation.isAIHandled && conversation.type === 'user-to-support') {
      conversation.isAIHandled = false;
      conversation.aiHandledUntil = new Date();
      conversation.assignedEmployeeId = new Types.ObjectId(decoded.id);
      conversation.assignedEmployeeName = decoded.name || decoded.email;
      
      // Add employee to participants if not present
      const existingParticipant = conversation.participants?.find((p: any) => p.id === decoded.id);
      if (!existingParticipant) {
        conversation.participants = conversation.participants || [];
        conversation.participants.push({
          id: decoded.id,
          type: 'employee',
          name: decoded.name || decoded.email,
          joinedAt: new Date(),
          isActive: true,
        });
      }
    }

    // Increment unread counts for other participants
    for (const participant of conversation.participants || []) {
      if (participant.id !== decoded.id && participant.isActive) {
        const currentCount = conversation.unreadCounts?.get?.(participant.id) || 0;
        if (conversation.unreadCounts?.set) {
          conversation.unreadCounts.set(participant.id, currentCount + 1);
        }
      }
    }

    await conversation.save();

    // TODO: Send notification to user if this is a support chat

    return NextResponse.json({
      message: {
        id: message._id.toString(),
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: message.senderName,
        content: message.content,
        messageType: message.messageType,
        attachments: message.attachments,
        replyTo: message.replyTo,
        status: message.status,
        createdAt: message.createdAt,
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

