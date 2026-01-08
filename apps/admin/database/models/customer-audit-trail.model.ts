import mongoose, { Schema, Document } from 'mongoose';

// Action categories for filtering
export type AuditActionCategory = 
  | 'assignment'      // Assigned, Transferred, Unassigned, Auto-reassigned
  | 'profile'         // Updated name/email/phone, Changed settings, Added note
  | 'financial'       // Deposit processed, Withdrawal approved/rejected/completed, Refund issued
  | 'kyc'             // KYC initiated, Verified, Rejected, Reset, Documents uploaded
  | 'fraud'           // Alert created, Investigated, Dismissed, User banned/suspended
  | 'trading'         // Position closed by admin, Restrictions applied
  | 'restriction'     // User banned, suspended, restricted
  | 'badge'           // Badge awarded, XP changed
  | 'note'            // Admin added note
  | 'other';          // Any other action

// Specific action types
export type AuditActionType =
  // Assignment actions
  | 'customer_assigned'
  | 'customer_transferred'
  | 'customer_unassigned'
  | 'customer_auto_reassigned'
  // Profile actions
  | 'profile_updated'
  | 'profile_viewed'
  | 'settings_changed'
  | 'password_reset'
  | 'email_changed'
  // Financial actions
  | 'deposit_processed'
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_completed'
  | 'withdrawal_failed'
  | 'refund_issued'
  | 'credits_adjusted'
  | 'wallet_updated'
  // KYC actions
  | 'kyc_initiated'
  | 'kyc_verified'
  | 'kyc_rejected'
  | 'kyc_reset'
  | 'kyc_documents_uploaded'
  | 'kyc_documents_reviewed'
  // Fraud actions
  | 'fraud_alert_created'
  | 'fraud_alert_investigated'
  | 'fraud_alert_dismissed'
  | 'fraud_alert_escalated'
  // Trading actions
  | 'position_closed_by_admin'
  | 'trade_cancelled'
  | 'competition_removed'
  | 'challenge_cancelled'
  // Restriction actions
  | 'user_banned'
  | 'user_unbanned'
  | 'user_suspended'
  | 'user_unsuspended'
  | 'user_restricted'
  | 'user_unrestricted'
  // Badge/XP actions
  | 'badge_awarded'
  | 'badge_removed'
  | 'xp_adjusted'
  | 'level_changed'
  // Other
  | 'note_added'
  | 'email_sent'
  | 'notification_sent'
  | 'custom_action';

export interface ICustomerAuditTrail extends Document {
  customerId: string;
  customerEmail: string;
  customerName: string;
  
  // Action details
  action: AuditActionType;
  actionCategory: AuditActionCategory;
  description: string;
  
  // Who performed the action
  performedBy: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    employeeRole: string;
    department: string;
    isSuperAdmin: boolean;
  };
  
  // Additional context
  metadata?: {
    previousValue?: any;
    newValue?: any;
    amount?: number;
    currency?: string;
    transactionId?: string;
    kycSessionId?: string;
    alertId?: string;
    positionId?: string;
    competitionId?: string;
    challengeId?: string;
    badgeId?: string;
    fromEmployee?: {
      id: string;
      name: string;
      email: string;
    };
    toEmployee?: {
      id: string;
      name: string;
      email: string;
    };
    reason?: string;
    notes?: string;
    [key: string]: any;
  };
  
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  
  createdAt: Date;
}

const CustomerAuditTrailSchema = new Schema<ICustomerAuditTrail>(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    
    // Action details
    action: {
      type: String,
      required: true,
      index: true,
    },
    actionCategory: {
      type: String,
      required: true,
      enum: ['assignment', 'profile', 'financial', 'kyc', 'fraud', 'trading', 'restriction', 'badge', 'note', 'other'],
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    
    // Who performed the action
    performedBy: {
      employeeId: {
        type: String,
        required: true,
        index: true,
      },
      employeeName: {
        type: String,
        required: true,
      },
      employeeEmail: {
        type: String,
        required: true,
        lowercase: true,
      },
      employeeRole: {
        type: String,
        required: true,
      },
      department: {
        type: String,
        required: true,
      },
      isSuperAdmin: {
        type: Boolean,
        default: false,
      },
    },
    
    // Additional context
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
    collection: 'customer_audit_trail',
  }
);

// Compound indexes for efficient queries
CustomerAuditTrailSchema.index({ customerId: 1, timestamp: -1 });
CustomerAuditTrailSchema.index({ customerId: 1, actionCategory: 1, timestamp: -1 });
CustomerAuditTrailSchema.index({ 'performedBy.employeeId': 1, timestamp: -1 });
CustomerAuditTrailSchema.index({ timestamp: -1 }); // For global queries

