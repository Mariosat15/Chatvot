import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

/**
 * GET /api/user/2fa/status
 * Returns whether the current user has two-factor authentication enabled.
 * Used by the profile security page to render the correct state
 * (enable button vs. disable / manage button).
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database unavailable" },
        { status: 503 },
      );
    }

    // Reason: better-auth stores the twoFactorEnabled flag on the user
    // document. Read it directly via the raw collection to avoid pulling
    // sensitive fields through a Mongoose model that does not include it.
    const user = await db.collection("user").findOne(
      { _id: session.user.id as unknown as object },
      { projection: { twoFactorEnabled: 1 } },
    );

    // Some adapters store _id as string; handle both lookup shapes.
    const userDoc =
      user ||
      (await db
        .collection("user")
        .findOne(
          { id: session.user.id },
          { projection: { twoFactorEnabled: 1 } },
        ));

    return NextResponse.json({
      enabled: Boolean(userDoc?.twoFactorEnabled),
    });
  } catch (error) {
    console.error("❌ [2FA] status error:", error);
    return NextResponse.json(
      { error: "Failed to read two-factor status" },
      { status: 500 },
    );
  }
}
