/**
 * Challenge Finalize Job
 *
 * Checks for:
 * 1. Active challenges that have ended → finalize them (determine winner, distribute stakes)
 * 2. Pending challenges that have passed acceptDeadline → expire them (no refund — credits are only charged on accept)
 *
 * Benefits:
 * - Challenges end automatically
 * - Winner determined and notified
 * - Stakes distributed properly
 * - Stale pending challenges don't block withdrawals
 */

import { connectToDatabase } from "../config/database";
import mongoose from "mongoose";

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
      throw new Error("Database not connected");
    }

    const challengesCollection = db.collection("challenges");

    // Recovery: Reset challenges stuck in "finalizing" for more than 5 minutes.
    // This handles cases where a process crashed mid-finalization (before transaction commit).
    // SAFETY: Only reset if NO wallet transactions exist for this challenge (proves it was never committed).
    // If wallet transactions exist, the challenge was committed — mark it "completed" instead.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stuckChallenges = await challengesCollection
      .find({ status: "finalizing", updatedAt: { $lt: fiveMinutesAgo } })
      .toArray();

    if (stuckChallenges.length > 0) {
      const walletTxCollection = db.collection("wallettransactions");
      for (const stuck of stuckChallenges) {
        // Check if any challenge_win transaction exists for this challenge
        const existingWinTx = await walletTxCollection.findOne({
          challengeId: stuck._id.toString(),
          transactionType: "challenge_win",
        });

        if (existingWinTx) {
          // Challenge was finalized (wallet credited) but got stuck — mark completed
          await challengesCollection.updateOne(
            { _id: stuck._id },
            { $set: { status: "completed" } },
          );
          console.log(`🔧 [RECOVERY] Challenge ${stuck._id} was stuck in "finalizing" but has wallet transactions — marking "completed"`);
        } else {
          // Challenge was NOT finalized — safe to reset to "active" for retry
          await challengesCollection.updateOne(
            { _id: stuck._id },
            { $set: { status: "active" } },
          );
          console.log(`🔧 [RECOVERY] Reset stuck "finalizing" challenge ${stuck._id} back to "active" (no wallet transactions found)`);
        }
      }
    }

    // Early exit: skip all work if no pending or active challenges exist
    const relevantCount = await challengesCollection.countDocuments({
      status: { $in: ["pending", "active"] },
    });
    if (relevantCount === 0) {
      return result;
    }

    const now = new Date();

    // ============================================
    // 1. EXPIRE PENDING CHALLENGES (not accepted in time)
    // ============================================
    const expiredPendingChallenges = await challengesCollection
      .find({
        status: "pending",
        acceptDeadline: { $lte: now },
      })
      .toArray();

    if (expiredPendingChallenges.length > 0) {

      for (const challenge of expiredPendingChallenges) {
        try {
          // Update challenge to expired
          await challengesCollection.updateOne(
            { _id: challenge._id },
            {
              $set: {
                status: "expired",
                expiredAt: now,
                expiredReason: "Not accepted within deadline",
              },
            },
          );

          // Reason: NO refund needed here. Credits are only deducted when
          // the challenged user ACCEPTS (in /api/challenges/[id]/accept).
          // Pending challenges have zero financial impact — the challenger
          // was never charged. Refunding here would give free credits.

          result.expiredPendingChallenges++;
        } catch (error) {
          result.failedChallenges.push(
            `${challenge._id}: Failed to expire - ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }
    }

    // ============================================
    // 2. FINALIZE ACTIVE CHALLENGES (ended)
    // ============================================
    const expiredActiveChallenges = await challengesCollection
      .find({
        status: "active",
        endTime: { $lte: now },
      })
      .toArray();

    result.checkedChallenges = expiredActiveChallenges.length;

    if (expiredActiveChallenges.length > 0) {
      // Import the finalization function
      const { finalizeChallenge } =
        await import("../../lib/actions/trading/challenge-finalize.actions");

      // Process each expired challenge
      for (const challenge of expiredActiveChallenges) {
        try {
          const finalizeResult = await finalizeChallenge(
            challenge._id.toString(),
          );

          if (finalizeResult) {
            result.finalizedChallenges++;
          } else {
            result.failedChallenges.push(
              `${challenge._id}: Finalization returned null`,
            );
          }
        } catch (error) {
          result.failedChallenges.push(
            `${challenge._id}: ${error instanceof Error ? error.message : "Unknown error"}`,
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
