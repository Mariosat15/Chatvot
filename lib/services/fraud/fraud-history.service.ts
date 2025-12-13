import { FraudHistory, FraudActionType, ActionSeverity, LogActionParams } from '@/database/models/fraud/fraud-history.model';
import { connectToDatabase } from '@/database/mongoose';

interface UserInfo {
  userId: string;
  email: string;
  name: string;
}

interface AdminInfo {
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
}

interface StateInfo {
  suspicionScore?: number;
  restrictionStatus?: string;
  accountStatus?: string;
}

interface DurationInfo {
  startDate?: Date;
  endDate?: Date;
  isPermanent?: boolean;
  durationDays?: number;
}

export class FraudHistoryService {
  /**
   * Log a warning issued to a user
   */
  static async logWarning(
    user: UserInfo,
    reason: string,
    details: string,
    admin?: AdminInfo,
    relatedAlertId?: string
  ) {
    return this.logAction({
      ...user,
      actionType: 'warning_issued',
      actionSeverity: 'medium',
      reason,
      details,
      admin,
      relatedAlertId,
    });
  }

  /**
   * Log when investigation starts
   */
  static async logInvestigationStarted(
    user: UserInfo,
    reason: string,
    details: string,
    admin?: AdminInfo,
    relatedAlertId?: string,
    previousState?: StateInfo
  ) {
    return this.logAction({
      ...user,
      actionType: 'investigation_started',
      actionSeverity: 'high',
      reason,
      details,
      admin,
      relatedAlertId,
      previousState,
    });
  }

  /**
   * Log when investigation is resolved
   */
  static async logInvestigationResolved(
    user: UserInfo,
    reason: string,
    details: string,
    admin?: AdminInfo,
    relatedAlertId?: string,
    newState?: StateInfo
  ) {
    return this.logAction({
      ...user,
      actionType: 'investigation_resolved',
      actionSeverity: 'medium',
      reason,
      details,
      admin,
      relatedAlertId,
      newState,
    });
  }

  /**
   * Log user suspension
   */
  static async logSuspension(
    user: UserInfo,
    reason: string,
    details: string,
    duration?: DurationInfo,
    admin?: AdminInfo,
    relatedAlertId?: string,
    previousState?: StateInfo
  ) {
    return this.logAction({
      ...user,
      actionType: 'suspended',
      actionSeverity: 'high',
      reason,
      details,
      duration,
      admin,
      relatedAlertId,
      previousState,
      newState: { accountStatus: 'suspended' },
    });
  }

  /**
   * Log suspension lifted
   */
  static async logSuspensionLifted(
    user: UserInfo,
    reason: string,
    details: string,
    admin?: AdminInfo,
    previousState?: StateInfo
  ) {
    return this.logAction({
      ...user,
      actionType: 'suspension_lifted',
      actionSeverity: 'low',
      reason,
      details,
      admin,
      previousState,
      newState: { accountStatus: 'active' },
    });
  }

  /**
   * Log user ban
   */
  static async logBan(
    user: UserInfo,
    reason: string,
    details: string,
    isPermanent: boolean,
    admin?: AdminInfo,
    relatedAlertId?: string,
    previousState?: StateInfo
  ) {
    return this.logAction({
      ...user,
      actionType: 'banned',
      actionSeverity: 'critical',
      reason,
      details,
      duration: { isPermanent },
      admin,
      relatedAlertId,
      previousState,
      newState: { accountStatus: 'banned' },
    });
  }

  /**
   * Log ban lifted
   */
  static async logBanLifted(
    user: UserInfo,
    reason: string,
    details: string,
    admin?: AdminInfo,
    previousState?: StateInfo
  ) {
    return this.logAction({
      ...user,
      actionType: 'ban_lifted',
      actionSeverity: 'medium',
      reason,
      details,
      admin,
      previousState,
      newState: { accountStatus: 'active' },
    });
  }

  /**
   * Log restriction added
   */
  static async logRestrictionAdded(
    user: UserInfo,
    restrictionType: string,
    reason: string,
    details: string,
    admin?: AdminInfo,
    relatedRestrictionId?: string,
    relatedAlertId?: string
  ) {
    return this.logAction({
      ...user,
      actionType: 'restriction_added',
      actionSeverity: 'high',
      reason: `${restrictionType}: ${reason}`,
      details,
      admin,
      relatedAlertId,
      relatedRestrictionId,
    });
  }

  /**
   * Log restriction removed
   */
  static async logRestrictionRemoved(
    user: UserInfo,
    restrictionType: string,
    reason: string,
    details: string,
    admin?: AdminInfo,
    relatedRestrictionId?: string
  ) {
    return this.logAction({
      ...user,
      actionType: 'restriction_removed',
      actionSeverity: 'low',
      reason: `${restrictionType}: ${reason}`,
      details,
      admin,
      relatedRestrictionId,
    });
  }

