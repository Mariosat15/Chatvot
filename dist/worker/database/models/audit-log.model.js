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
const AuditLogSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    userName: {
        type: String,
        required: true,
    },
    userEmail: {
        type: String,
        required: true,
    },
    userRole: {
        type: String,
        enum: ['admin', 'superadmin', 'moderator', 'user'],
        default: 'admin',
    },
    action: {
        type: String,
        required: true,
        index: true,
    },
    actionCategory: {
        type: String,
        enum: ['user_management', 'financial', 'competition', 'settings', 'content', 'security', 'system', 'data', 'other'],
        required: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
    },
    targetType: {
        type: String,
        enum: ['user', 'competition', 'transaction', 'settings', 'system', 'other'],
    },
    targetId: String,
    targetName: String,
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    previousValue: mongoose_1.Schema.Types.Mixed,
    newValue: mongoose_1.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    requestPath: String,
    requestMethod: String,
    status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'success',
    },
    errorMessage: String,
}, {
    timestamps: true,
});
// Indexes for efficient querying
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ actionCategory: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ status: 1, createdAt: -1 });
// Static method to log an action
AuditLogSchema.statics.logAction = async function (params) {
    try {
        const log = await this.create({
            ...params,
            status: params.status || 'success',
        });
        console.log(`📋 [AUDIT] ${params.action} by ${params.userEmail}: ${params.description}`);
        return log;
    }
    catch (error) {
        console.error('Failed to create audit log:', error);
        throw error;
    }
};
const AuditLog = mongoose_1.default.models.AuditLog ||
    mongoose_1.default.model('AuditLog', AuditLogSchema);
exports.default = AuditLog;
