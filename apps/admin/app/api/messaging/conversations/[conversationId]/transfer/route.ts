import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

/**
 * POST /api/messaging/conversations/[conversationId]/transfer
 * Transfer conversation to another employee
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
    const { toEmployeeId, toEmployeeName, reason } = body;

    if (!toEmployeeId) {
      return NextResponse.json(
        { error: 'Target employee ID is required' },
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

    if (conversation.type !== 'user-to-support') {
      return NextResponse.json(
        { error: 'Only support conversations can be transferred' },
        { status: 400 }
      );
    }

    const previousEmployeeId = conversation.assignedEmployeeId?.toString();
    const previousEmployeeName = conversation.assignedEmployeeName;

    // Store original employee if first transfer
    if (!conversation.originalEmployeeId && conversation.assignedEmployeeId) {
      conversation.originalEmployeeId = conversation.assignedEmployeeId;
    }

    // Update assignment
    conversation.assignedEmployeeId = new Types.ObjectId(toEmployeeId);
    conversation.assignedEmployeeName = toEmployeeName;
    conversation.isAIHandled = false;

    // Update participants
    if (previousEmployeeId) {
      const oldParticipant = conversation.participants?.find(
        (p: any) => p.id === previousEmployeeId && p.type === 'employee'
      );
      if (oldParticipant) {
        oldParticipant.isActive = false;
        oldParticipant.leftAt = new Date();
      }
    }

    const existingParticipant = conversation.participants?.find((p: any) => p.id === toEmployeeId);
    if (existingParticipant) {
      existingParticipant.isActive = true;
      existingParticipant.leftAt = undefined;
    } else {
      conversation.participants = conversation.participants || [];
      conversation.participants.push({
        id: toEmployeeId,
        type: 'employee',
        name: toEmployeeName,
        joinedAt: new Date(),
        isActive: true,
      });
    }

    // Add to transfer history
    if (!conversation.metadata) conversation.metadata = {};
    if (!conversation.metadata.transferHistory) conversation.metadata.transferHistory = [];

    conversation.metadata.transferHistory.push({
      fromEmployeeId: previousEmployeeId || decoded.id,
      fromEmployeeName: previousEmployeeName || decoded.name || decoded.email,
      toEmployeeId,
      toEmployeeName,
      reason,
      transferredAt: new Date(),
    });

    conversation.lastActivityAt = new Date();
    await conversation.save();

    // Create system message
    await Message.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      content: `Conversation transferred to ${toEmployeeName}${reason ? ` - Reason: ${reason}` : ''}`,
      messageType: 'system',
      status: 'sent',
      readBy: [],
      deliveredTo: [],
    });

    // TODO: Notify the new employee

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation._id.toString(),
        assignedEmployeeId: toEmployeeId,
        assignedEmployeeName: toEmployeeName,
      },
    });
  } catch (error) {
    console.error('Error transferring conversation:', error);
    return NextResponse.json(
      { error: 'Failed to transfer conversation' },
      { status: 500 }
    );
  }
}

