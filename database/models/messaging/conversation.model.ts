import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ConversationType = 
  | 'user-to-user'      // Friend chat
  | 'user-to-support'   // Customer support
  | 'employee-internal' // Employee to employee
  | 'group';            // Future: group chats

export type ConversationStatus = 
  | 'active'
  | 'archived'
  | 'closed';

export interface IParticipant {
  id: string;
  type: 'user' | 'employee' | 'ai';
  name: string;
  avatar?: string;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
}

export interface ILastMessage {
  messageId: Types.ObjectId;
  content: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'employee' | 'ai' | 'system';
  timestamp: Date;
}

export interface IConversation extends Document {
  type: ConversationType;
  status: ConversationStatus;
  
  // Participants
  participants: IParticipant[];
  
  // For support conversations
  assignedEmployeeId?: Types.ObjectId;
  assignedEmployeeName?: string;
  originalEmployeeId?: Types.ObjectId; // For temporary redirection tracking
  originalEmployeeName?: string;
  temporarilyRedirected?: boolean;
  redirectedAt?: Date;
  
  // AI handling
  isAIHandled: boolean;
  aiHandledUntil?: Date; // When AI stopped handling
  
  // Ticket system (for support conversations)
  ticketNumber?: string;
  customerId?: string;
  customerName?: string;
  
  // Last message preview
  lastMessage?: ILastMessage;
  
  // Metadata
  title?: string; // For group chats or custom titles
  metadata?: {
    transferHistory?: Array<{
      fromEmployeeId: string;
      fromEmployeeName: string;
      toEmployeeId: string;
      toEmployeeName: string;
      reason?: string;
      transferredAt: Date;
    }>;
    tags?: string[];
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    category?: string;
    [key: string]: any;
  };
  
  // Unread counts per participant
  unreadCounts: Map<string, number>;
  
  // Soft delete tracking (per user)
  deletedByUsers: string[];  // Users who deleted this conversation from their view
  messagesClearedByUsers: string[];  // Users who cleared messages
  userDeletedAt?: Map<string, Date>;  // When each user deleted
  userClearedAt?: Map<string, Date>;  // When each user cleared messages
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['user', 'employee', 'ai'], required: true },
    name: { type: String, required: true },
    avatar: { type: String },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const LastMessageSchema = new Schema<ILastMessage>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    content: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderType: { type: String, enum: ['user', 'employee', 'ai', 'system'], required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['user-to-user', 'user-to-support', 'employee-internal', 'group'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'closed'],
      default: 'active',
      index: true,
    },
    
    participants: [ParticipantSchema],
    
    assignedEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      index: true,
    },
    assignedEmployeeName: { type: String },
    originalEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
    originalEmployeeName: { type: String },
    temporarilyRedirected: {
      type: Boolean,
      default: false,
    },
    redirectedAt: { type: Date },
    
    isAIHandled: {
      type: Boolean,
      default: false,
    },
    aiHandledUntil: { type: Date },
    
    // Ticket system (for support conversations)
    ticketNumber: { type: String, index: true },
    customerId: { type: String, index: true },
    customerName: { type: String },
    
    lastMessage: LastMessageSchema,
    
    title: { type: String },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    
    unreadCounts: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    
    // Soft delete tracking (per user)
    deletedByUsers: {
      type: [String],
      default: [],
      index: true,
    },
    messagesClearedByUsers: {
      type: [String],
      default: [],
    },
    userDeletedAt: {
      type: Map,
      of: Date,
      default: new Map(),
    },
    userClearedAt: {
      type: Map,
      of: Date,
      default: new Map(),
    },
    
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  }
);

// Indexes for efficient queries
ConversationSchema.index({ 'participants.id': 1, status: 1 });
ConversationSchema.index({ 'participants.id': 1, deletedByUsers: 1 });
ConversationSchema.index({ assignedEmployeeId: 1, status: 1 });
ConversationSchema.index({ type: 1, status: 1, lastActivityAt: -1 });
ConversationSchema.index({ isAIHandled: 1, type: 1 });

// Static methods
ConversationSchema.statics.findByParticipant = function(
  participantId: string,
  options: { type?: ConversationType; status?: ConversationStatus } = {}
) {
  const query: any = { 'participants.id': participantId, 'participants.isActive': true };
  if (options.type) query.type = options.type;
  if (options.status) query.status = options.status;
  else query.status = { $ne: 'closed' };
  
  return this.find(query).sort({ lastActivityAt: -1 });
};

ConversationSchema.statics.findDirectConversation = function(
  participant1Id: string,
  participant2Id: string
) {
  return this.findOne({
    type: 'user-to-user',
    status: { $ne: 'closed' },
    'participants.id': { $all: [participant1Id, participant2Id] },
    participants: { $size: 2 },
  });
};

ConversationSchema.statics.findOrCreateSupportConversation = async function(
  userId: string,
  userName: string,
  userAvatar?: string
) {
  // Find existing active support conversation
  let conversation = await this.findOne({
    type: 'user-to-support',
    status: 'active',
    'participants.id': userId,
    'participants.type': 'user',
  });
  
  if (!conversation) {
    conversation = await this.create({
      type: 'user-to-support',
      status: 'active',
      participants: [{
        id: userId,
        type: 'user',
        name: userName,
        avatar: userAvatar,
        joinedAt: new Date(),
        isActive: true,
      }],
      isAIHandled: false, // Will be set based on settings
      unreadCounts: new Map(),
    });
  }
  
  return conversation;
};

// Instance methods
ConversationSchema.methods.addParticipant = function(
  participant: Omit<IParticipant, 'joinedAt' | 'isActive'>
) {
  const existing = this.participants.find((p: IParticipant) => p.id === participant.id);
  if (existing) {
    existing.isActive = true;
    existing.leftAt = undefined;
  } else {
    this.participants.push({
      ...participant,
      joinedAt: new Date(),
      isActive: true,
    });
  }
  return this.save();
};

ConversationSchema.methods.removeParticipant = function(participantId: string) {
  const participant = this.participants.find((p: IParticipant) => p.id === participantId);
  if (participant) {
    participant.isActive = false;
    participant.leftAt = new Date();
  }
  return this.save();
};

ConversationSchema.methods.incrementUnread = function(participantId: string) {
  const current = this.unreadCounts.get(participantId) || 0;
  this.unreadCounts.set(participantId, current + 1);
  return this.save();
};

ConversationSchema.methods.markAsRead = function(participantId: string) {
  this.unreadCounts.set(participantId, 0);
  return this.save();
};

interface ConversationModel extends Model<IConversation> {
  findByParticipant(
    participantId: string,
    options?: { type?: ConversationType; status?: ConversationStatus }
  ): Promise<IConversation[]>;
  findDirectConversation(
    participant1Id: string,
    participant2Id: string
  ): Promise<IConversation | null>;
  findOrCreateSupportConversation(
    userId: string,
    userName: string,
    userAvatar?: string
  ): Promise<IConversation>;
}

export const Conversation = mongoose.models.Conversation || 
  mongoose.model<IConversation, ConversationModel>('Conversation', ConversationSchema);

export default Conversation;

