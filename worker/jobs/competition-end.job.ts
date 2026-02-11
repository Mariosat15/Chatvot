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

import { connectToDatabase } from "../config/database";
import mongoose from "mongoose";

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

    // IMPORTANT: Use mongoose.connection.db directly to avoid model instance issues
    // When bundled, imported models may use a different mongoose instance
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const competitionsCollection = db.collection("competitions");

    // Recovery: Reset competitions stuck in "finalizing" for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stuckReset = await competitionsCollection.updateMany(
      { status: "finalizing", updatedAt: { $lt: fiveMinutesAgo } },
      { $set: { status: "active" } },
    );
    if (stuckReset.modifiedCount > 0) {
      console.log(`🔧 [RECOVERY] Reset ${stuckReset.modifiedCount} stuck "finalizing" competition(s) back to "active"`);
    }

    // Early exit: skip all work if no active competitions exist
    const activeCount = await competitionsCollection.countDocuments({ status: "active" });
    if (activeCount === 0) {
      return result;
    }

    // Find all active competitions that should have ended
    const now = new Date();

    const expiredCompetitions = await competitionsCollection
      .find({
        status: "active",
        endTime: { $lte: now },
      })
      .toArray();

    result.checkedCompetitions = expiredCompetitions.length;

    if (expiredCompetitions.length === 0) {
      return result;
    }

    // Import the finalization function
    const { finalizeCompetition } =
      await import("../../lib/actions/trading/competition-end.actions");

    // Process each expired competition
    for (const competition of expiredCompetitions) {
      try {
        const finalizeResult = await finalizeCompetition(
          competition._id.toString(),
        );

        if (finalizeResult?.success) {
          result.endedCompetitions++;
        } else {
          result.failedCompetitions.push(
            `${competition._id}: ${finalizeResult?.message || "Unknown error"}`,
          );
        }
      } catch (error) {
        result.failedCompetitions.push(
          `${competition._id}: ${error instanceof Error ? error.message : "Unknown error"}`,
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
