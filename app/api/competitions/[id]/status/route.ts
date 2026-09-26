import { NextRequest, NextResponse } from "next/server";
import { getCompetitionById } from "@/lib/actions/trading/competition.actions";
import {
  isCompetitionIdShaped,
  logMalformedCompetitionId,
} from "@/lib/utils/competition-id";
import { connectToDatabase } from "@/database/mongoose";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";

/**
 * GET /api/competitions/[id]/status
 * Returns the current status of a competition
 * Used for polling to detect when competition ends
 *
 * Query params:
 * - userId: Optional user ID to get their ranking when competition completes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // A junk id gets the 404 below rather than the 500 the catch would produce. This route is
    // POLLED, so a page left open on a bad id used to write a stack trace every few seconds.
    if (!isCompetitionIdShaped(id)) {
      logMalformedCompetitionId("GET /api/competitions/[id]/status", id);
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    // Get competition
    //
    // THIS NULL CHECK COULD NEVER RUN UNTIL 7 SEP 2026: `getCompetitionById` threw for a missing
    // contest, so this route's careful 404 answered 500 instead. It answers `null` now.
    const competition = await getCompetitionById(id);

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    // Base response
    const response: {
      status: string;
      endTime: Date | null;
      currentTime: string;
      cancellationReason: string | null;
      userRank?: number | null;
      totalParticipants?: number;
      isWinner?: boolean;
      prizeWon?: number;
    } = {
      status: competition.status,
      endTime: competition.endTime,
      currentTime: new Date().toISOString(),
      cancellationReason: competition.cancellationReason || null,
    };

    // If competition is completed and userId provided, get user's ranking
    if (competition.status === "completed" && userId) {
      await connectToDatabase();

      // Get user's participant record
      const userParticipant = (await CompetitionParticipant.findOne({
        competitionId: id,
        userId: userId,
      }).lean()) as { finalRank?: number | null; prizeWon?: number } | null;

      if (userParticipant) {
        // Get all participants sorted by finalRank
        const allParticipants = await CompetitionParticipant.find({
          competitionId: id,
        })
          .sort({ finalRank: 1 })
          .lean();

        response.userRank = userParticipant.finalRank || null;
        response.totalParticipants = allParticipants.length;
        response.isWinner = userParticipant.finalRank === 1;
        response.prizeWon = userParticipant.prizeWon || 0;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching competition status:", error);
    return NextResponse.json(
      { error: "Failed to fetch competition status" },
      { status: 500 },
    );
  }
}
