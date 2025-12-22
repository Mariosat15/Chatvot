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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
        const { finalizeCompetition } = await Promise.resolve().then(() => __importStar(require('../../lib/actions/trading/competition-end.actions')));
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
