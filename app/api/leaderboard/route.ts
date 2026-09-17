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
import { getGlobalBoard } from "@/lib/services/leaderboard/global-board.service";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Which board was asked for.
 *
 * Reason: `board` wins, then the legacy `source` pair, then the default. An
 * unrecognised value falls through to a game key rather than being refused,
 * because the per-game boards are named by stored keys and the route must not
 * hold a list of them.
 */
function resolveBoardId(params: {
  boardParam: string | null;
  source?: string;
  gameKeyParam: string | null;
}): string {
  const { boardParam, source, gameKeyParam } = params;
  const asked = boardParam?.trim();
  if (asked) return asked.toLowerCase() === "trading" ? "trading" : asked;
  if (source === "stats") {
    return gameKeyParam && gameKeyParam.length > 0 && gameKeyParam !== OVERALL_GAME_KEY
      ? gameKeyParam
      : "games";
  }
  if (source === "legacy") return "trading";
  return "global";
}

/**
 * GET /api/leaderboard?board=global|trading|games|<gameKey>&page=1&limit=50
 *
 * One endpoint, one envelope, three kinds of board:
 *
 *  - `global`  — the combined ranking (seven weighted components).
 *  - `trading` — trading performance only, the board that used to be the default.
 *  - `games`   — games performance, the stored `_overall` rollup.
 *  - anything else is treated as a single game's key.
 *
 * `source=legacy|stats` is still accepted so an older client keeps working;
 * it maps onto `trading` and `games` respectively.
 *
 * Reason: the default is now `global` on the owner's instruction of 16 Sep 2026.
 * That does not erase the R14 parallel period — trading is 25% of the global
 * score and is still served in full under `board=trading`.
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
    const source = searchParams.get("source")?.toLowerCase();
    const gameKeyParam = searchParams.get("gameKey");
    const search = searchParams.get("search") || undefined;

    // Reason: one dropdown, so the board list is always sent, whichever board
    // was asked for — the client must never have to guess what else exists.
    const tabs = await listLeaderboardTabs();
    const boards = [
      { id: "global", label: "Global leaderboard" },
      { id: "trading", label: "Trading performance" },
      ...tabs
        .filter((t) => t.gameKey !== OVERALL_GAME_KEY && t.gameKey !== "trading")
        .map((t) => ({ id: t.gameKey, label: t.label })),
    ];
    // Games performance only exists once a game has been played, so it is
    // offered only when the rollup tab is there to back it.
    if (tabs.some((t) => t.gameKey === OVERALL_GAME_KEY)) {
      boards.splice(2, 0, { id: "games", label: "Games performance" });
    }

    const board = resolveBoardId({ boardParam: searchParams.get("board"), source, gameKeyParam });

    if (board === "global") {
      const result = await getGlobalBoard({
        page,
        limit,
        viewerUserId: session.user.id,
        search,
      });
      const ladder = await getTitleLevels();
      const pageLevels = result.entries.length
        ? await getUsersWithTitles(result.entries.map((e) => e.userId))
        : new Map();

      return NextResponse.json({
        source: "global" as const,
        board: "global",
        boards,
        entries: result.entries.map((entry) => {
          const display = resolveLevelTitle(pageLevels.get(entry.userId), ladder);
          return {
            ...entry,
            userTitle: display.title,
            userTitleIcon: display.icon,
            userTitleColor: display.color,
          };
        }),
        totalCount: result.totalCount,
        page: result.page,
        limit: result.limit,
        myPosition: result.myPosition,
        // Reason: `weightsForDisplay` already carries the label, the one-line
        // description and the whole percentage the arithmetic used, so the
        // screen is never handed a second copy of the component list to drift
        // against.
        weights: result.weights,
        tabs,
      });
    }

    if (board !== "trading") {
      const gameKey = board === "games" ? OVERALL_GAME_KEY : board;
      const result = await getGameLeaderboard({
        gameKey,
        page,
        limit,
        viewerUserId: session.user.id,
      });
      return NextResponse.json({
        source: "stats" as const,
        board,
        boards,
        ...result,
        tabs: result.tabs.length > 0 ? result.tabs : tabs,
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
      board: "trading",
      boards,
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
