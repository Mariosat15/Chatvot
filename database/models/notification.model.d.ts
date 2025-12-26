import { Document, Model } from 'mongoose';
import { NotificationCategory, NotificationType } from './notification-template.model';
export interface INotification extends Document {
    userId: string;
    templateId: string;
    title: string;
    message: string;
    icon: string;
    category: NotificationCategory;
    type: NotificationType;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    color: string;
    actionUrl?: string;
    actionText?: string;
    isRead: boolean;
    readAt?: Date;
    metadata?: Record<string, any>;
    sentBy?: {
        adminId: string;
        adminEmail: string;
    };
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
declare const Notification: INotificationModel;
export default Notification;
//# sourceMappingURL=notification.model.d.ts.map