/**
 * Unified Fraud Alert Manager
 *
 * Handles creating or updating fraud alerts with multiple detection methods
 * Ensures all fraud findings are included in alert details
 *
 * KEY BEHAVIORS:
 * 1. Dismissed/resolved alerts stay resolved - won't recreate for same issue
 * 2. Competition-specific alerts - separate alerts per competition
 * 3. New alerts only for NEW suspicious activity
 */
export interface AlertEvidence {
    type: string;
    description: string;
    data: any;
}
export interface CreateOrUpdateAlertParams {
    alertType: string;
    userIds: string[];
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    evidence: AlertEvidence[];
    competitionId?: string;
}
export declare class AlertManagerService {
    /**
     * Create new alert OR update existing alert with additional evidence
     *
     * IMPORTANT:
     * - If alert was dismissed/resolved, don't create new one for same issue
     * - Competition alerts are tracked per competition (not globally per user)
     * - Only pending/investigating alerts can be updated
     */
    static createOrUpdateAlert(params: CreateOrUpdateAlertParams): Promise<void>;
    /**
     * Update an existing alert with new evidence
     * ALWAYS adds new evidence with timestamps - allows tracking multiple detections
     * ALL detections for same users are MERGED into ONE alert
     */
    private static updateExistingAlert;
    /**
     * Create a new alert
     */
    private static createNewAlert;
    /**
     * Check if alert can be created for these users
     * Returns false if there's already a resolved/dismissed alert
     */
    static canCreateAlert(userIds: string[], alertType: string, competitionId?: string): Promise<boolean>;
    /**
     * Helper: Format detection method name for display
     */
    private static formatMethodName;
    /**
     * Helper: Get severity level as number for comparison
     */
    private static getSeverityLevel;
}
//# sourceMappingURL=alert-manager.service.d.ts.map