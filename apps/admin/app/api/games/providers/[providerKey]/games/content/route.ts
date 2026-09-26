import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { updateGameContent } from "@/lib/services/game-providers/game-content.service";

/**
 * PATCH /api/games/providers/[providerKey]/games/content - the operator's copy and artwork
 *                                                          for one catalogue title
 *
 * A separate route from the sibling `games` PATCH, which flips the Live on ChartVolt switch.
 * One route taking either shape would have to work out which edit it was being asked for
 * from the fields present, and the failure mode of getting that wrong is a content save that
 * silently changes a game's live state.
 *
 * `content` is a literal segment and cannot collide with a provider key, because the segment
 * that varies is `[providerKey]` above it. That is not true one level down, which is why
 * provider health lives at `/api/games/provider-health` rather than under `providers/` - a
 * provider keyed `health` would otherwise be unreachable through the dynamic segment.
 */

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  // `guardSection`, never `requireAdminAuth` or `verifyAdminToken`: those ask whether the
  // caller is an admin at all, so an employee granted one unrelated section passes them.
  // Eight instances of that confusion are on record in `17`; this is the grant.
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as { gameCode?: string; content?: unknown };

    if (!body.gameCode || typeof body.gameCode !== "string") {
      return NextResponse.json({ error: "A game code is required." }, { status: 400 });
    }

    const result = await updateGameContent(providerKey, body.gameCode, body.content);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // The changed FIELD NAMES, never their values. A description is up to 2,000 characters
    // and a banner is a URL, so logging the values would make the audit trail unreadable in
    // exactly the place an operator goes to find out who changed a game's wording.
    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Game content updated for "${providerKey}/${body.gameCode}": ${Object.keys(
        result.content,
      ).join(", ")}`,
      targetType: "settings",
      targetId: `${providerKey}/${body.gameCode}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Failed to update game content:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
