import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";

/**
 * POST /api/user/2fa/send-otp
 * Email-OTP fallback channel. Generates and emails a short-lived code
 * to the user (using our sendTwoFactorOTP helper via the plugin config).
 *
 * Typical flow: user has 2FA enabled but cannot access their
 * authenticator — they click "Send code by email" on the verify page,
 * receive an OTP, and complete verification via /verify-otp below.
 */
export async function POST() {
  try {
    await auth.api.sendTwoFactorOTP({
      body: {},
      headers: await headers(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn("⚠️ [2FA] send-otp error:", message);

    return NextResponse.json(
      { error: "Could not send verification email. Please try again." },
      { status: 500 },
    );
  }
}
