/**
 * Challenge Finalize Job
 *
 * Checks for challenges that have ended and finalizes them.
 * Similar to competition end, but for 1v1 challenges.
 *
 * Benefits:
 * - Challenges end automatically
 * - Winner determined and notified
 * - Stakes distributed properly
 */
export interface ChallengeFinalizeResult {
    checkedChallenges: number;
    finalizedChallenges: number;
    failedChallenges: string[];
}
export declare function runChallengeFinalizeCheck(): Promise<ChallengeFinalizeResult>;
export default runChallengeFinalizeCheck;
