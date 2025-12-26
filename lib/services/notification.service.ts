import Notification from '@/database/models/notification.model';
import NotificationTemplate, { NotificationType, NotificationCategory } from '@/database/models/notification-template.model';
import { connectToDatabase } from '@/database/mongoose';

export interface NotificationData {
  userId: string;
  type: NotificationType;
  metadata?: Record<string, any>;
  adminId?: string;
  adminEmail?: string;
}

export interface SendOptions {
  userId: string;
  templateId: string;
  variables?: Record<string, any>;
  adminId?: string;
  adminEmail?: string;
}

export interface GetNotificationsOptions {
  limit?: number;
  offset?: number;
  category?: NotificationCategory;
  unreadOnly?: boolean;
}

/**
 * Replace template variables with actual values
 */
function replaceVariables(text: string, variables: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}

/**
 * Notification Service Class - provides all notification functionality
 */
class NotificationService {
  /**
   * Send a notification using a template
   */
  async send(options: SendOptions): Promise<any> {
    try {
      await connectToDatabase();

      const template = await NotificationTemplate.findOne({ 
        templateId: options.templateId, 
        isEnabled: true 
      });
      
      if (!template) {
        console.warn(`Notification template '${options.templateId}' not found or disabled`);
        return null;
      }

      const variables = options.variables || {};
      const title = replaceVariables(template.title, variables);
      const message = replaceVariables(template.message, variables);
      const actionUrl = template.actionUrl ? replaceVariables(template.actionUrl, variables) : undefined;

      const notification = await Notification.create({
        userId: options.userId,
        templateId: template.templateId,
        title,
        message,
        icon: template.icon,
        category: template.category,
        type: template.type,
        priority: template.priority,
        color: template.color,
        actionUrl,
        actionText: template.actionText,
        isRead: false,
        metadata: variables,
        sentBy: options.adminId ? {
          adminId: options.adminId,
          adminEmail: options.adminEmail,
        } : undefined,
        isInstant: false,
      });

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string, options: GetNotificationsOptions = {}) {
    await connectToDatabase();

    const { limit = 50, offset = 0, category, unreadOnly } = options;

    const query: any = { userId };
    if (category) query.category = category;
    if (unreadOnly) query.isRead = false;

    return Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    await connectToDatabase();
    return Notification.countDocuments({ userId, isRead: false });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    await connectToDatabase();
    
    const result = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() }
    );
    
    return !!result;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    await connectToDatabase();
    
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    
    return result.modifiedCount;
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(userId: string): Promise<number> {
    await connectToDatabase();
    
    const result = await Notification.deleteMany({ userId });
    return result.deletedCount;
  }

  /**
   * Delete a single notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    await connectToDatabase();
    
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });
    
    return !!result;
  }

  /**
   * Send notification by type (for KYC, trading events, etc.)
   */
  async sendByType(data: NotificationData): Promise<boolean> {
    const result = await this.send({
      userId: data.userId,
      templateId: data.type,
      variables: data.metadata,
      adminId: data.adminId,
      adminEmail: data.adminEmail,
    });
    return !!result;
  }
}

// Create singleton instance
export const notificationService = new NotificationService();

// ========== Helper functions for backwards compatibility ==========

export async function sendNotification(data: NotificationData): Promise<boolean> {
  return notificationService.sendByType(data);
}

export async function sendBulkNotifications(
  userIds: string[],
  type: NotificationType,
  metadata?: Record<string, any>
): Promise<number> {
  let successCount = 0;
  
  for (const userId of userIds) {
    const success = await sendNotification({ userId, type, metadata });
    if (success) successCount++;
  }
  
  return successCount;
}

// ========== KYC-specific notification helpers ==========

export async function sendKYCStartedNotification(userId: string): Promise<boolean> {
  return sendNotification({ userId, type: 'kyc_started' });
}

export async function sendKYCApprovedNotification(userId: string): Promise<boolean> {
  return sendNotification({ userId, type: 'kyc_approved' });
}

export async function sendKYCDeclinedNotification(userId: string, reason?: string): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'kyc_declined',
    metadata: { reason: reason || 'Verification could not be completed' },
  });
}

export async function sendKYCExpiredNotification(userId: string): Promise<boolean> {
  return sendNotification({ userId, type: 'kyc_expired' });
}

export async function sendKYCRequiredNotification(userId: string): Promise<boolean> {
  return sendNotification({ userId, type: 'kyc_required' });
}

// ========== Withdrawal notification helpers ==========

export async function sendWithdrawalInitiatedNotification(userId: string, amount: string): Promise<boolean> {
  return sendNotification({ userId, type: 'withdrawal_initiated', metadata: { amount } });
}

export async function sendWithdrawalCompletedNotification(userId: string, amount: string): Promise<boolean> {
  return sendNotification({ userId, type: 'withdrawal_completed', metadata: { amount } });
}

export async function sendWithdrawalFailedNotification(userId: string, reason: string): Promise<boolean> {
  return sendNotification({ userId, type: 'withdrawal_failed', metadata: { reason } });
}

// ========== Deposit notification helpers ==========

export async function sendDepositCompletedNotification(
  userId: string,
  amount: string,
  balance: string
): Promise<boolean> {
  return sendNotification({ userId, type: 'deposit_completed', metadata: { amount, balance } });
}

// Default export
export default notificationService;
