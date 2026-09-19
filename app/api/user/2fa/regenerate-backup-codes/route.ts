import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth, twoFactorApi } from "@/lib/better-auth/auth";

/**
 * POST /api/user/2fa/regenerate-backup-codes
 * Generates a fresh set of one-time backup codes for the current user.
 * The previous set is invalidated. Requires the user's password because
 * the regenerate operation is effectively an account-recovery reset.
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

    const result = await twoFactorApi().generateBackupCodes({
      body: { password },
      headers: await headers(),
    });

    return NextResponse.json({
      success: true,
      backupCodes: result?.backupCodes || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn("⚠️ [2FA] regenerate-backup-codes error:", message);

    if (/invalid|incorrect|wrong/i.test(message)) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not regenerate backup codes. Please try again." },
      { status: 500 },
    );
  }
}
