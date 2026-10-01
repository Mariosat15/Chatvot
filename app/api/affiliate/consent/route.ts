import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import {
  answerAffiliateConsent,
  getAffiliateConsentPrompt,
} from "@/lib/services/gamemaster/affiliate-consent.service";
import type { ClaimUser } from "@/lib/services/gamemaster/referral-claim.service";

/**
 * The one consent backend for the Game Master affiliate terms (`External game plans/24` s5.6).
 *
 * GET  -> `{ show: false }` or `{ show: true, kind, gameMasterId, gameMasterName }`.
 * POST -> `{ decision: "accept", termsAcceptanceId }` or `{ decision: "decline" }`.
 *
 * Reason: the player is always the session user, and nothing in the body names a player or a
 * Game Master - which question is being answered is decided server side from stored state, so
 * a request cannot answer somebody else's invitation or pick a different Game Master. The two
 * older routes (`/api/gamemaster/referral-claim`, `/api/gamemaster/terms-request`) keep working
 * for any tab still running the old bundle.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";

async function sessionUser(request: NextRequest): Promise<ClaimUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email, name: user.name || undefined };
}

export async function GET(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const prompt = await getAffiliateConsentPrompt(user);
    return NextResponse.json({ success: true, ...prompt });
  } catch (error) {
    console.error("❌ Affiliate consent prompt failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await sessionUser(request);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const forwarded = request.headers.get("x-forwarded-for");
    const result = await answerAffiliateConsent({
      user,
      decision: body?.decision,
      termsAcceptanceId: body?.termsAcceptanceId,
      meta: {
        ipAddress: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });
    if (result.success) return NextResponse.json(result);

    const status =
      result.code === "error"
        ? 500
        : result.code === "invalid_decision"
          ? 400
          : result.code === "no_open_consent" || result.code === "no_open_claim" || result.code === "in_progress"
            ? 409
            : 422;
    return NextResponse.json(
      { success: false, code: result.code, retryable: result.retryable, error: status === 500 ? GENERIC_ERROR : result.error },
      { status },
    );
  } catch (error) {
    console.error("❌ Answering affiliate consent failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
