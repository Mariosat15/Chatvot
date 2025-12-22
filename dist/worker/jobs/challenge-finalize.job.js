"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runChallengeFinalizeCheck = runChallengeFinalizeCheck;
const database_1 = require("../config/database");
// Import models directly
const challenge_model_1 = __importDefault(require("../../database/models/trading/challenge.model"));
async function runChallengeFinalizeCheck() {
    const result = {
        checkedChallenges: 0,
        finalizedChallenges: 0,
        failedChallenges: [],
    };
    try {
        await (0, database_1.connectToDatabase)();
        // Find all active challenges that should have ended
        const now = new Date();
        const expiredChallenges = await challenge_model_1.default.find({
            status: 'active',
            endTime: { $lte: now },
        });
        result.checkedChallenges = expiredChallenges.length;
        if (expiredChallenges.length === 0) {
            return result;
        }
        // Import the finalization function
        const { finalizeChallenge } = await import('../../lib/actions/trading/challenge-finalize.actions');
        // Process each expired challenge
        for (const challenge of expiredChallenges) {
            try {
                const finalizeResult = await finalizeChallenge(challenge._id.toString());
                if (finalizeResult) {
                    result.finalizedChallenges++;
                }
                else {
                    result.failedChallenges.push(`${challenge._id}: Finalization returned null`);
                }
            }
            catch (error) {
                result.failedChallenges.push(`${challenge._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return result;
    }
    catch (error) {
        result.failedChallenges.push(`Critical error: ${error}`);
        return result;
    }
}
exports.default = runChallengeFinalizeCheck;
