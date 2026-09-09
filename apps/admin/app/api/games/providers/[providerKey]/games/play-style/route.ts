import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  parsePlayStyleInput,
  setGamePlayStyle,
} from "@/lib/services/game-providers/game-play-style.service";

/**
 * PATCH /api/games/providers/[providerKey]/games/play-style - whether everybody plays this
 *                                                             title at once
 *
 * A THIRD route beside `games` (the Live on ChartVolt switch) and `games/content` (the
 * operator's copy and artwork), for the reason the content route already records: one route
 * taking either shape would have to work out which edit it was being asked for from the
 * fields present, and getting that wrong here changes when entry closes and how many attempts
 * a player gets on a contest somebody has paid to enter.
 *
 * `play-style` is a literal segment and cannot collide with a provider key, because the
 * segment that varies is `[providerKey]` above it - the same reasoning as `content`, and the
 * reason provider health had to move out from under `providers/`.
 */

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  // `guardSection`, never `verifyAdminAuth` or `verifyAdminToken`: those ask whether the
  // caller is an admin at all, so an employee granted one unrelated section passes them.
  // Nine instances of that confusion are now on record in `17`, the most recent being the
  // Image Optimizer's two unguarded handlers (R57). This is the grant that reveals the screen.
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      gameCode?: string;
      playMode?: unknown;
    };

    if (!body.gameCode || typeof body.gameCode !== "string") {
      return NextResponse.json({ error: "A game code is required." }, { status: 400 });
    }

    // The key must be PRESENT, because `null` means "clear it and follow the provider again"
    // and an absent field would have to mean the same thing - at which point a malformed body
    // of `{ gameCode }` silently undoes an operator's decision.
    if (!("playMode" in body)) {
      return NextResponse.json(
        { error: "A play style is required, or null to follow the provider." },
        { status: 400 },
      );
    }

    const parsed = parsePlayStyleInput(body.playMode);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await setGamePlayStyle(providerKey, body.gameCode, parsed.mode);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // The EFFECTIVE style, not the submitted one. An operator reading this line later wants
    // to know how the game was then run, and for a title whose provider already agreed those
    // two differ in emphasis: "set to Everyone at once" and "now runs Everyone at once, no
    // longer overridden" are different events and the second is the one that happened.
    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: `Play style for "${providerKey}/${body.gameCode}" is now "${result.effective}"${
        result.override
          ? " (set by us, overriding the provider)"
          : " (following the provider's own declaration)"
      }`,
      targetType: "settings",
      targetId: `${providerKey}/${body.gameCode}`,
      newValue: result.override ?? null,
    });

    return NextResponse.json({
      success: true,
      effective: result.effective,
      override: result.override ?? null,
    });
  } catch (error) {
    console.error("❌ Failed to update game play style:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
