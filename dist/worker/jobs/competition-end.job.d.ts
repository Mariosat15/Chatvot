/**
 * Competition End Job
 *
 * Checks for competitions that have ended and finalizes them.
 * Runs every minute to catch competitions at their exact end time.
 *
 * Benefits:
 * - Competitions end automatically without user action
 * - Prizes distributed immediately
 * - No manual intervention needed
 */
export interface CompetitionEndResult {
    checkedCompetitions: number;
    endedCompetitions: number;
    failedCompetitions: string[];
}
export declare function runCompetitionEndCheck(): Promise<CompetitionEndResult>;
export default runCompetitionEndCheck;
