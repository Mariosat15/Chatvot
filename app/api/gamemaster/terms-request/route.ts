import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import {
  answerTermsRequest,
  getTermsRequestPrompt,
} from "@/lib/services/gamemaster/gm-terms-request.service";

/**
 * The player's side of "Send T&C" (`External game plans/24` s5.5).
 *
 * GET  -> `{ show: false }` or `{ show: true, requestId, gameMasterId, gameMasterName }`.
 * POST -> `{ action: "accept", termsAcceptanceId }` or `{ action: "decline" }`.
 *
 * Reason: the player is always the session user and the Game Master is the one stored on the
 * request, so nothing in the body can answer somebody else's request.
 */

const GENERIC_ERROR = "Something went wrong. Please contact support.";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: true, ...(await getTermsRequestPrompt(userId)) });
  } catch (error) {
    console.error("❌ Terms request prompt failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const user = session?.user;
    if (!user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const forwarded = request.headers.get("x-forwarded-for");
    const result = await answerTermsRequest({
      user: { id: user.id, email: user.email || undefined, name: user.name || undefined },
      action: body?.action,
      termsAcceptanceId: body?.termsAcceptanceId,
      meta: {
        ipAddress: forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });
    if (result.success) return NextResponse.json(result);

    const status =
      result.code === "error" ? 500 : result.code === "invalid_action" ? 400 : result.code === "no_request" ? 409 : 422;
    return NextResponse.json(
      { success: false, code: result.code, error: status === 500 ? GENERIC_ERROR : result.error },
      { status },
    );
  } catch (error) {
    console.error("❌ Answering terms request failed:", error);
    return NextResponse.json({ success: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
