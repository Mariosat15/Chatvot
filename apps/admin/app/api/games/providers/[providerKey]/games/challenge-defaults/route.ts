import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  challengeDurationBounds,
  parseChallengeDefaultsBody,
  setGameChallengeDefaults,
} from "@/lib/services/game-providers/challenge-defaults.service";

/**
 * GET   /api/games/providers/[providerKey]/games/challenge-defaults - the platform's own bounds
 * PATCH /api/games/providers/[providerKey]/games/challenge-defaults - what a player's challenge
 *                                                                    form opens pre-filled with
 *
 * A FOURTH route beside `games` (the Live on ChartVolt switch), `games/content` (the operator's
 * copy and artwork) and `games/play-style` (how the game is played), for the reason the content
 * route already records: one route taking either shape would have to work out which edit it was
 * being asked for from the fields present, and getting that wrong here changes how long a paid
 * 1v1 runs and how late a player may start their round.
 *
 * `challenge-defaults` is a literal segment and cannot collide with a provider key, because the
 * segment that varies is `[providerKey]` above it - the same reasoning as `content` and
 * `play-style`, and the reason provider health had to move out from under `providers/`.
 */

export const dynamic = "force-dynamic";

/**
 * The bounds the control has to draw itself against, sent rather than duplicated.
 *
 * The minimum, the maximum and the length a title that says nothing gets are all administered on
 * the Challenge settings screen, so a number typed into this component's `min`/`max` is a second
 * copy of a rule the server enforces - and the two drift in the quiet direction, offering a
 * length the save then refuses. Same reasoning as the analytics window being sent by its route
 * rather than written into the caption.
 *
 * Guarded exactly as the mutation is: this is not a secret, but a handler with no guard has no
 * attribution either, and every route in this folder having *something* is precisely what carries
 * a reader past the one that has nothing (R40, R57).
 */
export async function GET(
  _request: NextRequest,
  _context: { params: Promise<{ providerKey: string }> },
) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const bounds = await challengeDurationBounds();
    return NextResponse.json({ success: true, bounds });
  } catch (error) {
    console.error("❌ Failed to load challenge duration bounds:", error);
    return NextResponse.json(
      { error: "Failed to load the challenge duration limits." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  // `guardSection`, never `verifyAdminAuth` or `verifyAdminToken`: those ask whether the caller
  // is an admin at all, so an employee granted one unrelated section passes them. Nine instances
  // of that confusion are now on record in `17`, the most recent being the Image Optimizer's two
  // unguarded handlers (R57). This is the grant that reveals the screen.
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    const { providerKey } = await params;
    const body = (await request.json()) as {
      gameCode?: string;
      challengeDefaults?: unknown;
    };

    if (!body.gameCode || typeof body.gameCode !== "string") {
      return NextResponse.json({ error: "A game code is required." }, { status: 400 });
    }

    // The key must be PRESENT, because `null` means "clear them" and an absent field would have
    // to mean the same thing - at which point a malformed body of `{ gameCode }` silently undoes
    // an operator's decision. Same rule as the play-style route beside it.
    if (!("challengeDefaults" in body)) {
      return NextResponse.json(
        { error: "Challenge defaults are required, or null to clear them." },
        { status: 400 },
      );
    }

    const parsed = parseChallengeDefaultsBody(body.challengeDefaults);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await setGameChallengeDefaults(
      providerKey,
      body.gameCode,
      parsed.submitted,
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // The EFFECTIVE values, not the submitted ones, for the same reason the play-style route
    // logs the effective style: an operator reading this line later wants to know what a player
    // then saw, and a submission omitting the length produces a resolved one from the platform's
    // own settings.
    await auditLogService.log({
      admin: guard.admin,
      action: "settings_updated",
      category: "settings",
      description: parsed.submitted
        ? `Challenge defaults for "${providerKey}/${body.gameCode}": ${result.effective.durationMinutes} minutes, join rule "${result.effective.roundStartPolicy}"`
        : `Challenge defaults for "${providerKey}/${body.gameCode}" cleared - the platform's own answers apply again`,
      targetType: "settings",
      targetId: `${providerKey}/${body.gameCode}`,
      newValue: result.stored ?? null,
    });

    return NextResponse.json({
      success: true,
      effective: result.effective,
      stored: result.stored ?? null,
    });
  } catch (error) {
    console.error("❌ Failed to update challenge defaults:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
