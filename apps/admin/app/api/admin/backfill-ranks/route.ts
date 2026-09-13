import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";

/**
 * POST /api/admin/backfill-ranks
 *
 * Reason: Before this fix, competition finalization did NOT write `currentRank`
 * to CompetitionParticipant documents. All rank-based stats (wins, podium
 * finishes) were reading 0. This endpoint backfills final ranks from the
 * Competition.finalLeaderboard for all completed competitions.
 *
 * Safe to run multiple times — idempotent.
 */
export async function POST() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const completedComps = await Competition.find({
      status: "completed",
      finalLeaderboard: { $exists: true, $ne: [] },
    })
      .select("_id name finalLeaderboard")
      .lean();

    let totalUpdated = 0;
    let competitionsFixed = 0;
    const errors: string[] = [];

    for (const comp of completedComps) {
      const leaderboard = comp.finalLeaderboard as {
        rank: number;
        userId: string;
      }[];
      if (!leaderboard || leaderboard.length === 0) continue;

      try {
        const bulkOps = leaderboard
          .filter((entry) => entry.rank > 0 && entry.userId)
          .map((entry) => ({
            updateOne: {
              filter: {
                competitionId: comp._id,
                userId: entry.userId,
              },
              update: {
                $set: { currentRank: entry.rank },
              },
            },
          }));

        if (bulkOps.length === 0) continue;

        const result = await CompetitionParticipant.bulkWrite(bulkOps);
        if (result.modifiedCount > 0) {
          totalUpdated += result.modifiedCount;
          competitionsFixed++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${comp.name}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfilled ranks for ${competitionsFixed} competitions (${totalUpdated} participants updated)`,
      details: {
        competitionsScanned: completedComps.length,
        competitionsFixed,
        participantsUpdated: totalUpdated,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("❌ Backfill ranks error:", error);
    return NextResponse.json(
      { error: "Failed to backfill ranks" },
      { status: 500 },
    );
  }
}
