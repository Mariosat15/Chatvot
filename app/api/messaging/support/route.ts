import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import MessagingService from '@/lib/services/messaging/messaging.service';

/**
 * GET /api/messaging/support
 * Get or create support conversation for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      console.log('❌ [Support GET] No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`📨 [Support GET] User: ${session.user.name} (${session.user.id})`);

    const conversation = await MessagingService.getOrCreateSupportConversation(
      session.user.id,
      session.user.name || 'User',
      session.user.image
    );

    console.log(`📨 [Support GET] Conversation: ${conversation._id}, participants: ${conversation.participants?.length}`);
    console.log(`📨 [Support GET] isAIHandled: ${conversation.isAIHandled}, assignedEmployee: ${conversation.assignedEmployeeName}`);

    // Get recent messages
    const messages = await MessagingService.getMessages(
      conversation._id.toString(),
      { limit: 50 }
    );

    console.log(`📨 [Support GET] Messages: ${messages.length}`);

    // Mark as read
    await MessagingService.markMessagesAsRead(
      conversation._id.toString(),
      session.user.id,
      session.user.name || 'User'
    );

    return NextResponse.json({
      conversation: {
        id: conversation._id.toString(),
        type: conversation.type,
        status: conversation.status,
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
    });
  } catch (error) {
    console.error('❌ [Support GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get support conversation' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messaging/support
 * Send a message to customer support
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      console.log('❌ [Support POST] No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, attachments } = body;

    console.log(`📤 [Support POST] From: ${session.user.name} (${session.user.id})`);
    console.log(`📤 [Support POST] Content: "${content?.substring(0, 50)}..."`);

    if (!content && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Message content or attachments required' },
        { status: 400 }
      );
    }

    // Get or create support conversation
    const conversation = await MessagingService.getOrCreateSupportConversation(
      session.user.id,
      session.user.name || 'User',
      session.user.image
    );

    console.log(`📤 [Support POST] Conversation: ${conversation._id}, isAIHandled: ${conversation.isAIHandled}, assignedEmployee: ${conversation.assignedEmployeeName}`);

    const { message } = await MessagingService.sendMessage({
      conversationId: conversation._id.toString(),
      senderId: session.user.id,
      senderType: 'user',
      senderName: session.user.name || 'User',
      senderAvatar: session.user.image,
      content: content || '',
      messageType: 'text',
      attachments,
    });

    console.log(`📤 [Support POST] Message sent: ${message._id}`);

    // Broadcast via WebSocket
    const { wsNotifier } = await import('@/lib/services/messaging/websocket-notifier');
    wsNotifier.notifyNewMessage(conversation._id.toString(), message);

    // Handle AI response if conversation is AI-handled
    let aiResponse = null;
    if (conversation.isAIHandled) {
      console.log(`🤖 [Support POST] AI is handling, generating response...`);
      try {
        aiResponse = await handleAIResponse(
          conversation._id.toString(),
          session.user.id,
          session.user.name || 'User',
          content
        );
        
        if (aiResponse) {
          wsNotifier.notifyNewMessage(conversation._id.toString(), aiResponse);
        }
      } catch (aiError) {
        console.error('Error generating AI response:', aiError);
      }
    }

    return NextResponse.json({
      message: {
        id: message._id.toString(),
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: message.senderName,
        senderAvatar: message.senderAvatar,
        content: message.content,
        messageType: message.messageType,
        attachments: message.attachments,
        status: message.status,
        createdAt: message.createdAt,
      },
      aiResponse: aiResponse ? {
        id: aiResponse._id.toString(),
        senderId: aiResponse.senderId,
        senderType: aiResponse.senderType,
        senderName: aiResponse.senderName,
        content: aiResponse.content,
        messageType: aiResponse.messageType,
        createdAt: aiResponse.createdAt,
      } : null,
      conversationId: conversation._id.toString(),
    });
  } catch (error: any) {
    console.error('Error sending support message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

/**
 * Handle AI response generation
 */
