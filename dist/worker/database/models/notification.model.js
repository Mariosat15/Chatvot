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
const NotificationSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    templateId: {
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
    category: {
        type: String,
        enum: ['purchase', 'competition', 'challenge', 'trading', 'achievement', 'system', 'admin', 'security'],
        required: true,
        index: true,
    },
    type: {
        type: String,
        required: true,
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
    },
    color: {
        type: String,
        default: '#FDD458',
    },
    actionUrl: String,
    actionText: String,
    isRead: {
        type: Boolean,
        default: false,
        index: true,
    },
    readAt: Date,
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    sentBy: {
        adminId: String,
        adminEmail: String,
    },
    isInstant: {
        type: Boolean,
        default: false,
    },
    expiresAt: {
        type: Date,
        index: true,
    },
}, {
    timestamps: true,
});
// Compound indexes for common queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
// Static methods
NotificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ userId, isRead: false });
};
NotificationSchema.statics.markAllAsRead = async function (userId) {
    await this.updateMany({ userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
};
NotificationSchema.statics.deleteOldNotifications = async function (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await this.deleteMany({
        createdAt: { $lt: cutoff },
        isRead: true,
    });
    return result.deletedCount;
};
const Notification = mongoose_1.default.models.Notification ||
    mongoose_1.default.model('Notification', NotificationSchema);
exports.default = Notification;
