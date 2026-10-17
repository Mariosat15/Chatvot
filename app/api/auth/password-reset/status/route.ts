import { NextRequest, NextResponse } from "next/server";
import {
  isResetTokenTwoFactorVerified,
  resolveResetTokenUserId,
  userHasTwoFactorEnrolment,
} from "@/lib/services/password-reset-2fa.service";

/**
 * GET /api/auth/password-reset/status?token=
 * Tells the reset page whether the token is usable and whether 2FA is required.
 * Does not return the user's email.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || "";
    const resolved = await resolveResetTokenUserId(token);
    if (!resolved) {
      return NextResponse.json({
        valid: false,
        requiresTwoFactor: false,
        twoFactorVerified: false,
      });
    }

    const requiresTwoFactor = await userHasTwoFactorEnrolment(
      resolved.userId,
    );
    const twoFactorVerified = requiresTwoFactor
      ? await isResetTokenTwoFactorVerified(token)
      : true;

    return NextResponse.json({
      valid: true,
      requiresTwoFactor,
      twoFactorVerified,
    });
  } catch (error) {
    console.error("❌ [password-reset/status]", error);
    return NextResponse.json(
      {
        valid: false,
        requiresTwoFactor: false,
        twoFactorVerified: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
