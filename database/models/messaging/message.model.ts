import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type MessageType = 
  | 'text'
  | 'image'
  | 'file'
  | 'audio'
  | 'system'       // System messages (joined, left, transferred)
  | 'ai-response'; // AI generated responses

export type MessageStatus = 
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface IAttachment {
  type: 'image' | 'file' | 'audio';
  url: string;
  filename: string;
  mimeType: string;
  size: number; // bytes
  thumbnailUrl?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number; // for audio
    [key: string]: any;
  };
}

export interface IReadReceipt {
  participantId: string;
  participantName: string;
  readAt: Date;
}

export interface IReaction {
  participantId: string;
  participantName: string;
  emoji: string;
  reactedAt: Date;
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  
  // Sender info
  senderId: string;
  senderType: 'user' | 'employee' | 'ai' | 'system';
  senderName: string;
  senderAvatar?: string;
  
  // Content
  messageType: MessageType;
  content: string;
  attachments?: IAttachment[];
  
  // Reply reference
  replyTo?: {
    messageId: Types.ObjectId;
    content: string;
    senderName: string;
  };
  
  // Status tracking
  status: MessageStatus;
  readBy: IReadReceipt[];
  deliveredTo: string[]; // participant IDs
  
  // Reactions
  reactions?: IReaction[];
  
  // Moderation
  isModerated: boolean;
  moderationReason?: string;
  originalContent?: string; // Stored if content was modified
  
  // AI metadata
  aiMetadata?: {
    model?: string;
    confidence?: number;
    intent?: string;
    shouldEscalate?: boolean;
    escalationReason?: string;
  };
  
  // Edit history
  isEdited: boolean;
  editedAt?: Date;
  editHistory?: Array<{
    content: string;
    editedAt: Date;
  }>;
  
  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    type: { type: String, enum: ['image', 'file', 'audio'], required: true },
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    thumbnailUrl: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const ReadReceiptSchema = new Schema<IReadReceipt>(
  {
    participantId: { type: String, required: true },
    participantName: { type: String, required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false }
);

const ReactionSchema = new Schema<IReaction>(
  {
    participantId: { type: String, required: true },
    participantName: { type: String, required: true },
    emoji: { type: String, required: true },
    reactedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    
    senderId: { type: String, required: true, index: true },
    senderType: {
      type: String,
      enum: ['user', 'employee', 'ai', 'system'],
      required: true,
    },
    senderName: { type: String, required: true },
    senderAvatar: { type: String },
    
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'system', 'ai-response'],
      default: 'text',
    },
    content: { type: String, required: true },
    attachments: [AttachmentSchema],
    
    replyTo: {
      messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
      content: { type: String },
      senderName: { type: String },
    },
    
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent',
    },
    readBy: [ReadReceiptSchema],
    deliveredTo: [{ type: String }],
    
    reactions: [ReactionSchema],
    
    isModerated: { type: Boolean, default: false },
    moderationReason: { type: String },
    originalContent: { type: String },
    
    aiMetadata: {
      model: { type: String },
      confidence: { type: Number },
      intent: { type: String },
      shouldEscalate: { type: Boolean },
      escalationReason: { type: String },
    },
    
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    editHistory: [{
      content: { type: String },
      editedAt: { type: Date },
    }],
    
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String },
  },
  {
    timestamps: true,
    collection: 'messages',
  }
);

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, isDeleted: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

// Text search index for message content
MessageSchema.index({ content: 'text' });

// Static methods
MessageSchema.statics.getConversationMessages = function(
  conversationId: string,
  options: { limit?: number; before?: Date; after?: Date } = {}
) {
  const query: any = {
    conversationId: new Types.ObjectId(conversationId),
    isDeleted: false,
  };
  
  if (options.before) {
    query.createdAt = { $lt: options.before };
  }
  if (options.after) {
    query.createdAt = { ...query.createdAt, $gt: options.after };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

MessageSchema.statics.searchMessages = function(
  participantId: string,
  searchTerm: string,
  options: { limit?: number } = {}
) {
  return this.aggregate([
    {
      $lookup: {
        from: 'conversations',
        localField: 'conversationId',
        foreignField: '_id',
        as: 'conversation',
      },
    },
    { $unwind: '$conversation' },
    {
      $match: {
        'conversation.participants.id': participantId,
        'conversation.participants.isActive': true,
        isDeleted: false,
        $text: { $search: searchTerm },
      },
    },
    { $sort: { score: { $meta: 'textScore' }, createdAt: -1 } },
    { $limit: options.limit || 20 },
  ]);
};

// Instance methods
MessageSchema.methods.markAsRead = function(participantId: string, participantName: string) {
  const existingReceipt = this.readBy.find((r: IReadReceipt) => r.participantId === participantId);
  if (!existingReceipt) {
    this.readBy.push({
      participantId,
      participantName,
      readAt: new Date(),
    });
    this.status = 'read';
  }
  return this.save();
};

MessageSchema.methods.addReaction = function(
  participantId: string,
  participantName: string,
  emoji: string
) {
  // Remove existing reaction from same participant
  this.reactions = this.reactions?.filter(
    (r: IReaction) => r.participantId !== participantId
  ) || [];
  
  // Add new reaction
  this.reactions.push({
    participantId,
    participantName,
    emoji,
    reactedAt: new Date(),
  });
  
  return this.save();
};

MessageSchema.methods.removeReaction = function(participantId: string) {
  this.reactions = this.reactions?.filter(
    (r: IReaction) => r.participantId !== participantId
  ) || [];
  return this.save();
};

MessageSchema.methods.editContent = function(newContent: string) {
  // Store in edit history
  if (!this.editHistory) this.editHistory = [];
  this.editHistory.push({
    content: this.content,
    editedAt: new Date(),
  });
  
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

MessageSchema.methods.softDelete = function(deletedBy: string) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

interface MessageModel extends Model<IMessage> {
  getConversationMessages(
    conversationId: string,
    options?: { limit?: number; before?: Date; after?: Date }
  ): Promise<IMessage[]>;
  searchMessages(
    participantId: string,
    searchTerm: string,
    options?: { limit?: number }
  ): Promise<IMessage[]>;
}

export const Message = mongoose.models.Message || 
  mongoose.model<IMessage, MessageModel>('Message', MessageSchema);

export default Message;

