import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * GET /api/messaging/conversations/[conversationId]
 * Get conversation details with messages
 */
export async function GET(
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
      adminId: string;
      email: string;
      name?: string;
      role: string;
    };

    const { conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    await connectToDatabase();

    const Conversation = mongoose.models.Conversation || 
      mongoose.model('Conversation', new mongoose.Schema({}, { strict: false, collection: 'conversations' }));
    const Message = mongoose.models.Message || 
      mongoose.model('Message', new mongoose.Schema({}, { strict: false, collection: 'messages' }));

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get messages
    const messageQuery: any = {
      conversationId: new Types.ObjectId(conversationId),
      isDeleted: { $ne: true },
    };

    if (before) {
      messageQuery.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(messageQuery)
      .sort({ createdAt: -1 })
      .limit(limit);

    // Mark messages as read for this employee
    await Message.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: decoded.adminId },
        'readBy.participantId': { $ne: decoded.adminId },
      },
      {
        $push: {
          readBy: {
            participantId: decoded.adminId,
            participantName: decoded.name || decoded.email,
            readAt: new Date(),
          },
        },
        $set: { status: 'read' },
      }
    );

    // Reset unread count
    if (conversation.unreadCounts?.has) {
      conversation.unreadCounts.set(decoded.adminId, 0);
      await conversation.save();
    }

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
        participants: conversation.participants?.filter((p: any) => p.isActive) || [],
        lastMessage: conversation.lastMessage,
        unreadCount: 0,
        isAIHandled: conversation.isAIHandled,
        assignedEmployeeId: conversation.assignedEmployeeId?.toString(),
        assignedEmployeeName: conversation.assignedEmployeeName,
        originalEmployeeId: conversation.originalEmployeeId?.toString(),
        originalEmployeeName: conversation.originalEmployeeName,
        temporarilyRedirected: conversation.temporarilyRedirected || false,
        redirectedAt: conversation.redirectedAt,
        metadata: conversation.metadata,
        createdAt: conversation.createdAt,
        lastActivityAt: conversation.lastActivityAt,
      },
      messages: messages.reverse().map((msg: any) => ({
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
        isModerated: msg.isModerated,
        moderationReason: msg.moderationReason,
        aiMetadata: msg.aiMetadata,
        createdAt: msg.createdAt,
      })),
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

