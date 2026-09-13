import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getAdminSession } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";

/**
 * Admin Two-Factor Authentication recovery endpoint.
 *
 * Purpose: lets an admin inspect and *reset* a user's 2FA enrolment when the
 * user has lost access to their authenticator app / backup codes and can no
 * longer pass the login challenge. Resetting un-enrols the user (deletes the
 * better-auth `twoFactor` record and clears `user.twoFactorEnabled`) so they
 * can sign in with email + password again and re-enrol a fresh authenticator.
 *
 * Reason: the self-service /api/user/2fa/disable route needs the user's
 * password AND an active session, which a locked-out user does not have. This
 * admin path is the only safe recovery channel for that scenario.
 */

/**
 * Resolve the better-auth `twoFactor` filter for a given user id. The mongodb
 * adapter serializes the `twoFactor.userId` reference into an ObjectId at write
 * time, while session/user ids surface as hex strings — so we match either.
 */
function buildTwoFactorFilter(userId: string): Record<string, unknown> {
  let oid: ObjectId | null = null;
  try {
    oid = new ObjectId(userId);
  } catch {
    oid = null;
  }
  return oid ? { userId: { $in: [oid, userId] } } : { userId };
}

/** Build a `$or` query that matches the user by string id or ObjectId _id. */
function buildUserFilter(userId: string): Record<string, unknown> {
  const or: Record<string, unknown>[] = [{ id: userId }];
  if (ObjectId.isValid(userId) && String(new ObjectId(userId)) === userId) {
    or.push({ _id: new ObjectId(userId) });
  }
  return { $or: or };
}

/**
 * GET /api/users/[userId]/2fa
 * Returns whether the user currently has a 2FA enrolment.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database unavailable" },
        { status: 503 },
      );
    }

    const enrolment = await db
      .collection("twoFactor")
      .findOne(buildTwoFactorFilter(userId), { projection: { _id: 1 } });

    const user = await db
      .collection("user")
      .findOne(buildUserFilter(userId), { projection: { twoFactorEnabled: 1 } });

    return NextResponse.json({
      success: true,
      // Source of truth for "can be reset" is the enrolment record; the flag
      // is reported separately so the UI can surface a stale-state mismatch.
      enabled: Boolean(enrolment) || user?.twoFactorEnabled === true,
      enrolled: Boolean(enrolment),
    });
  } catch (error) {
    console.error("Error reading user 2FA status:", error);
    return NextResponse.json(
      { error: "Failed to read 2FA status" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/users/[userId]/2fa
 * Resets (removes) the user's 2FA enrolment so they can sign in with
 * email + password and re-enrol a new authenticator.
 *
 * Body (optional): { reason?: string }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason: string =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "Admin 2FA reset (account recovery)";

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database unavailable" },
        { status: 503 },
      );
    }

    const user = await db
      .collection("user")
      .findOne(buildUserFilter(userId), {
        projection: { email: 1, name: 1 },
      });
    const userEmail = (user?.email as string) || "";

    // Remove the better-auth enrolment record (TOTP secret + backup codes)…
    const deleteResult = await db
      .collection("twoFactor")
      .deleteMany(buildTwoFactorFilter(userId));

    // …and clear the boolean the login challenge gates on.
    await db
      .collection("user")
      .updateMany(buildUserFilter(userId), {
        $set: { twoFactorEnabled: false },
      });

    // Audit trail — security-sensitive action.
    try {
      const AuditLog = (await import("@/database/models/audit-log.model"))
        .default;
      await AuditLog.logAction({
        userId: session.id,
        userName: session.name || "Admin",
        userEmail: session.email || "admin@system",
        userRole: "admin",
        action: "user_2fa_reset",
        actionCategory: "security",
        description: `Reset two-factor authentication for user ${userEmail || userId}`,
        targetType: "user",
        targetId: userId,
        metadata: { reason, recordsRemoved: deleteResult.deletedCount, userEmail },
        status: "success",
      });
    } catch (auditError) {
      console.error("Failed to log 2FA reset to audit log:", auditError);
    }

    console.log(
      `🔐 [Admin] 2FA reset for user ${userId} (${userEmail}) by ${session.email}`,
    );

    return NextResponse.json({
      success: true,
      message:
        "Two-factor authentication has been reset. The user can now sign in with their password and set up a new authenticator.",
      recordsRemoved: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Error resetting user 2FA:", error);
    return NextResponse.json(
      { error: "Failed to reset two-factor authentication" },
      { status: 500 },
    );
  }
}
