"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const UserNotificationPreferencesSchema = new mongoose_1.Schema({
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
UserNotificationPreferencesSchema.statics.getOrCreatePreferences = async function (userId) {
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
UserNotificationPreferencesSchema.statics.isNotificationEnabled = async function (userId, category, templateId) {
    const prefs = await this.findOne({ userId });
    // If no preferences set, default to enabled
    if (!prefs)
        return true;
    // Master switch
    if (!prefs.notificationsEnabled)
        return false;
    // Security and critical admin messages are always enabled
    if (category === 'security')
        return true;
    // Check category preference
    const categoryKey = category;
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
const UserNotificationPreferences = mongoose_1.default.models.UserNotificationPreferences ||
    mongoose_1.default.model('UserNotificationPreferences', UserNotificationPreferencesSchema);
exports.default = UserNotificationPreferences;
//# sourceMappingURL=user-notification-preferences.model.js.map