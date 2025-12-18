import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationCategory = 
  | 'purchase'      // Deposits, withdrawals, credit purchases
  | 'competition'   // Competition events
  | 'challenge'     // 1v1 Challenge events
  | 'trading'       // Trading events (orders, positions)
  | 'achievement'   // Badges, level ups, milestones
  | 'system'        // System notifications, maintenance
  | 'admin'         // Manual admin notifications
  | 'security';     // Security alerts, login, password changes

export type NotificationType =
  // Purchase
  | 'deposit_initiated'
  | 'deposit_completed'
  | 'deposit_failed'
  | 'withdrawal_initiated'
  | 'withdrawal_completed'
  | 'withdrawal_failed'
  // Competition
  | 'competition_joined'
  | 'competition_starting_soon'
  | 'competition_started'
  | 'competition_ending_soon'
  | 'competition_ended'
  | 'competition_won'
  | 'competition_podium'
  | 'competition_prize_received'
  | 'competition_disqualified'
  | 'competition_cancelled'
  // 1v1 Challenges
  | 'challenge_received'
  | 'challenge_accepted'
  | 'challenge_started'
  | 'challenge_declined'
  | 'challenge_expired'
  | 'challenge_won'
  | 'challenge_lost'
  | 'challenge_tie'
  | 'challenge_disqualified'
  | 'competition_refunded'
  // Trading
  | 'order_placed'
  | 'order_filled'
  | 'order_cancelled'
  | 'position_opened'
  | 'position_closed'
  | 'stop_loss_triggered'
  | 'take_profit_triggered'
  | 'margin_warning'
  | 'margin_call'
  | 'liquidation'
  // Achievement
  | 'badge_earned'
  | 'level_up'
  | 'milestone_reached'
  | 'leaderboard_rank_up'
  // System
  | 'system_maintenance'
  | 'system_update'
  | 'new_feature'
  | 'terms_updated'
  // Admin
  | 'admin_announcement'
  | 'admin_message'
  | 'admin_alert'
  // Security
  | 'login_new_device'
  | 'password_changed'
  | 'email_changed'
  | 'account_suspended'
  | 'account_restored'
  // Custom (for admin-created templates)
  | 'custom';

export interface INotificationTemplate extends Document {
  // Template identification
  templateId: string;           // Unique identifier (e.g., 'deposit_completed')
  name: string;                 // Display name
  description: string;          // Description for admin
  
  // Categorization
  category: NotificationCategory;
  type: NotificationType;
  
  // Content
  title: string;                // Notification title (supports variables like {{amount}})
  message: string;              // Notification message
  icon: string;                 // Emoji or icon identifier
  
  // Styling
  priority: 'low' | 'normal' | 'high' | 'urgent';
  color: string;                // Badge/accent color
  
  // Settings
  isEnabled: boolean;           // Whether this notification type is enabled globally
  isDefault: boolean;           // Whether this is a system default (survives reset)
  isCustom: boolean;            // Whether this was created by admin
  
