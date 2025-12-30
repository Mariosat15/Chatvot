import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Security Log Model
 * Stores all security-relevant API requests for auditing
 */

export interface ISecurityLog extends Document {
  // Request Info
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent?: string;
  
  // Endpoint Info
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  category: 'deposit' | 'withdrawal' | 'auth' | 'admin' | 'wallet' | 'kyc' | 'other';
  
  // Request Details (sanitized - no sensitive data)
  requestBody?: Record<string, unknown>;
  queryParams?: Record<string, string>;
  
  // Response Info
  statusCode: number;
  responseTime: number; // milliseconds
  success: boolean;
  errorMessage?: string;
  
  // Rate Limiting
  rateLimitRemaining?: number;
  rateLimitExceeded: boolean;
  
  // Security Flags
  suspicious: boolean;
  suspiciousReasons?: string[];
  
  // Metadata
  createdAt: Date;
}

interface ISecurityLogModel extends Model<ISecurityLog> {
  logRequest(data: Partial<ISecurityLog>): Promise<ISecurityLog>;
  getRecentLogs(options: {
    userId?: string;
    category?: string;
    suspicious?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<ISecurityLog[]>;
  getSuspiciousActivity(hours?: number): Promise<ISecurityLog[]>;
  getLogStats(hours?: number): Promise<{
    totalRequests: number;
    failedRequests: number;
    rateLimitExceeded: number;
    suspiciousRequests: number;
    byCategory: Record<string, number>;
    byEndpoint: Record<string, number>;
  }>;
}

const SecurityLogSchema = new Schema<ISecurityLog>(
  {
    // Request Info
    userId: {
      type: String,
      index: true,
    },
    userEmail: String,
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: String,
    
    // Endpoint Info
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['deposit', 'withdrawal', 'auth', 'admin', 'wallet', 'kyc', 'other'],
      default: 'other',
      index: true,
    },
    
    // Request Details
    requestBody: Schema.Types.Mixed,
    queryParams: Schema.Types.Mixed,
    
    // Response Info
    statusCode: {
      type: Number,
      required: true,
      index: true,
    },
    responseTime: {
      type: Number,
      required: true,
    },
    success: {
      type: Boolean,
      required: true,
      index: true,
    },
    errorMessage: String,
    
    // Rate Limiting
    rateLimitRemaining: Number,
    rateLimitExceeded: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    // Security Flags
    suspicious: {
      type: Boolean,
      default: false,
      index: true,
    },
    suspiciousReasons: [String],
  },
  {
    timestamps: true,
  }
);

// Index for time-based queries
SecurityLogSchema.index({ createdAt: -1 });

// Compound indexes for common queries
SecurityLogSchema.index({ userId: 1, createdAt: -1 });
SecurityLogSchema.index({ category: 1, createdAt: -1 });
SecurityLogSchema.index({ suspicious: 1, createdAt: -1 });

// TTL index - automatically delete logs older than 90 days
SecurityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static method to log a request
SecurityLogSchema.statics.logRequest = async function (data: Partial<ISecurityLog>): Promise<ISecurityLog> {
  // Detect suspicious activity
  const suspiciousReasons: string[] = [];
  
  // Check for rate limit exceeded
  if (data.rateLimitExceeded) {
    suspiciousReasons.push('Rate limit exceeded');
  }
  
  // Check for multiple failed requests
  if (data.statusCode && data.statusCode >= 400) {
    // Check recent failures from same IP
    const recentFailures = await this.countDocuments({
      ipAddress: data.ipAddress,
      success: false,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
    });
    
    if (recentFailures >= 5) {
      suspiciousReasons.push(`Multiple failures from IP (${recentFailures} in 5 min)`);
    }
  }
  
  // Check for unusual user agents
  if (data.userAgent) {
    const ua = data.userAgent.toLowerCase();
    if (ua.includes('curl') || ua.includes('python') || ua.includes('postman')) {
      suspiciousReasons.push('Non-browser user agent');
    }
  }
  
  // Mark as suspicious if any reasons found
  const suspicious = suspiciousReasons.length > 0;
  
  return this.create({
    ...data,
    suspicious,
    suspiciousReasons: suspicious ? suspiciousReasons : undefined,
  });
};

// Static method to get recent logs
SecurityLogSchema.statics.getRecentLogs = async function (options: {
  userId?: string;
  category?: string;
  suspicious?: boolean;
  limit?: number;
  skip?: number;
}): Promise<ISecurityLog[]> {
  const query: Record<string, unknown> = {};
  
  if (options.userId) query.userId = options.userId;
  if (options.category) query.category = options.category;
  if (options.suspicious !== undefined) query.suspicious = options.suspicious;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 100)
    .lean();
};

// Static method to get suspicious activity
SecurityLogSchema.statics.getSuspiciousActivity = async function (hours = 24): Promise<ISecurityLog[]> {
  return this.find({
    suspicious: true,
    createdAt: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
  })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
};

// Static method to get log statistics
SecurityLogSchema.statics.getLogStats = async function (hours = 24): Promise<{
  totalRequests: number;
  failedRequests: number;
  rateLimitExceeded: number;
  suspiciousRequests: number;
  byCategory: Record<string, number>;
  byEndpoint: Record<string, number>;
}> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const [totals, byCategory, byEndpoint] = await Promise.all([
    this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          failedRequests: { $sum: { $cond: ['$success', 0, 1] } },
          rateLimitExceeded: { $sum: { $cond: ['$rateLimitExceeded', 1, 0] } },
          suspiciousRequests: { $sum: { $cond: ['$suspicious', 1, 0] } },
        },
      },
    ]),
    this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$endpoint', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
  ]);
  
  const stats = totals[0] || {
    totalRequests: 0,
    failedRequests: 0,
    rateLimitExceeded: 0,
    suspiciousRequests: 0,
  };
  
  return {
    ...stats,
    byCategory: Object.fromEntries(byCategory.map((c: { _id: string; count: number }) => [c._id, c.count])),
    byEndpoint: Object.fromEntries(byEndpoint.map((e: { _id: string; count: number }) => [e._id, e.count])),
  };
};

const SecurityLog =
  (mongoose.models?.SecurityLog as unknown as ISecurityLogModel) ||
  mongoose.model<ISecurityLog, ISecurityLogModel>('SecurityLog', SecurityLogSchema);

export default SecurityLog;