async function handleAIResponse(
  conversationId: string,
  userId: string,
  userName: string,
  userMessage: string
) {
  const { connectToDatabase } = await import('@/database/mongoose');
  const mongoose = await import('mongoose');
  
  await connectToDatabase();
  
  const db = mongoose.default.connection.db;
  if (!db) return null;
  
  // Get messaging settings
  const settingsDoc = await db.collection('messaging_settings').findOne({});
  const settings = settingsDoc || {};
  
  if (!settings.enableAISupport) {
    return null;
  }
  
  // Get conversation to check AI response count
  const conversation = await db.collection('conversations').findOne({
    _id: new mongoose.default.Types.ObjectId(conversationId)
  });
  
  if (!conversation) return null;
  
  // Count AI messages in this conversation
  const aiMessageCount = await db.collection('messages').countDocuments({
    conversationId: new mongoose.default.Types.ObjectId(conversationId),
    senderType: 'ai'
  });
  
  // Check for escalation keywords
  const escalationKeywords = settings.aiEscalationKeywords || ['human', 'agent', 'person', 'real person', 'talk to someone', 'representative'];
  const lowerMessage = userMessage.toLowerCase();
  const shouldEscalate = escalationKeywords.some((kw: string) => lowerMessage.includes(kw.toLowerCase()));
  
  // Check max responses before escalation
  const maxResponses = settings.aiMaxResponsesBeforeEscalation || 10;
  const shouldAutoEscalate = aiMessageCount >= maxResponses;
  
  if (shouldEscalate || shouldAutoEscalate) {
    // Escalate to human - find assigned employee or any available
    return await escalateToHuman(conversationId, userId, userName, shouldEscalate ? 'User requested human assistance' : 'Maximum AI responses reached');
  }
  
  // Generate AI response using OpenAI
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      return null;
    }
    
    // Get conversation history for context
    const recentMessages = await db.collection('messages')
      .find({ conversationId: new mongoose.default.Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    const conversationHistory = recentMessages.reverse().map(m => ({
      role: m.senderType === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
    
    // Build system prompt
    const systemPrompt = settings.aiSystemPrompt || `You are a helpful customer support assistant for ChartVolt, a trading platform. 
Be friendly, professional, and helpful. If you cannot help with something or the user seems frustrated, 
suggest connecting them with a human agent. Keep responses concise but informative.`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) return null;
    
    // Save AI message
    const aiMessage = {
      conversationId: new mongoose.default.Types.ObjectId(conversationId),
      senderId: 'ai-assistant',
      senderType: 'ai',
      senderName: 'AI Assistant',
      content: aiContent,
      messageType: 'ai-response',
      status: 'sent',
      readBy: [],
      createdAt: new Date(),
    };
    
    const result = await db.collection('messages').insertOne(aiMessage);
    
    // Update conversation lastMessage
    await db.collection('conversations').updateOne(
      { _id: new mongoose.default.Types.ObjectId(conversationId) },
      {
        $set: {
          lastMessage: {
            content: aiContent.substring(0, 100),
            senderId: 'ai-assistant',
            senderName: 'AI Assistant',
            senderType: 'ai',
            timestamp: new Date(),
          },
          lastActivityAt: new Date(),
        }
      }
    );
    
    return { ...aiMessage, _id: result.insertedId };
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return null;
  }
}

/**
 * Escalate conversation from AI to human
 */
async function escalateToHuman(
  conversationId: string,
  userId: string,
  userName: string,
  reason: string
) {
  const mongoose = await import('mongoose');
  const { connectToDatabase } = await import('@/database/mongoose');
  
  await connectToDatabase();
  const db = mongoose.default.connection.db;
  if (!db) return null;
  
  // Check if user has an assigned employee
  const assignment = await db.collection('customer_assignments').findOne({
    $or: [
      { customerId: userId },
      { customerId: userId.toString() }
    ]
  });
  
  let assignedEmployee = null;
  if (assignment?.employeeId) {
    assignedEmployee = await db.collection('admins').findOne({
      _id: new mongoose.default.Types.ObjectId(assignment.employeeId),
      status: 'active'
    });
  }
  
  // If no assigned employee or assigned employee is unavailable, find any available backoffice/support employee
  if (!assignedEmployee || assignedEmployee.isAvailableForChat === false) {
    const originalEmployee = assignedEmployee; // Store original for reference
    
    assignedEmployee = await db.collection('admins').findOne({
      status: 'active',
      role: { $in: ['Backoffice', 'Support Agent', 'Full Admin'] },
      isLockedOut: { $ne: true },
      isAvailableForChat: { $ne: false }
    });
  }
  
  const employeeName = assignedEmployee?.name || assignedEmployee?.email?.split('@')[0] || 'Support Team';
  const employeeId = assignedEmployee?._id?.toString();
  
  // Update conversation - mark as no longer AI handled
  await db.collection('conversations').updateOne(
    { _id: new mongoose.default.Types.ObjectId(conversationId) },
    {
      $set: {
        isAIHandled: false,
        assignedEmployeeId: employeeId ? new mongoose.default.Types.ObjectId(employeeId) : null,
        assignedEmployeeName: employeeName,
        lastActivityAt: new Date(),
      }
    }
  );
  
  // Add employee as participant if exists
  if (employeeId) {
    await db.collection('conversations').updateOne(
      { _id: new mongoose.default.Types.ObjectId(conversationId) },
      {
        $push: {
          participants: {
            id: employeeId,
            type: 'employee',
            name: employeeName,
            avatar: assignedEmployee?.profileImage,
            joinedAt: new Date(),
            isActive: true
          }
        }
      }
    );
  }
  
  // Send escalation message
  const escalationMessage = {
    conversationId: new mongoose.default.Types.ObjectId(conversationId),
    senderId: 'ai-assistant',
    senderType: 'ai',
    senderName: 'AI Assistant',
    content: `I'm transferring you to ${employeeName} who will be able to assist you further. ${reason === 'User requested human assistance' ? 'As requested, ' : ''}they'll be with you shortly!`,
    messageType: 'ai-response',
    status: 'sent',
    readBy: [],
    createdAt: new Date(),
  };
  
  const result = await db.collection('messages').insertOne(escalationMessage);
  
  // Update conversation lastMessage
  await db.collection('conversations').updateOne(
    { _id: new mongoose.default.Types.ObjectId(conversationId) },
    {
      $set: {
        lastMessage: {
          content: escalationMessage.content.substring(0, 100),
          senderId: 'ai-assistant',
          senderName: 'AI Assistant',
          senderType: 'ai',
          timestamp: new Date(),
        }
      }
    }
  );
  
  console.log(`🤖→👤 [AI] Escalated conversation ${conversationId} to ${employeeName}. Reason: ${reason}`);
  
  return { ...escalationMessage, _id: result.insertedId };
}

