"use strict";
/**
 * Badge Evaluation Job
 *
 * Evaluates badges for all users who have been trading.
 * Runs every hour (same as Inngest: chatvolt-evaluate-badges)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBadgeEvaluation = runBadgeEvaluation;
const database_1 = require("../config/database");
const badge_evaluation_service_1 = require("../../lib/services/badge-evaluation.service");
async function runBadgeEvaluation() {
    const result = {
        usersEvaluated: 0,
        badgesAwarded: 0,
        errors: [],
    };
    try {
        await (0, database_1.connectToDatabase)();
        // Get users who have traded recently (last 24 hours) to avoid processing inactive users
        const CompetitionParticipant = (await import('../../database/models/trading/competition-participant.model')).default;
        // Find unique user IDs who have been active
        const activeParticipants = await CompetitionParticipant.find({
            status: 'active',
        }).distinct('userId');
        // Evaluate badges for each active user
        for (const userId of activeParticipants) {
            try {
                const evalResult = await (0, badge_evaluation_service_1.evaluateUserBadges)(userId.toString());
                result.usersEvaluated++;
                result.badgesAwarded += evalResult.newBadges?.length || 0;
            }
            catch (userError) {
                result.errors.push(`User ${userId} badge error: ${userError}`);
            }
        }
        return result;
    }
    catch (error) {
        result.errors.push(`Badge evaluation error: ${error}`);
        return result;
    }
}
exports.default = runBadgeEvaluation;
