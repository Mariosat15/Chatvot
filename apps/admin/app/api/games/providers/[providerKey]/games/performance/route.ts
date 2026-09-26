import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import {
  DEFAULT_PERFORMANCE_WINDOW,
  getGamePerformanceForKey,
  resolveWindow,
  PERFORMANCE_WINDOWS,
} from "@/lib/services/games/game-performance.service";
import ProviderGame from "@/database/models/games/provider-game.model";
import { connectToDatabase } from "@/database/mongoose";

/**
 * GET /api/games/providers/[providerKey]/games/performance
 *
 * Per-title operational stats for the All Games workspace. Granted by `game-providers`
 * (the workspace grant), not `game-performance` — operators editing a title need the numbers
 * without a second section. No money in the response (same rule as the full performance route).
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const gameCode = request.nextUrl.searchParams.get("gameCode")?.trim() ?? "";
    if (!gameCode) {
      return NextResponse.json(
        { error: "A game code is required." },
        { status: 400 },
      );
    }

    const windowDays = resolveWindow(request.nextUrl.searchParams.get("days"));

    await connectToDatabase();
    const title = await ProviderGame.findOne({ providerKey, gameCode })
      .select("gameKey")
      .lean<{ gameKey?: string } | null>();

    if (!title?.gameKey) {
      return NextResponse.json({ error: "Title not found." }, { status: 404 });
    }

    const stats = await getGamePerformanceForKey(title.gameKey, windowDays);

    return NextResponse.json({
      success: true,
      stats,
      windowDays: windowDays ?? DEFAULT_PERFORMANCE_WINDOW,
      availableWindows: PERFORMANCE_WINDOWS,
    });
  } catch (error) {
    console.error("❌ Failed to read title performance:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
