import { NextRequest, NextResponse } from "next/server";
import { clearLeaderboardCache } from "@/lib/actions/leaderboard/global-leaderboard.actions";
import { verifyInternalSecret } from "@/lib/utils/internal-auth";

/**
 * POST /api/leaderboard/invalidate
 *
 * Clears the in-memory leaderboard cache so the next request rebuilds from DB.
 * Called by the admin simulator cleanup to ensure deleted test users
 * disappear immediately instead of lingering for up to 5 minutes.
 *
 * Protected by a simple shared secret (not user-facing).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { secret } = body;

    // Shared secret — this endpoint is internal (admin → main app)
    if (
      !verifyInternalSecret(
        secret,
        [process.env.INTERNAL_API_SECRET],
        "leaderboard/invalidate",
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    clearLeaderboardCache();

    return NextResponse.json({
      success: true,
      message: "Leaderboard cache cleared — next request will rebuild from DB",
    });
  } catch (error) {
    console.error("[leaderboard/invalidate] error:", error);
    return NextResponse.json(
      { error: "Failed to invalidate cache" },
      { status: 500 },
    );
  }
}
