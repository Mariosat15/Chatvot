/**
 * Challenge Finalize Job
 * 
 * Checks for:
 * 1. Active challenges that have ended → finalize them (determine winner, distribute stakes)
 * 2. Pending challenges that have passed acceptDeadline → expire them (refund challenger)
 * 
 * Benefits:
 * - Challenges end automatically
 * - Winner determined and notified
 * - Stakes distributed properly
 * - Stale pending challenges don't block withdrawals
 */

import { connectToDatabase } from '../config/database';
import mongoose from 'mongoose';

export interface ChallengeFinalizeResult {
  checkedChallenges: number;
  finalizedChallenges: number;
  expiredPendingChallenges: number;
  refundedAmount: number;
  failedChallenges: string[];
}

export async function runChallengeFinalizeCheck(): Promise<ChallengeFinalizeResult> {
  const result: ChallengeFinalizeResult = {
    checkedChallenges: 0,
    finalizedChallenges: 0,
    expiredPendingChallenges: 0,
    refundedAmount: 0,
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
    const walletsCollection = db.collection('creditwallets');
    const now = new Date();

    // ============================================
    // 1. EXPIRE PENDING CHALLENGES (not accepted in time)
    // ============================================
    const expiredPendingChallenges = await challengesCollection.find({
      status: 'pending',
      acceptDeadline: { $lte: now },
    }).toArray();

    if (expiredPendingChallenges.length > 0) {
      console.log(`   📋 Found ${expiredPendingChallenges.length} pending challenge(s) past accept deadline`);
      
      for (const challenge of expiredPendingChallenges) {
        try {
          // Update challenge to expired
          await challengesCollection.updateOne(
            { _id: challenge._id },
            { 
              $set: { 
                status: 'expired',
                expiredAt: now,
                expiredReason: 'Not accepted within deadline',
              }
            }
          );
          
          // Refund the challenger's entry fee
          if (challenge.challengerId && challenge.entryFee > 0) {
            const refundResult = await walletsCollection.updateOne(
              { userId: challenge.challengerId },
              { 
                $inc: { 
                  creditBalance: challenge.entryFee,
                  totalSpentOnChallenges: -challenge.entryFee,
                }
              }
            );
            
            if (refundResult.modifiedCount > 0) {
              result.refundedAmount += challenge.entryFee;
              console.log(`   💰 Refunded ${challenge.entryFee} credits to challenger ${challenge.challengerId}`);
            }
          }
          
          result.expiredPendingChallenges++;
          console.log(`   ⏰ Expired pending challenge ${challenge._id} (deadline was ${challenge.acceptDeadline})`);
        } catch (error) {
          result.failedChallenges.push(
            `${challenge._id}: Failed to expire - ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    // ============================================
    // 2. FINALIZE ACTIVE CHALLENGES (ended)
    // ============================================
    const expiredActiveChallenges = await challengesCollection.find({
      status: 'active',
      endTime: { $lte: now },
    }).toArray();

    result.checkedChallenges = expiredActiveChallenges.length;

    if (expiredActiveChallenges.length > 0) {
      console.log(`   🏁 Found ${expiredActiveChallenges.length} active challenge(s) to finalize`);
      
      // Import the finalization function
      const { finalizeChallenge } = await import('../../lib/actions/trading/challenge-finalize.actions');

      // Process each expired challenge
      for (const challenge of expiredActiveChallenges) {
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
    }

    return result;
  } catch (error) {
    result.failedChallenges.push(`Critical error: ${error}`);
    return result;
  }
}

export default runChallengeFinalizeCheck;

