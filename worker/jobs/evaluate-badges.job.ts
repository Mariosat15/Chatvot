/**
 * Badge Evaluation Job
 *
 * Evaluates badges for all users who have been trading.
 * Runs every hour (same as Inngest: chatvolt-evaluate-badges)
 */

import { connectToDatabase } from "../config/database";
import { evaluateUserBadges } from "../../lib/services/badge-evaluation.service";

export interface BadgeEvaluationResult {
  usersEvaluated: number;
  badgesAwarded: number;
  errors: string[];
}

export async function runBadgeEvaluation(): Promise<BadgeEvaluationResult> {
  const result: BadgeEvaluationResult = {
    usersEvaluated: 0,
    badgesAwarded: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    // Get users who have traded recently (last 24 hours) to avoid processing inactive users
    const CompetitionParticipant = (
      await import("../../database/models/trading/competition-participant.model")
    ).default;

    // Find unique user IDs who have been active
    const activeParticipants = await CompetitionParticipant.find({
      status: "active",
    }).distinct("userId");

    // Evaluate badges in parallel batches for performance at scale
    const BATCH_SIZE = 20;
    for (let i = 0; i < activeParticipants.length; i += BATCH_SIZE) {
      const batch = activeParticipants.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (userId) => {
          const evalResult = await evaluateUserBadges(userId.toString());
          return evalResult.newBadges?.length || 0;
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const batchResult = batchResults[j];
        if (batchResult.status === "fulfilled") {
          result.usersEvaluated++;
          result.badgesAwarded += batchResult.value;
        } else {
          result.errors.push(`User ${batch[j]} badge error: ${batchResult.reason}`);
        }
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Badge evaluation error: ${error}`);
    return result;
  }
}

export default runBadgeEvaluation;
