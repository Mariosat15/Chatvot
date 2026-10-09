import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import { resolveContestViewer } from "@/lib/services/gamemaster/contest-viewer.service";
import {
  browseCompetitions,
  COMPETITIONS_PAGE_SIZE,
} from "@/lib/competitions/browse-competitions";

export const dynamic = "force-dynamic";

/**
 * GET /api/competitions
 *
 * Paginated browse (default pageSize 10). Query:
 *   page, limit, status, game, asset, q, sort
 *
 * Legacy clients that omit page still get a paged envelope; `competitions` is
 * aliased to `items` for older callers that only read that key.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      userId = session?.user?.id || null;
    } catch {
      // anonymous browse
    }

    const sp = request.nextUrl.searchParams;
    const viewer = await resolveContestViewer(userId);

    const result = await browseCompetitions({
      page: Number(sp.get("page") || 1),
      limit: Number(sp.get("limit") || COMPETITIONS_PAGE_SIZE),
      status: sp.get("status") || "active,upcoming",
      game: sp.get("game") || sp.get("type") || "all",
      asset: sp.get("asset") || undefined,
      q: sp.get("q") || sp.get("search") || undefined,
      sort: sp.get("sort") || "featured",
      viewer,
    });

    return NextResponse.json({
      ...result,
      // Reason: older pollers read `competitions`; keep both until fully migrated.
      competitions: result.items,
      userInCompetitionIds: result.userInCompetitionIds,
    });
  } catch (error) {
    console.error("Error fetching competitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitions" },
      { status: 500 },
    );
  }
}
