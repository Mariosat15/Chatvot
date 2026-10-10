import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { guardSection } from "@/lib/admin/section-route-guard";
import { verifyAdminPassword } from "@/lib/admin/verify-admin-password";
import { connectToDatabase } from "@/database/mongoose";

/**
 * POST /api/users/[userId]/password
 * An admin sets a new sign-in password for a player.
 *
 * Body: { newPassword: string, adminPassword: string, revokeSessions?: boolean }
 *
 * Reason: the self-service reset needs the player to receive an email, which does not help a
 * player whose address is wrong or whose inbox is lost. The hash MUST match what the player
 * app verifies - `lib/better-auth/auth.ts` overrides Better Auth's hasher with bcrypt at 12
 * rounds - or the reset reports success and the new password never works.
 */

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const BCRYPT_ROUNDS = 12;

/** The ways a user id can be stored as a reference (ObjectId from the adapter, or string). */
function userIdCandidates(user: { _id: unknown; id?: unknown }): unknown[] {
  const candidates: unknown[] = [user._id, String(user._id)];
  if (typeof user.id === "string" && user.id) candidates.push(user.id);
  return candidates;
}

function buildUserFilter(userId: string): Record<string, unknown> {
  const or: Record<string, unknown>[] = [{ id: userId }];
  if (ObjectId.isValid(userId) && String(new ObjectId(userId)) === userId) {
    or.push({ _id: new ObjectId(userId) });
  }
  return { $or: or };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;
    const admin = guard.admin;

    const { userId } = await params;
    const body = await req.json().catch(() => ({}));
    const newPassword: unknown = body?.newPassword;
    // Reason: signing the player out everywhere is the safe default - an admin reset usually
    // follows a lost or compromised account, and a stolen session must not survive it.
    const revokeSessions = body?.revokeSessions !== false;

    if (
      typeof newPassword !== "string" ||
      newPassword.length < MIN_PASSWORD_LENGTH ||
      newPassword.length > MAX_PASSWORD_LENGTH
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `The new password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }

    const check = await verifyAdminPassword(admin.id, body?.adminPassword);
    if (!check.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            check.status === 401 ? "Your admin password is incorrect." : check.message,
        },
        { status: check.status },
      );
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database unavailable" },
        { status: 503 },
      );
    }

    const user = await db
      .collection("user")
      .findOne(buildUserFilter(userId), { projection: { _id: 1, id: 1, email: 1 } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const candidates = userIdCandidates(user);
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const now = new Date();

    const updated = await db.collection("account").updateMany(
      { providerId: "credential", userId: { $in: candidates } },
      { $set: { password: hash, updatedAt: now } },
    );

    // Reason: an account created only through a social login has no credential row, and a
    // password set nowhere would be reported as success while sign-in still refuses it.
    let createdCredential = false;
    if (updated.matchedCount === 0) {
      await db.collection("account").insertOne({
        userId: user._id,
        accountId: String(user._id),
        providerId: "credential",
        password: hash,
        createdAt: now,
        updatedAt: now,
      });
      createdCredential = true;
    }

    let sessionsRevoked = 0;
    if (revokeSessions) {
      const removed = await db
        .collection("session")
        .deleteMany({ userId: { $in: candidates } });
      sessionsRevoked = removed.deletedCount;
    }

    const userEmail = typeof user.email === "string" ? user.email : "";
    try {
      const AuditLog = (await import("@/database/models/audit-log.model")).default;
      await AuditLog.logAction({
        userId: admin.id,
        userName: admin.name || "Admin",
        userEmail: admin.email || "admin@system",
        userRole: "admin",
        action: "user_password_reset",
        actionCategory: "security",
        description: `Set a new password for user ${userEmail || userId}`,
        targetType: "user",
        targetId: userId,
        // Reason: the password itself is never logged, not even hashed.
        metadata: { userEmail, sessionsRevoked, createdCredential },
        status: "success",
      });
    } catch (auditError) {
      console.error("❌ Failed to log password reset to audit log:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: revokeSessions
        ? "Password updated. The user has been signed out everywhere."
        : "Password updated.",
      sessionsRevoked,
    });
  } catch (error) {
    console.error("❌ Error resetting user password:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}
