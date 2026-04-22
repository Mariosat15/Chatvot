import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";

/**
 * GET /api/user/2fa/status
 * Returns whether the current user has two-factor authentication enabled.
 * Used by the profile security page to render the correct state
 * (enable button vs. disable / manage button).
 *
 * Implementation note: we resolve `twoFactorEnabled` through better-auth's
 * session resolver (not a raw collection read).
 *
 * Reason: better-auth's mongodb adapter stores `user._id` as an `ObjectId`,
 * while session tokens expose the id as a hex *string*. A direct
 * `findOne({ _id: stringId })` never matches and always returned false,
 * which made the gate (and this endpoint) incorrectly report "2FA disabled"
 * for users who had it correctly enabled.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as unknown as { twoFactorEnabled?: boolean };
    return NextResponse.json({
      enabled: Boolean(user.twoFactorEnabled),
    });
  } catch (error) {
    console.error("❌ [2FA] status error:", error);
    return NextResponse.json(
      { error: "Failed to read two-factor status" },
      { status: 500 },
    );
  }
}
