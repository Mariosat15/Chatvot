import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";

/**
 * GET /api/competitions - every contest, for the admin list screen.
 *
 * Guarded on the `competitions` section. This route used to carry its own inline
 * `verifyAdminToken`, which decoded the admin JWT cookie and asked nothing else - so any
 * signed-in employee could read every contest regardless of their grants, and the file also
 * held a second copy of the JWT verification the rest of the app does in one place.
 *
 * Deleting the local copy is the point, not a tidy-up: a route with its own authentication
 * helper is a route that will not receive the next fix to the shared one. Sixth instance of
 * the auth class; see `finalize-old-competitions/route.ts` for the list.
 *
 * NO FILTER IS APPLIED, DELIBERATELY. Drafts and provider contests are all returned, because
 * this is the screen an operator publishes a draft from. The list component is what makes
 * them legible - `12` s3.1a records the day it did not, and rendered a draft in the same grey
 * it uses for a finished contest.
 */
export async function GET() {
  try {
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;

    await connectToDatabase();

    // Get competitions sorted by start time (newest first, capped for safety)
    const competitions = await Competition.find()
      .sort({ startTime: -1 })
      .limit(500)
      .lean();

    return NextResponse.json({
      success: true,
      competitions: JSON.parse(JSON.stringify(competitions)),
    });
  } catch (error) {
    console.error("Error fetching competitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitions" },
      { status: 500 },
    );
  }
}
