import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { listChallengeableTitles } from "@/lib/services/games/challengeable-titles.service";
import { errorResponse } from "@/lib/utils/api-utils";

/**
 * The list the "create a challenge" game picker renders.
 *
 * Requires a session, same as every other `/api/challenges/*` route, though the answer does
 * not depend on which player is asking - a challenge title is a platform-wide fact, not a
 * per-user one. The check exists so the picker cannot be enumerated by a caller with no
 * account, consistent with every sibling route in this folder.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const titles = await listChallengeableTitles();
    return NextResponse.json({ titles });
  } catch (error) {
    console.error("❌ Error fetching challengeable titles:", error);
    return errorResponse("Something went wrong. Please contact support.", 500);
  }
}