  /**
   * Log alert created
   */
  static async logAlertCreated(
    user: UserInfo,
    alertType: string,
    reason: string,
    details: string,
    relatedAlertId?: string,
    evidence?: LogActionParams['evidence']
  ) {
    return this.logAction({
      ...user,
      actionType: 'alert_created',
      actionSeverity: 'medium',
      reason: `${alertType}: ${reason}`,
      details,
      relatedAlertId,
      evidence,
      isAutomated: true,
    });
  }

  /**
   * Log alert dismissed
   */
  static async logAlertDismissed(
    user: UserInfo,
    reason: string,
    details: string,
    admin?: AdminInfo,
    relatedAlertId?: string
  ) {
    return this.logAction({
      ...user,
      actionType: 'alert_dismissed',
      actionSeverity: 'low',
      reason,
      details,
      admin,
      relatedAlertId,
    });
  }

  /**
   * Log alert resolved
   */
  static async logAlertResolved(
    user: UserInfo,
    reason: string,
    details: string,
    admin?: AdminInfo,
    relatedAlertId?: string
  ) {
    return this.logAction({
      ...user,
      actionType: 'alert_resolved',
      actionSeverity: 'low',
      reason,
      details,
      admin,
      relatedAlertId,
    });
  }

  /**
   * Log new evidence added
   */
  static async logEvidenceAdded(
    user: UserInfo,
    evidenceType: string,
    reason: string,
    details: string,
    relatedAlertId?: string,
    evidence?: LogActionParams['evidence']
  ) {
    return this.logAction({
      ...user,
      actionType: 'evidence_added',
      actionSeverity: 'medium',
      reason: `${evidenceType}: ${reason}`,
      details,
      relatedAlertId,
      evidence,
      isAutomated: true,
    });
  }

  /**
   * Log automated action
   */
  static async logAutoAction(
    user: UserInfo,
    reason: string,
    details: string,
    severity: ActionSeverity = 'high',
    previousState?: StateInfo,
    newState?: StateInfo
  ) {
    return this.logAction({
      ...user,
      actionType: 'auto_action',
      actionSeverity: severity,
      reason,
      details,
      isAutomated: true,
      previousState,
      newState,
    });
  }

  /**
   * Log manual review
   */
  static async logManualReview(
    user: UserInfo,
    reason: string,
    details: string,
    admin: AdminInfo,
    adminNotes?: string,
    relatedAlertId?: string
  ) {
    return this.logAction({
      ...user,
      actionType: 'manual_review',
      actionSeverity: 'low',
      reason,
      details,
      admin,
      adminNotes,
      relatedAlertId,
    });
  }

  /**
   * Generic action logger
   */
  private static async logAction(params: {
    userId: string;
    email: string;
    name: string;
    actionType: FraudActionType;
    actionSeverity: ActionSeverity;
    reason: string;
    details: string;
    admin?: AdminInfo;
    relatedAlertId?: string;
    relatedRestrictionId?: string;
    relatedCompetitionId?: string;
    evidence?: LogActionParams['evidence'];
    previousState?: StateInfo;
    newState?: StateInfo;
    duration?: DurationInfo;
    adminNotes?: string;
    isAutomated?: boolean;
  }) {
    try {
      await connectToDatabase();

      const performedBy = params.isAutomated
        ? { type: 'automated' as const }
        : params.admin?.adminId
        ? {
            type: 'admin' as const,
            adminId: params.admin.adminId,
            adminEmail: params.admin.adminEmail,
            adminName: params.admin.adminName || params.admin.adminEmail?.split('@')[0],
          }
        : { type: 'system' as const };

      const entry = await FraudHistory.logAction({
        userId: params.userId,
        userEmail: params.email,
        userName: params.name,
        actionType: params.actionType,
        actionSeverity: params.actionSeverity,
        performedBy,
        reason: params.reason,
        details: params.details,
        relatedAlertId: params.relatedAlertId,
        relatedRestrictionId: params.relatedRestrictionId,
        relatedCompetitionId: params.relatedCompetitionId,
        evidence: params.evidence,
        previousState: params.previousState,
        newState: params.newState,
        duration: params.duration,
        adminNotes: params.adminNotes,
      });

      console.log(`[FraudHistory] Logged ${params.actionType} for user ${params.email}`);
      return entry;
    } catch (error) {
      console.error('[FraudHistory] Error logging action:', error);
      // Don't throw - history logging should not break main flows
      return null;
    }
  }

  /**
   * Get user's fraud history summary
   */
  static async getUserSummary(userId: string) {
    await connectToDatabase();
    
    const [history, actionCounts] = await Promise.all([
      FraudHistory.getUserHistory(userId),
      FraudHistory.getActionCounts(userId),
    ]);

    const suspensionCount = actionCounts.suspended || 0;
    const banCount = actionCounts.banned || 0;
    const warningCount = actionCounts.warning_issued || 0;
    const liftCount = (actionCounts.suspension_lifted || 0) + (actionCounts.ban_lifted || 0);

    return {
      history,
      counts: actionCounts,
      summary: {
        totalIncidents: history.length,
        suspensionCount,
        banCount,
        warningCount,
        liftCount,
        isRepeatOffender: suspensionCount > 1 || banCount > 0,
        hasBeenRehabbed: liftCount > 0,
      },
    };
  }
}

