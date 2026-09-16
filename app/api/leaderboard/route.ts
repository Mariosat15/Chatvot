import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { getGlobalLeaderboard } from "@/lib/actions/leaderboard/global-leaderboard.actions";
import { getUsersWithTitles } from "@/lib/services/xp-level.service";
import { getTitleLevels } from "@/lib/services/xp-config.service";
import { resolveLevelTitle } from "@/lib/utils/level-title";
import type { GlobalLeaderboardEntry } from "@/lib/actions/leaderboard/global-leaderboard.actions";
import {
  getGameLeaderboard,
  listLeaderboardTabs,
  CROSS_GAME_SCORING_STARTED_CAPTION,
} from "@/lib/services/games/game-leaderboard.service";
import { OVERALL_GAME_KEY } from "@/database/models/games/user-game-stats.model";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/leaderboard?page=1&limit=50
 * GET /api/leaderboard?source=stats&gameKey=_overall&page=1&limit=50
 *
 * Default remains the legacy trading-shaped rebuild (R14 parallel period).
 * `source=stats` serves UserGameStats — overall + per-game tabs.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Please sign in to view the leaderboard.",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        10,
        parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) ||
          DEFAULT_LIMIT,
      ),
    );
    const source = (searchParams.get("source") || "legacy").toLowerCase();
    const gameKeyParam = searchParams.get("gameKey");

    // Reason: tabs are always from stored stats so the UI can offer the switch
    // without a second round trip, even while the default page is still legacy.
    const tabs = await listLeaderboardTabs();

    if (source === "stats") {
      const gameKey =
        typeof gameKeyParam === "string" && gameKeyParam.length > 0
          ? gameKeyParam
          : OVERALL_GAME_KEY;
      const board = await getGameLeaderboard({
        gameKey,
        page,
        limit,
        viewerUserId: session.user.id,
      });
      return NextResponse.json({
        source: "stats" as const,
        ...board,
        tabs: board.tabs.length > 0 ? board.tabs : tabs,
      });
    }

    const full = await getGlobalLeaderboard(0);
    const totalCount = full.length;
    const offset = (page - 1) * limit;
    const pageEntries = full.slice(offset, offset + limit);

    const pageUserIds = pageEntries.map((e) => e.userId);
    const userLevels = pageUserIds.length
      ? await getUsersWithTitles(pageUserIds)
      : new Map();

    const ladder = await getTitleLevels();

    const entries: GlobalLeaderboardEntry[] = pageEntries.map((entry) => {
      const display = resolveLevelTitle(userLevels.get(entry.userId), ladder);
      return {
        ...entry,
        userTitle: display.title,
        userTitleIcon: display.icon,
        userTitleColor: display.color,
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
      source: "legacy" as const,
      entries,
      totalCount,
      page,
      limit,
      myPosition,
      tabs,
      startsFromCaption: CROSS_GAME_SCORING_STARTED_CAPTION,
      gameKey: OVERALL_GAME_KEY,
    });
  } catch (error) {
    console.error("[api/leaderboard] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load leaderboard";
    return NextResponse.json(
      { error: "Server error", message },
      { status: 500 },
    );
  }
}
