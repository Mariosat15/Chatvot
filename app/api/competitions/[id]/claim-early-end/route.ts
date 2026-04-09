import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import mongoose from "mongoose";
import { invalidateRankingCache } from "@/lib/caches/ranking-cache";

/**
 * POST /api/competitions/[id]/claim-early-end
 *
 * Allows the last remaining active participant to trigger early finalization.
 * Guards:
 *  - User must be authenticated
 *  - Competition must be active
 *  - User must be the sole remaining active participant
 *  - All other participants must be liquidated/disqualified
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: competitionId } = await params;

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return NextResponse.json(
        { error: "Invalid competition ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    const competition = await db.collection("competitions").findOne({
      _id: new mongoose.Types.ObjectId(competitionId),
      status: "active",
    });

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found or not active" },
        { status: 404 },
      );
    }

    const participants = await db
      .collection("competitionparticipants")
      .find({ competitionId })
      .project({ userId: 1, status: 1 })
      .toArray();

    if (participants.length < 2) {
      return NextResponse.json(
        { error: "Not enough participants" },
        { status: 400 },
      );
    }

    const disqualifyOnLiquidation =
      competition.rules?.disqualifyOnLiquidation !== false;

    const activeParticipants = participants.filter(
      (p) =>
        p.status === "active" &&
        !(disqualifyOnLiquidation && p.status === "liquidated"),
    );

    if (activeParticipants.length !== 1) {
      return NextResponse.json(
        { error: "Early end not available — multiple players still active" },
        { status: 400 },
      );
    }

    if (activeParticipants[0].userId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the last remaining player can claim early end" },
        { status: 403 },
      );
    }

    // Reason: Use finalizeCompetition to handle prize distribution, ranking,
    // notifications etc. — same path as regular competition end.
    const { finalizeCompetition } = await import(
      "@/lib/actions/trading/competition-end.actions"
    );

    const finalizeResult = await finalizeCompetition(competitionId);

    if (finalizeResult?.success) {
      await db.collection("competitions").updateOne(
        { _id: new mongoose.Types.ObjectId(competitionId) },
        {
          $set: {
            earlyEndReason: "Last man standing — claimed by winner",
            earlyEndClaimedBy: session.user.id,
          },
        },
      );

      invalidateRankingCache(competitionId);

      return NextResponse.json({
        success: true,
        message: "Competition ended! You are the winner!",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: finalizeResult?.message || "Failed to finalize competition",
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("❌ Error claiming early end:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
