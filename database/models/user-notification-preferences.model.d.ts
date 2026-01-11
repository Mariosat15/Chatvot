import { Document, Model } from 'mongoose';
import { NotificationCategory } from './notification-template.model';
export interface IUserNotificationPreferences extends Document {
    userId: string;
    notificationsEnabled: boolean;
    emailNotificationsEnabled: boolean;
    pushNotificationsEnabled: boolean;
    categoryPreferences: {
        purchase: boolean;
        competition: boolean;
        trading: boolean;
        achievement: boolean;
        system: boolean;
        admin: boolean;
        security: boolean;
    };
    disabledNotifications: string[];
    quietHoursEnabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    digestEnabled: boolean;
    digestFrequency: 'daily' | 'weekly' | 'never';
    createdAt: Date;
    updatedAt: Date;
}
export interface IUserNotificationPreferencesModel extends Model<IUserNotificationPreferences> {
    getOrCreatePreferences(userId: string): Promise<IUserNotificationPreferences>;
    isNotificationEnabled(userId: string, category: NotificationCategory, templateId?: string): Promise<boolean>;
}
declare const UserNotificationPreferences: IUserNotificationPreferencesModel;
export default UserNotificationPreferences;
//# sourceMappingURL=user-notification-preferences.model.d.ts.map