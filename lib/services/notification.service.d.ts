import { NotificationCategory } from '@/database/models/notification-template.model';
import { INotification } from '@/database/models/notification.model';
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
declare class NotificationService {
    private static templatesSeeded;
    /**
     * Ensure templates are seeded
     */
    private ensureTemplatesSeeded;
    /**
     * Send a notification using a template
     */
    send(params: SendNotificationParams): Promise<INotification | null>;
    /**
     * Send an instant/custom notification (not from template)
     */
    sendInstant(params: SendInstantNotificationParams): Promise<INotification | INotification[]>;
    /**
     * Send notification to multiple users
     */
    sendBulk(params: SendBulkNotificationParams): Promise<number>;
    notifyDepositInitiated(userId: string, amount: number): Promise<INotification | null>;
    notifyDepositCompleted(userId: string, amount: number, balance: number): Promise<INotification | null>;
    notifyDepositFailed(userId: string, amount: number, reason: string): Promise<INotification | null>;
    notifyWithdrawalInitiated(userId: string, amount: number): Promise<INotification | null>;
    notifyWithdrawalCompleted(userId: string, amount: number): Promise<INotification | null>;
    notifyWithdrawalFailed(userId: string, amount: number, reason: string): Promise<INotification | null>;
    notifyCompetitionJoined(userId: string, competitionId: string, competitionName: string, entryFee: number): Promise<INotification | null>;
    notifyCompetitionStartingSoon(userId: string, competitionId: string, competitionName: string, startTime: string): Promise<INotification | null>;
    notifyCompetitionStarted(userId: string, competitionId: string, competitionName: string): Promise<INotification | null>;
    notifyCompetitionEndingSoon(userId: string, competitionId: string, competitionName: string, endTime: string): Promise<INotification | null>;
    notifyCompetitionEnded(userId: string, competitionId: string, competitionName: string, finalRank: number, pnl: number): Promise<INotification | null>;
    notifyCompetitionWon(userId: string, competitionName: string, prize: number): Promise<INotification | null>;
    notifyPodiumFinish(userId: string, competitionName: string, finalRank: number, prize: number): Promise<INotification | null>;
    notifyDisqualified(userId: string, competitionId: string, competitionName: string, reason: string): Promise<INotification | null>;
    notifyPrizeReceived(userId: string, competitionName: string, prize: number, rank: number): Promise<INotification | null>;
    notifyCompetitionCancelled(userId: string, competitionId: string, competitionName: string, reason: string, entryFee: number): Promise<INotification | null>;
    notifyCompetitionRefunded(userId: string, competitionName: string, entryFee: number, newBalance: number): Promise<INotification | null>;
    notifyOrderFilled(userId: string, symbol: string, orderType: string, price: number, size: number): Promise<INotification | null>;
    notifyPositionClosed(userId: string, symbol: string, pnl: number, pnlPercent: number): Promise<INotification | null>;
    notifyMarginWarning(userId: string, marginLevel: number): Promise<INotification | null>;
    notifyMarginCall(userId: string, marginLevel: number): Promise<INotification | null>;
    notifyStopLossTriggered(userId: string, symbol: string, price: number, pnl: number): Promise<INotification | null>;
    notifyTakeProfitTriggered(userId: string, symbol: string, price: number, pnl: number): Promise<INotification | null>;
    notifyLiquidation(userId: string, symbol: string): Promise<INotification | null>;
    notifyBadgeEarned(userId: string, badgeName: string, badgeDescription: string): Promise<INotification | null>;
    notifyLevelUp(userId: string, level: number, title: string): Promise<INotification | null>;
    notifyLeaderboardRankUp(userId: string, newRank: number, previousRank: number): Promise<INotification | null>;
    sendAdminAnnouncement(title: string, message: string, adminId: string, adminEmail: string, userIds?: string[]): Promise<number | INotification | INotification[]>;
    notifyAccountSuspended(userId: string, reason: string): Promise<INotification | null>;
    notifyAccountRestored(userId: string): Promise<INotification | null>;
    notifyNewDeviceLogin(userId: string, deviceInfo: string, location: string, time: string): Promise<INotification | null>;
    notifyPasswordChanged(userId: string): Promise<INotification | null>;
    getUserNotifications(userId: string, options?: {
        limit?: number;
        offset?: number;
        category?: NotificationCategory;
        unreadOnly?: boolean;
    }): Promise<(import("mongoose").FlattenMaps<INotification> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    getUnreadCount(userId: string): Promise<number>;
    markAsRead(notificationId: string, userId: string): Promise<boolean>;
    markAllAsRead(userId: string): Promise<number>;
    deleteNotification(notificationId: string, userId: string): Promise<boolean>;
    clearAllNotifications(userId: string): Promise<number>;
    seedDefaultTemplates(): Promise<void>;
    getTemplates(category?: NotificationCategory): Promise<(import("mongoose").FlattenMaps<import("@/database/models/notification-template.model").INotificationTemplate> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    updateTemplate(templateId: string, updates: Partial<{
        name: string;
        title: string;
        message: string;
        icon: string;
        priority: string;
        color: string;
        isEnabled: boolean;
        actionUrl: string;
        actionText: string;
        channels: {
            inApp: boolean;
            email: boolean;
            push: boolean;
        };
    }>): Promise<(import("mongoose").Document<unknown, {}, import("@/database/models/notification-template.model").INotificationTemplate, {}, {}> & import("@/database/models/notification-template.model").INotificationTemplate & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    toggleTemplate(templateId: string, isEnabled: boolean): Promise<(import("mongoose").Document<unknown, {}, import("@/database/models/notification-template.model").INotificationTemplate, {}, {}> & import("@/database/models/notification-template.model").INotificationTemplate & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    toggleAllTemplates(isEnabled: boolean): Promise<import("mongoose").UpdateWriteOpResult>;
    createCustomTemplate(data: {
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
    }): Promise<import("mongoose").Document<unknown, {}, import("@/database/models/notification-template.model").INotificationTemplate, {}, {}> & import("@/database/models/notification-template.model").INotificationTemplate & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    deleteCustomTemplate(templateId: string): Promise<boolean>;
    getNotificationStats(): Promise<{
        totalSent: number;
        unreadCount: number;
        byCategory: any;
    }>;
}
export declare const notificationService: NotificationService;
export { NotificationService };
//# sourceMappingURL=notification.service.d.ts.map