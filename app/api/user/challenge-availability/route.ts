import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { errorResponse } from "@/lib/utils/api-utils";
import {
  getChallengeAvailability,
  setGameWillingness,
} from "@/lib/services/games/challenge-availability.service";

/**
 * A player's own per-game challenge availability.
 *
 * DELIBERATELY DOES NOT WRITE `UserPresence.acceptingChallenges`. The GET
 * reports it, because the settings screen has to render the master switch beside
 * the per-game ones, but the write goes through `PATCH /api/user/presence`,
 * which already owns that field. A second writer of one field is the "one rule,
 * two copies" shape in its smallest form, and here the two would disagree about
 * whether a settings change counts as activity.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const availability = await getChallengeAvailability(session.user.id);
    return NextResponse.json(availability);
  } catch (error) {
    console.error("❌ Error reading challenge availability:", error);
    return errorResponse("Something went wrong. Please contact support.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const gameKey = typeof body?.gameKey === "string" ? body.gameKey : "";
    // Reason: `typeof` rather than a truthiness check, because `false` is the
    // whole point of this endpoint and `!body.willing` would refuse every
    // opt-out while accepting every opt-in.
    if (typeof body?.willing !== "boolean") {
      return errorResponse("A willing value is required", 400);
    }

    const result = await setGameWillingness(
      session.user.id,
      gameKey,
      body.willing,
    );
    if (!result.success) {
      return errorResponse(result.error, 400);
    }

    return NextResponse.json({ success: true, willing: result.willing });
  } catch (error) {
    console.error("❌ Error saving challenge availability:", error);
    return errorResponse("Something went wrong. Please contact support.", 500);
  }
}
