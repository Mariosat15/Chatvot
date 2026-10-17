import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { errorResponse } from "@/lib/utils/api-utils";
import { getUserById } from "@/lib/utils/user-lookup";
import { setUsername } from "@/lib/services/username.service";
import { syncPublicNameCopies } from "@/lib/services/username-sync.service";
import { checkRateLimit } from "@/lib/utils/rate-limiter";

/**
 * The signed-in player's own username.
 *
 * GET reports the current handle (absent on accounts that predate usernames) and the
 * public name other players currently see. PUT sets or changes it, then rewrites every
 * stored copy of the old name so leaderboards, challenges and chats stop showing it.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(session.user.id);
    if (!user) return errorResponse("User not found", 404);

    return NextResponse.json({
      username: user.username ?? null,
      publicName: user.publicName,
    });
  } catch (error) {
    console.error("❌ Error reading username:", error);
    return errorResponse("Something went wrong. Please contact support.", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // Reason: every change triggers a rewrite across several collections, so a
    // player cycling handles in a loop is an expensive write storm.
    const limit = checkRateLimit(`username-change:${userId}`, {
      maxRequests: 5,
      windowMs: 60 * 60_000,
    });
    if (!limit.success) {
      return errorResponse("Too many username changes. Please try again later.", 429);
    }

    const body = await request.json().catch(() => null);
    const result = await setUsername(userId, body?.username);
    if (!result.success) {
      const status =
        result.code === "invalid" ? 400 : result.code === "taken" ? 409 : result.code === "not_found" ? 404 : 500;
      return errorResponse(result.error, status);
    }

    if (result.previous !== result.username) {
      // Reason: the username is already saved; a failed copy rewrite must not report
      // the change as failed, it only leaves some old rows showing the previous name.
      await syncPublicNameCopies(userId, result.username).catch((error) => {
        console.warn("⚠️ Username saved but stored name copies were not rewritten:", error);
      });
    }

    return NextResponse.json({ success: true, username: result.username });
  } catch (error) {
    console.error("❌ Error changing username:", error);
    return errorResponse("Something went wrong. Please contact support.", 500);
  }
}
