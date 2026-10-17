import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { getActiveGameMasterIds } from "@/lib/services/gamemaster/active-game-masters";

/**
 * GET /api/gamemaster/active-ids
 * The user ids of every active Game Master, so any screen can badge a name.
 *
 * Reason for one list rather than a per-row lookup: names are rendered by a dozen
 * components, several of them from polled responses, and a lookup per component would be
 * a dozen queries per page. The set of Game Masters is small and changes rarely, so it is
 * cached in memory for a minute.
 */
const CACHE_MS = 60_000;
let cached: { at: number; ids: string[] } | null = null;

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!cached || Date.now() - cached.at > CACHE_MS) {
      cached = { at: Date.now(), ids: await getActiveGameMasterIds() };
    }

    return NextResponse.json({ success: true, userIds: cached.ids });
  } catch (error) {
    console.error("❌ [GM BADGE] active-ids failed:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
