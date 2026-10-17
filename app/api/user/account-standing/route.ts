import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { getAccountStanding } from "@/lib/services/account-standing.service";

/**
 * GET /api/user/account-standing
 *
 * Polled by `AccountStandingGuard` on every signed-in page. Answers whether the player may
 * stay signed in, and if not, where they should be sent.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { ok: false, reason: "no_session", action: "sign_out" },
        { status: 401 },
      );
    }

    const standing = await getAccountStanding(session.user.id, session.user.email);
    return NextResponse.json(standing, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("❌ [Account standing] Check failed:", error);
    // Reason: a failed CHECK is not a failed account. Answering ok:false here would sign
    // every player out during a database blip, so the guard is told to try again later.
    return NextResponse.json(
      { ok: true, degraded: true, error: "Something went wrong. Please contact support." },
      { status: 503 },
    );
  }
}
