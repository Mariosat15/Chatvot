import { CustomerAuditTrail, AuditActionCategory, AuditActionType, getActionDescription } from '@/database/models/customer-audit-trail.model';
import { CustomerAssignment } from '@/database/models/customer-assignment.model';
import { AssignmentSettings, AssignmentStrategy } from '@/database/models/assignment-settings.model';
import { dbConnect } from '@/database/connection';

export interface PerformedBy {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  department?: string;
  isSuperAdmin?: boolean;
}

export interface CustomerInfo {
  customerId: string;
  customerEmail: string;
  customerName: string;
}

export interface LogAuditParams {
  customer: CustomerInfo;
  action: AuditActionType;
  actionCategory: AuditActionCategory;
  performedBy: PerformedBy;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

class CustomerAuditService {
  /**
   * Log an action to the customer audit trail
   */
  async logAction(params: LogAuditParams): Promise<void> {
    try {
      await dbConnect();
      
      const description = params.description || getActionDescription(params.action, params.metadata);
      
      await CustomerAuditTrail.create({
        customerId: params.customer.customerId,
        customerEmail: params.customer.customerEmail,
        customerName: params.customer.customerName,
        action: params.action,
        actionCategory: params.actionCategory,
        description,
        performedBy: {
          employeeId: params.performedBy.employeeId,
          employeeName: params.performedBy.employeeName,
          employeeEmail: params.performedBy.employeeEmail,
          employeeRole: params.performedBy.employeeRole,
          department: params.performedBy.department || this.getDepartmentFromRole(params.performedBy.employeeRole),
          isSuperAdmin: params.performedBy.isSuperAdmin || false,
        },
        metadata: params.metadata,
        timestamp: new Date(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      
      console.log(`📋 [Audit] Logged: ${params.action} for customer ${params.customer.customerEmail} by ${params.performedBy.employeeEmail}`);
    } catch (error) {
      console.error('❌ [Audit] Failed to log action:', error);
      // Don't throw - audit logging should not break main flow
    }
  }
  
  /**
   * Get department from role name
   */
  private getDepartmentFromRole(role: string): string {
    const roleLower = role.toLowerCase();
    if (roleLower.includes('finance') || roleLower.includes('financial')) return 'Finance';
    if (roleLower.includes('compliance') || roleLower.includes('kyc')) return 'Compliance';
    if (roleLower.includes('fraud') || roleLower.includes('security')) return 'Security';
    if (roleLower.includes('super') || roleLower.includes('admin')) return 'Admin';
    return 'Backoffice';
  }
  
  // ==================== ASSIGNMENT ACTIONS ====================
  
  async logCustomerAssigned(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    toEmployee: { id: string; name: string; email: string },
    assignmentType: 'auto' | 'admin' | 'self' | 'transfer' | 'reassign',
    metadata?: { strategy?: string; reason?: string }
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'customer_assigned',
      actionCategory: 'assignment',
      performedBy,
      metadata: {
        toEmployee: { id: toEmployee.id, name: toEmployee.name, email: toEmployee.email },
        assignmentType,
        ...metadata,
      },
    });
  }
  
  async logCustomerTransferred(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    fromEmployee: { id: string; name: string; email: string },
    toEmployee: { id: string; name: string; email: string },
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'customer_transferred',
      actionCategory: 'assignment',
      performedBy,
      metadata: {
        fromEmployee,
        toEmployee,
        reason,
      },
    });
  }
  
