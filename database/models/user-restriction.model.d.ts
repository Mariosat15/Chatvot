import { Document } from 'mongoose';
export type RestrictionType = 'banned' | 'suspended';
export type RestrictionReason = 'multi_accounting' | 'fraud' | 'terms_violation' | 'payment_fraud' | 'suspicious_activity' | 'admin_decision' | 'automated_fraud_detection' | 'other';
export interface IUserRestriction extends Document {
    userId: string;
    restrictionType: RestrictionType;
    reason: RestrictionReason;
    customReason?: string;
    canTrade: boolean;
    canEnterCompetitions: boolean;
    canDeposit: boolean;
    canWithdraw: boolean;
    restrictedAt: Date;
    expiresAt?: Date;
    restrictedBy: string;
    relatedFraudAlertId?: string;
    relatedUserIds?: string[];
    isActive: boolean;
    unrestrictedAt?: Date;
    unrestrictedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const UserRestriction: import("mongoose").Model<any, {}, {}, {}, any, any>;
export default UserRestriction;
//# sourceMappingURL=user-restriction.model.d.ts.map