import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth, twoFactorApi } from "@/lib/better-auth/auth";

/**
 * POST /api/user/2fa/disable
 * Removes 2FA from the current user's account after verifying their
 * password. Intentionally does NOT also require a TOTP code — this
 * matches better-auth's default and keeps account-recovery paths
 * functional if the user loses their authenticator and uses a backup
 * code earlier in the session.
 *
 * Note: If 2FA is required for high-value actions (e.g. withdrawals),
 * a separate cooldown should be enforced on that action — not here.
 *
 * Body: { password: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const password: unknown = body?.password;
    if (typeof password !== "string" || password.length < 1) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    await twoFactorApi().disableTwoFactor({
      body: { password },
      headers: await headers(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn("⚠️ [2FA] disable error:", message);

    if (/invalid|incorrect|wrong/i.test(message)) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not disable 2FA. Please try again." },
      { status: 500 },
    );
  }
}
