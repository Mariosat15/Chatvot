import { NextRequest, NextResponse } from "next/server";
import { clearLeaderboardCache } from "@/lib/actions/leaderboard/global-leaderboard.actions";

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

    // Simple shared secret — this endpoint is internal (admin → main app)
    const expectedSecret = process.env.INTERNAL_API_SECRET || "simulator-cleanup";
    if (secret !== expectedSecret) {
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
