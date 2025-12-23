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

import { connectToDatabase } from '../config/database';
import mongoose from 'mongoose';

export interface ChallengeFinalizeResult {
  checkedChallenges: number;
  finalizedChallenges: number;
  failedChallenges: string[];
}

export async function runChallengeFinalizeCheck(): Promise<ChallengeFinalizeResult> {
  const result: ChallengeFinalizeResult = {
    checkedChallenges: 0,
    finalizedChallenges: 0,
    failedChallenges: [],
  };

  try {
    await connectToDatabase();

    // IMPORTANT: Use mongoose.connection.db directly to avoid model instance issues
    // When bundled, imported models may use a different mongoose instance
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }
    
    const challengesCollection = db.collection('challenges');

    // Find all active challenges that should have ended
    const now = new Date();
    const expiredChallenges = await challengesCollection.find({
      status: 'active',
      endTime: { $lte: now },
    }).toArray();

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
        } else {
          result.failedChallenges.push(
            `${challenge._id}: Finalization returned null`
          );
        }
      } catch (error) {
        result.failedChallenges.push(
          `${challenge._id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return result;
  } catch (error) {
    result.failedChallenges.push(`Critical error: ${error}`);
    return result;
  }
}

export default runChallengeFinalizeCheck;

