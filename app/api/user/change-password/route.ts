import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { evaluateTwoFactorGate } from "@/lib/services/two-factor-gate.service";
import { getFraudSettings } from "@/lib/services/fraud-settings.service";

/**
 * POST /api/user/change-password
 * Change the current user's password.
 *
 * Security:
 *   - Requires an authenticated session (better-auth).
 *   - If `FraudSettings.requireTwoFactorForPasswordChange` is enabled AND the
 *     user has 2FA enrolled, a valid TOTP / backup code must be supplied in
 *     the request body as `twoFactorCode`. This is a step-up check that
 *     protects against session-theft or device-left-unlocked scenarios.
 */
export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword, twoFactorCode } = body as {
      currentPassword?: string;
      newPassword?: string;
      twoFactorCode?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // ---- Two-factor step-up gate ------------------------------------------
    // Reason: Only enforce 2FA on password change when the admin has turned
    // the policy on. The gate itself is a no-op for users who don't have
    // 2FA enabled, so we still let them change their password with just the
    // current-password check below (consistent with the pre-2FA behaviour).
    try {
      const fraudSettings = await getFraudSettings();
      if (fraudSettings?.requireTwoFactorForPasswordChange) {
        const gate = await evaluateTwoFactorGate({
          userId: session.user.id,
          reqHeaders,
          code: twoFactorCode,
          policy: {
            required: true,
            blockIfNotEnabled: false,
          },
        });

        if (!gate.ok && gate.code !== "TWO_FACTOR_NOT_ENABLED") {
          return NextResponse.json(
            { error: gate.error, code: gate.code },
            { status: gate.status },
          );
        }
      }
    } catch (gateErr) {
      // Reason: Never block a password change if the settings service fails
      // to load — the old behaviour was no-2FA, so degrade gracefully.
      console.warn(
        "⚠️ [change-password] 2FA gate skipped due to settings error:",
        gateErr,
      );
    }

    try {
      await auth.api.changePassword({
        body: {
          currentPassword,
          newPassword,
        },
        headers: reqHeaders,
      });

      console.log("✅ Password changed for user:", session.user.email);

      return NextResponse.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (authError) {
      console.error("Password change error:", authError);

      const errorMessage = authError instanceof Error ? authError.message : "";
      if (
        errorMessage.includes("incorrect") ||
        errorMessage.includes("invalid")
      ) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error:
            "Failed to change password. Please check your current password.",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 },
    );
  }
}
