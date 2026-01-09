import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';
import {
  Conversation,
  Message,
  FriendRequest,
  Friendship,
  MessagingSettings,
  UserPresence,
  IConversation,
  IMessage,
  IFriendRequest,
  IFriendship,
  IMessagingSettings,
  ConversationType,
} from '@/database/models/messaging';

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// WebSocket server URL for internal API
const WS_SERVER_URL = process.env.WEBSOCKET_INTERNAL_URL || 'http://localhost:3003';

/**
 * Broadcast message to WebSocket server for real-time delivery
 */
async function broadcastToWebSocket(endpoint: string, data: any): Promise<void> {
  try {
    const response = await fetch(`${WS_SERVER_URL}/internal/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.warn(`[WS Broadcast] Failed to broadcast ${endpoint}:`, response.status);
    }
  } catch (error) {
    // Don't throw - WebSocket is optional for message delivery
    console.warn(`[WS Broadcast] Error broadcasting ${endpoint}:`, error instanceof Error ? error.message : error);
  }
}

export class MessagingService {
  // ==========================================
  // CONVERSATIONS
  // ==========================================
  
  static async createConversation(params: {
    type: ConversationType;
    participants: Array<{
      id: string;
      type: 'user' | 'employee' | 'ai';
      name: string;
      avatar?: string;
    }>;
    title?: string;
    isAIHandled?: boolean;
    assignedEmployeeId?: string;
    assignedEmployeeName?: string;
  }): Promise<IConversation> {
    await connectToDatabase();
    
    const conversation = await Conversation.create({
      type: params.type,
      status: 'active',
      participants: params.participants.map(p => ({
        ...p,
        joinedAt: new Date(),
        isActive: true,
      })),
      title: params.title,
      isAIHandled: params.isAIHandled || false,
      assignedEmployeeId: params.assignedEmployeeId ? new Types.ObjectId(params.assignedEmployeeId) : undefined,
      assignedEmployeeName: params.assignedEmployeeName,
      unreadCounts: new Map(),
      lastActivityAt: new Date(),
    });
    
    console.log(`📝 [createConversation] Created: ${conversation._id}, type: ${params.type}, isAIHandled: ${params.isAIHandled}, assignedEmployee: ${params.assignedEmployeeName || 'none'}`);
    
    return conversation;
  }
  
  static async getUserConversations(
    userId: string,
    options: { type?: ConversationType; limit?: number; offset?: number } = {}
  ): Promise<IConversation[]> {
    await connectToDatabase();
    
    const query: any = {
      'participants.id': userId,
      'participants.isActive': true,
      status: { $ne: 'closed' },
    };
    
    if (options.type) {
      query.type = options.type;
    }
    
    return Conversation.find(query)
      .sort({ lastActivityAt: -1 })
      .skip(options.offset || 0)
      .limit(options.limit || 50);
  }
  
  static async getConversationById(
    conversationId: string,
    participantId: string
  ): Promise<IConversation | null> {
    await connectToDatabase();
    
    return Conversation.findOne({
      _id: new Types.ObjectId(conversationId),
      'participants.id': participantId,
      status: { $ne: 'closed' },
    });
  }
  
  static async findOrCreateDirectConversation(
    user1: { id: string; name: string; avatar?: string },
    user2: { id: string; name: string; avatar?: string }
  ): Promise<IConversation> {
    await connectToDatabase();
    
    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      type: 'user-to-user',
      status: { $ne: 'closed' },
      'participants.id': { $all: [user1.id, user2.id] },
      participants: { $size: 2 },
    });
    
    if (!conversation) {
      conversation = await this.createConversation({
        type: 'user-to-user',
        participants: [
          { id: user1.id, type: 'user', name: user1.name, avatar: user1.avatar },
          { id: user2.id, type: 'user', name: user2.name, avatar: user2.avatar },
        ],
      });
    }
    
    return conversation;
  }
  
  static async getOrCreateSupportConversation(
    userId: string,
    userName: string,
    userAvatar?: string
  ): Promise<IConversation> {
    await connectToDatabase();
    
    const settings = await MessagingSettings.getSettings();
    
    console.log(`🔍 [MessagingService] getOrCreateSupportConversation for user: ${userName} (${userId})`);
    console.log(`🔍 [MessagingService] AI Support enabled: ${settings.enableAISupport}`);
    
    // First, check if user has an assigned employee (account manager)
    let assignedEmployee: { id: string; name: string; avatar?: string } | null = null;
    try {
      const db = mongoose.connection.db;
      if (db) {
        const assignment = await db.collection('customer_assignments').findOne({
          customerId: userId,
          isActive: true,
        });
        
        console.log(`🔍 [MessagingService] Assignment found: ${assignment ? 'Yes' : 'No'}`);
        
        if (assignment?.employeeId) {
          const employee = await db.collection('admins').findOne({
            _id: new Types.ObjectId(assignment.employeeId),
            status: 'active',
          });
          
          if (employee) {
            assignedEmployee = {
              id: employee._id.toString(),
              name: employee.name || employee.email.split('@')[0],
              avatar: employee.profileImage,
            };
            console.log(`🔍 [MessagingService] Assigned employee: ${assignedEmployee.name}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ [MessagingService] Error checking customer assignment:', error);
    }
    
    // Find existing active support conversation
    let conversation = await Conversation.findOne({
      type: 'user-to-support',
      status: 'active',
      'participants.id': userId,
      'participants.type': 'user',
    });
    
    if (conversation) {
      console.log(`📦 [MessagingService] Found existing conversation: ${conversation._id}, isAIHandled: ${conversation.isAIHandled}, isResolved: ${(conversation as any).isResolved}`);
      
      // Handle resolved conversations - when customer sends new message, reopen with AI
      if ((conversation as any).isResolved) {
        console.log(`🔄 [MessagingService] Conversation was resolved, reopening with AI...`);
        
        // Reopen the conversation with AI handling (new request cycle)
        conversation.isAIHandled = settings.enableAISupport;
        (conversation as any).isResolved = false;
        (conversation as any).reopenedAt = new Date();
        await conversation.save();
        
        // Add system message about new request
        await this.sendMessage({
          conversationId: conversation._id.toString(),
          senderId: 'system',
          senderType: 'system',
          senderName: 'System',
          content: '🆕 New support request. Our AI assistant will help you first.',
          messageType: 'system',
        });
        
        // If AI is enabled, add AI greeting
        if (settings.enableAISupport) {
          await this.sendMessage({
            conversationId: conversation._id.toString(),
            senderId: 'ai',
            senderType: 'ai',
            senderName: 'AI Assistant',
            content: settings.aiGreeting || 'Hello! I\'m here to help. How can I assist you today?',
            messageType: 'text',
          });
        }
        
        console.log(`✅ [MessagingService] Conversation reopened, AI handling: ${conversation.isAIHandled}`);
      }
      
      // Store assigned employee info on conversation (for escalation later)
      // But DON'T disable AI - let AI handle until escalation
      if (assignedEmployee && !conversation.assignedEmployeeId) {
        conversation.assignedEmployeeId = new Types.ObjectId(assignedEmployee.id);
        conversation.assignedEmployeeName = assignedEmployee.name;
        // Keep isAIHandled as is - only change when escalated
        await conversation.save();
        console.log(`📦 [MessagingService] Updated assigned employee info (AI still handling)`);
      }
      
      return conversation;
    }
    
    console.log(`🆕 [MessagingService] Creating new support conversation`);
    
    // IMPORTANT: AI ALWAYS handles first if enabled, regardless of assigned employee
    // The assigned employee will take over when customer requests human assistance
    const shouldUseAI = settings.enableAISupport;
    
    conversation = await this.createConversation({
      type: 'user-to-support',
      participants: [{
        id: userId,
        type: 'user',
        name: userName,
        avatar: userAvatar,
      }],
      isAIHandled: shouldUseAI, // AI handles first if enabled
      // Store assigned employee info for later escalation
      assignedEmployeeId: assignedEmployee?.id,
      assignedEmployeeName: assignedEmployee?.name,
    });
    
    // If AI support is enabled, add AI as participant and send greeting
    if (shouldUseAI) {
      conversation.participants.push({
        id: 'ai-assistant',
        type: 'ai',
        name: 'AI Assistant',
        joinedAt: new Date(),
        isActive: true,
      });
      await conversation.save();
      
      // Send AI greeting
      await this.sendMessage({
        conversationId: conversation._id.toString(),
        senderId: 'ai-assistant',
        senderType: 'ai',
        senderName: 'AI Assistant',
        content: settings.aiGreetingMessage,
        messageType: 'ai-response',
      });
      console.log(`✅ [MessagingService] AI Support enabled - AI greeting sent`);
      
      // If there's an assigned employee, mention they're available
      if (assignedEmployee) {
        console.log(`📝 [MessagingService] Assigned employee ${assignedEmployee.name} ready for escalation`);
      }
    }
    // If AI is disabled but has assigned employee, add employee directly
    else if (assignedEmployee) {
      conversation.participants.push({
        id: assignedEmployee.id,
        type: 'employee',
        name: assignedEmployee.name,
        avatar: assignedEmployee.avatar,
        joinedAt: new Date(),
        isActive: true,
      });
      await conversation.save();
      
      // Send welcome message from assigned employee
      await this.sendMessage({
        conversationId: conversation._id.toString(),
        senderId: assignedEmployee.id,
        senderType: 'employee',
        senderName: assignedEmployee.name,
        senderAvatar: assignedEmployee.avatar,
        content: `Hello ${userName}! I'm ${assignedEmployee.name}, your dedicated account manager. How can I help you today?`,
        messageType: 'system',
      });
      console.log(`✅ [MessagingService] AI disabled - Employee handling directly`);
    }
    // No AI and no employee - just create empty conversation (waiting for support)
    else {
      console.log(`⚠️ [MessagingService] No AI and no assigned employee - customer waiting for support`);
    }
    
    return conversation;
  }
  
  // ==========================================
  // MESSAGES
  // ==========================================
  
  static async sendMessage(params: {
    conversationId: string;
    senderId: string;
    senderType: 'user' | 'employee' | 'ai' | 'system';
    senderName: string;
    senderAvatar?: string;
    content: string;
    messageType?: 'text' | 'image' | 'file' | 'audio' | 'system' | 'ai-response';
    attachments?: Array<{
      type: 'image' | 'file' | 'audio';
      url: string;
      filename: string;
      mimeType: string;
      size: number;
      thumbnailUrl?: string;
    }>;
    replyTo?: {
      messageId: string;
      content: string;
      senderName: string;
    };
  }): Promise<{ message: IMessage; conversation: IConversation }> {
    await connectToDatabase();
    
    const settings = await MessagingSettings.getSettings();
    
    // Rate limiting check
    const rateLimitKey = `msg:${params.senderId}`;
    const rateLimit = rateLimitMap.get(rateLimitKey);
    const now = Date.now();
    
    if (rateLimit) {
      if (now < rateLimit.resetAt) {
        if (rateLimit.count >= settings.messagesPerMinuteLimit) {
          throw new Error('Rate limit exceeded. Please slow down.');
        }
        rateLimit.count++;
      } else {
        rateLimitMap.set(rateLimitKey, { count: 1, resetAt: now + 60000 });
      }
    } else {
      rateLimitMap.set(rateLimitKey, { count: 1, resetAt: now + 60000 });
    }
    
    // Content moderation
    let moderatedContent = params.content;
    let isModerated = false;
    let moderationReason: string | undefined;
    
    if (params.senderType === 'user') {
      const moderation = settings.moderateContent(params.content);
      if (moderation.flags.some((f: string) => f.startsWith('BLOCKED'))) {
        throw new Error('Message blocked due to content policy violation.');
      }
      moderatedContent = moderation.content;
      isModerated = moderation.wasModified;
      if (moderation.flags.length > 0) {
        moderationReason = moderation.flags.join('; ');
      }
    }
    
    // Validate message length
    if (moderatedContent.length > settings.maxMessageLength) {
      throw new Error(`Message too long. Maximum ${settings.maxMessageLength} characters allowed.`);
    }
    
    // Create message
    const message = await Message.create({
      conversationId: new Types.ObjectId(params.conversationId),
      senderId: params.senderId,
      senderType: params.senderType,
      senderName: params.senderName,
      senderAvatar: params.senderAvatar,
      messageType: params.messageType || 'text',
      content: moderatedContent,
      attachments: params.attachments,
      replyTo: params.replyTo ? {
        messageId: new Types.ObjectId(params.replyTo.messageId),
        content: params.replyTo.content,
        senderName: params.replyTo.senderName,
      } : undefined,
      status: 'sent',
      readBy: [],
      deliveredTo: [],
      isModerated,
      moderationReason,
      originalContent: isModerated ? params.content : undefined,
    });
    
    // Update conversation
    const conversation = await Conversation.findByIdAndUpdate(
      params.conversationId,
      {
        $set: {
          lastMessage: {
            messageId: message._id,
            content: moderatedContent.substring(0, 100),
            senderId: params.senderId,
            senderName: params.senderName,
            senderType: params.senderType,
            timestamp: message.createdAt,
          },
          lastActivityAt: new Date(),
        },
      },
      { new: true }
    );
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    // Increment unread counts for other participants
    for (const participant of conversation.participants) {
      if (participant.id !== params.senderId && participant.isActive) {
        const currentCount = conversation.unreadCounts.get(participant.id) || 0;
        conversation.unreadCounts.set(participant.id, currentCount + 1);
      }
    }
    await conversation.save();
    
    // Stop typing indicator (wrapped in try-catch as this is non-critical)
    try {
      if (typeof UserPresence.stopTyping === 'function') {
        await UserPresence.stopTyping(params.senderId);
      }
    } catch (err) {
      console.warn('[MessagingService] Failed to stop typing indicator:', err instanceof Error ? err.message : err);
    }
    
    // Broadcast message to WebSocket for real-time delivery
    broadcastToWebSocket('message', {
      conversationId: params.conversationId,
      message: {
        id: message._id.toString(),
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: message.senderName,
        senderAvatar: message.senderAvatar,
        content: message.content,
        messageType: message.messageType,
        attachments: message.attachments,
        createdAt: message.createdAt,
        readBy: message.readBy,
      },
    });
    
    return { message, conversation };
  }
  
  static async getMessages(
    conversationId: string,
    options: { limit?: number; before?: Date; after?: Date } = {}
  ): Promise<IMessage[]> {
    await connectToDatabase();
    
    const query: any = {
      conversationId: new Types.ObjectId(conversationId),
      // Include messages where isDeleted is false OR not set (for legacy messages)
      $or: [
        { isDeleted: false },
        { isDeleted: { $exists: false } },
      ],
    };
    
    if (options.before) {
      query.createdAt = { $lt: options.before };
    }
    if (options.after) {
      query.createdAt = { ...query.createdAt, $gt: options.after };
    }
    
    return Message.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  }
  
  static async markMessagesAsRead(
    conversationId: string,
    participantId: string,
    participantName: string
  ): Promise<void> {
    await connectToDatabase();
    
    // Mark all unread messages as read
    await Message.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: participantId },
        'readBy.participantId': { $ne: participantId },
      },
      {
        $push: {
          readBy: {
            participantId,
            participantName,
            readAt: new Date(),
          },
        },
        $set: { status: 'read' },
      }
    );
    
    // Reset unread count in conversation
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      conversation.unreadCounts.set(participantId, 0);
      await conversation.save();
    }
  }
  
  // ==========================================
  // FRIEND SYSTEM
  // ==========================================
  
  static async sendFriendRequest(
    fromUser: { id: string; name: string; avatar?: string },
    toUser: { id: string; name: string; avatar?: string },
    message?: string
  ): Promise<IFriendRequest> {
    await connectToDatabase();
    
    const settings = await MessagingSettings.getSettings();
    
    // Check if already friends
    const areFriends = await Friendship.areFriends(fromUser.id, toUser.id);
    if (areFriends) {
      throw new Error('You are already friends with this user.');
    }
    
    // Check for existing pending request
    const hasPending = await FriendRequest.hasPendingRequest(fromUser.id, toUser.id);
    if (hasPending) {
      throw new Error('A friend request already exists between you and this user.');
    }
    
    // Check friend request rate limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestsToday = await FriendRequest.countDocuments({
      fromUserId: fromUser.id,
      createdAt: { $gte: today },
    });
    
    if (requestsToday >= settings.friendRequestsPerDayLimit) {
      throw new Error('Daily friend request limit reached. Please try again tomorrow.');
    }
    
    const request = await FriendRequest.create({
      fromUserId: fromUser.id,
      fromUserName: fromUser.name,
      fromUserAvatar: fromUser.avatar,
      toUserId: toUser.id,
      toUserName: toUser.name,
      toUserAvatar: toUser.avatar,
      message,
      status: 'pending',
    });
    
    return request;
  }
  
  static async respondToFriendRequest(
    requestId: string,
    response: 'accept' | 'decline',
    userId: string
  ): Promise<{ request: IFriendRequest; friendship?: IFriendship }> {
    await connectToDatabase();
    
    const request = await FriendRequest.findById(requestId);
    if (!request) {
      throw new Error('Friend request not found.');
    }
    
    if (request.toUserId !== userId) {
      throw new Error('You cannot respond to this friend request.');
    }
    
    if (request.status !== 'pending') {
      throw new Error('This friend request has already been responded to.');
    }
    
    request.status = response === 'accept' ? 'accepted' : 'declined';
    request.respondedAt = new Date();
    await request.save();
    
    let friendship: IFriendship | undefined;
    
    if (response === 'accept') {
      // Check max friends limit
      const settings = await MessagingSettings.getSettings();
      const currentFriendsCount = await Friendship.countDocuments({
        users: userId,
        blockedBy: { $exists: false },
      });
      
      if (currentFriendsCount >= settings.maxFriendsPerUser) {
        throw new Error('Maximum friends limit reached.');
      }
      
      friendship = await Friendship.createFromRequest(request);
    }
    
    return { request, friendship };
  }
  
  static async cancelFriendRequest(requestId: string, userId: string): Promise<IFriendRequest> {
    await connectToDatabase();
    
    const request = await FriendRequest.findById(requestId);
    if (!request) {
      throw new Error('Friend request not found.');
    }
    
    if (request.fromUserId !== userId) {
      throw new Error('You cannot cancel this friend request.');
    }
    
    if (request.status !== 'pending') {
      throw new Error('This friend request cannot be cancelled.');
    }
    
    request.status = 'cancelled';
    request.respondedAt = new Date();
    await request.save();
    
    return request;
  }
  
  static async getFriends(userId: string): Promise<IFriendship[]> {
    await connectToDatabase();
    return Friendship.getUserFriends(userId);
  }
  
  static async getPendingFriendRequests(userId: string): Promise<{
    received: IFriendRequest[];
    sent: IFriendRequest[];
  }> {
    await connectToDatabase();
    
    const [received, sent] = await Promise.all([
      FriendRequest.findPendingForUser(userId),
      FriendRequest.findSentByUser(userId),
    ]);
    
    return { received, sent };
  }
  
  static async removeFriend(userId: string, friendId: string): Promise<void> {
    await connectToDatabase();
    
    const sortedUsers = [userId, friendId].sort();
    await Friendship.deleteOne({ users: sortedUsers });
  }
  
  static async blockUser(userId: string, blockedUserId: string): Promise<IFriendship | null> {
    await connectToDatabase();
    
    let friendship = await Friendship.getFriendship(userId, blockedUserId);
    
    if (friendship) {
      await friendship.block(userId);
    } else {
      // Create a blocked relationship even if not friends
      friendship = await Friendship.create({
        users: [userId, blockedUserId].sort(),
        userDetails: [
          { userId, userName: 'Unknown', userAvatar: undefined },
          { userId: blockedUserId, userName: 'Unknown', userAvatar: undefined },
        ],
        blockedBy: userId,
        blockedAt: new Date(),
        mutedBy: [],
      });
    }
    
    return friendship;
  }
  
  static async unblockUser(userId: string, blockedUserId: string): Promise<void> {
    await connectToDatabase();
    
    const friendship = await Friendship.getFriendship(userId, blockedUserId);
    if (friendship && friendship.blockedBy === userId) {
      await friendship.unblock();
    }
  }
  
  // ==========================================
  // SUPPORT CHAT MANAGEMENT
  // ==========================================
  
  static async transferConversation(
    conversationId: string,
    toEmployeeId: string,
    toEmployeeName: string,
    toEmployeeEmail: string,
    reason?: string,
    transferredBy?: { id: string; name: string }
  ): Promise<IConversation> {
    await connectToDatabase();
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }
    
    if (conversation.type !== 'user-to-support') {
      throw new Error('Only support conversations can be transferred.');
    }
    
    const previousEmployeeId = conversation.assignedEmployeeId?.toString();
    const previousEmployeeName = conversation.assignedEmployeeName;
    
    // Store original employee if this is the first transfer
    if (!conversation.originalEmployeeId && conversation.assignedEmployeeId) {
      conversation.originalEmployeeId = conversation.assignedEmployeeId;
    }
    
    // Update assignment
    conversation.assignedEmployeeId = new Types.ObjectId(toEmployeeId);
    conversation.assignedEmployeeName = toEmployeeName;
    
    // Remove AI handling
    conversation.isAIHandled = false;
    conversation.aiHandledUntil = new Date();
    
    // Remove old employee from participants if present
    if (previousEmployeeId) {
      const oldParticipant = conversation.participants.find(
        p => p.id === previousEmployeeId && p.type === 'employee'
      );
      if (oldParticipant) {
        oldParticipant.isActive = false;
        oldParticipant.leftAt = new Date();
      }
    }
    
    // Add new employee to participants
    const existingParticipant = conversation.participants.find(p => p.id === toEmployeeId);
    if (existingParticipant) {
      existingParticipant.isActive = true;
      existingParticipant.leftAt = undefined;
    } else {
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
      fromEmployeeId: previousEmployeeId || 'none',
      fromEmployeeName: previousEmployeeName || 'AI/None',
      toEmployeeId,
      toEmployeeName,
      reason,
      transferredAt: new Date(),
    });
    
    await conversation.save();
    
    // Send system message about transfer
    await this.sendMessage({
      conversationId,
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      content: `Conversation transferred to ${toEmployeeName}${reason ? `: ${reason}` : ''}`,
      messageType: 'system',
    });
    
    return conversation;
  }
  
  static async escalateFromAI(
    conversationId: string,
    reason: string
  ): Promise<IConversation> {
    await connectToDatabase();
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }
    
    console.log(`🤖→👤 [escalateFromAI] Conversation: ${conversationId}, Reason: ${reason}`);
    
    // Get the user from participants
    const userParticipant = conversation.participants.find(p => p.type === 'user');
    const userId = userParticipant?.id;
    
    // Find employee to assign - priority order:
    // 1. Already assigned employee on conversation
    // 2. Customer assignment record
    // 3. Any available support staff
    let assignedEmployee: { id: string; name: string; avatar?: string } | null = null;
    
    const db = mongoose.connection.db;
    if (db && userId) {
      // Priority 1: Use existing assigned employee on conversation
      if (conversation.assignedEmployeeId) {
        const emp = await db.collection('admins').findOne({
          _id: conversation.assignedEmployeeId,
          status: 'active',
          isAvailableForChat: { $ne: false },
        });
        if (emp) {
          assignedEmployee = {
            id: emp._id.toString(),
            name: emp.name || emp.email?.split('@')[0],
            avatar: emp.profileImage,
          };
          console.log(`🤖→👤 [escalateFromAI] Using pre-assigned employee: ${assignedEmployee.name}`);
        }
      }
      
      // Priority 2: Check customer_assignments
      if (!assignedEmployee) {
        const assignment = await db.collection('customer_assignments').findOne({
          customerId: userId,
          isActive: true,
        });
        
        if (assignment?.employeeId) {
          const emp = await db.collection('admins').findOne({
            _id: new Types.ObjectId(assignment.employeeId),
            status: 'active',
            isAvailableForChat: { $ne: false },
          });
          if (emp) {
            assignedEmployee = {
              id: emp._id.toString(),
              name: emp.name || emp.email?.split('@')[0],
              avatar: emp.profileImage,
            };
            console.log(`🤖→👤 [escalateFromAI] Using customer assignment: ${assignedEmployee.name}`);
          }
        }
      }
      
      // Priority 3: Find any available support staff
      if (!assignedEmployee) {
        const emp = await db.collection('admins').findOne({
          status: 'active',
          role: { $in: ['Backoffice', 'Support Agent', 'Full Admin'] },
          isLockedOut: { $ne: true },
          isAvailableForChat: { $ne: false },
        });
        if (emp) {
          assignedEmployee = {
            id: emp._id.toString(),
            name: emp.name || emp.email?.split('@')[0],
            avatar: emp.profileImage,
          };
          console.log(`🤖→👤 [escalateFromAI] Using fallback support: ${assignedEmployee.name}`);
        }
      }
    }
    
    // Mark AI as no longer handling
    conversation.isAIHandled = false;
    conversation.aiHandledUntil = new Date();
    
    // Assign employee
    if (assignedEmployee) {
      conversation.assignedEmployeeId = new Types.ObjectId(assignedEmployee.id);
      conversation.assignedEmployeeName = assignedEmployee.name;
      
      // Add employee as participant if not already present
      const isParticipant = conversation.participants.some(
        p => p.id === assignedEmployee!.id && p.type === 'employee'
      );
      
      if (!isParticipant) {
        conversation.participants.push({
          id: assignedEmployee.id,
          type: 'employee',
          name: assignedEmployee.name,
          avatar: assignedEmployee.avatar,
          joinedAt: new Date(),
          isActive: true,
        });
      }
    }
    
    // Remove AI from active participants
    const aiParticipant = conversation.participants.find(p => p.id === 'ai-assistant');
    if (aiParticipant) {
      aiParticipant.isActive = false;
      aiParticipant.leftAt = new Date();
    }
    
    await conversation.save();
    
    // Build transfer message
    const employeeName = assignedEmployee?.name || 'our support team';
    const transferMessage = reason === 'User requested'
      ? `I'm connecting you with ${employeeName}. They'll be with you shortly!`
      : `I'm transferring you to ${employeeName} who will be able to assist you further. They'll be with you shortly!`;
    
    // Send AI farewell message
    await this.sendMessage({
      conversationId,
      senderId: 'ai-assistant',
      senderType: 'ai',
      senderName: 'AI Assistant',
      content: transferMessage,
      messageType: 'system',
    });
    
    // Notify employee
    if (assignedEmployee) {
      const { wsNotifier } = await import('@/lib/services/messaging/websocket-notifier');
      wsNotifier.notifyEmployeeNewChat(assignedEmployee.id, {
        conversationId,
        customerName: userParticipant?.name || 'Customer',
        customerId: userId || '',
        reason,
      });
    }
    
    console.log(`🤖→👤 [escalateFromAI] Escalated to ${employeeName}`);
    
    return conversation;
  }
  
  // ==========================================
  // PRESENCE
  // ==========================================
  
  static async setPresence(
    participantId: string,
    participantType: 'user' | 'employee',
    status: 'online' | 'away' | 'busy' | 'offline',
    deviceInfo?: { platform?: string; browser?: string; lastIp?: string }
  ): Promise<void> {
    await connectToDatabase();
    
    if (status === 'offline') {
      await UserPresence.setOffline(participantId);
    } else {
      await UserPresence.setOnline(participantId, participantType, deviceInfo);
      if (status !== 'online') {
        await UserPresence.findOneAndUpdate(
          { participantId },
          { $set: { status } }
        );
      }
    }
  }
  
  static async setTyping(participantId: string, conversationId: string): Promise<void> {
    await connectToDatabase();
    try {
      if (typeof UserPresence.setTyping === 'function') {
        await UserPresence.setTyping(participantId, conversationId);
      }
    } catch (err) {
      console.warn('[MessagingService] setTyping error:', err instanceof Error ? err.message : err);
    }
  }
  
  static async stopTyping(participantId: string): Promise<void> {
    await connectToDatabase();
    try {
      if (typeof UserPresence.stopTyping === 'function') {
        await UserPresence.stopTyping(participantId);
      }
    } catch (err) {
      console.warn('[MessagingService] stopTyping error:', err instanceof Error ? err.message : err);
    }
  }
  
  static async heartbeat(participantId: string): Promise<void> {
    await connectToDatabase();
    try {
      if (typeof UserPresence.heartbeat === 'function') {
        await UserPresence.heartbeat(participantId);
      }
    } catch (err) {
      console.warn('[MessagingService] heartbeat error:', err instanceof Error ? err.message : err);
    }
  }
  
  // ==========================================
  // SETTINGS
  // ==========================================
  
  static async getSettings(): Promise<IMessagingSettings> {
    await connectToDatabase();
    return MessagingSettings.getSettings();
  }
  
  static async updateSettings(
    updates: Partial<IMessagingSettings>
  ): Promise<IMessagingSettings> {
    await connectToDatabase();
    return MessagingSettings.updateSettings(updates);
  }
  
  // ==========================================
  // SEARCH
  // ==========================================
  
  static async searchMessages(
    participantId: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<IMessage[]> {
    await connectToDatabase();
    return Message.searchMessages(participantId, searchTerm, { limit });
  }
  
  static async searchUsers(
    query: string,
    excludeUserId: string,
    limit: number = 20
  ): Promise<Array<{ id: string; name: string; avatar?: string }>> {
    await connectToDatabase();
    
    // Query users collection directly (managed by better-auth)
    const db = mongoose.connection.db;
    if (!db) {
      return [];
    }
    
    const usersCollection = db.collection('user');
    const users = await usersCollection.find({
      _id: { $ne: new Types.ObjectId(excludeUserId) },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    })
      .project({ _id: 1, name: 1, email: 1, image: 1 })
      .limit(limit)
      .toArray();
    
    return users.map(u => ({
      id: u._id.toString(),
      name: u.name || u.email,
      avatar: u.image,
    }));
  }
  
  // ==========================================
  // STATISTICS
  // ==========================================
  
  static async getUnreadCount(participantId: string): Promise<number> {
    await connectToDatabase();
    
    const conversations = await Conversation.find({
      'participants.id': participantId,
      'participants.isActive': true,
      status: { $ne: 'closed' },
    });
    
    let totalUnread = 0;
    for (const conv of conversations) {
      totalUnread += conv.unreadCounts.get(participantId) || 0;
    }
    
    return totalUnread;
  }
  
  static async getEmployeeSupportStats(employeeId: string): Promise<{
    activeChats: number;
    totalMessages: number;
    avgResponseTime: number;
  }> {
    await connectToDatabase();
    
    const activeChats = await Conversation.countDocuments({
      assignedEmployeeId: new Types.ObjectId(employeeId),
      type: 'user-to-support',
      status: 'active',
    });
    
    // Get conversations for this employee
    const conversations = await Conversation.find({
      assignedEmployeeId: new Types.ObjectId(employeeId),
      type: 'user-to-support',
    }).select('_id');
    
    const conversationIds = conversations.map(c => c._id);
    
    const totalMessages = await Message.countDocuments({
      conversationId: { $in: conversationIds },
      senderId: employeeId,
    });
    
    // TODO: Calculate average response time
    const avgResponseTime = 0;
    
    return { activeChats, totalMessages, avgResponseTime };
  }
}

export default MessagingService;

