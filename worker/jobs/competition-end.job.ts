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

import { connectToDatabase } from '../config/database';

// Import models directly
import Competition from '../../database/models/trading/competition.model';

export interface CompetitionEndResult {
  checkedCompetitions: number;
  endedCompetitions: number;
  failedCompetitions: string[];
}

export async function runCompetitionEndCheck(): Promise<CompetitionEndResult> {
  const result: CompetitionEndResult = {
    checkedCompetitions: 0,
    endedCompetitions: 0,
    failedCompetitions: [],
  };

  try {
    await connectToDatabase();

    // Find all active competitions that should have ended
    const now = new Date();
    
    // Debug: Check what competitions exist
    const allActiveCompetitions = await Competition.find({ status: 'active' }).select('_id name status endTime');
    if (allActiveCompetitions.length > 0) {
      console.log(`   📊 Found ${allActiveCompetitions.length} active competition(s):`);
      allActiveCompetitions.forEach(c => {
        const endTime = new Date(c.endTime);
        const hasEnded = endTime <= now;
        const timeRemaining = hasEnded ? 'ENDED' : `${Math.round((endTime.getTime() - now.getTime()) / 1000)}s remaining`;
        console.log(`      - ${c.name}: endTime=${endTime.toISOString()}, ${timeRemaining}`);
      });
    }
    
    const expiredCompetitions = await Competition.find({
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
        } else {
          result.failedCompetitions.push(
            `${competition._id}: ${finalizeResult?.message || 'Unknown error'}`
          );
        }
      } catch (error) {
        result.failedCompetitions.push(
          `${competition._id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return result;
  } catch (error) {
    result.failedCompetitions.push(`Critical error: ${error}`);
    return result;
  }
}

export default runCompetitionEndCheck;

