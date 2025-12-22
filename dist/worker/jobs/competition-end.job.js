"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCompetitionEndCheck = runCompetitionEndCheck;
const database_1 = require("../config/database");
// Import models directly
const competition_model_1 = __importDefault(require("../../database/models/trading/competition.model"));
async function runCompetitionEndCheck() {
    const result = {
        checkedCompetitions: 0,
        endedCompetitions: 0,
        failedCompetitions: [],
    };
    try {
        await (0, database_1.connectToDatabase)();
        // Find all active competitions that should have ended
        const now = new Date();
        const expiredCompetitions = await competition_model_1.default.find({
            status: 'active',
            endTime: { $lte: now },
        });
        result.checkedCompetitions = expiredCompetitions.length;
        if (expiredCompetitions.length === 0) {
            return result;
        }
        // Import the finalization function
        const { finalizeCompetition } = await import('../../lib/actions/trading/competition-end.actions');
        // Process each expired competition
        for (const competition of expiredCompetitions) {
            try {
                const finalizeResult = await finalizeCompetition(competition._id.toString());
                if (finalizeResult?.success) {
                    result.endedCompetitions++;
                }
                else {
                    result.failedCompetitions.push(`${competition._id}: ${finalizeResult?.message || 'Unknown error'}`);
                }
            }
            catch (error) {
                result.failedCompetitions.push(`${competition._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return result;
    }
    catch (error) {
        result.failedCompetitions.push(`Critical error: ${error}`);
        return result;
    }
}
exports.default = runCompetitionEndCheck;
