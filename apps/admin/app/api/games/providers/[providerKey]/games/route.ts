import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { setTitleEnabled } from "@/lib/services/game-providers/provider-admin.service";

/**
 * GET   /api/games/providers/[providerKey]/games - the cached catalogue for one provider
 * PATCH /api/games/providers/[providerKey]/games - flip one title's ChartVolt switch
 *
 * The list returns BOTH switches on every row, because showing only ours would leave an
 * operator unable to tell "we have not enabled it" from "the provider has withdrawn it".
 * Those need different actions, and the row is the only place the distinction is visible.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    await connectToDatabase();

    const games = await ProviderGame.find({ providerKey })
      .sort({ displayName: 1 })
      .lean();

    return NextResponse.json({ success: true, games });
  } catch (error) {
    console.error("❌ Failed to load provider catalogue:", error);
    return NextResponse.json(
      { error: "Failed to load the game catalogue." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      gameCode?: string;
      enabled?: boolean;
    };

    if (!body.gameCode || typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "A game code and an enabled flag are required." },
        { status: 400 },
      );
    }

    const result = await setTitleEnabled(providerKey, body.gameCode, body.enabled);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Game "${providerKey}/${body.gameCode}" ${
        body.enabled ? "enabled" : "disabled"
      } on ChartVolt${body.enabled ? "" : " (contests already running will still finish)"}`,
      targetType: "settings",
      targetId: `${providerKey}/${body.gameCode}`,
      newValue: body.enabled,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to update game enable switch:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
