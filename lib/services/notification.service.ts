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
   * Create a custom notification directly (without template)
   */
  async createCustom(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    icon?: string;
    category?: string;
    priority?: string;
    color?: string;
    actionUrl?: string;
    actionText?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    try {
      await connectToDatabase();

      const notification = await Notification.create({
        userId: data.userId,
        templateId: `custom_${data.type}`,
        title: data.title,
        message: data.message,
        icon: data.icon || 'bell',
        category: data.category || 'system',
        type: data.type,
        priority: data.priority || 'normal',
        color: data.color || 'blue',
        actionUrl: data.actionUrl,
        actionText: data.actionText,
        isRead: false,
        metadata: data.metadata || {},
        isInstant: true,
      });

      return notification;
    } catch (error) {
      console.error('Error creating custom notification:', error);
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

  // ========== Convenience methods for specific notification types ==========

  /**
   * Send deposit initiated notification
   */
  async notifyDepositInitiated(userId: string, amount: number): Promise<any> {
    console.log(`🔔 Sending deposit_initiated notification to ${userId}`);
    console.log(`   Amount: €${amount.toFixed(2)}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'deposit_initiated',
        variables: { amount: `€${amount.toFixed(2)}` },
      });
      if (result) {
        console.log(`✅ Deposit initiated notification CREATED: ${result._id}`);
      } else {
        console.log(`⚠️ Deposit initiated notification NOT created (check template/preferences)`);
      }
      return result;
    } catch (error) {
      console.error('❌ Error in notifyDepositInitiated:', error);
      return null;
    }
  }

  /**
   * Send deposit completed notification
   */
  async notifyDepositCompleted(userId: string, amount: number, balance: number): Promise<any> {
    console.log(`🔔 Sending deposit_completed notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'deposit_completed',
        variables: { amount: `€${amount.toFixed(2)}`, balance: balance.toFixed(2) },
      });
      console.log(`✅ Deposit notification result:`, result ? 'sent' : 'not sent');
      return result;
    } catch (error) {
      console.error('❌ Error in notifyDepositCompleted:', error);
      return null;
    }
  }

  /**
   * Send deposit failed notification
   */
  async notifyDepositFailed(userId: string, amount: number, reason: string): Promise<any> {
    console.log(`🔔 Sending deposit_failed notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'deposit_failed',
        variables: { amount: `€${amount.toFixed(2)}`, reason },
      });
      return result;
    } catch (error) {
      console.error('❌ Error in notifyDepositFailed:', error);
      return null;
    }
  }

  /**
   * Send withdrawal initiated notification
   */
  async notifyWithdrawalInitiated(userId: string, amount: number): Promise<any> {
    console.log(`🔔 Sending withdrawal_initiated notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'withdrawal_initiated',
        variables: { amount: `€${amount.toFixed(2)}` },
      });
      return result;
    } catch (error) {
      console.error('❌ Error in notifyWithdrawalInitiated:', error);
      return null;
    }
  }

  /**
   * Send withdrawal completed notification
   */
  async notifyWithdrawalCompleted(userId: string, amount: number): Promise<any> {
    console.log(`🔔 Sending withdrawal_completed notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'withdrawal_completed',
        variables: { amount: `€${amount.toFixed(2)}` },
      });
      return result;
    } catch (error) {
      console.error('❌ Error in notifyWithdrawalCompleted:', error);
      return null;
    }
  }

  /**
   * Send withdrawal failed notification
   */
  async notifyWithdrawalFailed(userId: string, amount: number, reason: string): Promise<any> {
    console.log(`🔔 Sending withdrawal_failed notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'withdrawal_failed',
        variables: { amount: `€${amount.toFixed(2)}`, reason },
      });
      return result;
    } catch (error) {
      console.error('❌ Error in notifyWithdrawalFailed:', error);
      return null;
    }
  }

  /**
   * Send badge earned notification
   */
  async notifyBadgeEarned(userId: string, badgeName: string, badgeDescription: string): Promise<any> {
    return this.send({
      userId,
      templateId: 'badge_earned',
      variables: {
        badgeName,
        badgeDescription,
      },
    });
  }

  /**
   * Send competition disqualified notification
   */
  async notifyDisqualified(userId: string, competitionName: string, reason: string): Promise<any> {
    return this.send({
      userId,
      templateId: 'competition_disqualified',
      variables: {
        competitionName,
        reason,
      },
    });
  }

  /**
   * Send liquidation notification
   */
  async notifyLiquidation(userId: string, competitionName: string, reason: string): Promise<any> {
    return this.send({
      userId,
      templateId: 'liquidation',
      variables: {
        competitionName,
        reason,
      },
    });
  }

  /**
   * Send stop loss triggered notification
   */
  async notifyStopLossTriggered(userId: string, symbol: string, exitPrice: number, realizedPnl: number): Promise<any> {
    return this.send({
      userId,
      templateId: 'stop_loss_triggered',
      variables: {
        symbol,
        exitPrice: exitPrice.toFixed(5),
        pnl: realizedPnl >= 0 ? `+€${realizedPnl.toFixed(2)}` : `-€${Math.abs(realizedPnl).toFixed(2)}`,
      },
    });
  }

  /**
   * Send take profit triggered notification
   */
  async notifyTakeProfitTriggered(userId: string, symbol: string, exitPrice: number, realizedPnl: number): Promise<any> {
    return this.send({
      userId,
      templateId: 'take_profit_triggered',
      variables: {
        symbol,
        exitPrice: exitPrice.toFixed(5),
        pnl: realizedPnl >= 0 ? `+€${realizedPnl.toFixed(2)}` : `-€${Math.abs(realizedPnl).toFixed(2)}`,
      },
    });
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

// ========== Social/Messaging notification helpers ==========

export interface CreateUserNotificationOptions {
  userId: string;
  type: string;
  title: string;
  message: string;
  icon?: string;
  category?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a custom user notification (for social features like friend requests, blocks, messages)
 */
export async function createUserNotification(options: CreateUserNotificationOptions): Promise<boolean> {
  try {
    const notification = await notificationService.createCustom({
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      icon: options.icon || 'bell',
      category: options.category || 'social',
      actionUrl: options.actionUrl,
      metadata: options.metadata,
    });
    return !!notification;
  } catch (error) {
    console.error('Error creating user notification:', error);
    return false;
  }
}

/**
 * Send new message notification
 */
export async function sendNewMessageNotification(
  userId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<boolean> {
  return createUserNotification({
    userId,
    type: 'new_message',
    title: 'New Message',
    message: `${senderName}: ${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? '...' : ''}`,
    icon: 'message-circle',
    category: 'messaging',
    actionUrl: `/messaging?conversation=${conversationId}`,
    metadata: { senderName, conversationId },
  });
}

/**
 * Send friend request notification
 */
export async function sendFriendRequestNotification(
  userId: string,
  fromUserName: string,
  fromUserId: string
): Promise<boolean> {
  return createUserNotification({
    userId,
    type: 'friend_request',
    title: 'Friend Request',
    message: `${fromUserName} wants to be your friend.`,
    icon: 'user-plus',
    category: 'social',
    actionUrl: '/messaging?tab=requests',
    metadata: { fromUserName, fromUserId },
  });
}

/**
 * Send friend request accepted notification
 */
export async function sendFriendRequestAcceptedNotification(
  userId: string,
  friendName: string,
  friendId: string
): Promise<boolean> {
  return createUserNotification({
    userId,
    type: 'friend_request_accepted',
    title: 'Friend Request Accepted',
    message: `${friendName} accepted your friend request!`,
    icon: 'users',
    category: 'social',
    actionUrl: `/messaging?friend=${friendId}`,
    metadata: { friendName, friendId },
  });
}

// Default export
export default notificationService;
