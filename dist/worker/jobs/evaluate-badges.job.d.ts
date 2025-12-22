/**
 * Badge Evaluation Job
 *
 * Evaluates badges for all users who have been trading.
 * Runs every hour (same as Inngest: chatvolt-evaluate-badges)
 */
export interface BadgeEvaluationResult {
    usersEvaluated: number;
    badgesAwarded: number;
    errors: string[];
}
export declare function runBadgeEvaluation(): Promise<BadgeEvaluationResult>;
export default runBadgeEvaluation;