  async logCustomerUnassigned(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    previousEmployee: { id: string; name: string; email: string },
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'customer_unassigned',
      actionCategory: 'assignment',
      performedBy,
      metadata: {
        fromEmployee: previousEmployee,
        reason,
      },
    });
  }
  
  async logCustomerAutoReassigned(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    fromEmployee: { id: string; name: string; email: string },
    toEmployee: { id: string; name: string; email: string },
    reason: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'customer_auto_reassigned',
      actionCategory: 'assignment',
      performedBy,
      metadata: {
        fromEmployee,
        toEmployee,
        reason,
      },
    });
  }
  
  // ==================== PROFILE ACTIONS ====================
  
  async logProfileUpdated(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    changes: { field: string; previousValue?: any; newValue?: any }[]
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'profile_updated',
      actionCategory: 'profile',
      performedBy,
      description: `Updated: ${changes.map(c => c.field).join(', ')}`,
      metadata: { changes },
    });
  }
  
  async logProfileViewed(
    customer: CustomerInfo,
    performedBy: PerformedBy
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'profile_viewed',
      actionCategory: 'profile',
      performedBy,
    });
  }
  
  // ==================== FINANCIAL ACTIONS ====================
  
  async logDepositProcessed(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    amount: number,
    currency: string,
    transactionId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'deposit_processed',
      actionCategory: 'financial',
      performedBy,
      metadata: { amount, currency, transactionId },
    });
  }
  
  async logWithdrawalApproved(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    amount: number,
    currency: string,
    transactionId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'withdrawal_approved',
      actionCategory: 'financial',
      performedBy,
      metadata: { amount, currency, transactionId },
    });
  }
  
  async logWithdrawalRejected(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    amount: number,
    currency: string,
    reason: string,
    transactionId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'withdrawal_rejected',
      actionCategory: 'financial',
      performedBy,
      metadata: { amount, currency, reason, transactionId },
    });
  }
  
  async logWithdrawalCompleted(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    amount: number,
    currency: string,
    transactionId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'withdrawal_completed',
      actionCategory: 'financial',
      performedBy,
      metadata: { amount, currency, transactionId },
    });
  }
  
  async logRefundIssued(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    amount: number,
    currency: string,
    reason?: string,
    transactionId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'refund_issued',
      actionCategory: 'financial',
      performedBy,
      metadata: { amount, currency, reason, transactionId },
    });
  }
  
  async logCreditsAdjusted(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    amount: number,
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'credits_adjusted',
      actionCategory: 'financial',
      performedBy,
      metadata: { amount, reason },
    });
  }
  
  // ==================== KYC ACTIONS ====================
  
  async logKycInitiated(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    sessionId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'kyc_initiated',
      actionCategory: 'kyc',
      performedBy,
      metadata: { kycSessionId: sessionId },
    });
  }
  
  async logKycVerified(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    sessionId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'kyc_verified',
      actionCategory: 'kyc',
      performedBy,
      metadata: { kycSessionId: sessionId },
    });
  }
  
  async logKycRejected(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    reason: string,
    sessionId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'kyc_rejected',
      actionCategory: 'kyc',
      performedBy,
      metadata: { reason, kycSessionId: sessionId },
    });
  }
  
  async logKycReset(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'kyc_reset',
      actionCategory: 'kyc',
      performedBy,
      metadata: { reason },
    });
  }
  
  // ==================== FRAUD ACTIONS ====================
  
  async logFraudAlertCreated(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    alertType: string,
    alertId?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'fraud_alert_created',
      actionCategory: 'fraud',
      performedBy,
      metadata: { alertType, alertId },
    });
  }
  
  async logFraudAlertInvestigated(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    alertId: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'fraud_alert_investigated',
      actionCategory: 'fraud',
      performedBy,
      metadata: { alertId },
    });
  }
  
  async logFraudAlertDismissed(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    alertId: string,
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'fraud_alert_dismissed',
      actionCategory: 'fraud',
      performedBy,
      metadata: { alertId, reason },
    });
  }
  
  // ==================== RESTRICTION ACTIONS ====================
  
  async logUserBanned(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'user_banned',
      actionCategory: 'restriction',
      performedBy,
      metadata: { reason },
    });
  }
  
  async logUserUnbanned(
    customer: CustomerInfo,
    performedBy: PerformedBy
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'user_unbanned',
      actionCategory: 'restriction',
      performedBy,
    });
  }
  
  async logUserSuspended(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'user_suspended',
      actionCategory: 'restriction',
      performedBy,
      metadata: { reason },
    });
  }
  
  async logUserUnsuspended(
    customer: CustomerInfo,
    performedBy: PerformedBy
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'user_unsuspended',
      actionCategory: 'restriction',
      performedBy,
    });
  }
  
  async logUserRestricted(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    restrictions: string[],
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'user_restricted',
      actionCategory: 'restriction',
      performedBy,
      metadata: { restrictions, reason },
    });
  }
  
  // ==================== TRADING ACTIONS ====================
  
  async logPositionClosedByAdmin(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    positionId: string,
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'position_closed_by_admin',
      actionCategory: 'trading',
      performedBy,
      metadata: { positionId, reason },
    });
  }
  
  async logCompetitionRemoved(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    competitionId: string,
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'competition_removed',
      actionCategory: 'trading',
      performedBy,
      metadata: { competitionId, reason },
    });
  }
  
  async logChallengeDeclined(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    challengeId: string,
    reason?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'challenge_cancelled',
      actionCategory: 'trading',
      performedBy,
      metadata: { challengeId, reason },
    });
  }
  
  // ==================== NOTE ACTIONS ====================
  
  async logNoteAdded(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    note: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'note_added',
      actionCategory: 'note',
      performedBy,
      metadata: { notes: note },
    });
  }
  
  // ==================== BADGE ACTIONS ====================
  
  async logBadgeAwarded(
    customer: CustomerInfo,
    performedBy: PerformedBy,
    badgeId: string,
    badgeName?: string
  ): Promise<void> {
    await this.logAction({
      customer,
      action: 'badge_awarded',
      actionCategory: 'badge',
      performedBy,
      metadata: { badgeId, badgeName },
    });
  }
  
  // ==================== QUERY METHODS ====================
  
  /**
   * Get audit trail for a customer
   */
  async getCustomerAuditTrail(
    customerId: string,
    options: {
      category?: AuditActionCategory;
      limit?: number;
      skip?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    await dbConnect();
    
    const query: any = { customerId };
    
    if (options.category) {
      query.actionCategory = options.category;
    }
    
    if (options.startDate || options.endDate) {
      query.timestamp = {};
      if (options.startDate) query.timestamp.$gte = options.startDate;
      if (options.endDate) query.timestamp.$lte = options.endDate;
    }
    
    const [entries, total] = await Promise.all([
      CustomerAuditTrail.find(query)
        .sort({ timestamp: -1 })
        .skip(options.skip || 0)
        .limit(options.limit || 50)
        .lean(),
      CustomerAuditTrail.countDocuments(query),
    ]);
    
    return { entries, total };
  }
  
  /**
   * Get audit trail for actions performed by an employee
   */
  async getEmployeeAuditTrail(
    employeeId: string,
    options: { limit?: number; skip?: number } = {}
  ) {
    await dbConnect();
    
    const [entries, total] = await Promise.all([
      CustomerAuditTrail.find({ 'performedBy.employeeId': employeeId })
        .sort({ timestamp: -1 })
        .skip(options.skip || 0)
        .limit(options.limit || 50)
        .lean(),
      CustomerAuditTrail.countDocuments({ 'performedBy.employeeId': employeeId }),
    ]);
    
    return { entries, total };
  }
  
  /**
   * Get audit statistics for a customer
   */
  async getCustomerAuditStats(customerId: string) {
    await dbConnect();
    
    const stats = await CustomerAuditTrail.aggregate([
      { $match: { customerId } },
      {
        $group: {
          _id: '$actionCategory',
          count: { $sum: 1 },
          lastAction: { $max: '$timestamp' },
        },
      },
    ]);
    
    return stats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, lastAction: stat.lastAction };
      return acc;
    }, {} as Record<string, { count: number; lastAction: Date }>);
  }
}

// Export singleton instance
export const customerAuditService = new CustomerAuditService();

export default customerAuditService;

