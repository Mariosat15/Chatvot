import mongoose, { Document, Model } from 'mongoose';
export type FraudActionType = 'warning_issued' | 'investigation_started' | 'investigation_resolved' | 'suspended' | 'suspension_lifted' | 'banned' | 'ban_lifted' | 'restriction_added' | 'restriction_removed' | 'alert_created' | 'alert_dismissed' | 'alert_resolved' | 'evidence_added' | 'manual_review' | 'auto_action';
export type ActionSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface IFraudHistory extends Document {
    userId: mongoose.Types.ObjectId;
    userEmail: string;
    userName: string;
    actionType: FraudActionType;
    actionSeverity: ActionSeverity;
    performedBy: {
        type: 'admin' | 'system' | 'automated';
        adminId?: mongoose.Types.ObjectId;
        adminEmail?: string;
        adminName?: string;
    };
    relatedAlertId?: mongoose.Types.ObjectId;
    relatedRestrictionId?: mongoose.Types.ObjectId;
    relatedCompetitionId?: mongoose.Types.ObjectId;
    reason: string;
    details: string;
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
    createdAt: Date;
    updatedAt: Date;
}
export interface IFraudHistoryModel extends Model<IFraudHistory> {
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
export declare const FraudHistory: IFraudHistoryModel;
//# sourceMappingURL=fraud-history.model.d.ts.map