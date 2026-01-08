import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';

// Messaging Settings Schema
const MessagingSettingsSchema = new mongoose.Schema({
  // AI Customer Support
  enableAISupport: { type: Boolean, default: false },
  aiGreetingMessage: {
    type: String,
    default: "Hello! I'm your AI assistant. How can I help you today?",
  },
  aiEscalationKeywords: {
    type: [String],
    default: ['human', 'agent', 'person', 'real person', 'talk to someone', 'representative'],
  },
  aiMaxResponsesBeforeEscalation: { type: Number, default: 10 },
  aiSystemPrompt: { type: String },
  aiKnowledgeBaseEnabled: { type: Boolean, default: true },
  
  // Auto-routing
  autoAssignToEmployeeEnabled: { type: Boolean, default: true },
  autoAssignToRoleIfUnassigned: { type: [String], default: ['Backoffice', 'Support'] },
  roundRobinEnabled: { type: Boolean, default: true },
  maxConcurrentChatsPerEmployee: { type: Number, default: 10 },
  
  // Notifications
  notifyEmployeeOnNewMessage: { type: Boolean, default: true },
  notifyEmployeeOnTransfer: { type: Boolean, default: true },
  notifyUserOnEmployeeReply: { type: Boolean, default: true },
  notifyUserOnTransfer: { type: Boolean, default: true },
  unreadReminderAfterMinutes: { type: Number, default: 5 },
  
  // User-to-user
  allowUserToUserChat: { type: Boolean, default: true },
  requireFriendshipForChat: { type: Boolean, default: true },
  maxFriendsPerUser: { type: Number, default: 500 },
  
  // File sharing
  allowFileSharing: { type: Boolean, default: true },
  allowedFileTypes: { type: [String], default: ['image/jpeg', 'image/png', 'application/pdf'] },
  maxFileSizeMB: { type: Number, default: 10 },
  maxFilesPerMessage: { type: Number, default: 5 },
  
  // Content moderation
  enableContentModeration: { type: Boolean, default: true },
  blockLinksInUserMessages: { type: Boolean, default: false },
  
  // Rate limiting
  messagesPerMinuteLimit: { type: Number, default: 30 },
  friendRequestsPerDayLimit: { type: Number, default: 50 },
  
  // Data retention
  messageRetentionDays: { type: Number, default: 0 },
  
  // Working hours
  enableWorkingHours: { type: Boolean, default: false },
  workingHoursStart: { type: String, default: '09:00' },
  workingHoursEnd: { type: String, default: '18:00' },
  workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  workingHoursTimezone: { type: String, default: 'UTC' },
  outsideHoursMessage: { type: String, default: "We're currently outside working hours." },
  
  // Misc
  welcomeMessageForNewUsers: { type: String },
  maxMessageLength: { type: Number, default: 4000 },
  enableTypingIndicators: { type: Boolean, default: true },
  enableReadReceipts: { type: Boolean, default: true },
  enableOnlineStatus: { type: Boolean, default: true },
}, {
  timestamps: true,
  collection: 'messaging_settings',
});

/**
 * GET /api/messaging/settings
 * Get messaging settings
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'default-secret';
    verify(token, jwtSecret);

    await connectToDatabase();

    const MessagingSettings = mongoose.models.MessagingSettings || 
      mongoose.model('MessagingSettings', MessagingSettingsSchema);

    let settings = await MessagingSettings.findOne();
    if (!settings) {
      settings = await MessagingSettings.create({});
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching messaging settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/messaging/settings
 * Update messaging settings
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'default-secret';
    const decoded = verify(token, jwtSecret) as {
      id: string;
      email: string;
      isSuperAdmin?: boolean;
    };

    // Only super admin can change settings
    if (!decoded.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admin can modify messaging settings' },
        { status: 403 }
      );
    }

    const body = await request.json();

    await connectToDatabase();

    const MessagingSettings = mongoose.models.MessagingSettings || 
      mongoose.model('MessagingSettings', MessagingSettingsSchema);

    let settings = await MessagingSettings.findOne();
    if (settings) {
      Object.assign(settings, body);
      await settings.save();
    } else {
      settings = await MessagingSettings.create(body);
    }

    console.log(`✅ [Messaging Settings] Updated by ${decoded.email}`);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating messaging settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