  // Channels (for future multi-channel support)
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  
  // Actions
  actionUrl?: string;           // URL to navigate to when clicked
  actionText?: string;          // Button text for action
  
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationTemplateModel extends Model<INotificationTemplate> {
  getTemplate(templateId: string): Promise<INotificationTemplate | null>;
  getEnabledTemplates(): Promise<INotificationTemplate[]>;
  seedDefaults(): Promise<void>;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>({
  templateId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    enum: ['purchase', 'competition', 'challenge', 'trading', 'achievement', 'system', 'admin', 'security'],
    required: true,
  },
  type: {
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
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  color: {
    type: String,
    default: '#FDD458', // Primary yellow
  },
  isEnabled: {
    type: Boolean,
    default: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  isCustom: {
    type: Boolean,
    default: false,
  },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
  },
  actionUrl: String,
  actionText: String,
}, {
  timestamps: true,
});

// Static methods
NotificationTemplateSchema.statics.getTemplate = async function(templateId: string) {
  return this.findOne({ templateId, isEnabled: true });
};

NotificationTemplateSchema.statics.getEnabledTemplates = async function() {
  return this.find({ isEnabled: true }).sort({ category: 1, name: 1 });
};

NotificationTemplateSchema.statics.seedDefaults = async function() {
  const defaults = getDefaultTemplates();
  
  for (const template of defaults) {
    await this.findOneAndUpdate(
      { templateId: template.templateId },
      { $setOnInsert: template },
      { upsert: true }
    );
  }
  
  console.log(`✅ Seeded ${defaults.length} default notification templates`);
};

const NotificationTemplate = (mongoose.models.NotificationTemplate as INotificationTemplateModel) || 
  mongoose.model<INotificationTemplate, INotificationTemplateModel>('NotificationTemplate', NotificationTemplateSchema);

export default NotificationTemplate;

// Default notification templates
function getDefaultTemplates(): Partial<INotificationTemplate>[] {
  return [
    // ========== PURCHASE ==========
    {
      templateId: 'deposit_initiated',
      name: 'Deposit Initiated',
      description: 'Sent when user initiates a deposit',
      category: 'purchase',
      type: 'deposit_initiated',
      title: '💳 Deposit Processing',
      message: 'Your deposit of {{amount}} is being processed. This usually takes a few moments.',
      icon: '💳',
      priority: 'normal',
      color: '#3B82F6',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/wallet',
      actionText: 'View Wallet',
    },
    {
      templateId: 'deposit_completed',
      name: 'Deposit Completed',
      description: 'Sent when deposit is successful',
      category: 'purchase',
      type: 'deposit_completed',
      title: '✅ Deposit Successful!',
      message: '{{amount}} credits have been added to your wallet. Your new balance is {{balance}} credits.',
      icon: '✅',
      priority: 'high',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/wallet',
      actionText: 'View Wallet',
    },
    {
      templateId: 'deposit_failed',
      name: 'Deposit Failed',
      description: 'Sent when deposit fails',
      category: 'purchase',
      type: 'deposit_failed',
      title: '❌ Deposit Failed',
      message: 'Your deposit of {{amount}} could not be processed. {{reason}}',
      icon: '❌',
      priority: 'high',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/wallet',
      actionText: 'Try Again',
    },
    {
      templateId: 'withdrawal_initiated',
      name: 'Withdrawal Requested',
      description: 'Sent when withdrawal is requested',
      category: 'purchase',
      type: 'withdrawal_initiated',
      title: '📤 Withdrawal Requested',
      message: 'Your withdrawal of {{amount}} has been submitted and is pending review.',
      icon: '📤',
      priority: 'normal',
      color: '#F59E0B',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/wallet',
      actionText: 'View Status',
    },
    {
      templateId: 'withdrawal_completed',
      name: 'Withdrawal Completed',
      description: 'Sent when withdrawal is processed',
      category: 'purchase',
      type: 'withdrawal_completed',
      title: '✅ Withdrawal Completed',
      message: 'Your withdrawal of {{amount}} has been processed. Funds should arrive within 3-5 business days.',
      icon: '✅',
      priority: 'high',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/wallet',
      actionText: 'View Wallet',
    },
    {
      templateId: 'withdrawal_failed',
      name: 'Withdrawal Failed',
      description: 'Sent when withdrawal is rejected',
      category: 'purchase',
      type: 'withdrawal_failed',
      title: '❌ Withdrawal Failed',
      message: 'Your withdrawal request could not be processed. {{reason}}',
      icon: '❌',
      priority: 'high',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/wallet',
      actionText: 'Contact Support',
    },

    // ========== COMPETITION ==========
    {
      templateId: 'competition_joined',
      name: 'Competition Joined',
      description: 'Sent when user enters a competition',
      category: 'competition',
      type: 'competition_joined',
      title: '🎯 You\'re In!',
      message: 'You\'ve successfully entered "{{competitionName}}". Entry fee: {{entryFee}} credits. Good luck!',
      icon: '🎯',
      priority: 'high',
      color: '#8B5CF6',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/competitions/{{competitionId}}',
      actionText: 'View Competition',
    },
    {
      templateId: 'competition_starting_soon',
      name: 'Competition Starting Soon',
      description: 'Reminder before competition starts',
      category: 'competition',
      type: 'competition_starting_soon',
      title: '⏰ Competition Starting Soon!',
      message: '"{{competitionName}}" starts in {{timeUntil}}. Get ready to trade!',
      icon: '⏰',
      priority: 'high',
      color: '#F59E0B',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: true },
      actionUrl: '/competitions/{{competitionId}}',
      actionText: 'View Competition',
    },
    {
      templateId: 'competition_started',
      name: 'Competition Started',
      description: 'Sent when competition goes live',
      category: 'competition',
      type: 'competition_started',
      title: '🚀 Competition is LIVE!',
      message: '"{{competitionName}}" has started! Trading is now open. May the best trader win!',
      icon: '🚀',
      priority: 'urgent',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: true },
      actionUrl: '/competitions/{{competitionId}}/trade',
      actionText: 'Start Trading',
    },
    {
      templateId: 'competition_ending_soon',
      name: 'Competition Ending Soon',
      description: 'Warning before competition ends',
      category: 'competition',
      type: 'competition_ending_soon',
      title: '⚠️ Competition Ending Soon!',
      message: '"{{competitionName}}" ends in {{timeUntil}}. Current position: #{{currentRank}}',
      icon: '⚠️',
      priority: 'high',
      color: '#F59E0B',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: true },
      actionUrl: '/competitions/{{competitionId}}/trade',
      actionText: 'Trade Now',
    },
    {
      templateId: 'competition_ended',
      name: 'Competition Ended',
      description: 'Sent when competition finishes',
      category: 'competition',
      type: 'competition_ended',
      title: '🏁 Competition Ended',
      message: '"{{competitionName}}" has ended! Your final position: #{{finalRank}} with P&L of {{pnl}}',
      icon: '🏁',
      priority: 'high',
      color: '#6366F1',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/competitions/{{competitionId}}',
      actionText: 'View Results',
    },
    {
      templateId: 'competition_won',
      name: 'Competition Won',
      description: 'Sent to competition winner',
      category: 'competition',
      type: 'competition_won',
      title: '🏆 CONGRATULATIONS! You Won!',
      message: 'You won "{{competitionName}}"! Your prize of {{prize}} credits has been added to your wallet!',
      icon: '🏆',
      priority: 'urgent',
      color: '#FDD458',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: true },
      actionUrl: '/wallet',
      actionText: 'View Prize',
    },
    {
      templateId: 'competition_podium',
      name: 'Podium Finish',
      description: 'Sent to top 3 finishers',
      category: 'competition',
      type: 'competition_podium',
      title: '🥇 Podium Finish!',
      message: 'You finished #{{finalRank}} in "{{competitionName}}"! Prize: {{prize}} credits',
      icon: '🥇',
      priority: 'high',
      color: '#FDD458',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: true },
      actionUrl: '/wallet',
      actionText: 'View Prize',
    },
    {
      templateId: 'competition_prize_received',
      name: 'Prize Received',
      description: 'Prize credited to wallet',
      category: 'competition',
      type: 'competition_prize_received',
      title: '💰 Prize Received!',
      message: '{{prize}} credits from "{{competitionName}}" have been added to your wallet!',
      icon: '💰',
      priority: 'high',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/wallet',
      actionText: 'View Wallet',
    },
    {
      templateId: 'competition_disqualified',
      name: 'Disqualified',
      description: 'Sent when user is disqualified',
      category: 'competition',
      type: 'competition_disqualified',
      title: '⛔ Disqualified',
      message: 'You have been disqualified from "{{competitionName}}". Reason: {{reason}}',
      icon: '⛔',
      priority: 'urgent',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/competitions/{{competitionId}}',
      actionText: 'View Details',
    },
    {
      templateId: 'competition_cancelled',
      name: 'Competition Cancelled',
      description: 'Sent when a competition is cancelled before starting',
      category: 'competition',
      type: 'competition_cancelled',
      title: '🚫 Competition Cancelled',
      message: '"{{competitionName}}" has been cancelled. Reason: {{reason}}. Your entry fee of {{entryFee}} credits has been fully refunded.',
      icon: '🚫',
      priority: 'urgent',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/wallet',
      actionText: 'View Wallet',
    },
    {
      templateId: 'competition_refunded',
      name: 'Competition Refund',
      description: 'Sent when entry fee is refunded',
      category: 'competition',
      type: 'competition_refunded',
      title: '💰 Entry Fee Refunded',
      message: 'Your entry fee of {{entryFee}} credits for "{{competitionName}}" has been refunded to your wallet. New balance: {{balance}} credits.',
      icon: '💰',
      priority: 'high',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/wallet',
      actionText: 'View Wallet',
    },

    // ========== TRADING ==========
    {
      templateId: 'order_filled',
      name: 'Order Filled',
      description: 'Sent when order is executed',
      category: 'trading',
      type: 'order_filled',
      title: '✅ Order Filled',
      message: '{{orderType}} order for {{symbol}} filled at {{price}}. Size: {{size}}',
      icon: '✅',
      priority: 'normal',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
    },
    {
      templateId: 'position_closed',
      name: 'Position Closed',
      description: 'Sent when position is closed',
      category: 'trading',
      type: 'position_closed',
      title: '📊 Position Closed',
      message: '{{symbol}} position closed. P&L: {{pnl}} ({{pnlPercent}}%)',
      icon: '📊',
      priority: 'normal',
      color: '#6366F1',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
    },
    {
      templateId: 'stop_loss_triggered',
      name: 'Stop Loss Triggered',
      description: 'Sent when stop loss is hit',
      category: 'trading',
      type: 'stop_loss_triggered',
      title: '🛑 Stop Loss Triggered',
      message: 'Stop loss triggered for {{symbol}} at {{price}}. Loss limited to {{loss}}',
      icon: '🛑',
      priority: 'high',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: true },
    },
    {
      templateId: 'take_profit_triggered',
      name: 'Take Profit Triggered',
      description: 'Sent when take profit is hit',
      category: 'trading',
      type: 'take_profit_triggered',
      title: '🎯 Take Profit Hit!',
      message: 'Take profit triggered for {{symbol}} at {{price}}. Profit: {{profit}}',
      icon: '🎯',
      priority: 'high',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: true },
    },
    {
      templateId: 'margin_warning',
      name: 'Margin Warning',
      description: 'Warning when margin level is low',
      category: 'trading',
      type: 'margin_warning',
      title: '⚠️ Margin Warning',
      message: 'Your margin level is at {{marginLevel}}%. Consider reducing positions to avoid liquidation.',
      icon: '⚠️',
      priority: 'urgent',
      color: '#F59E0B',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: true },
    },
    {
      templateId: 'margin_call',
      name: 'Margin Call',
      description: 'Critical margin warning',
      category: 'trading',
      type: 'margin_call',
      title: '🚨 MARGIN CALL',
      message: 'URGENT: Margin level critically low at {{marginLevel}}%. Add funds or close positions immediately!',
      icon: '🚨',
      priority: 'urgent',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: true },
    },
    {
      templateId: 'liquidation',
      name: 'Liquidation',
      description: 'Sent when position is liquidated',
      category: 'trading',
      type: 'liquidation',
      title: '💥 Position Liquidated',
      message: 'Your {{symbol}} position has been liquidated due to insufficient margin.',
      icon: '💥',
      priority: 'urgent',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: true },
    },

    // ========== ACHIEVEMENT ==========
    {
      templateId: 'badge_earned',
      name: 'Badge Earned',
      description: 'Sent when user earns a badge',
      category: 'achievement',
      type: 'badge_earned',
      title: '🏅 New Badge Earned!',
      message: 'Congratulations! You\'ve earned the "{{badgeName}}" badge! {{badgeDescription}}',
      icon: '🏅',
      priority: 'high',
      color: '#FDD458',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/profile',
      actionText: 'View Badge',
    },
    {
      templateId: 'level_up',
      name: 'Level Up',
      description: 'Sent when user levels up',
      category: 'achievement',
      type: 'level_up',
      title: '⬆️ Level Up!',
      message: 'You\'ve reached Level {{level}}! New title: {{title}}',
      icon: '⬆️',
      priority: 'high',
      color: '#8B5CF6',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/profile',
      actionText: 'View Profile',
    },
    {
      templateId: 'leaderboard_rank_up',
      name: 'Leaderboard Rank Up',
      description: 'Sent when user climbs leaderboard',
      category: 'achievement',
      type: 'leaderboard_rank_up',
      title: '📈 Rank Improved!',
      message: 'You\'ve climbed to #{{newRank}} on the global leaderboard! (up from #{{oldRank}})',
      icon: '📈',
      priority: 'normal',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/leaderboard',
      actionText: 'View Leaderboard',
    },

    // ========== SYSTEM ==========
    {
      templateId: 'system_maintenance',
      name: 'System Maintenance',
      description: 'Scheduled maintenance notice',
      category: 'system',
      type: 'system_maintenance',
      title: '🔧 Scheduled Maintenance',
      message: 'The platform will undergo maintenance on {{date}} from {{startTime}} to {{endTime}}. Some features may be unavailable.',
      icon: '🔧',
      priority: 'high',
      color: '#F59E0B',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
    },
    {
      templateId: 'system_update',
      name: 'System Update',
      description: 'Platform update announcement',
      category: 'system',
      type: 'system_update',
      title: '🎉 Platform Updated!',
      message: 'We\'ve rolled out new updates! {{message}}',
      icon: '🎉',
      priority: 'normal',
      color: '#8B5CF6',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
    },
    {
      templateId: 'new_feature',
      name: 'New Feature',
      description: 'New feature announcement',
      category: 'system',
      type: 'new_feature',
      title: '✨ New Feature Available!',
      message: '{{featureName}} is now available! {{description}}',
      icon: '✨',
      priority: 'normal',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
    },

    // ========== ADMIN ==========
    {
      templateId: 'admin_announcement',
      name: 'Admin Announcement',
      description: 'General announcement from admin',
      category: 'admin',
      type: 'admin_announcement',
      title: '📢 Announcement',
      message: '{{message}}',
      icon: '📢',
      priority: 'high',
      color: '#FDD458',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
    },
    {
      templateId: 'admin_message',
      name: 'Admin Message',
      description: 'Personal message from admin',
      category: 'admin',
      type: 'admin_message',
      title: '💬 Message from Admin',
      message: '{{message}}',
      icon: '💬',
      priority: 'normal',
      color: '#3B82F6',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
    },
    {
      templateId: 'admin_alert',
      name: 'Admin Alert',
      description: 'Important alert from admin',
      category: 'admin',
      type: 'admin_alert',
      title: '🚨 Important Alert',
      message: '{{message}}',
      icon: '🚨',
      priority: 'urgent',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: true },
    },

    // ========== SECURITY ==========
    {
      templateId: 'login_new_device',
      name: 'New Device Login',
      description: 'Login from new device detected',
      category: 'security',
      type: 'login_new_device',
      title: '🔐 New Login Detected',
      message: 'Your account was accessed from a new device. If this wasn\'t you, please secure your account immediately.',
      icon: '🔐',
      priority: 'high',
      color: '#F59E0B',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
    },
    {
      templateId: 'password_changed',
      name: 'Password Changed',
      description: 'Password change confirmation',
      category: 'security',
      type: 'password_changed',
      title: '🔒 Password Changed',
      message: 'Your password has been successfully changed. If you didn\'t make this change, contact support immediately.',
      icon: '🔒',
      priority: 'high',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
    },
    {
      templateId: 'account_suspended',
      name: 'Account Suspended',
      description: 'Account suspension notice',
      category: 'security',
      type: 'account_suspended',
      title: '⛔ Account Suspended',
      message: 'Your account has been suspended. Reason: {{reason}}. Contact support for more information.',
      icon: '⛔',
      priority: 'urgent',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
    },
    {
      templateId: 'account_restored',
      name: 'Account Restored',
      description: 'Account restoration notice',
      category: 'security',
      type: 'account_restored',
      title: '✅ Account Restored',
      message: 'Your account has been restored and is now fully active. Welcome back!',
      icon: '✅',
      priority: 'high',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
    },

    // ========== 1v1 CHALLENGES ==========
    {
      templateId: 'challenge_received',
      name: 'Challenge Received',
      description: 'Sent when someone challenges the user',
      category: 'challenge',
      type: 'challenge_received',
      title: '⚔️ Challenge Received!',
      message: '{{challengerName}} has challenged you to a 1v1 battle! Entry: {{entryFee}} credits. Winner takes {{winnerPrize}} credits!',
      icon: '⚔️',
      priority: 'urgent',
      color: '#F59E0B',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/challenges',
      actionText: 'View Challenge',
    },
    {
      templateId: 'challenge_accepted',
      name: 'Challenge Accepted',
      description: 'Sent to challenger when their challenge is accepted',
      category: 'challenge',
      type: 'challenge_accepted',
      title: '🎯 Challenge Accepted!',
      message: '{{challengedName}} has accepted your challenge! The battle begins NOW. Winner takes {{winnerPrize}} credits!',
      icon: '🎯',
      priority: 'urgent',
      color: '#10B981',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/challenges/{{challengeId}}',
      actionText: 'Start Trading',
    },
    {
      templateId: 'challenge_started',
      name: 'Challenge Started',
      description: 'Sent to both players when challenge starts',
      category: 'challenge',
      type: 'challenge_started',
      title: '🚀 Challenge Started!',
      message: 'Your 1v1 challenge against {{challengerName}} has begun! You have {{duration}} minutes. May the best trader win!',
      icon: '🚀',
      priority: 'urgent',
      color: '#8B5CF6',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/challenges/{{challengeId}}',
      actionText: 'Trade Now',
    },
    {
      templateId: 'challenge_declined',
      name: 'Challenge Declined',
      description: 'Sent to challenger when their challenge is declined',
      category: 'challenge',
      type: 'challenge_declined',
      title: '😔 Challenge Declined',
      message: '{{challengedName}} has declined your challenge. No credits were deducted. Try challenging someone else!',
      icon: '😔',
      priority: 'normal',
      color: '#6B7280',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/leaderboard',
      actionText: 'Find Opponents',
    },
    {
      templateId: 'challenge_expired',
      name: 'Challenge Expired',
      description: 'Sent when a challenge expires without response',
      category: 'challenge',
      type: 'challenge_expired',
      title: '⏰ Challenge Expired',
      message: 'Your challenge to {{challengedName}} has expired. They did not respond in time.',
      icon: '⏰',
      priority: 'low',
      color: '#6B7280',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
    },
    {
      templateId: 'challenge_won',
      name: 'Challenge Won',
      description: 'Sent to the winner of a 1v1 challenge',
      category: 'challenge',
      type: 'challenge_won',
      title: '🏆 You Won the Challenge!',
      message: 'Congratulations! You defeated {{opponentName}} and won {{prize}} credits! Final P&L: {{pnl}}',
      icon: '🏆',
      priority: 'high',
      color: '#F59E0B',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
      actionUrl: '/challenges/{{challengeId}}',
      actionText: 'View Results',
    },
    {
      templateId: 'challenge_lost',
      name: 'Challenge Lost',
      description: 'Sent to the loser of a 1v1 challenge',
      category: 'challenge',
      type: 'challenge_lost',
      title: '😞 Challenge Lost',
      message: '{{opponentName}} won this battle. Final P&L: {{pnl}}. Don\'t give up - challenge them to a rematch!',
      icon: '😞',
      priority: 'normal',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/challenges/{{challengeId}}',
      actionText: 'View Results',
    },
    {
      templateId: 'challenge_tie',
      name: 'Challenge Tie',
      description: 'Sent when a challenge ends in a tie',
      category: 'challenge',
      type: 'challenge_tie',
      title: '🤝 Challenge Ended in a Tie!',
      message: 'Your challenge against {{opponentName}} ended in a tie! {{tieResolution}}',
      icon: '🤝',
      priority: 'normal',
      color: '#6366F1',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: false, push: false },
      actionUrl: '/challenges/{{challengeId}}',
      actionText: 'View Results',
    },
    {
      templateId: 'challenge_disqualified',
      name: 'Challenge Disqualified',
      description: 'Sent when a player is disqualified from a challenge',
      category: 'challenge',
      type: 'challenge_disqualified',
      title: '⚠️ Challenge Disqualification',
      message: 'You were disqualified from the challenge against {{opponentName}}. Reason: {{reason}}',
      icon: '⚠️',
      priority: 'high',
      color: '#EF4444',
      isEnabled: true,
      isDefault: true,
      isCustom: false,
      channels: { inApp: true, email: true, push: false },
    },
  ];
}

// Export for seeding
export { getDefaultTemplates };

