import Notification from '@/database/models/notification.model';
import NotificationTemplate, { NotificationType } from '@/database/models/notification-template.model';
import { connectToDatabase } from '@/lib/mongoose';

export interface NotificationData {
  userId: string;
  type: NotificationType;
  metadata?: Record<string, any>;
  adminId?: string;
  adminEmail?: string;
}

/**
 * Replace template variables with actual values
 */
function replaceVariables(text: string, metadata: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return metadata[key] !== undefined ? String(metadata[key]) : match;
  });
}

/**
 * Send a notification to a user based on a template
 */
export async function sendNotification(data: NotificationData): Promise<boolean> {
  try {
    await connectToDatabase();

    // Get the template
    const template = await NotificationTemplate.getTemplate(data.type);
    
    if (!template) {
      console.warn(`Notification template '${data.type}' not found or disabled`);
      return false;
    }

    // Replace variables in title and message
    const metadata = data.metadata || {};
    const title = replaceVariables(template.title, metadata);
    const message = replaceVariables(template.message, metadata);
    const actionUrl = template.actionUrl ? replaceVariables(template.actionUrl, metadata) : undefined;

    // Create the notification
    await Notification.create({
      userId: data.userId,
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
      metadata,
      sentBy: data.adminId ? {
        adminId: data.adminId,
        adminEmail: data.adminEmail,
      } : undefined,
      isInstant: false,
    });

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Send multiple notifications to multiple users
 */
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
  return sendNotification({
    userId,
    type: 'kyc_started',
  });
}

export async function sendKYCApprovedNotification(userId: string): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'kyc_approved',
  });
}

export async function sendKYCDeclinedNotification(userId: string, reason?: string): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'kyc_declined',
    metadata: { reason: reason || 'Verification could not be completed' },
  });
}

export async function sendKYCExpiredNotification(userId: string): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'kyc_expired',
  });
}

export async function sendKYCRequiredNotification(userId: string): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'kyc_required',
  });
}

// ========== Withdrawal notification helpers ==========

export async function sendWithdrawalInitiatedNotification(userId: string, amount: string): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'withdrawal_initiated',
    metadata: { amount },
  });
}

export async function sendWithdrawalCompletedNotification(userId: string, amount: string): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'withdrawal_completed',
    metadata: { amount },
  });
}

export async function sendWithdrawalFailedNotification(userId: string, reason: string): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'withdrawal_failed',
    metadata: { reason },
  });
}

// ========== Deposit notification helpers ==========

export async function sendDepositCompletedNotification(
  userId: string,
  amount: string,
  balance: string
): Promise<boolean> {
  return sendNotification({
    userId,
    type: 'deposit_completed',
    metadata: { amount, balance },
  });
}

// Export for convenience
export default {
  sendNotification,
  sendBulkNotifications,
  sendKYCStartedNotification,
  sendKYCApprovedNotification,
  sendKYCDeclinedNotification,
  sendKYCExpiredNotification,
  sendKYCRequiredNotification,
  sendWithdrawalInitiatedNotification,
  sendWithdrawalCompletedNotification,
  sendWithdrawalFailedNotification,
  sendDepositCompletedNotification,
};
