import mongoose, { Document } from 'mongoose';
/**
 * Fraud Detection Score Model
 *
 * Tracks cumulative fraud score for each user (0-100%)
 * Multiple detection methods contribute to the overall score
 * Automatic risk level calculation and alert triggering
 *
 * Each method contributes a percentage (e.g., device match = 40%)
 * Total score = sum of all method percentages (capped at 100%)
 */
export interface IScoreBreakdown {
    percentage: number;
    evidence: string;
    lastDetected?: Date;
}
export interface ILinkedAccount {
    userId: mongoose.Types.ObjectId;
    matchType: string;
    confidence: number;
    detectedAt: Date;
}
export interface IScoreHistory {
    timestamp: Date;
    score: number;
    reason: string;
    delta: number;
    triggeredBy: string;
}
export interface ISuspicionScore extends Document {
    userId: mongoose.Types.ObjectId;
    totalScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    lastUpdated: Date;
    scoreBreakdown: {
        deviceMatch: IScoreBreakdown;
        ipMatch: IScoreBreakdown;
        ipBrowserMatch: IScoreBreakdown;
        sameCity: IScoreBreakdown;
        samePayment: IScoreBreakdown;
        rapidCreation: IScoreBreakdown;
        coordinatedEntry: IScoreBreakdown;
        tradingSimilarity: IScoreBreakdown;
        mirrorTrading: IScoreBreakdown;
        timezoneLanguage: IScoreBreakdown;
        deviceSwitching: IScoreBreakdown;
    };
    linkedAccounts: ILinkedAccount[];
    scoreHistory: IScoreHistory[];
    autoRestrictedAt?: Date;
    autoRestrictionReason?: string;
    createdAt: Date;
    updatedAt: Date;
    calculateRiskLevel(): 'low' | 'medium' | 'high' | 'critical';
    addPercentage(method: keyof ISuspicionScore['scoreBreakdown'], percentage: number, evidence: string): void;
    addPoints(method: keyof ISuspicionScore['scoreBreakdown'], percentage: number, evidence: string): void;
    addLinkedAccount(linkedUserId: mongoose.Types.ObjectId, matchType: string, confidence: number): void;
    resetScore(): void;
}
declare const SuspicionScore: mongoose.Model<any, {}, {}, {}, any, any>;
export default SuspicionScore;
//# sourceMappingURL=suspicion-score.model.d.ts.map