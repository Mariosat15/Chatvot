import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { isGmJoinEnabled } from "@/lib/services/gamemaster/gm-program-flags";
import { getGmLeaderboardPage } from "@/lib/services/gamemaster/gm-leaderboard.service";
import {
  parseGmLeaderboardPage,
  parseGmLeaderboardSort,
} from "@/lib/services/gamemaster/gm-leaderboard-rules";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * GET /api/gamemasters/leaderboard?sort=&page=&limit= (`External game plans/24` s6.1)
 *
 * Any signed-in player may read it (owner decision D7); nobody may while
 * `WhiteLabel.gmJoinEnabled` is off. The response never carries earnings or emails - the
 * row shape is an explicit key list in `gm-leaderboard-rules.ts`, pinned by a test.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isGmJoinEnabled())) {
      return NextResponse.json(
        { success: false, code: "feature_disabled", error: "The Game Master leaderboard is not available." },
        { status: 403 },
      );
    }

    const params = request.nextUrl.searchParams;
    const sort = parseGmLeaderboardSort(params.get("sort"));
    const paging = parseGmLeaderboardPage(params.get("page"), params.get("limit"));
    if (!sort || !paging) {
      return NextResponse.json(
        { success: false, code: "invalid_input", error: "Invalid sort or page." },
        { status: 400 },
      );
    }

    const page = await getGmLeaderboardPage({
      viewerUserId: session.user.id,
      sort,
      page: paging.page,
      pageSize: paging.pageSize,
    });
    return NextResponse.json({ success: true, ...page });
  } catch (error) {
    console.error("❌ Game Master leaderboard failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
