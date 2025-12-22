import { Document, Model } from 'mongoose';
export type NotificationCategory = 'purchase' | 'competition' | 'challenge' | 'trading' | 'achievement' | 'system' | 'admin' | 'security';
export type NotificationType = 'deposit_initiated' | 'deposit_completed' | 'deposit_failed' | 'withdrawal_initiated' | 'withdrawal_completed' | 'withdrawal_failed' | 'competition_joined' | 'competition_starting_soon' | 'competition_started' | 'competition_ending_soon' | 'competition_ended' | 'competition_won' | 'competition_podium' | 'competition_prize_received' | 'competition_disqualified' | 'competition_cancelled' | 'challenge_received' | 'challenge_accepted' | 'challenge_started' | 'challenge_declined' | 'challenge_expired' | 'challenge_won' | 'challenge_lost' | 'challenge_tie' | 'challenge_disqualified' | 'competition_refunded' | 'order_placed' | 'order_filled' | 'order_cancelled' | 'position_opened' | 'position_closed' | 'stop_loss_triggered' | 'take_profit_triggered' | 'margin_warning' | 'margin_call' | 'liquidation' | 'badge_earned' | 'level_up' | 'milestone_reached' | 'leaderboard_rank_up' | 'system_maintenance' | 'system_update' | 'new_feature' | 'terms_updated' | 'admin_announcement' | 'admin_message' | 'admin_alert' | 'login_new_device' | 'password_changed' | 'email_changed' | 'account_suspended' | 'account_restored' | 'custom';
export interface INotificationTemplate extends Document {
    templateId: string;
    name: string;
    description: string;
    category: NotificationCategory;
    type: NotificationType;
    title: string;
    message: string;
    icon: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    color: string;
    isEnabled: boolean;
    isDefault: boolean;
    isCustom: boolean;
    channels: {
        inApp: boolean;
        email: boolean;
        push: boolean;
    };
    actionUrl?: string;
    actionText?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface INotificationTemplateModel extends Model<INotificationTemplate> {
    getTemplate(templateId: string): Promise<INotificationTemplate | null>;
    getEnabledTemplates(): Promise<INotificationTemplate[]>;
    seedDefaults(): Promise<void>;
}
declare const NotificationTemplate: INotificationTemplateModel;
export default NotificationTemplate;
declare function getDefaultTemplates(): Partial<INotificationTemplate>[];
export { getDefaultTemplates };
//# sourceMappingURL=notification-template.model.d.ts.map