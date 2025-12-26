import { FraudActionType, ActionSeverity, LogActionParams } from '@/database/models/fraud/fraud-history.model';
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
export declare class FraudHistoryService {
    /**
     * Log a warning issued to a user
     */
    static logWarning(user: UserInfo, reason: string, details: string, admin?: AdminInfo, relatedAlertId?: string): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log when investigation starts
     */
    static logInvestigationStarted(user: UserInfo, reason: string, details: string, admin?: AdminInfo, relatedAlertId?: string, previousState?: StateInfo): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log when investigation is resolved
     */
    static logInvestigationResolved(user: UserInfo, reason: string, details: string, admin?: AdminInfo, relatedAlertId?: string, newState?: StateInfo): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log user suspension
     */
    static logSuspension(user: UserInfo, reason: string, details: string, duration?: DurationInfo, admin?: AdminInfo, relatedAlertId?: string, previousState?: StateInfo): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log suspension lifted
     */
    static logSuspensionLifted(user: UserInfo, reason: string, details: string, admin?: AdminInfo, previousState?: StateInfo): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log user ban
     */
    static logBan(user: UserInfo, reason: string, details: string, isPermanent: boolean, admin?: AdminInfo, relatedAlertId?: string, previousState?: StateInfo): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log ban lifted
     */
    static logBanLifted(user: UserInfo, reason: string, details: string, admin?: AdminInfo, previousState?: StateInfo): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log restriction added
     */
    static logRestrictionAdded(user: UserInfo, restrictionType: string, reason: string, details: string, admin?: AdminInfo, relatedRestrictionId?: string, relatedAlertId?: string): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log restriction removed
     */
    static logRestrictionRemoved(user: UserInfo, restrictionType: string, reason: string, details: string, admin?: AdminInfo, relatedRestrictionId?: string): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log alert created
     */
    static logAlertCreated(user: UserInfo, alertType: string, reason: string, details: string, relatedAlertId?: string, evidence?: LogActionParams['evidence']): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log alert dismissed
     */
    static logAlertDismissed(user: UserInfo, reason: string, details: string, admin?: AdminInfo, relatedAlertId?: string): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log alert resolved
     */
    static logAlertResolved(user: UserInfo, reason: string, details: string, admin?: AdminInfo, relatedAlertId?: string): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log new evidence added
     */
    static logEvidenceAdded(user: UserInfo, evidenceType: string, reason: string, details: string, relatedAlertId?: string, evidence?: LogActionParams['evidence']): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log automated action
     */
    static logAutoAction(user: UserInfo, reason: string, details: string, severity?: ActionSeverity, previousState?: StateInfo, newState?: StateInfo): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Log manual review
     */
    static logManualReview(user: UserInfo, reason: string, details: string, admin: AdminInfo, adminNotes?: string, relatedAlertId?: string): Promise<import("@/database/models/fraud/fraud-history.model").IFraudHistory | null>;
    /**
     * Generic action logger
     */
    private static logAction;
    /**
     * Get user's fraud history summary
     */
    static getUserSummary(userId: string): Promise<{
        history: import("@/database/models/fraud/fraud-history.model").IFraudHistory[];
        counts: Record<FraudActionType, number>;
        summary: {
            totalIncidents: number;
            suspensionCount: number;
            banCount: number;
            warningCount: number;
            liftCount: number;
            isRepeatOffender: boolean;
            hasBeenRehabbed: boolean;
        };
    }>;
}
export {};
//# sourceMappingURL=fraud-history.service.d.ts.map