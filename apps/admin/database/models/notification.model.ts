import mongoose, { Schema, Document, Model } from 'mongoose';
import { NotificationCategory, NotificationType } from './notification-template.model';

export interface INotification extends Document {
  // Target
  userId: string;               // Recipient user ID (or 'all' for broadcast)
  
  // Template reference
  templateId: string;           // Reference to template used
  
  // Content (rendered from template)
  title: string;
  message: string;
  icon: string;
  
  // Categorization
  category: NotificationCategory;
  type: NotificationType;
  
  // Styling
  priority: 'low' | 'normal' | 'high' | 'urgent';
  color: string;
  
  // Actions
  actionUrl?: string;
  actionText?: string;
  
  // Status
  isRead: boolean;
  readAt?: Date;
  
  // Metadata
  metadata?: Record<string, any>;  // Dynamic data used for variables
  
  // Sender info (for admin messages)
  sentBy?: {
    adminId: string;
    adminEmail: string;
  };
  
  // For instant/one-time notifications
  isInstant: boolean;
  expiresAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationModel extends Model<INotification> {
  getUnreadCount(userId: string): Promise<number>;
  markAllAsRead(userId: string): Promise<void>;
  deleteOldNotifications(days: number): Promise<number>;
}

const NotificationSchema = new Schema<INotification>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  templateId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    default: '🔔',
  },
  category: {
    type: String,
    enum: ['purchase', 'competition', 'challenge', 'trading', 'achievement', 'system', 'admin', 'security'],
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  color: {
    type: String,
    default: '#FDD458',
  },
  actionUrl: String,
  actionText: String,
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: Date,
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
  sentBy: {
    adminId: String,
    adminEmail: String,
  },
  isInstant: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound indexes for common queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });

// Static methods
NotificationSchema.statics.getUnreadCount = async function(userId: string): Promise<number> {
  return this.countDocuments({ userId, isRead: false });
};

NotificationSchema.statics.markAllAsRead = async function(userId: string): Promise<void> {
  await this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

NotificationSchema.statics.deleteOldNotifications = async function(days: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoff },
    isRead: true,
  });
  
  return result.deletedCount;
};

const Notification = (mongoose.models.Notification as INotificationModel) || 
  mongoose.model<INotification, INotificationModel>('Notification', NotificationSchema);

export default Notification;

