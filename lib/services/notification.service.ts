import { connectToDatabase } from '@/database/mongoose';
import NotificationTemplate, { NotificationType, NotificationCategory } from '@/database/models/notification-template.model';
import Notification, { INotification } from '@/database/models/notification.model';
import UserNotificationPreferences from '@/database/models/user-notification-preferences.model';

interface SendNotificationParams {
  userId: string;
  templateId: string;
  variables?: Record<string, string | number>;
  metadata?: Record<string, any>;
  overrideTitle?: string;
  overrideMessage?: string;
}

interface SendInstantNotificationParams {
  userId: string | 'all';
  title: string;
  message: string;
  category?: NotificationCategory;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  icon?: string;
  color?: string;
  actionUrl?: string;
  actionText?: string;
  expiresAt?: Date;
  sentBy?: {
    adminId: string;
    adminEmail: string;
  };
}

interface SendBulkNotificationParams {
  userIds: string[];
  templateId: string;
  variables?: Record<string, string | number>;
  metadata?: Record<string, any>;
}

class NotificationService {
  private static templatesSeeded = false;

  /**
   * Ensure templates are seeded
   */
  private async ensureTemplatesSeeded(): Promise<void> {
    if (NotificationService.templatesSeeded) return;
    
    const count = await NotificationTemplate.countDocuments();
    if (count === 0) {
      console.log('📋 No notification templates found, seeding defaults...');
      await NotificationTemplate.seedDefaults();
    }
    NotificationService.templatesSeeded = true;
  }

