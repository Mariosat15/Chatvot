import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";

/**
 * POST /api/user/2fa/verify-backup-code
 * Fallback sign-in path for users who have lost access to their
 * authenticator app. Consumes one of the user's one-time backup codes
 * and, if valid, completes the session.
 *
 * Body: { code: string; disableSession?: boolean; trustDevice?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code: unknown = body?.code;
    const trustDevice: unknown = body?.trustDevice;

    if (typeof code !== "string" || code.trim().length < 4) {
      return NextResponse.json(
        { error: "Enter one of your backup codes." },
        { status: 400 },
      );
    }

    await auth.api.verifyBackupCode({
      body: {
        code: code.trim(),
        trustDevice: Boolean(trustDevice),
      },
      headers: await headers(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.warn("⚠️ [2FA] verify-backup-code error:", message);

    if (/invalid|incorrect|expired|used/i.test(message)) {
      return NextResponse.json(
        { error: "Invalid or already-used backup code." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Could not verify the backup code. Please try again." },
      { status: 500 },
    );
  }
}
