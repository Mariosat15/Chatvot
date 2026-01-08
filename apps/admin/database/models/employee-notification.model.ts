import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type EmployeeNotificationType = 
  | 'customer_assigned'
  | 'customer_unassigned'
  | 'customer_transferred_in'
  | 'customer_transferred_out'
  | 'password_changed'
  | 'profile_updated'
  | 'role_changed'
  | 'sections_updated'
  | 'account_suspended'
  | 'account_activated'
  | 'forced_logout'
  | 'system_message';

export interface IEmployeeNotification extends Document {
  employeeId: Types.ObjectId;
  type: EmployeeNotificationType;
  title: string;
  message: string;
  metadata?: {
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    previousEmployee?: string;
    newEmployee?: string;
    changedBy?: string;
    [key: string]: any;
  };
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const EmployeeNotificationSchema = new Schema<IEmployeeNotification>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'customer_assigned',
        'customer_unassigned',
        'customer_transferred_in',
        'customer_transferred_out',
        'password_changed',
        'profile_updated',
        'role_changed',
        'sections_updated',
        'account_suspended',
        'account_activated',
        'forced_logout',
        'system_message',
      ],
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
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'employee_notifications',
  }
);

// Index for efficient queries
EmployeeNotificationSchema.index({ employeeId: 1, isRead: 1, createdAt: -1 });
EmployeeNotificationSchema.index({ createdAt: -1 });

// Static method to create notification
EmployeeNotificationSchema.statics.createNotification = async function(
  employeeId: string,
  type: EmployeeNotificationType,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<IEmployeeNotification> {
  return this.create({
    employeeId: new Types.ObjectId(employeeId),
    type,
    title,
    message,
    metadata,
    isRead: false,
  });
};

// Static method to get unread count
EmployeeNotificationSchema.statics.getUnreadCount = async function(
  employeeId: string
): Promise<number> {
  return this.countDocuments({
    employeeId: new Types.ObjectId(employeeId),
    isRead: false,
  });
};

// Static method to mark all as read
EmployeeNotificationSchema.statics.markAllAsRead = async function(
  employeeId: string
): Promise<void> {
  await this.updateMany(
    { employeeId: new Types.ObjectId(employeeId), isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

interface EmployeeNotificationModel extends Model<IEmployeeNotification> {
  createNotification(
    employeeId: string,
    type: EmployeeNotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<IEmployeeNotification>;
  getUnreadCount(employeeId: string): Promise<number>;
  markAllAsRead(employeeId: string): Promise<void>;
}

export const EmployeeNotification = mongoose.models.EmployeeNotification || 
  mongoose.model<IEmployeeNotification, EmployeeNotificationModel>('EmployeeNotification', EmployeeNotificationSchema);

export default EmployeeNotification;

