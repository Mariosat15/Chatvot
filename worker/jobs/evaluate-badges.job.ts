/**
 * Badge Evaluation Job
 * 
 * Evaluates badges for all users who have been trading.
 * Runs every hour (same as Inngest: chatvolt-evaluate-badges)
 */

import { connectToDatabase } from '../config/database';
import { evaluateUserBadges } from '../../lib/services/badge-evaluation.service';

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
    const CompetitionParticipant = (await import('../../database/models/trading/competition-participant.model')).default;
    
    // Find unique user IDs who have been active
    const activeParticipants = await CompetitionParticipant.find({
      status: 'active',
    }).distinct('userId');

    // Evaluate badges for each active user
    for (const userId of activeParticipants) {
      try {
        const evalResult = await evaluateUserBadges(userId.toString());
        result.usersEvaluated++;
        result.badgesAwarded += evalResult.newBadges?.length || 0;
      } catch (userError) {
        result.errors.push(`User ${userId} badge error: ${userError}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Badge evaluation error: ${error}`);
    return result;
  }
}

export default runBadgeEvaluation;