  /**
   * Send a notification using a template
   */
  async send(params: SendNotificationParams): Promise<INotification | null> {
    await connectToDatabase();
    
    // Ensure templates are seeded
    await this.ensureTemplatesSeeded();

    let template = await NotificationTemplate.findOne({
      templateId: params.templateId,
      isEnabled: true,
    });

    // If template not found, try seeding again (might be first run)
    if (!template) {
      console.log(`⚠️ Template "${params.templateId}" not found, attempting to seed...`);
      await NotificationTemplate.seedDefaults();
      template = await NotificationTemplate.findOne({
        templateId: params.templateId,
        isEnabled: true,
      });
    }

    if (!template) {
      console.log(`❌ Notification template "${params.templateId}" not found or disabled after seeding`);
      return null;
    }

    // Check if user wants to receive this notification
    console.log(`🔍 Checking if notification "${params.templateId}" is enabled for user ${params.userId}`);
    let isEnabled = true;
    try {
      isEnabled = await UserNotificationPreferences.isNotificationEnabled(
        params.userId,
        template.category as NotificationCategory,
        params.templateId
      );
      console.log(`   User preference check result: ${isEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.log(`   ⚠️ Error checking preferences, defaulting to enabled:`, error);
      isEnabled = true; // Default to enabled on error
    }

    if (!isEnabled) {
      console.log(`🔕 Notification "${params.templateId}" disabled by user ${params.userId}`);
      return null;
    }

    // Replace variables in title and message
    let title = params.overrideTitle || template.title;
    let message = params.overrideMessage || template.message;

    if (params.variables) {
      for (const [key, value] of Object.entries(params.variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        title = title.replace(regex, String(value));
        message = message.replace(regex, String(value));
      }
    }

    // Also replace variables in actionUrl if present
    let actionUrl = template.actionUrl;
    if (actionUrl && params.variables) {
      for (const [key, value] of Object.entries(params.variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        actionUrl = actionUrl.replace(regex, String(value));
      }
    }

    console.log(`📝 Creating notification in database...`);
    console.log(`   User: ${params.userId}`);
    console.log(`   Template: ${params.templateId}`);
    console.log(`   Title: ${title}`);
    
    const notification = await Notification.create({
      userId: params.userId,
      templateId: params.templateId,
      title,
      message,
      icon: template.icon,
      category: template.category,
      type: template.type,
      priority: template.priority,
      color: template.color,
      actionUrl,
      actionText: template.actionText,
      metadata: params.metadata || {},
      isInstant: false,
    });

    console.log(`✅ Notification created with ID: ${notification._id}`);
    console.log(`📬 Notification sent: [${template.type}] to user ${params.userId}`);

    return notification;
  }

  /**
   * Send an instant/custom notification (not from template)
   */
  async sendInstant(params: SendInstantNotificationParams): Promise<INotification | INotification[]> {
    await connectToDatabase();

    const notificationData = {
      templateId: 'instant',
      title: params.title,
      message: params.message,
      icon: params.icon || '📢',
      category: params.category || 'admin' as NotificationCategory,
      type: 'admin_message' as NotificationType,
      priority: params.priority || 'normal',
      color: params.color || '#FDD458',
      actionUrl: params.actionUrl,
      actionText: params.actionText,
      sentBy: params.sentBy,
      isInstant: true,
      expiresAt: params.expiresAt,
    };

    if (params.userId === 'all') {
      // Send to all users - get all unique userIds from better-auth user collection
      const mongoose = await connectToDatabase();
      const db = mongoose.connection.db;
      
      if (!db) {
        throw new Error('Database connection not found');
      }
      
      // better-auth stores users in 'user' collection with 'id' field
      const users = await db.collection('user').find({}).project({ id: 1, _id: 1 }).toArray();
      
      const notifications = await Notification.insertMany(
        users.map(user => ({
          ...notificationData,
          userId: user.id || user._id?.toString(),
        }))
      );

      console.log(`📢 Broadcast notification sent to ${users.length} users`);
      return notifications;
    }

    const notification = await Notification.create({
      ...notificationData,
      userId: params.userId,
    });

    console.log(`📬 Instant notification sent to user ${params.userId}`);
    return notification;
  }

  /**
   * Send notification to multiple users
   */
  async sendBulk(params: SendBulkNotificationParams): Promise<number> {
    await connectToDatabase();

    const template = await NotificationTemplate.findOne({
      templateId: params.templateId,
      isEnabled: true,
    });

    if (!template) {
      console.log(`⚠️ Notification template "${params.templateId}" not found or disabled`);
      return 0;
    }

    // Replace variables in title and message
    let title = template.title;
    let message = template.message;

    if (params.variables) {
      for (const [key, value] of Object.entries(params.variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        title = title.replace(regex, String(value));
        message = message.replace(regex, String(value));
      }
    }

    let actionUrl = template.actionUrl;
    if (actionUrl && params.variables) {
      for (const [key, value] of Object.entries(params.variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        actionUrl = actionUrl.replace(regex, String(value));
      }
    }

    const notifications = await Notification.insertMany(
      params.userIds.map(userId => ({
        userId,
        templateId: params.templateId,
        title,
        message,
        icon: template.icon,
        category: template.category,
        type: template.type,
        priority: template.priority,
        color: template.color,
        actionUrl,
        actionText: template.actionText,
        metadata: params.metadata || {},
        isInstant: false,
      }))
    );

    console.log(`📬 Bulk notification sent to ${notifications.length} users`);
    return notifications.length;
  }

  // ========== CONVENIENCE METHODS ==========

  // Purchase notifications
  async notifyDepositInitiated(userId: string, amount: number) {
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

  async notifyDepositCompleted(userId: string, amount: number, balance: number) {
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

  async notifyDepositFailed(userId: string, amount: number, reason: string) {
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

  async notifyWithdrawalInitiated(userId: string, amount: number) {
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

  async notifyWithdrawalCompleted(userId: string, amount: number) {
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

  async notifyWithdrawalFailed(userId: string, amount: number, reason: string) {
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

  // Competition notifications
  async notifyCompetitionJoined(userId: string, competitionId: string, competitionName: string, entryFee: number) {
    console.log(`🔔 Sending competition_joined notification to ${userId} for ${competitionName}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'competition_joined',
        variables: { competitionId, competitionName, entryFee },
      });
      console.log(`✅ Competition joined notification result:`, result ? 'sent' : 'not sent');
      return result;
    } catch (error) {
      console.error('❌ Error in notifyCompetitionJoined:', error);
      return null;
    }
  }

  async notifyCompetitionStartingSoon(userId: string, competitionId: string, competitionName: string, startTime: string) {
    console.log(`🔔 Sending competition_starting_soon notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'competition_starting_soon',
      variables: { competitionId, competitionName, startTime },
    });
  }

  async notifyCompetitionStarted(userId: string, competitionId: string, competitionName: string) {
    console.log(`🔔 Sending competition_started notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'competition_started',
      variables: { competitionId, competitionName },
    });
  }

  async notifyCompetitionEndingSoon(userId: string, competitionId: string, competitionName: string, endTime: string) {
    console.log(`🔔 Sending competition_ending_soon notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'competition_ending_soon',
      variables: { competitionId, competitionName, endTime },
    });
  }

  async notifyCompetitionEnded(userId: string, competitionId: string, competitionName: string, finalRank: number, pnl: number) {
    return this.send({
      userId,
      templateId: 'competition_ended',
      variables: {
        competitionId,
        competitionName,
        finalRank,
        pnl: pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2),
      },
    });
  }

  async notifyCompetitionWon(userId: string, competitionName: string, prize: number) {
    return this.send({
      userId,
      templateId: 'competition_won',
      variables: { competitionName, prize: prize.toFixed(2) },
    });
  }

  async notifyPodiumFinish(userId: string, competitionName: string, finalRank: number, prize: number) {
    return this.send({
      userId,
      templateId: 'competition_podium',
      variables: { competitionName, finalRank, prize: prize.toFixed(2) },
    });
  }

  async notifyDisqualified(userId: string, competitionId: string, competitionName: string, reason: string) {
    console.log(`🔔 Sending competition_disqualified notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'competition_disqualified',
      variables: { competitionId, competitionName, reason },
    });
  }

  async notifyPrizeReceived(userId: string, competitionName: string, prize: number, rank: number) {
    console.log(`🔔 Sending competition_prize_received notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'competition_prize_received',
      variables: { competitionName, prize: `€${prize.toFixed(2)}`, rank },
    });
  }

  async notifyCompetitionCancelled(userId: string, competitionId: string, competitionName: string, reason: string, entryFee: number) {
    console.log(`🔔 Sending competition_cancelled notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'competition_cancelled',
        variables: { competitionId, competitionName, reason, entryFee: entryFee.toFixed(2) },
      });
      if (result) {
        console.log(`✅ Competition cancelled notification CREATED: ${result._id}`);
      }
      return result;
    } catch (error) {
      console.error('❌ Error in notifyCompetitionCancelled:', error);
      return null;
    }
  }

  async notifyCompetitionRefunded(userId: string, competitionName: string, entryFee: number, newBalance: number) {
    console.log(`🔔 Sending competition_refunded notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'competition_refunded',
        variables: { competitionName, entryFee: entryFee.toFixed(2), balance: newBalance.toFixed(2) },
      });
      if (result) {
        console.log(`✅ Competition refunded notification CREATED: ${result._id}`);
      }
      return result;
    } catch (error) {
      console.error('❌ Error in notifyCompetitionRefunded:', error);
      return null;
    }
  }

  // Trading notifications
  async notifyOrderFilled(userId: string, symbol: string, orderType: string, price: number, size: number) {
    return this.send({
      userId,
      templateId: 'order_filled',
      variables: { symbol, orderType, price: price.toFixed(5), size: size.toString() },
    });
  }

  async notifyPositionClosed(userId: string, symbol: string, pnl: number, pnlPercent: number) {
    return this.send({
      userId,
      templateId: 'position_closed',
      variables: {
        symbol,
        pnl: pnl >= 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2),
        pnlPercent: pnlPercent.toFixed(2),
      },
    });
  }

  async notifyMarginWarning(userId: string, marginLevel: number) {
    return this.send({
      userId,
      templateId: 'margin_warning',
      variables: { marginLevel: marginLevel.toFixed(1) },
    });
  }

  async notifyMarginCall(userId: string, marginLevel: number) {
    return this.send({
      userId,
      templateId: 'margin_call',
      variables: { marginLevel: marginLevel.toFixed(1) },
    });
  }

  async notifyStopLossTriggered(userId: string, symbol: string, price: number, pnl: number) {
    console.log(`🔔 Sending stop_loss_triggered notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'stop_loss_triggered',
      variables: { symbol, price: price.toFixed(5), pnl: pnl.toFixed(2) },
    });
  }

  async notifyTakeProfitTriggered(userId: string, symbol: string, price: number, pnl: number) {
    console.log(`🔔 Sending take_profit_triggered notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'take_profit_triggered',
      variables: { symbol, price: price.toFixed(5), pnl: `+${pnl.toFixed(2)}` },
    });
  }

  async notifyLiquidation(userId: string, symbol: string) {
    console.log(`🔔 Sending liquidation notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'liquidation',
      variables: { symbol },
    });
  }

  // Achievement notifications
  async notifyBadgeEarned(userId: string, badgeName: string, badgeDescription: string) {
    return this.send({
      userId,
      templateId: 'badge_earned',
      variables: { badgeName, badgeDescription },
    });
  }

  async notifyLevelUp(userId: string, level: number, title: string) {
    console.log(`🔔 Sending level_up notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'level_up',
      variables: { level, title },
    });
  }

  async notifyLeaderboardRankUp(userId: string, newRank: number, previousRank: number) {
    console.log(`🔔 Sending leaderboard_rank_up notification to ${userId}`);
    return this.send({
      userId,
      templateId: 'leaderboard_rank_up',
      variables: { newRank, previousRank, positions: previousRank - newRank },
    });
  }

  // Admin notifications
  async sendAdminAnnouncement(title: string, message: string, adminId: string, adminEmail: string, userIds?: string[]) {
    if (userIds && userIds.length > 0) {
      // Send to specific users
      return this.sendBulk({
        userIds,
        templateId: 'admin_announcement',
        variables: { message },
      });
    }
    
    // Broadcast to all
    return this.sendInstant({
      userId: 'all',
      title: title || '📢 Announcement',
      message,
      category: 'admin',
      priority: 'high',
      icon: '📢',
      sentBy: { adminId, adminEmail },
    });
  }

  // Security notifications
  async notifyAccountSuspended(userId: string, reason: string) {
    console.log(`🔔 Sending account_suspended notification to ${userId}`);
    console.log(`   Reason: ${reason}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'account_suspended',
        variables: { reason },
      });
      if (result) {
        console.log(`✅ Account suspended notification CREATED: ${result._id}`);
      } else {
        console.log(`⚠️ Account suspended notification NOT created`);
      }
      return result;
    } catch (error) {
      console.error('❌ Error in notifyAccountSuspended:', error);
      return null;
    }
  }

  async notifyAccountRestored(userId: string) {
    console.log(`🔔 Sending account_restored notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'account_restored',
      });
      if (result) {
        console.log(`✅ Account restored notification CREATED: ${result._id}`);
      } else {
        console.log(`⚠️ Account restored notification NOT created`);
      }
      return result;
    } catch (error) {
      console.error('❌ Error in notifyAccountRestored:', error);
      return null;
    }
  }

  async notifyNewDeviceLogin(userId: string, deviceInfo: string, location: string, time: string) {
    console.log(`🔔 Sending login_new_device notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'login_new_device',
        variables: { deviceInfo, location, time },
      });
      return result;
    } catch (error) {
      console.error('❌ Error in notifyNewDeviceLogin:', error);
      return null;
    }
  }

  async notifyPasswordChanged(userId: string) {
    console.log(`🔔 Sending password_changed notification to ${userId}`);
    try {
      const result = await this.send({
        userId,
        templateId: 'password_changed',
      });
      return result;
    } catch (error) {
      console.error('❌ Error in notifyPasswordChanged:', error);
      return null;
    }
  }

  // ========== QUERY METHODS ==========

  async getUserNotifications(userId: string, options: {
    limit?: number;
    offset?: number;
    category?: NotificationCategory;
    unreadOnly?: boolean;
  } = {}) {
    await connectToDatabase();

    const query: any = { userId };
    
    if (options.category) {
      query.category = options.category;
    }
    
    if (options.unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(options.offset || 0)
      .limit(options.limit || 50)
      .lean();

    return notifications;
  }

  async getUnreadCount(userId: string): Promise<number> {
    await connectToDatabase();
    return Notification.countDocuments({ userId, isRead: false });
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    await connectToDatabase();
    
    const result = await Notification.updateOne(
      { _id: notificationId, userId },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    await connectToDatabase();
    
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return result.modifiedCount;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    await connectToDatabase();
    
    const result = await Notification.deleteOne({ _id: notificationId, userId });
    return result.deletedCount > 0;
  }

  async clearAllNotifications(userId: string): Promise<number> {
    await connectToDatabase();
    
    const result = await Notification.deleteMany({ userId });
    return result.deletedCount;
  }

  // ========== ADMIN METHODS ==========

  async seedDefaultTemplates(): Promise<void> {
    await connectToDatabase();
    await NotificationTemplate.seedDefaults();
  }

  async getTemplates(category?: NotificationCategory) {
    await connectToDatabase();
    
    const query: any = {};
    if (category) {
      query.category = category;
    }
    
    return NotificationTemplate.find(query).sort({ category: 1, name: 1 }).lean();
  }

  async updateTemplate(templateId: string, updates: Partial<{
    name: string;
    title: string;
    message: string;
    icon: string;
    priority: string;
    color: string;
    isEnabled: boolean;
    actionUrl: string;
    actionText: string;
    channels: { inApp: boolean; email: boolean; push: boolean };
  }>) {
    await connectToDatabase();
    
    return NotificationTemplate.findOneAndUpdate(
      { templateId },
      { $set: updates },
      { new: true }
    );
  }

  async toggleTemplate(templateId: string, isEnabled: boolean) {
    await connectToDatabase();
    
    return NotificationTemplate.findOneAndUpdate(
      { templateId },
      { $set: { isEnabled } },
      { new: true }
    );
  }

  async toggleAllTemplates(isEnabled: boolean) {
    await connectToDatabase();
    
    return NotificationTemplate.updateMany(
      {},
      { $set: { isEnabled } }
    );
  }

  async createCustomTemplate(data: {
    templateId: string;
    name: string;
    description?: string;
    category: NotificationCategory;
    title: string;
    message: string;
    icon?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    color?: string;
    actionUrl?: string;
    actionText?: string;
  }) {
    await connectToDatabase();
    
    return NotificationTemplate.create({
      ...data,
      type: 'custom',
      isEnabled: true,
      isDefault: false,
      isCustom: true,
      channels: { inApp: true, email: false, push: false },
    });
  }

  async deleteCustomTemplate(templateId: string): Promise<boolean> {
    await connectToDatabase();
    
    // Only allow deleting custom templates
    const result = await NotificationTemplate.deleteOne({
      templateId,
      isCustom: true,
    });
    
    return result.deletedCount > 0;
  }

  async getNotificationStats() {
    await connectToDatabase();
    
    const [totalSent, unreadCount, templateStats] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ isRead: false }),
      Notification.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      totalSent,
      unreadCount,
      byCategory: templateStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export class for testing
export { NotificationService };

