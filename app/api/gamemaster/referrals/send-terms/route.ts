import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { sendTermsRequest } from "@/lib/services/gamemaster/gm-terms-request.service";
import { sendReferralClaimReminder } from "@/lib/services/gamemaster/referral-claim-reminder.service";

/**
 * POST `{ referralId }` or `{ claimId }` - the Game Master's "Send terms" button
 * (`External game plans/24` s5.5, once-only since s5.6). `referralId` names an affiliated row
 * that has no consent yet; `claimId` names a link sign-up still waiting for an answer.
 *
 * Reason: the Game Master is always the SESSION user. The body names only the row, and each
 * service looks it up scoped to that Game Master, so another Game Master's referral reads as
 * not found rather than being sendable. A body naming BOTH is refused, so one click cannot
 * spend two reminders.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const hasReferral = body?.referralId !== undefined;
    const hasClaim = body?.claimId !== undefined;
    if (hasReferral === hasClaim) {
      return NextResponse.json(
        { success: false, code: "invalid_input", error: "Choose one referral to send the terms to." },
        { status: 400 },
      );
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const meta = {
      ipAddress: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    };
    const result = hasClaim
      ? await sendReferralClaimReminder({ gameMasterUserId: userId, claimId: body.claimId, meta })
      : await sendTermsRequest({ gameMasterUserId: userId, referralId: body.referralId, meta });
    if (result.success) return NextResponse.json(result);

    // Reason: `limit_reached` is 409, not 429 - since s5.6 there is no "try later". The send is
    // spent for good, and a 429 tells a client to retry.
    const status =
      result.code === "error"
        ? 500
        : result.code === "not_found"
          ? 404
          : result.code === "not_game_master"
            ? 403
            : 409;
    return NextResponse.json(
      { success: false, code: result.code, error: status === 500 ? GENERIC_ERROR : result.error },
      { status },
    );
  } catch (error) {
    console.error("❌ Sending Game Master terms failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
