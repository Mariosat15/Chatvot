import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { RateLimiters } from "@/lib/utils/rate-limiter";
import { isGmJoinEnabled } from "@/lib/services/gamemaster/gm-program-flags";
import { affiliate } from "@/lib/services/gamemaster/affiliation.service";
import { JOIN_GM_REFUSAL_STATUS } from "@/lib/services/gamemaster/gm-leaderboard-rules";

const GENERIC_ERROR = "Something went wrong. Please contact support.";

/**
 * POST /api/gamemasters/[subscriptionId]/join  body `{ termsAcceptanceId }`
 * (`External game plans/24` s6.3)
 *
 * The order is load-bearing: session, then the switch, then the rate limit, then the body.
 * Every rule about WHO may join WHOM lives in `affiliate()` - the one writer - and this
 * route adds only transport: who is asking, whether the feature is on, and how often.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subscriptionId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isGmJoinEnabled())) {
      return NextResponse.json(
        { success: false, code: "feature_disabled", error: "Joining a Game Master is not available." },
        { status: 403 },
      );
    }

    // Reason: counted before the body is read, so malformed requests spend the budget too
    // - otherwise the limit can be walked round by sending garbage between real attempts.
    const limit = RateLimiters.gmJoin(session.user.id);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, code: "rate_limited", error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, code: "invalid_input", error: "Invalid request body." },
        { status: 400 },
      );
    }
    const termsAcceptanceId = (body as { termsAcceptanceId?: unknown } | null)?.termsAcceptanceId;
    const { subscriptionId } = await context.params;

    const result = await affiliate({
      user: { id: session.user.id, email: session.user.email, name: session.user.name },
      gameMaster: { subscriptionId },
      channel: "chartvolt_join_gm",
      surface: "leaderboard",
      // Reason: passed through untyped-but-checked - `affiliate()` refuses anything that is
      // not the id of this player's fresh acceptance of the current wording for this GM.
      termsAcceptanceId: typeof termsAcceptanceId === "string" ? termsAcceptanceId : undefined,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (!result.success) {
      const status = JOIN_GM_REFUSAL_STATUS.get(result.code) ?? 500;
      const error = status === 500 ? GENERIC_ERROR : result.error;
      return NextResponse.json({ success: false, code: result.code, error }, { status });
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      alreadyAffiliated: result.alreadyAffiliated,
    });
  } catch (error) {
    console.error("❌ Join Game Master failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
