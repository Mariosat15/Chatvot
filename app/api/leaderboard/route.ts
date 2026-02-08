import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { getGlobalLeaderboard } from "@/lib/actions/leaderboard/global-leaderboard.actions";
import { getUsersWithTitles } from "@/lib/services/xp-level.service";
import { getTitleByXP } from "@/lib/constants/levels";
import type { GlobalLeaderboardEntry } from "@/lib/actions/leaderboard/global-leaderboard.actions";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/leaderboard?page=1&limit=50
 * Returns a paginated slice. Builds full list once (cached 60s); titles loaded only for the requested page.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view the leaderboard." },
        { status: 401 }
      );
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
    const pageEntries = full.slice(offset, offset + limit);

    const pageUserIds = pageEntries.map((e) => e.userId);
    const userLevels = pageUserIds.length
      ? await getUsersWithTitles(pageUserIds)
      : new Map();
    const entries: GlobalLeaderboardEntry[] = pageEntries.map((entry) => {
      const level = userLevels.get(entry.userId);
      const titleLevel = level ? getTitleByXP(level.currentXP) : getTitleByXP(0);
      return {
        ...entry,
        userTitle: titleLevel.title,
        userTitleIcon: titleLevel.icon,
        userTitleColor: titleLevel.color,
      };
    });

    const userEntry = full.find((e) => e.userId === session.user.id);
    const myPosition = {
      rank: userEntry?.rank ?? 0,
      totalUsers: full.length,
      percentile: userEntry
        ? ((full.length - userEntry.rank + 1) / full.length) * 100
        : 0,
    };

    return NextResponse.json({
      entries,
      totalCount,
      page,
      limit,
      myPosition,
    });
  } catch (error) {
    console.error("[api/leaderboard] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load leaderboard";
    return NextResponse.json(
      { error: "Server error", message },
      { status: 500 }
    );
  }
}
