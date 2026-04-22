import { NextResponse } from "next/server";
import { headers } from "next/headers";
import mongoose from "mongoose";

import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";

/**
 * GET /api/user/2fa/status
 * Returns whether the current user has two-factor authentication enabled.
 * Used by the profile security page to render the correct state
 * (enable button vs. disable / manage button).
 *
 * Implementation note: enrolment is read from the better-auth `twoFactor`
 * collection — the presence of a row for the user's id is the canonical
 * "enrolled" signal. This stays consistent even when the login-2FA
 * admin toggle transiently clears `user.twoFactorEnabled` during the
 * sign-in bypass (which never touches the TOTP secret / backup codes).
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const col = mongoose.connection.collection("twoFactor");
    const record = await col.findOne(
      { userId } as unknown as Parameters<typeof col.findOne>[0],
      { projection: { _id: 1 } },
    );

    return NextResponse.json({ enabled: Boolean(record) });
  } catch (error) {
    console.error("❌ [2FA] status error:", error);
    return NextResponse.json(
      { error: "Failed to read two-factor status" },
      { status: 500 },
    );
  }
}
