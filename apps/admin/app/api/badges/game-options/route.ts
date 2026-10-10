import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import { TRADING_GAME_TYPE } from "@/lib/games/types";

/**
 * GET /api/badges/game-options
 * Scope options for badge authoring (R96b). Guarded by badges, not game-providers,
 * so an operator with the badges grant can scope without needing the catalogue grant.
 */
export async function GET() {
  const guard = await guardSection("badges");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();
    // Reason: deprecated titles (e.g. circuit-perfect) stay in the catalogue for history
    // but must not be offered as badge scope — chartvoltEnabled alone is not enough.
    const rows = await ProviderGame.find({
      chartvoltEnabled: true,
      providerStatus: "active",
    })
      .select({ gameKey: 1, displayName: 1 })
      .lean();

    const games = rows
      .filter((r) => typeof r.gameKey === "string" && r.gameKey)
      .map((r) => ({
        gameKey: r.gameKey as string,
        displayName: (r.displayName as string) || (r.gameKey as string),
      }));

    return NextResponse.json({
      success: true,
      options: [
        { gameKey: TRADING_GAME_TYPE, displayName: "Trading" },
        ...games,
      ],
    });
  } catch (error) {
    console.error("badge game-options:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load game options" },
      { status: 500 },
    );
  }
}
