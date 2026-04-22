import { NextResponse } from "next/server";
import { headers } from "next/headers";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";

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
 *
 * Reason: the better-auth mongodb adapter serializes `twoFactor.userId`
 * into an `ObjectId` at write time (any field that references `user.id`
 * is converted). Session tokens expose the id as a hex string, so we
 * query against both shapes to cover rows written by either the adapter
 * or a direct import path.
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

    let oid: ObjectId | null = null;
    try {
      oid = new ObjectId(userId);
    } catch {
      oid = null;
    }

    const filter: Record<string, unknown> = oid
      ? { userId: { $in: [oid, userId] } }
      : { userId };

    const record = await col.findOne(
      filter as unknown as Parameters<typeof col.findOne>[0],
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
