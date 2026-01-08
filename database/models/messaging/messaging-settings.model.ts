import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IContentModerationRule {
  pattern: string;      // Regex pattern
  action: 'block' | 'flag' | 'replace';
  replacement?: string; // For 'replace' action
  reason: string;
  isEnabled: boolean;
}

export interface IMessagingSettings extends Document {
  // ==========================================
  // AI CUSTOMER SUPPORT
  // ==========================================
  enableAISupport: boolean;
  aiGreetingMessage: string;
  aiEscalationKeywords: string[]; // Words that trigger transfer to human
  aiMaxResponsesBeforeEscalation: number; // Auto-escalate after N AI responses
  aiConfidenceThresholdForEscalation: number; // 0-1, escalate if below
  aiSystemPrompt?: string; // Custom system prompt for AI
  aiKnowledgeBaseEnabled: boolean; // Use knowledge base for responses
  
  // ==========================================
  // AUTO-ROUTING
  // ==========================================
  autoAssignToEmployeeEnabled: boolean; // Route to customer's assigned employee
  autoAssignToRoleIfUnassigned: string[]; // Roles to assign if no employee assigned
  roundRobinEnabled: boolean; // Distribute evenly among available employees
  maxConcurrentChatsPerEmployee: number;
  
  // ==========================================
  // NOTIFICATION SETTINGS
  // ==========================================
  notifyEmployeeOnNewMessage: boolean;
  notifyEmployeeOnTransfer: boolean;
  notifyUserOnEmployeeReply: boolean;
  notifyUserOnTransfer: boolean;
  unreadReminderAfterMinutes: number; // Remind employee of unread after N minutes
  
  // ==========================================
  // USER-TO-USER SETTINGS
  // ==========================================
  allowUserToUserChat: boolean;
  requireFriendshipForChat: boolean;
  maxFriendsPerUser: number;
  
  // ==========================================
  // FILE SHARING
  // ==========================================
  allowFileSharing: boolean;
  allowedFileTypes: string[]; // e.g., ['image/jpeg', 'image/png', 'application/pdf']
  maxFileSizeMB: number;
  maxFilesPerMessage: number;
  
  // ==========================================
  // CONTENT MODERATION
  // ==========================================
  enableContentModeration: boolean;
  moderationRules: IContentModerationRule[];
  blockLinksInUserMessages: boolean;
  
  // ==========================================
  // RATE LIMITING
  // ==========================================
  messagesPerMinuteLimit: number;
  friendRequestsPerDayLimit: number;
  
  // ==========================================
  // DATA RETENTION
  // ==========================================
  messageRetentionDays: number; // 0 = keep forever
  deletedMessageRetentionDays: number; // Days to keep deleted messages
  
  // ==========================================
  // WORKING HOURS (for support)
  // ==========================================
  enableWorkingHours: boolean;
  workingHoursStart: string; // "09:00"
  workingHoursEnd: string;   // "18:00"
  workingDays: number[];     // 0=Sun, 1=Mon, ... 6=Sat
  workingHoursTimezone: string; // e.g., "Europe/London"
  outsideHoursMessage: string;
  
