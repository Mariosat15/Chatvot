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
exports.FraudHistory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const FraudHistorySchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    userEmail: {
        type: String,
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    actionType: {
        type: String,
        enum: [
            'warning_issued',
            'investigation_started',
            'investigation_resolved',
            'suspended',
            'suspension_lifted',
            'banned',
            'ban_lifted',
            'restriction_added',
            'restriction_removed',
            'alert_created',
            'alert_dismissed',
            'alert_resolved',
            'evidence_added',
            'manual_review',
            'auto_action',
        ],
        required: true,
        index: true,
    },
    actionSeverity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true,
        index: true,
    },
    performedBy: {
        type: {
            type: String,
            enum: ['admin', 'system', 'automated'],
            required: true,
        },
        adminId: {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Admin',
        },
        adminEmail: String,
        adminName: String,
    },
    relatedAlertId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'FraudAlert',
    },
    relatedRestrictionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'UserRestriction',
    },
    relatedCompetitionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Competition',
    },
    reason: {
        type: String,
        required: true,
    },
    details: {
        type: String,
        required: true,
    },
    evidence: [{
            type: {
                type: String,
                required: true,
            },
            description: String,
            value: mongoose_1.Schema.Types.Mixed,
            timestamp: Date,
        }],
    previousState: {
        suspicionScore: Number,
        restrictionStatus: String,
        accountStatus: String,
    },
    newState: {
        suspicionScore: Number,
        restrictionStatus: String,
        accountStatus: String,
    },
    duration: {
        startDate: Date,
        endDate: Date,
        isPermanent: Boolean,
        durationDays: Number,
    },
    adminNotes: String,
    ipAddress: String,
    userAgent: String,
}, {
    timestamps: true,
});
// Compound indexes for efficient queries
FraudHistorySchema.index({ userId: 1, createdAt: -1 });
FraudHistorySchema.index({ actionType: 1, createdAt: -1 });
FraudHistorySchema.index({ 'performedBy.adminId': 1, createdAt: -1 });
FraudHistorySchema.index({ actionSeverity: 1, createdAt: -1 });
// Static method: Get user's complete fraud history
FraudHistorySchema.statics.getUserHistory = async function (userId) {
    // Try to convert to ObjectId, fallback to string match
    let query;
    try {
        const objectId = new mongoose_1.default.Types.ObjectId(userId);
        query = { $or: [{ userId: objectId }, { userId: userId }] };
    }
    catch {
        query = { userId: userId };
    }
    return this.find(query)
        .sort({ createdAt: -1 })
        .populate('relatedAlertId', 'title status')
        .populate('relatedCompetitionId', 'name')
        .exec();
};
// Static method: Get action counts for a user
FraudHistorySchema.statics.getActionCounts = async function (userId) {
    // Try to convert to ObjectId, fallback to string match
    let matchQuery;
    try {
        const objectId = new mongoose_1.default.Types.ObjectId(userId);
        matchQuery = { $or: [{ userId: objectId }, { userId: userId }] };
    }
    catch {
        matchQuery = { userId: userId };
    }
    const counts = await this.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$actionType', count: { $sum: 1 } } },
    ]);
    const result = {};
    counts.forEach((item) => {
        result[item._id] = item.count;
    });
    return result;
};
// Static method: Get recent actions across all users
FraudHistorySchema.statics.getRecentActions = async function (limit = 50) {
    return this.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'email name')
        .exec();
};
// Static method: Log a new action
FraudHistorySchema.statics.logAction = async function (params) {
    const history = new this({
        userId: new mongoose_1.default.Types.ObjectId(params.userId),
        userEmail: params.userEmail,
        userName: params.userName,
        actionType: params.actionType,
        actionSeverity: params.actionSeverity,
        performedBy: {
            type: params.performedBy.type,
            adminId: params.performedBy.adminId
                ? new mongoose_1.default.Types.ObjectId(params.performedBy.adminId)
                : undefined,
            adminEmail: params.performedBy.adminEmail,
            adminName: params.performedBy.adminName,
        },
        reason: params.reason,
        details: params.details,
        relatedAlertId: params.relatedAlertId
            ? new mongoose_1.default.Types.ObjectId(params.relatedAlertId)
            : undefined,
        relatedRestrictionId: params.relatedRestrictionId
            ? new mongoose_1.default.Types.ObjectId(params.relatedRestrictionId)
            : undefined,
        relatedCompetitionId: params.relatedCompetitionId
            ? new mongoose_1.default.Types.ObjectId(params.relatedCompetitionId)
            : undefined,
        evidence: params.evidence,
        previousState: params.previousState,
        newState: params.newState,
        duration: params.duration,
        adminNotes: params.adminNotes,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
    return history.save();
};
exports.FraudHistory = (mongoose_1.default.models.FraudHistory ||
    mongoose_1.default.model('FraudHistory', FraudHistorySchema));
//# sourceMappingURL=fraud-history.model.js.map