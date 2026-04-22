import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";

/**
 * POST /api/user/2fa/enable
 * Starts the 2FA enrollment flow. Returns the TOTP URI (for QR display)
 * and the initial set of backup codes.
 *
 * IMPORTANT: This DOES NOT fully activate 2FA yet. The user must call
 * /api/user/2fa/verify-totp with a valid code from their authenticator
 * app before we mark twoFactorEnabled = true. Better-auth handles this
 * two-step confirmation internally.
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

    const result = (await auth.api.enableTwoFactor({
      body: { password },
      headers: await headers(),
    })) as { totpURI?: string; backupCodes?: string[] } | undefined;

    if (!result?.totpURI) {
      return NextResponse.json(
        { error: "Could not start 2FA enrollment." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      totpURI: result.totpURI,
      backupCodes: result.backupCodes || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn("⚠️ [2FA] enable error:", message);

    // Reason: Better-auth surfaces "invalid password" as a thrown error.
    // Map it to a friendlier client message without leaking internals.
    if (/invalid|incorrect|wrong/i.test(message)) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not enable 2FA. Please try again." },
      { status: 500 },
    );
  }
}
