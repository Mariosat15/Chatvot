import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { suggestOpenContests } from "@/lib/services/games/game-suggestions.service";
import { listInterestedGameKeys } from "@/lib/services/games/interest-inference.service";

/**
 * GET /api/games/suggestions
 *
 * Contests the player might like, derived from play / declared interest.
 * Never creates invitations (X14).
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [interests, contests] = await Promise.all([
      listInterestedGameKeys(session.user.id),
      suggestOpenContests(session.user.id, 8),
    ]);

    return NextResponse.json({
      success: true,
      interests,
      contests,
    });
  } catch (error) {
    console.error("Error loading game suggestions:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
