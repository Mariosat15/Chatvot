import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { auth } from "@/lib/better-auth/auth";
import { resolveContestViewer } from "@/lib/services/gamemaster/contest-viewer.service";
import { withVisibleContests } from "@/lib/services/gamemaster/visible-contests";
import { annotatePrivateContests } from "@/lib/services/gamemaster/private-contest-listing.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get session for user-specific data
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      userId = session?.user?.id || null;
    } catch {
      // Not logged in, continue without user data
    }

    // Fetch non-draft competitions (capped to prevent unbounded scan). Private Game Master
    // contests are listed to every signed-in player and annotated with what this viewer may
    // do about each one - the same answer `getCompetitions` gives, since the page refetches here.
    const viewer = await resolveContestViewer(userId);
    const listed = await Competition.find(
      withVisibleContests({ status: { $ne: "draft" } }, viewer),
    )
      .sort({ startTime: -1 })
      .limit(200)
      .lean();
    const rows = listed as Array<Record<string, unknown>>;
    const competitions = await annotatePrivateContests(rows, viewer);

    // Get user's participation status if logged in
    let userInCompetitionIds: string[] = [];
    if (userId) {
      const participations = await CompetitionParticipant.find({
        userId,
        status: { $in: ["active", "completed"] },
      })
        .select("competitionId")
        .lean();

      userInCompetitionIds = participations.map((p) => String(p.competitionId));
    }

    return NextResponse.json({
      competitions: JSON.parse(JSON.stringify(competitions)),
      userInCompetitionIds,
    });
  } catch (error) {
    console.error("Error fetching competitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitions" },
      { status: 500 },
    );
  }
}
