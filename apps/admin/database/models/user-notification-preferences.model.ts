import mongoose, { Schema, Document, Model } from 'mongoose';
import { NotificationCategory } from './notification-template.model';

export interface IUserNotificationPreferences extends Document {
  userId: string;
  
  // Global settings
  notificationsEnabled: boolean;      // Master switch
  emailNotificationsEnabled: boolean; // Email notifications
  pushNotificationsEnabled: boolean;  // Push notifications (future)
  
  // Category preferences (true = enabled)
  categoryPreferences: {
    purchase: boolean;      // Deposits, withdrawals
    competition: boolean;   // Competition events
    trading: boolean;       // Trading alerts
    achievement: boolean;   // Badges, level ups
    system: boolean;        // System updates, maintenance
    admin: boolean;         // Admin messages (always on for important)
    security: boolean;      // Security alerts (always on)
  };
  
  // Specific notification type overrides (optional fine-grained control)
  disabledNotifications: string[];  // Array of templateIds to disable
  
  // Quiet hours (optional)
  quietHoursEnabled: boolean;
  quietHoursStart?: string;  // HH:MM format
  quietHoursEnd?: string;    // HH:MM format
  
  // Digest settings (optional for future)
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly' | 'never';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserNotificationPreferencesModel extends Model<IUserNotificationPreferences> {
  getOrCreatePreferences(userId: string): Promise<IUserNotificationPreferences>;
  isNotificationEnabled(userId: string, category: NotificationCategory, templateId?: string): Promise<boolean>;
}

const UserNotificationPreferencesSchema = new Schema<IUserNotificationPreferences>({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  notificationsEnabled: {
    type: Boolean,
    default: true,
  },
  emailNotificationsEnabled: {
    type: Boolean,
    default: true,
  },
  pushNotificationsEnabled: {
    type: Boolean,
    default: false,
  },
  categoryPreferences: {
    purchase: { type: Boolean, default: true },
    competition: { type: Boolean, default: true },
    trading: { type: Boolean, default: true },
    achievement: { type: Boolean, default: true },
    system: { type: Boolean, default: true },
    admin: { type: Boolean, default: true },
    security: { type: Boolean, default: true },
  },
  disabledNotifications: {
    type: [String],
    default: [],
  },
  quietHoursEnabled: {
    type: Boolean,
    default: false,
  },
  quietHoursStart: String,
  quietHoursEnd: String,
  digestEnabled: {
    type: Boolean,
    default: false,
  },
  digestFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'never'],
    default: 'never',
  },
}, {
  timestamps: true,
});

// Static methods
UserNotificationPreferencesSchema.statics.getOrCreatePreferences = async function(userId: string) {
  let prefs = await this.findOne({ userId });
  
  if (!prefs) {
    prefs = await this.create({
      userId,
      notificationsEnabled: true,
      emailNotificationsEnabled: true,
      pushNotificationsEnabled: false,
      categoryPreferences: {
        purchase: true,
        competition: true,
        trading: true,
        achievement: true,
        system: true,
        admin: true,
        security: true,
      },
      disabledNotifications: [],
      quietHoursEnabled: false,
      digestEnabled: false,
      digestFrequency: 'never',
    });
  }
  
  return prefs;
};

UserNotificationPreferencesSchema.statics.isNotificationEnabled = async function(
  userId: string,
  category: NotificationCategory,
  templateId?: string
): Promise<boolean> {
  const prefs = await this.findOne({ userId });
  
  // If no preferences set, default to enabled
  if (!prefs) return true;
  
  // Master switch
  if (!prefs.notificationsEnabled) return false;
  
  // Security and critical admin messages are always enabled
  if (category === 'security') return true;
  
  // Check category preference
  const categoryKey = category as keyof typeof prefs.categoryPreferences;
  if (prefs.categoryPreferences && prefs.categoryPreferences[categoryKey] === false) {
    return false;
  }
  
  // Check specific template override
  if (templateId && prefs.disabledNotifications.includes(templateId)) {
    return false;
  }
  
  // Check quiet hours
  if (prefs.quietHoursEnabled && prefs.quietHoursStart && prefs.quietHoursEnd) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Simple check (doesn't handle overnight spans)
    if (currentTime >= prefs.quietHoursStart && currentTime <= prefs.quietHoursEnd) {
      return false;
    }
  }
  
  return true;
};

const UserNotificationPreferences = (mongoose.models.UserNotificationPreferences as IUserNotificationPreferencesModel) || 
  mongoose.model<IUserNotificationPreferences, IUserNotificationPreferencesModel>('UserNotificationPreferences', UserNotificationPreferencesSchema);

export default UserNotificationPreferences;

