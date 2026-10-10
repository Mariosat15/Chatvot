import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import {
  acceptReferralClaim,
  declineReferralClaim,
  getReferralClaimPrompt,
  type ClaimUser,
} from "@/lib/services/gamemaster/referral-claim.service";

/**
 * The one-time Gamemaster terms prompt for a player who signed up through a referral link
 * (`External game plans/24` s5.3).
 *
 * GET  -> `{ show: false }` or `{ show: true, gameMasterId, gameMasterName }`.
 * POST -> `{ action: "accept", termsAcceptanceId }` or `{ action: "decline" }`.
 *
 * Reason: the player is always the session user - nothing in the body names a player or a
 * Game Master, so a request cannot answer somebody else's invitation. The Game Master is
 * the one stored on the claim at sign-up; the consent id is verified by `affiliate()`.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";

async function sessionUser(request: NextRequest): Promise<ClaimUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email, name: user.name || undefined };
}

function requestMeta(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const prompt = await getReferralClaimPrompt(user);
    return NextResponse.json({ success: true, ...prompt });
  } catch (error) {
    console.error("❌ Referral claim prompt failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const action = body?.action;
    const meta = requestMeta(request);

    let result;
    if (action === "accept") {
      result = await acceptReferralClaim({ user, termsAcceptanceId: body?.termsAcceptanceId, ...meta });
    } else if (action === "decline") {
      result = await declineReferralClaim({ user, ...meta });
    } else {
      return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
    }

    if (result.success) return NextResponse.json(result);
    // Reason: "nothing to answer" and "an answer already in flight" are conflicts with the
    // claim's state, not server faults; an outage is a 500 with the generic message.
    const status = result.code === "error" ? 500 : result.code === "no_open_claim" || result.code === "in_progress" ? 409 : 422;
    return NextResponse.json(
      { success: false, code: result.code, retryable: result.retryable, error: status === 500 ? GENERIC_ERROR : result.error },
      { status },
    );
  } catch (error) {
    console.error("❌ Answering referral claim failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
