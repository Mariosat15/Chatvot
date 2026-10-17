import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { twoFactorApi } from "@/lib/better-auth/auth";

/**
 * POST /api/user/2fa/verify-totp
 * Verifies a 6-digit TOTP code from the user's authenticator app.
 *
 * Used in two contexts:
 *   (a) During enrollment — confirms the authenticator is paired, then
 *       better-auth marks twoFactorEnabled = true on the user.
 *   (b) During sign-in — finalises the session when a user with 2FA
 *       active has just entered email + password.
 *
 * Body: { code: string; trustDevice?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code: unknown = body?.code;
    const trustDevice: unknown = body?.trustDevice;

    if (typeof code !== "string" || !/^\d{6,8}$/.test(code.trim())) {
      return NextResponse.json(
        { error: "Enter the 6-digit code from your authenticator app." },
        { status: 400 },
      );
    }

    await twoFactorApi().verifyTOTP({
      body: {
        code: code.trim(),
        trustDevice: Boolean(trustDevice),
      },
      headers: await headers(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn("⚠️ [2FA] verify-totp error:", message);

    if (/invalid|incorrect|expired/i.test(message)) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please try again." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not verify the code. Please try again." },
      { status: 500 },
    );
  }
}
