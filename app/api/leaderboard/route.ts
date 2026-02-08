import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import {
  getGlobalLeaderboard,
  getMyLeaderboardPosition,
} from "@/lib/actions/leaderboard/global-leaderboard.actions";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/leaderboard?page=1&limit=50
 * Returns a paginated slice of the global leaderboard so the client never loads 4000+ entries.
 * Auth required.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(10, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT)))
    );

    const full = await getGlobalLeaderboard(0);
    const totalCount = full.length;
    const offset = (page - 1) * limit;
    const entries = full.slice(offset, offset + limit);

    const myPosition = await getMyLeaderboardPosition();

    return NextResponse.json({
      entries,
      totalCount,
      page,
      limit,
      myPosition,
    });
  } catch (error) {
    console.error("[api/leaderboard] error:", error);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}