  // ==========================================
  // MISC
  // ==========================================
  welcomeMessageForNewUsers?: string;
  maxMessageLength: number;
  enableTypingIndicators: boolean;
  enableReadReceipts: boolean;
  enableOnlineStatus: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ContentModerationRuleSchema = new Schema<IContentModerationRule>(
  {
    pattern: { type: String, required: true },
    action: { type: String, enum: ['block', 'flag', 'replace'], required: true },
    replacement: { type: String },
    reason: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const MessagingSettingsSchema = new Schema<IMessagingSettings>(
  {
    // AI Customer Support
    enableAISupport: { type: Boolean, default: false },
    aiGreetingMessage: {
      type: String,
      default: "Hello! I'm your AI assistant. How can I help you today? If you need to speak with a human agent, just let me know.",
    },
    aiEscalationKeywords: {
      type: [String],
      default: ['human', 'agent', 'person', 'real person', 'talk to someone', 'representative', 'support agent', 'live chat'],
    },
    aiMaxResponsesBeforeEscalation: { type: Number, default: 10 },
    aiConfidenceThresholdForEscalation: { type: Number, default: 0.3 },
    aiSystemPrompt: { type: String },
    aiKnowledgeBaseEnabled: { type: Boolean, default: true },
    
    // Auto-routing
    autoAssignToEmployeeEnabled: { type: Boolean, default: true },
    autoAssignToRoleIfUnassigned: {
      type: [String],
      default: ['Backoffice', 'Support'],
    },
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
    allowedFileTypes: {
      type: [String],
      default: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    },
    maxFileSizeMB: { type: Number, default: 10 },
    maxFilesPerMessage: { type: Number, default: 5 },
    
    // Content moderation
    enableContentModeration: { type: Boolean, default: true },
    moderationRules: {
      type: [ContentModerationRuleSchema],
      default: [
        {
          pattern: '\\b(fuck|shit|ass|damn|bitch)\\b',
          action: 'replace',
          replacement: '***',
          reason: 'Profanity filter',
          isEnabled: true,
        },
      ],
    },
    blockLinksInUserMessages: { type: Boolean, default: false },
    
    // Rate limiting
    messagesPerMinuteLimit: { type: Number, default: 30 },
    friendRequestsPerDayLimit: { type: Number, default: 50 },
    
    // Data retention
    messageRetentionDays: { type: Number, default: 0 }, // 0 = forever
    deletedMessageRetentionDays: { type: Number, default: 30 },
    
    // Working hours
    enableWorkingHours: { type: Boolean, default: false },
    workingHoursStart: { type: String, default: '09:00' },
    workingHoursEnd: { type: String, default: '18:00' },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // Mon-Fri
    workingHoursTimezone: { type: String, default: 'UTC' },
    outsideHoursMessage: {
      type: String,
      default: "We're currently outside of our working hours. We'll respond to your message as soon as possible during our next business day.",
    },
    
    // Misc
    welcomeMessageForNewUsers: { type: String },
    maxMessageLength: { type: Number, default: 4000 },
    enableTypingIndicators: { type: Boolean, default: true },
    enableReadReceipts: { type: Boolean, default: true },
    enableOnlineStatus: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'messaging_settings',
  }
);

// Singleton pattern - only one settings document
MessagingSettingsSchema.statics.getSettings = async function(): Promise<IMessagingSettings> {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

MessagingSettingsSchema.statics.updateSettings = async function(
  updates: Partial<IMessagingSettings>
): Promise<IMessagingSettings> {
  const settings = await this.findOne();
  if (settings) {
    Object.assign(settings, updates);
    return settings.save();
  }
  return this.create(updates);
};

// Helper methods
MessagingSettingsSchema.methods.isWithinWorkingHours = function(): boolean {
  if (!this.enableWorkingHours) return true;
  
  const now = new Date();
  // Convert to working hours timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: this.workingHoursTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const timeStr = now.toLocaleTimeString('en-US', options);
  const dayOfWeek = new Date(
    now.toLocaleString('en-US', { timeZone: this.workingHoursTimezone })
  ).getDay();
  
  if (!this.workingDays.includes(dayOfWeek)) return false;
  
  const currentTime = timeStr.replace(':', '');
  const startTime = this.workingHoursStart.replace(':', '');
  const endTime = this.workingHoursEnd.replace(':', '');
  
  return currentTime >= startTime && currentTime <= endTime;
};

MessagingSettingsSchema.methods.shouldEscalateAI = function(
  messageContent: string,
  aiResponseCount: number,
  confidence?: number
): { shouldEscalate: boolean; reason?: string } {
  // Check keywords
  const lowerContent = messageContent.toLowerCase();
  for (const keyword of this.aiEscalationKeywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return { shouldEscalate: true, reason: `User requested: "${keyword}"` };
    }
  }
  
  // Check response count
  if (aiResponseCount >= this.aiMaxResponsesBeforeEscalation) {
    return { shouldEscalate: true, reason: 'Maximum AI responses reached' };
  }
  
  // Check confidence
  if (confidence !== undefined && confidence < this.aiConfidenceThresholdForEscalation) {
    return { shouldEscalate: true, reason: 'Low AI confidence' };
  }
  
  return { shouldEscalate: false };
};

MessagingSettingsSchema.methods.moderateContent = function(
  content: string
): { content: string; wasModified: boolean; flags: string[] } {
  if (!this.enableContentModeration) {
    return { content, wasModified: false, flags: [] };
  }
  
  let moderatedContent = content;
  let wasModified = false;
  const flags: string[] = [];
  
  for (const rule of this.moderationRules) {
    if (!rule.isEnabled) continue;
    
    const regex = new RegExp(rule.pattern, 'gi');
    if (regex.test(content)) {
      if (rule.action === 'block') {
        flags.push(`BLOCKED: ${rule.reason}`);
      } else if (rule.action === 'replace' && rule.replacement) {
        moderatedContent = moderatedContent.replace(regex, rule.replacement);
        wasModified = true;
      } else if (rule.action === 'flag') {
        flags.push(`FLAGGED: ${rule.reason}`);
      }
    }
  }
  
  return { content: moderatedContent, wasModified, flags };
};

interface MessagingSettingsModel extends Model<IMessagingSettings> {
  getSettings(): Promise<IMessagingSettings>;
  updateSettings(updates: Partial<IMessagingSettings>): Promise<IMessagingSettings>;
}

export const MessagingSettings = mongoose.models.MessagingSettings ||
  mongoose.model<IMessagingSettings, MessagingSettingsModel>(
    'MessagingSettings',
    MessagingSettingsSchema
  );

export default MessagingSettings;

