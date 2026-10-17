import { NextRequest, NextResponse } from "next/server";
import {
  markResetTokenTwoFactorVerified,
  resolveResetTokenUserId,
  userHasTwoFactorEnrolment,
  verifyTwoFactorWithoutSession,
} from "@/lib/services/password-reset-2fa.service";

/**
 * POST /api/auth/password-reset/verify-2fa
 * Confirms TOTP/backup for a password-reset token when the account has 2FA.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      code?: string;
    };
    const token = (body.token || "").trim();
    const code = (body.code || "").trim();

    if (!token || !code) {
      return NextResponse.json(
        {
          success: false,
          error: "Reset token and verification code are required.",
        },
        { status: 400 },
      );
    }

    const resolved = await resolveResetTokenUserId(token);
    if (!resolved) {
      return NextResponse.json(
        {
          success: false,
          error: "This reset link is invalid or has expired.",
          code: "INVALID_TOKEN",
        },
        { status: 400 },
      );
    }

    const enrolled = await userHasTwoFactorEnrolment(resolved.userId);
    if (!enrolled) {
      // Reason: nothing to verify — treat as already cleared so a race where
      // 2FA was disabled mid-flow cannot strand the player.
      return NextResponse.json({ success: true, twoFactorVerified: true });
    }

    const ok = await verifyTwoFactorWithoutSession(resolved.userId, code);
    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification code.",
          code: "TWO_FACTOR_INVALID",
        },
        { status: 403 },
      );
    }

    await markResetTokenTwoFactorVerified(
      token,
      resolved.userId,
      resolved.expiresAt,
    );

    return NextResponse.json({ success: true, twoFactorVerified: true });
  } catch (error) {
    console.error("❌ [password-reset/verify-2fa]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
