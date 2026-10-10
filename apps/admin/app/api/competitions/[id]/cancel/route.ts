import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { cancelCompetitionAndRefund } from "@/lib/actions/trading/competition-cancel.actions";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";

/**
 * POST /api/competitions/[id]/cancel - cancel an upcoming competition and refund everyone.
 *
 * Guarded on the `competitions` SECTION, not on `requireAdminAuth`. The latter asks only
 * whether the caller is an admin at all, so an employee granted one unrelated section passed
 * it and could refund every entrant of any contest. Sixth instance of that class; see
 * `finalize-old-competitions/route.ts` for the list.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    const { id } = await params;
    const { reason } = await request.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "Cancellation reason is required" },
        { status: 400 },
      );
    }

    // Get competition
    const competition = await Competition.findById(id);

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    // Only allow cancelling upcoming competitions
    if (competition.status !== "upcoming") {
      return NextResponse.json(
        {
          error: `Cannot cancel a competition that is ${competition.status}. Only upcoming competitions can be cancelled.`,
        },
        { status: 400 },
      );
    }

    // Get participant count before cancellation
    const participantCount = competition.currentParticipants || 0;

    // Cancel and refund
    await cancelCompetitionAndRefund(id, reason.trim());

    return NextResponse.json({
      success: true,
      message: "Competition cancelled and all participants refunded",
      refundedCount: participantCount,
    });
  } catch (error) {
    console.error("Error cancelling competition:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to cancel competition",
      },
      { status: 500 },
    );
  }
}
