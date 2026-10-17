import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { PASSWORD_REQUIREMENTS } from "@/lib/constants/auth-password";
import {
  clearResetTokenTwoFactorProof,
  isResetTokenTwoFactorVerified,
  resolveResetTokenUserId,
  userHasTwoFactorEnrolment,
} from "@/lib/services/password-reset-2fa.service";

/**
 * POST /api/auth/password-reset/confirm
 * Sets the new password. When the account has 2FA, verify-2fa must have run
 * for this token first.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      newPassword?: string;
    };
    const token = (body.token || "").trim();
    const newPassword = body.newPassword || "";

    if (!token || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Reset token and new password are required.",
        },
        { status: 400 },
      );
    }

    if (!PASSWORD_REQUIREMENTS.every((reqRule) => reqRule.test(newPassword))) {
      return NextResponse.json(
        {
          success: false,
          error: "Password does not meet security requirements.",
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
    if (enrolled) {
      const verified = await isResetTokenTwoFactorVerified(token);
      if (!verified) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Enter your authenticator code before setting a new password.",
            code: "TWO_FACTOR_REQUIRED",
          },
          { status: 403 },
        );
      }
    }

    try {
      await auth.api.resetPassword({
        body: { token, newPassword },
      });
    } catch (authError) {
      const msg =
        authError instanceof Error ? authError.message : String(authError);
      console.error("❌ [password-reset/confirm] auth.api.resetPassword:", msg);
      if (
        msg.toLowerCase().includes("token") ||
        msg.toLowerCase().includes("invalid")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "This reset link is invalid or has expired.",
            code: "INVALID_TOKEN",
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "Could not reset password. Please try again.",
        },
        { status: 400 },
      );
    }

    await clearResetTokenTwoFactorProof(token).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: "Password updated. You can sign in with your new password.",
    });
  } catch (error) {
    console.error("❌ [password-reset/confirm]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
