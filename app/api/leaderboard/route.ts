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
import { getTerms } from "@/lib/services/terminology.service";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Which board was asked for.
 *
 * Reason: only three boards are offered — Global, Trading, Games. An
 * unrecognised `board` (including a leftover per-game `gameKey`) falls back to
 * Global rather than inventing a fourth board the UI no longer renders.
 */
function resolveBoardId(params: {
  boardParam: string | null;
  source?: string;
  gameKeyParam: string | null;
}): string {
  const { boardParam, source } = params;
  const asked = boardParam?.trim()?.toLowerCase();
  if (asked === "trading" || asked === "games" || asked === "global") {
    return asked;
  }
  if (source === "stats") return "games";
  if (source === "legacy") return "trading";
  return "global";
}

/**
 * GET /api/leaderboard?board=global|trading|games&page=1&limit=50
 *
 * Three boards only:
 *  - `global`  — combined ranking (seven weighted components).
 *  - `trading` — Trading Leaderboard.
 *  - `games`   — Games Leaderboard (`_overall` rollup). Per-game boards removed.
 *
 * `source=legacy|stats` still maps to trading / games for older clients.
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

    // Reason: always the same three labels. Games is offered even when empty so
    // the dropdown does not jump when the first game contest settles. Nouns come
    // from getTerms() (X8 pass 4) so an operator rename reaches the picker.
    const tabs = await listLeaderboardTabs();
    const terms = await getTerms();
    const boards = [
      { id: "global", label: `Global ${terms.leaderboard}` },
      { id: "trading", label: `Trading ${terms.leaderboard}` },
      { id: "games", label: `${terms.games} ${terms.leaderboard}` },
    ];

    const board = resolveBoardId({
      boardParam: searchParams.get("board"),
      source,
      gameKeyParam,
    });

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
      // Games Leaderboard only — never a per-title board.
      const result = await getGameLeaderboard({
        gameKey: OVERALL_GAME_KEY,
        page,
        limit,
        viewerUserId: session.user.id,
      });
      const ladder = await getTitleLevels();
      const pageLevels = result.entries.length
        ? await getUsersWithTitles(result.entries.map((e) => e.userId))
        : new Map();

      return NextResponse.json({
        source: "stats" as const,
        board: "games",
        boards,
        ...result,
        entries: result.entries.map((entry) => {
          const display = resolveLevelTitle(pageLevels.get(entry.userId), ladder);
          return {
            ...entry,
            userTitle: display.title,
            userTitleIcon: display.icon,
            userTitleColor: display.color,
          };
        }),
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
