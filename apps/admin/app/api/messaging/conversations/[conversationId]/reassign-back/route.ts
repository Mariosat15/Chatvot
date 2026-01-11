import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production';

/**
 * POST /api/messaging/conversations/[conversationId]/reassign-back
 * Reassign a temporarily redirected conversation back to the original employee
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
    };

    const { conversationId } = await params;

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const conversation = await db.collection('conversations').findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (!conversation.temporarilyRedirected || !conversation.originalEmployeeId) {
      return NextResponse.json(
        { error: 'This conversation was not temporarily redirected' },
        { status: 400 }
      );
    }

    // Get original employee
    const originalEmployee = await db.collection('admins').findOne({
      _id: conversation.originalEmployeeId,
      status: 'active',
      isLockedOut: { $ne: true },
    });

    if (!originalEmployee) {
      return NextResponse.json(
        { error: 'Original employee not found or not active' },
        { status: 404 }
      );
    }

    // Check if original employee is now available
    if (originalEmployee.isAvailableForChat === false) {
      return NextResponse.json(
        { error: 'Original employee is still unavailable' },
        { status: 400 }
      );
    }

    // Reassign back
    await db.collection('conversations').updateOne(
      { _id: new mongoose.Types.ObjectId(conversationId) },
      {
        $set: {
          assignedEmployeeId: conversation.originalEmployeeId,
          assignedEmployeeName: conversation.originalEmployeeName,
          temporarilyRedirected: false,
          reassignedAt: new Date(),
        },
        $unset: {
          originalEmployeeId: 1,
          originalEmployeeName: 1,
          redirectedAt: 1,
        }
      }
    );

    // Add system message
    await db.collection('messages').insertOne({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      content: `${conversation.originalEmployeeName} is back and will continue assisting you.`,
      messageType: 'system',
      status: 'sent',
      readBy: [],
      createdAt: new Date(),
    });

    console.log(`📋 [Reassign] Conversation ${conversationId} reassigned back to ${originalEmployee.email}`);

    return NextResponse.json({
      success: true,
      message: 'Conversation reassigned back to original employee',
    });
  } catch (error) {
    console.error('Error reassigning conversation:', error);
    return NextResponse.json(
      { error: 'Failed to reassign conversation' },
      { status: 500 }
    );
  }
}

