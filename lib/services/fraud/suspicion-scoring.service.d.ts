import { ISuspicionScore } from '@/database/models/fraud/suspicion-score.model';
/**
 * Fraud Detection Scoring Service
 *
 * Manages cumulative fraud detection scoring system (0-100%)
 * Each method contributes a percentage to the overall score
 */
export interface ScoreUpdate {
    method: keyof ISuspicionScore['scoreBreakdown'];
    percentage: number;
    evidence: string;
    linkedUserIds?: string[];
    confidence?: number;
}
export declare class SuspicionScoringService {
    /**
     * Percentage values for each detection method (0-100%)
     * Each method contributes up to this percentage to the overall score
     */
    private static readonly PERCENTAGE_VALUES;
    /**
     * Risk thresholds
     */
    private static readonly THRESHOLDS;
    /**
     * Get or create suspicion score for a user
     */
    static getOrCreateScore(userId: string): Promise<ISuspicionScore>;
    /**
     * Update fraud detection score for a user
     */
    static updateScore(userId: string, update: ScoreUpdate): Promise<ISuspicionScore>;
    /**
     * Update scores for multiple users (e.g., all linked accounts)
     */
    static updateScoresForMultipleUsers(userIds: string[], update: Omit<ScoreUpdate, 'linkedUserIds'>, linkedUserIds: string[]): Promise<ISuspicionScore[]>;
    /**
     * Device Match Detection (+40%)
     */
    static scoreDeviceMatch(userIds: string[], fingerprintId: string, deviceInfo: string): Promise<void>;
    /**
     * IP Match Detection (+30%)
     */
    static scoreIPMatch(userIds: string[], ipAddress: string): Promise<void>;
    /**
     * IP + Browser Match Detection (+35%)
     */
    static scoreIPBrowserMatch(userIds: string[], ipAddress: string, browser: string): Promise<void>;
    /**
     * Timezone + Language Match Detection (+10%)
     */
    static scoreTimezoneLanguage(userIds: string[], timezone: string, language: string): Promise<void>;
    /**
     * Calculate score for same payment method
     */
    static scorePaymentMatch(userIds: string[], paymentProvider: string, paymentFingerprint: string): Promise<void>;
    /**
     * Calculate score for rapid account creation
     */
    static scoreRapidCreation(userIds: string[], timeWindowMinutes: number): Promise<void>;
    /**
     * Calculate score for coordinated competition entry
     */
    static scoreCoordinatedEntry(userIds: string[], competitionId: string, timeWindowMinutes: number): Promise<void>;
    /**
     * Calculate score for trading similarity
     */
    static scoreTradingSimilarity(userId1: string, userId2: string, similarityPercentage: number): Promise<void>;
    /**
     * Calculate score for mirror trading
     */
    static scoreMirrorTrading(userId1: string, userId2: string, matchRate: number): Promise<void>;
    /**
     * Calculate score for same city/location
     */
    static scoreSameCity(userIds: string[], city: string, distanceKm: number): Promise<void>;
    /**
     * Calculate score for unusual device switching
     */
    static scoreDeviceSwitching(userId: string, deviceCount: number, timeWindowHours: number): Promise<void>;
    /**
     * Get suspicion score for a user (plain object, no methods)
     */
    static getScore(userId: string): Promise<Omit<ISuspicionScore, 'calculateRiskLevel' | 'addPercentage' | 'addPoints' | 'addLinkedAccount' | 'resetScore'> | null>;
    /**
     * Get all high-risk users (plain objects, no methods)
     */
    static getHighRiskUsers(): Promise<Omit<ISuspicionScore, 'calculateRiskLevel' | 'addPercentage' | 'addPoints' | 'addLinkedAccount' | 'resetScore'>[]>;
    /**
     * Get users by risk level (plain objects, no methods)
     */
    static getUsersByRiskLevel(level: 'low' | 'medium' | 'high' | 'critical'): Promise<Omit<ISuspicionScore, 'calculateRiskLevel' | 'addPercentage' | 'addPoints' | 'addLinkedAccount' | 'resetScore'>[]>;
    /**
     * Reset score for a user
     */
    static resetScore(userId: string): Promise<ISuspicionScore>;
    /**
     * Get fraud settings (singleton pattern)
     */
    private static getFraudSettings;
    /**
     * Check fraud settings and auto-restrict user if enabled
     * This respects admin settings - no auto-restriction unless explicitly enabled
     */
    private static checkAndAutoRestrictUser;
    /**
     * Get score statistics
     */
    static getStatistics(): Promise<{
        total: number;
        low: number;
        medium: number;
        high: number;
        critical: number;
        averageScore: number;
    }>;
}
export default SuspicionScoringService;
//# sourceMappingURL=suspicion-scoring.service.d.ts.map