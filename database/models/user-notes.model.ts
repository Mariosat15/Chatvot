import { Schema, model, models, Document } from 'mongoose';

export interface IUserNote extends Document {
  userId: string;
  adminId: string;
  adminName: string;
  
  // Note Content
  content: string;
  category: 'general' | 'kyc' | 'fraud' | 'support' | 'financial' | 'warning' | 'ban' | 'other';
  
  // Priority/Importance
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Visibility
  isInternal: boolean; // Only visible to admins
  isPinned: boolean;
  
  // Related entities
  relatedKYCSessionId?: string;
  relatedWithdrawalId?: string;
  relatedTransactionId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const UserNoteSchema = new Schema<IUserNote>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    adminId: {
      type: String,
      required: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      required: true,
      enum: ['general', 'kyc', 'fraud', 'support', 'financial', 'warning', 'ban', 'other'],
      default: 'general',
    },
    priority: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    isInternal: {
      type: Boolean,
      default: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    relatedKYCSessionId: String,
    relatedWithdrawalId: String,
    relatedTransactionId: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
UserNoteSchema.index({ userId: 1, createdAt: -1 });
UserNoteSchema.index({ userId: 1, category: 1 });
UserNoteSchema.index({ userId: 1, isPinned: -1, createdAt: -1 });

const UserNote = models?.UserNote || model<IUserNote>('UserNote', UserNoteSchema);

export default UserNote;

