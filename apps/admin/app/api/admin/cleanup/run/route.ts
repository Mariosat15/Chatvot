import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import { verifyAdminAuth } from "@/lib/admin/auth";

/**
 * POST /api/admin/cleanup/run
 * Delete oldest completed/cancelled competitions and challenges older than X days.
 * Body: { olderThanDays: number, deleteOldestCompetitions: number, deleteOldestChallenges: number }
 * Super admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated || !auth.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const olderThanDays = Math.max(1, Math.min(365, Number(body.olderThanDays) || 90));
    const deleteOldestCompetitions = Math.max(0, Math.min(500, Number(body.deleteOldestCompetitions) || 30));
    const deleteOldestChallenges = Math.max(0, Math.min(500, Number(body.deleteOldestChallenges) || 30));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    await connectToDatabase();

    let competitionsDeleted = 0;
    let challengesDeleted = 0;

    if (deleteOldestCompetitions > 0) {
      const toDelete = await Competition.find({
        status: { $in: ["completed", "cancelled"] },
        endTime: { $lt: cutoff },
      })
        .sort({ endTime: 1 })
        .limit(deleteOldestCompetitions)
        .select("_id")
        .lean();

      const ids = toDelete.map((c: { _id: unknown }) => c._id);
      const idStrings = ids.map((id: unknown) => (id as { toString?: () => string })?.toString?.() ?? String(id));
      if (ids.length > 0) {
        await CompetitionParticipant.deleteMany({ competitionId: { $in: idStrings } });
        const result = await Competition.deleteMany({ _id: { $in: ids } });
        competitionsDeleted = result.deletedCount;
      }
    }

    if (deleteOldestChallenges > 0) {
      const toDelete = await Challenge.find({
        status: { $in: ["completed", "cancelled", "expired", "declined"] },
        $or: [{ endTime: { $lt: cutoff } }, { updatedAt: { $lt: cutoff } }, { createdAt: { $lt: cutoff } }],
      })
        .sort({ endTime: 1, updatedAt: 1, createdAt: 1 })
        .limit(deleteOldestChallenges)
        .select("_id")
        .lean();

      const ids = toDelete.map((c: { _id: unknown }) => c._id);
      const idStrings = ids.map((id: unknown) => (id as { toString?: () => string })?.toString?.() ?? String(id));
      if (ids.length > 0) {
        await ChallengeParticipant.deleteMany({ challengeId: { $in: idStrings } });
        const result = await Challenge.deleteMany({ _id: { $in: ids } });
        challengesDeleted = result.deletedCount;
      }
    }

    return NextResponse.json({
      success: true,
      olderThanDays,
      competitionsDeleted,
      challengesDeleted,
      message: `Deleted ${competitionsDeleted} competitions and ${challengesDeleted} challenges older than ${olderThanDays} days.`,
    });
  } catch (error) {
    console.error("[admin/cleanup] error:", error);
    return NextResponse.json(
      { success: false, error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
