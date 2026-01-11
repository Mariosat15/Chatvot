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
      console.log('❌ [SendMsg] No admin token');
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
    const body = await request.json();
    const { content, messageType, attachments, replyTo } = body;

    console.log(`📤 [SendMsg] From: ${decoded.email} (${decoded.adminId}) to conv: ${conversationId}`);
    console.log(`📤 [SendMsg] Content: "${content?.substring(0, 50)}..."`);

    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Message content or attachments required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    // Find conversation
    let convObjectId;
    try {
      convObjectId = new Types.ObjectId(conversationId);
    } catch {
      console.log(`❌ [SendMsg] Invalid conversationId: ${conversationId}`);
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    const conversation = await db.collection('conversations').findOne({ _id: convObjectId });

    if (!conversation) {
      console.log(`❌ [SendMsg] Conversation not found: ${conversationId}`);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    console.log(`📤 [SendMsg] Conversation type: ${conversation.type}, participants: ${conversation.participants?.length}`);

    // Create message
    const messageDoc = {
      conversationId: convObjectId,
      senderId: decoded.adminId,
      senderType: 'employee',
      senderName: decoded.name || decoded.email,
      messageType: messageType || 'text',
      content: content || '',
      attachments: attachments || [],
      replyTo: replyTo ? {
        messageId: new Types.ObjectId(replyTo.messageId),
        content: replyTo.content,
        senderName: replyTo.senderName,
      } : undefined,
      status: 'sent',
      readBy: [],
      deliveredTo: [],
      isDeleted: false, // IMPORTANT: Required for message queries
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const msgResult = await db.collection('messages').insertOne(messageDoc);
    console.log(`📤 [SendMsg] Message created: ${msgResult.insertedId}`);

    // Build unread counts update - use object notation for MongoDB
    const unreadCountsUpdate: Record<string, number> = {};
    for (const participant of conversation.participants || []) {
      if (participant.id !== decoded.adminId && participant.isActive) {
        const currentCount = conversation.unreadCounts?.[participant.id] || 0;
        unreadCountsUpdate[`unreadCounts.${participant.id}`] = currentCount + 1;
        console.log(`📤 [SendMsg] Incrementing unread for ${participant.name} (${participant.id}): ${currentCount} -> ${currentCount + 1}`);
      }
    }

    // Update conversation
    const updateDoc: any = {
      $set: {
        lastMessage: {
          messageId: msgResult.insertedId,
          content: content?.substring(0, 100) || '[Attachment]',
          senderId: decoded.adminId,
          senderName: decoded.name || decoded.email,
          senderType: 'employee',
          timestamp: new Date(),
        },
        lastActivityAt: new Date(),
        updatedAt: new Date(),
        ...unreadCountsUpdate,
      },
    };

    // If AI was handling support chat, take over
    if (conversation.isAIHandled && conversation.type === 'user-to-support') {
      updateDoc.$set.isAIHandled = false;
      updateDoc.$set.aiHandledUntil = new Date();
      updateDoc.$set.assignedEmployeeId = new Types.ObjectId(decoded.adminId);
      updateDoc.$set.assignedEmployeeName = decoded.name || decoded.email;
      
      // Add employee to participants if not present
      const existingParticipant = conversation.participants?.find((p: any) => p.id === decoded.adminId);
      if (!existingParticipant) {
        updateDoc.$push = {
          participants: {
            id: decoded.adminId,
            type: 'employee',
            name: decoded.name || decoded.email,
            joinedAt: new Date(),
            isActive: true,
          }
        };
      }
    }

    await db.collection('conversations').updateOne({ _id: convObjectId }, updateDoc);
    console.log(`📤 [SendMsg] Conversation updated successfully`);

    // Build message object for response
    const messageResponse = {
      id: msgResult.insertedId.toString(),
      senderId: decoded.adminId,
      senderType: 'employee',
      senderName: decoded.name || decoded.email,
      content: content || '',
      messageType: messageType || 'text',
      attachments: attachments || [],
      replyTo: replyTo,
      status: 'sent',
      createdAt: new Date(),
    };

    // Notify via WebSocket so customer receives the message in real-time
    // Use internal URL for server-to-server communication (not public wss:// URL)
    try {
      const wsInternalUrl = process.env.WS_INTERNAL_URL || 'http://localhost:3003';
      
      console.log(`📤 [SendMsg] Broadcasting via WebSocket: ${wsInternalUrl}/internal/message`);
      
      const wsResponse = await fetch(`${wsInternalUrl}/internal/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: messageResponse,
        }),
      });
      
      if (wsResponse.ok) {
        console.log(`✅ [SendMsg] WebSocket broadcast successful`);
      } else {
        console.warn(`⚠️ [SendMsg] WebSocket broadcast failed: ${wsResponse.status}`);
      }
    } catch (wsError) {
      console.warn(`⚠️ [SendMsg] WebSocket notification failed:`, wsError);
      // Don't fail the request if WebSocket fails - message is already saved
    }

    return NextResponse.json({ message: messageResponse });
  } catch (error) {
    console.error('❌ [SendMsg] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

