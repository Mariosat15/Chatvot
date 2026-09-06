import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { twoFactorApi } from "@/lib/better-auth/auth";

/**
 * POST /api/user/2fa/verify-otp
 * Verifies the email-channel one-time password that was emailed to the
 * user after calling /api/user/2fa/send-otp.
 *
 * Body: { code: string; trustDevice?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code: unknown = body?.code;
    const trustDevice: unknown = body?.trustDevice;

    if (typeof code !== "string" || !/^\d{4,8}$/.test(code.trim())) {
      return NextResponse.json(
        { error: "Enter the code sent to your email." },
        { status: 400 },
      );
    }

    await twoFactorApi().verifyTwoFactorOTP({
      body: {
        code: code.trim(),
        trustDevice: Boolean(trustDevice),
      },
      headers: await headers(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn("⚠️ [2FA] verify-otp error:", message);

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
