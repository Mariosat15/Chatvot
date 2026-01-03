import mongoose, { Schema, Document, Model } from 'mongoose';

// Types of actions that can be taken on a user
export type FraudActionType = 
  | 'warning_issued'
  | 'investigation_started'
  | 'investigation_resolved'
  | 'suspended'
  | 'suspension_lifted'
  | 'banned'
  | 'ban_lifted'
  | 'restriction_added'
  | 'restriction_removed'
  | 'alert_created'
  | 'alert_dismissed'
  | 'alert_resolved'
  | 'evidence_added'
  | 'manual_review'
  | 'auto_action'
  | 'account_locked'
  | 'account_unlocked';

// Severity levels for tracking escalation
export type ActionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IFraudHistory extends Document {
  // Target user information
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userName: string;
  
  // Action details
  actionType: FraudActionType;
  actionSeverity: ActionSeverity;
  
  // Who performed the action
  performedBy: {
    type: 'admin' | 'system' | 'automated';
    adminId?: mongoose.Types.ObjectId;
    adminEmail?: string;
    adminName?: string;
  };
  
  // Related records
  relatedAlertId?: mongoose.Types.ObjectId;
  relatedRestrictionId?: mongoose.Types.ObjectId;
  relatedCompetitionId?: mongoose.Types.ObjectId;
  
  // Action context
  reason: string;
  details: string;
  evidence?: {
    type: string;
    description: string;
    value?: string | number;
    timestamp?: Date;
  }[];
  
  // Previous state (for tracking changes)
  previousState?: {
    suspicionScore?: number;
    restrictionStatus?: string;
    accountStatus?: string;
  };
  
  // New state after action
  newState?: {
    suspicionScore?: number;
    restrictionStatus?: string;
    accountStatus?: string;
  };
  
  // Duration tracking (for suspensions/bans)
  duration?: {
    startDate?: Date;
    endDate?: Date;
    isPermanent?: boolean;
    durationDays?: number;
  };
  
  // Notes from admin
  adminNotes?: string;
  
  // Metadata
  ipAddress?: string;
  userAgent?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IFraudHistoryModel extends Model<IFraudHistory> {
  // Static methods for common queries
  getUserHistory(userId: string): Promise<IFraudHistory[]>;
  getActionCounts(userId: string): Promise<Record<FraudActionType, number>>;
  getRecentActions(limit?: number): Promise<IFraudHistory[]>;
  logAction(params: LogActionParams): Promise<IFraudHistory>;
}

export interface LogActionParams {
  userId: string;
  userEmail: string;
  userName: string;
  actionType: FraudActionType;
  actionSeverity: ActionSeverity;
  performedBy: {
    type: 'admin' | 'system' | 'automated';
    adminId?: string;
    adminEmail?: string;
    adminName?: string;
  };
  reason: string;
  details: string;
  relatedAlertId?: string;
  relatedRestrictionId?: string;
  relatedCompetitionId?: string;
  evidence?: {
    type: string;
    description: string;
    value?: string | number;
    timestamp?: Date;
  }[];
  previousState?: {
    suspicionScore?: number;
    restrictionStatus?: string;
    accountStatus?: string;
  };
  newState?: {
    suspicionScore?: number;
    restrictionStatus?: string;
    accountStatus?: string;
  };
  duration?: {
    startDate?: Date;
    endDate?: Date;
    isPermanent?: boolean;
    durationDays?: number;
  };
  adminNotes?: string;
  ipAddress?: string;
  userAgent?: string;
}

const FraudHistorySchema = new Schema<IFraudHistory>(
  {
    userId: {
      type: Schema.Types.Mixed, // Accept both ObjectId and String (for UUIDs)
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
        'account_locked',
        'account_unlocked',
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
        type: Schema.Types.ObjectId,
        ref: 'Admin',
      },
      adminEmail: String,
      adminName: String,
    },
    relatedAlertId: {
      type: Schema.Types.ObjectId,
      ref: 'FraudAlert',
    },
    relatedRestrictionId: {
      type: Schema.Types.ObjectId,
      ref: 'UserRestriction',
    },
    relatedCompetitionId: {
      type: Schema.Types.ObjectId,
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
      value: Schema.Types.Mixed,
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
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
FraudHistorySchema.index({ userId: 1, createdAt: -1 });
FraudHistorySchema.index({ actionType: 1, createdAt: -1 });
FraudHistorySchema.index({ 'performedBy.adminId': 1, createdAt: -1 });
FraudHistorySchema.index({ actionSeverity: 1, createdAt: -1 });

// Static method: Get user's complete fraud history
FraudHistorySchema.statics.getUserHistory = async function(
  userId: string
): Promise<IFraudHistory[]> {
  // Try to convert to ObjectId, fallback to string match
  let query;
  try {
    const objectId = new mongoose.Types.ObjectId(userId);
    query = { $or: [{ userId: objectId }, { userId: userId }] };
  } catch {
    query = { userId: userId };
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('relatedAlertId', 'title status')
    .populate('relatedCompetitionId', 'name')
    .exec();
};

// Static method: Get action counts for a user
FraudHistorySchema.statics.getActionCounts = async function(
  userId: string
): Promise<Record<FraudActionType, number>> {
  // Try to convert to ObjectId, fallback to string match
  let matchQuery;
  try {
    const objectId = new mongoose.Types.ObjectId(userId);
    matchQuery = { $or: [{ userId: objectId }, { userId: userId }] };
  } catch {
    matchQuery = { userId: userId };
  }
  
  const counts = await this.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$actionType', count: { $sum: 1 } } },
  ]);
  
  const result: Record<string, number> = {};
  counts.forEach((item: { _id: string; count: number }) => {
    result[item._id] = item.count;
  });
  
  return result;
};

// Static method: Get recent actions across all users
FraudHistorySchema.statics.getRecentActions = async function(
  limit: number = 50
): Promise<IFraudHistory[]> {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'email name')
    .exec();
};

// Helper to safely convert to ObjectId or return null
function safeObjectId(id: string | undefined | null): mongoose.Types.ObjectId | null {
  if (!id) return null;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return new mongoose.Types.ObjectId(id);
    }
  } catch {
    // Invalid ObjectId format
  }
  return null;
}

// Static method: Log a new action
FraudHistorySchema.statics.logAction = async function(
  params: LogActionParams
): Promise<IFraudHistory> {
  // Handle userId - can be ObjectId string or UUID string
  let userIdValue: mongoose.Types.ObjectId | string = params.userId;
  const objectId = safeObjectId(params.userId);
  if (objectId) {
    userIdValue = objectId;
  }
  
  const history = new this({
    userId: userIdValue,
    userEmail: params.userEmail,
    userName: params.userName,
    actionType: params.actionType,
    actionSeverity: params.actionSeverity,
    performedBy: {
      type: params.performedBy.type,
      adminId: safeObjectId(params.performedBy.adminId),
      adminEmail: params.performedBy.adminEmail,
      adminName: params.performedBy.adminName,
    },
    reason: params.reason,
    details: params.details,
    relatedAlertId: safeObjectId(params.relatedAlertId),
    relatedRestrictionId: safeObjectId(params.relatedRestrictionId),
    relatedCompetitionId: safeObjectId(params.relatedCompetitionId),
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

export const FraudHistory = (mongoose.models.FraudHistory ||
  mongoose.model<IFraudHistory, IFraudHistoryModel>(
    'FraudHistory',
    FraudHistorySchema
  )) as IFraudHistoryModel;