// Static methods
CustomerAuditTrailSchema.statics.getCustomerHistory = function(
  customerId: string,
  options: {
    category?: AuditActionCategory;
    limit?: number;
    skip?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const query: any = { customerId };
  
  if (options.category) {
    query.actionCategory = options.category;
  }
  
  if (options.startDate || options.endDate) {
    query.timestamp = {};
    if (options.startDate) query.timestamp.$gte = options.startDate;
    if (options.endDate) query.timestamp.$lte = options.endDate;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 50);
};

CustomerAuditTrailSchema.statics.getEmployeeActions = function(
  employeeId: string,
  options: { limit?: number; skip?: number } = {}
) {
  return this.find({ 'performedBy.employeeId': employeeId })
    .sort({ timestamp: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 50);
};

// Helper to create category-specific icon/color mapping
export const AUDIT_CATEGORY_CONFIG: Record<AuditActionCategory, { icon: string; color: string; label: string }> = {
  assignment: { icon: '🔄', color: 'blue', label: 'Assignment' },
  profile: { icon: '👤', color: 'gray', label: 'Profile' },
  financial: { icon: '💰', color: 'green', label: 'Financial' },
  kyc: { icon: '✅', color: 'purple', label: 'KYC' },
  fraud: { icon: '🚨', color: 'red', label: 'Fraud' },
  trading: { icon: '📈', color: 'orange', label: 'Trading' },
  restriction: { icon: '🚫', color: 'red', label: 'Restriction' },
  badge: { icon: '🏆', color: 'yellow', label: 'Badge' },
  note: { icon: '📝', color: 'gray', label: 'Note' },
  other: { icon: '📋', color: 'gray', label: 'Other' },
};

// Helper to get human-readable action descriptions
export function getActionDescription(action: AuditActionType, metadata?: any): string {
  const descriptions: Record<AuditActionType, string | ((m: any) => string)> = {
    // Assignment
    customer_assigned: (m) => m?.fromEmployee ? 
      `Customer assigned from ${m.fromEmployee.name} to ${m.toEmployee?.name}` : 
      `Customer assigned to ${m?.toEmployee?.name || 'employee'}`,
    customer_transferred: (m) => `Customer transferred from ${m?.fromEmployee?.name} to ${m?.toEmployee?.name}`,
    customer_unassigned: 'Customer unassigned',
    customer_auto_reassigned: (m) => `Customer auto-reassigned due to: ${m?.reason || 'employee deletion'}`,
    
    // Profile
    profile_updated: 'Profile information updated',
    profile_viewed: 'Profile viewed',
    settings_changed: 'Account settings changed',
    password_reset: 'Password reset initiated',
    email_changed: (m) => `Email changed from ${m?.previousValue} to ${m?.newValue}`,
    
    // Financial
    deposit_processed: (m) => `Deposit of ${m?.currency || '€'}${m?.amount?.toFixed(2) || '0.00'} processed`,
    withdrawal_requested: (m) => `Withdrawal of ${m?.currency || '€'}${m?.amount?.toFixed(2) || '0.00'} requested`,
    withdrawal_approved: (m) => `Withdrawal of ${m?.currency || '€'}${m?.amount?.toFixed(2) || '0.00'} approved`,
    withdrawal_rejected: (m) => `Withdrawal rejected: ${m?.reason || 'No reason provided'}`,
    withdrawal_completed: (m) => `Withdrawal of ${m?.currency || '€'}${m?.amount?.toFixed(2) || '0.00'} completed`,
    withdrawal_failed: (m) => `Withdrawal failed: ${m?.reason || 'Unknown error'}`,
    refund_issued: (m) => `Refund of ${m?.currency || '€'}${m?.amount?.toFixed(2) || '0.00'} issued`,
    credits_adjusted: (m) => `Credits adjusted by ${m?.amount > 0 ? '+' : ''}${m?.amount}`,
    wallet_updated: 'Wallet balance updated',
    
    // KYC
    kyc_initiated: 'KYC verification initiated',
    kyc_verified: 'KYC verification approved',
    kyc_rejected: (m) => `KYC verification rejected: ${m?.reason || 'No reason provided'}`,
    kyc_reset: 'KYC status reset',
    kyc_documents_uploaded: 'KYC documents uploaded',
    kyc_documents_reviewed: 'KYC documents reviewed',
    
    // Fraud
    fraud_alert_created: (m) => `Fraud alert created: ${m?.alertType || 'Unknown type'}`,
    fraud_alert_investigated: 'Fraud alert under investigation',
    fraud_alert_dismissed: (m) => `Fraud alert dismissed: ${m?.reason || 'No reason provided'}`,
    fraud_alert_escalated: 'Fraud alert escalated',
    
    // Trading
    position_closed_by_admin: (m) => `Position ${m?.positionId} closed by admin`,
    trade_cancelled: 'Trade cancelled',
    competition_removed: 'Removed from competition',
    challenge_cancelled: 'Challenge cancelled',
    
    // Restriction
    user_banned: (m) => `User banned: ${m?.reason || 'No reason provided'}`,
    user_unbanned: 'User unbanned',
    user_suspended: (m) => `User suspended: ${m?.reason || 'No reason provided'}`,
    user_unsuspended: 'User unsuspended',
    user_restricted: (m) => `User restricted: ${m?.reason || 'No reason provided'}`,
    user_unrestricted: 'User restrictions removed',
    
    // Badge/XP
    badge_awarded: (m) => `Badge "${m?.badgeId}" awarded`,
    badge_removed: (m) => `Badge "${m?.badgeId}" removed`,
    xp_adjusted: (m) => `XP adjusted by ${m?.amount > 0 ? '+' : ''}${m?.amount}`,
    level_changed: (m) => `Level changed from ${m?.previousValue} to ${m?.newValue}`,
    
    // Other
    note_added: 'Note added to customer record',
    email_sent: (m) => `Email sent: ${m?.subject || 'No subject'}`,
    notification_sent: 'Notification sent',
    custom_action: (m) => m?.description || 'Custom action performed',
  };
  
  const desc = descriptions[action];
  if (typeof desc === 'function') {
    return desc(metadata || {});
  }
  return desc || action;
}

export const CustomerAuditTrail = mongoose.models.CustomerAuditTrail || 
  mongoose.model<ICustomerAuditTrail>('CustomerAuditTrail', CustomerAuditTrailSchema);

export default CustomerAuditTrail;

