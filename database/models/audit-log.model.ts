import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  // Who performed the action
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'admin' | 'superadmin' | 'moderator' | 'user';
  
  // What action was performed
  action: string;
  actionCategory: 
    | 'user_management'
    | 'financial'
    | 'competition'
    | 'settings'
    | 'content'
    | 'security'
    | 'system'
    | 'data'
    | 'other';
  
  // Details about the action
  description: string;
  targetType?: 'user' | 'competition' | 'transaction' | 'settings' | 'system' | 'other';
  targetId?: string;
  targetName?: string;
  
  // Additional context
  metadata?: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
  
  // Request info
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  
  // Status
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  
  // Timestamps
  createdAt: Date;
}

export interface IAuditLogModel extends Model<IAuditLog> {
  logAction(params: {
    userId: string;
    userName: string;
    userEmail: string;
    userRole?: 'admin' | 'superadmin' | 'moderator' | 'user';
    action: string;
    actionCategory: IAuditLog['actionCategory'];
    description: string;
    targetType?: IAuditLog['targetType'];
    targetId?: string;
    targetName?: string;
    metadata?: Record<string, unknown>;
    previousValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
    requestMethod?: string;
    status?: 'success' | 'failed' | 'pending';
    errorMessage?: string;
  }): Promise<IAuditLog>;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
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
      type: Schema.Types.Mixed,
      default: {},
    },
    previousValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
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
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ actionCategory: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ status: 1, createdAt: -1 });

// Static method to log an action
AuditLogSchema.statics.logAction = async function(params: Parameters<IAuditLogModel['logAction']>[0]) {
  try {
    const log = await this.create({
      ...params,
      status: params.status || 'success',
    });
    console.log(`📋 [AUDIT] ${params.action} by ${params.userEmail}: ${params.description}`);
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    throw error;
  }
};

const AuditLog = (mongoose.models.AuditLog as IAuditLogModel) || 
  mongoose.model<IAuditLog, IAuditLogModel>('AuditLog', AuditLogSchema);

export default AuditLog;

