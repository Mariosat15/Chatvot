import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { sendTermsRequest } from "@/lib/services/gamemaster/gm-terms-request.service";

/**
 * POST `{ referralId }` - the Game Master's "Send T&C" button (`External game plans/24` s5.5).
 *
 * Reason: the Game Master is always the SESSION user. The body names only the referral row,
 * and the service looks it up scoped to that Game Master, so another Game Master's referral
 * reads as not found rather than being sendable.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const forwarded = request.headers.get("x-forwarded-for");
    const result = await sendTermsRequest({
      gameMasterUserId: userId,
      referralId: body?.referralId,
      meta: {
        ipAddress: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });
    if (result.success) return NextResponse.json(result);

    const status =
      result.code === "error"
        ? 500
        : result.code === "not_found"
          ? 404
          : result.code === "not_game_master"
            ? 403
            : result.code === "cooldown" || result.code === "limit_reached"
              ? 429
              : 409;
    return NextResponse.json(
      { success: false, code: result.code, retryAt: result.retryAt, error: status === 500 ? GENERIC_ERROR : result.error },
      { status },
    );
  } catch (error) {
    console.error("❌ Sending Game Master terms failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
