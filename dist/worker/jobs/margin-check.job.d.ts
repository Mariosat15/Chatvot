/**
 * Margin Check Job
 *
 * Runs periodically to check all users' margins and liquidate if needed.
 * This is a BACKUP to the client-side real-time checks.
 *
 * Benefits:
 * - Catches users who disconnect before liquidation
 * - Ensures no one escapes margin call
 * - Runs independently of user actions
 */
export interface MarginCheckResult {
    checkedParticipants: number;
    liquidatedUsers: number;
    liquidatedPositions: number;
    errors: string[];
}
export declare function runMarginCheck(): Promise<MarginCheckResult>;
export default runMarginCheck;
