"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudHistoryService = void 0;
const fraud_history_model_1 = require("@/database/models/fraud/fraud-history.model");
const mongoose_1 = require("@/database/mongoose");
class FraudHistoryService {
    /**
     * Log a warning issued to a user
     */
    static async logWarning(user, reason, details, admin, relatedAlertId) {
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
    static async logInvestigationStarted(user, reason, details, admin, relatedAlertId, previousState) {
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
    static async logInvestigationResolved(user, reason, details, admin, relatedAlertId, newState) {
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
    static async logSuspension(user, reason, details, duration, admin, relatedAlertId, previousState) {
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
    static async logSuspensionLifted(user, reason, details, admin, previousState) {
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
    static async logBan(user, reason, details, isPermanent, admin, relatedAlertId, previousState) {
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
    static async logBanLifted(user, reason, details, admin, previousState) {
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
    static async logRestrictionAdded(user, restrictionType, reason, details, admin, relatedRestrictionId, relatedAlertId) {
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
    static async logRestrictionRemoved(user, restrictionType, reason, details, admin, relatedRestrictionId) {
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
    static async logAlertCreated(user, alertType, reason, details, relatedAlertId, evidence) {
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
    static async logAlertDismissed(user, reason, details, admin, relatedAlertId) {
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
    static async logAlertResolved(user, reason, details, admin, relatedAlertId) {
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
    static async logEvidenceAdded(user, evidenceType, reason, details, relatedAlertId, evidence) {
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
    static async logAutoAction(user, reason, details, severity = 'high', previousState, newState) {
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
    static async logManualReview(user, reason, details, admin, adminNotes, relatedAlertId) {
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
    static async logAction(params) {
        try {
            await (0, mongoose_1.connectToDatabase)();
            const performedBy = params.isAutomated
                ? { type: 'automated' }
                : params.admin?.adminId
                    ? {
                        type: 'admin',
                        adminId: params.admin.adminId,
                        adminEmail: params.admin.adminEmail,
                        adminName: params.admin.adminName || params.admin.adminEmail?.split('@')[0],
                    }
                    : { type: 'system' };
            const entry = await fraud_history_model_1.FraudHistory.logAction({
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
        }
        catch (error) {
            console.error('[FraudHistory] Error logging action:', error);
            // Don't throw - history logging should not break main flows
            return null;
        }
    }
    /**
     * Get user's fraud history summary
     */
    static async getUserSummary(userId) {
        await (0, mongoose_1.connectToDatabase)();
        const [history, actionCounts] = await Promise.all([
            fraud_history_model_1.FraudHistory.getUserHistory(userId),
            fraud_history_model_1.FraudHistory.getActionCounts(userId),
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
exports.FraudHistoryService = FraudHistoryService;
