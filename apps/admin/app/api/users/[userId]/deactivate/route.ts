import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { getAdminSession } from "@/lib/admin/auth";
import AuditLog from "@/database/models/audit-log.model";
import UserNote from "@/database/models/user-notes.model";

/**
 * POST /api/users/[userId]/deactivate
 *
 * Admin deactivates a user account. Account data is preserved but login is blocked.
 * Logs the action in audit trail and user notes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json();
    const reason = body.reason || "Admin decision";

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 },
      );
    }

    // Reason: Update the user document with deactivation fields.
    const { ObjectId } = await import("mongodb");
    let userQuery;
    try {
      userQuery = { _id: new ObjectId(userId) };
    } catch {
      userQuery = { _id: userId };
    }

    const user = await db.collection("user").findOne(userQuery);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isDeactivated) {
      return NextResponse.json(
        { error: "Account is already deactivated" },
        { status: 400 },
      );
    }

    await db.collection("user").updateOne(userQuery, {
      $set: {
        isDeactivated: true,
        deactivatedAt: new Date(),
        deactivatedBy: session.id || session.email || "admin",
        deactivationReason: reason,
      },
    });

    // Add admin note
    await UserNote.create({
      userId,
      adminId: session.id,
      adminName: session.name || session.email || "Admin",
      content: `Account deactivated by admin. Reason: ${reason}`,
      category: "ban",
      priority: "high",
    });

    // Create audit log
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || "Admin",
      userEmail: session.email || "admin@system",
      userRole: "admin",
      action: "user_deactivated",
      actionCategory: "user_management",
      description: `Deactivated account for user ${userId} (${user.email || "unknown"}). Reason: ${reason}`,
      targetType: "user",
      targetId: userId,
      metadata: { reason, userEmail: user.email, userName: user.name },
      status: "success",
    });

    console.log(
      `🔴 Admin ${session.email} deactivated account ${userId} (${user.email})`,
    );

    // Reason: Auto-resolve fraud alerts involving this deactivated account.
    try {
      await autoResolveFraudAlertsForDeactivation(db, userId);
    } catch (fraudError) {
      console.error(
        "⚠️ Failed to auto-resolve fraud alerts after admin deactivation:",
        fraudError,
      );
    }

    // Reason: Invalidate all sessions for this user so they are immediately
    // logged out everywhere. better-auth stores sessions in "session" collection.
    try {
      const deleteResult = await db
        .collection("session")
        .deleteMany({ userId });
      console.log(
        `🔒 Deleted ${deleteResult.deletedCount} sessions for admin-deactivated user ${userId}`,
      );
    } catch (sessionError) {
      console.error(
        "⚠️ Failed to delete sessions after admin deactivation:",
        sessionError,
      );
    }

    return NextResponse.json({
      success: true,
      message: `Account deactivated successfully`,
    });
  } catch (error) {
    console.error("❌ Error deactivating user:", error);
    return NextResponse.json(
      { error: "Failed to deactivate account" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/users/[userId]/deactivate
 *
 * Admin reactivates a deactivated account.
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
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 },
      );
    }

    const { ObjectId } = await import("mongodb");
    let userQuery;
    try {
      userQuery = { _id: new ObjectId(userId) };
    } catch {
      userQuery = { _id: userId };
    }

    const user = await db.collection("user").findOne(userQuery);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.isDeactivated) {
      return NextResponse.json(
        { error: "Account is not deactivated" },
        { status: 400 },
      );
    }

    await db.collection("user").updateOne(userQuery, {
      $set: {
        isDeactivated: false,
        reactivatedAt: new Date(),
        reactivatedBy: session.id || session.email || "admin",
      },
      $unset: {
        deactivatedAt: "",
        deactivatedBy: "",
        deactivationReason: "",
      },
    });

    // Add admin note
    await UserNote.create({
      userId,
      adminId: session.id,
      adminName: session.name || session.email || "Admin",
      content: `Account reactivated by admin.`,
      category: "general",
      priority: "medium",
    });

    // Create audit log
    await AuditLog.logAction({
      userId: session.id,
      userName: session.name || "Admin",
      userEmail: session.email || "admin@system",
      userRole: "admin",
      action: "user_reactivated",
      actionCategory: "user_management",
      description: `Reactivated account for user ${userId} (${user.email || "unknown"})`,
      targetType: "user",
      targetId: userId,
      metadata: { userEmail: user.email, userName: user.name },
      status: "success",
    });

    console.log(
      `🟢 Admin ${session.email} reactivated account ${userId} (${user.email})`,
    );

    return NextResponse.json({
      success: true,
      message: `Account reactivated successfully`,
    });
  } catch (error) {
    console.error("❌ Error reactivating user:", error);
    return NextResponse.json(
      { error: "Failed to reactivate account" },
      { status: 500 },
    );
  }
}

/**
 * Auto-resolve fraud alerts when an account is deactivated.
 * Same logic as the user-facing endpoint.
 */
async function autoResolveFraudAlertsForDeactivation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  deactivatedUserId: string,
) {
  const openAlerts = await db
    .collection("fraudalerts")
    .find({
      $or: [
        { primaryUserId: deactivatedUserId },
        { suspiciousUserIds: deactivatedUserId },
        { "evidence.data.connectedAccountIds": deactivatedUserId },
      ],
      status: { $in: ["pending", "investigating"] },
    })
    .toArray();

  for (const alert of openAlerts) {
    const involvedIds = new Set<string>();
    if (alert.primaryUserId) involvedIds.add(alert.primaryUserId);
    if (Array.isArray(alert.suspiciousUserIds)) {
      for (const id of alert.suspiciousUserIds) involvedIds.add(id);
    }
    if (Array.isArray(alert.evidence)) {
      for (const ev of alert.evidence) {
        if (Array.isArray(ev.data?.connectedAccountIds)) {
          for (const id of ev.data.connectedAccountIds) involvedIds.add(id);
        }
      }
    }

    const otherIds = [...involvedIds].filter((id) => id !== deactivatedUserId);

    if (otherIds.length <= 1) {
      // 0 or 1 other account — auto-resolve
      const now = new Date();
      await db.collection("fraudalerts").updateOne(
        { _id: alert._id },
        {
          $set: {
            status: "resolved",
            resolvedAt: now,
            resolvedBy: "system",
            actionTaken: "account_deactivated",
            resolution: `Auto-resolved: Account ${deactivatedUserId} was deactivated by admin. Since this alert involves only ${involvedIds.size} accounts, the investigation is no longer needed.`,
            investigationClearedAt: now,
            clearanceNote: `Auto-resolved due to admin deactivation of ${deactivatedUserId}`,
          },
          $push: {
            detectionHistory: {
              action: "auto_resolved_deactivation",
              timestamp: now,
              triggeredBy: "system",
              note: `Alert auto-resolved: account ${deactivatedUserId} deactivated. Only ${involvedIds.size} accounts involved.`,
            },
          },
        },
      );
      console.log(
        `✅ Alert ${alert._id} auto-resolved due to admin deactivation of ${deactivatedUserId}`,
      );
    } else {
      // 3+ accounts — keep active, log the deactivation
      await db.collection("fraudalerts").updateOne(
        { _id: alert._id },
        {
          $push: {
            detectionHistory: {
              action: "account_deactivated",
              timestamp: new Date(),
              triggeredBy: "system",
              note: `Account ${deactivatedUserId} deactivated by admin. Alert remains active (${involvedIds.size} accounts involved).`,
            },
          },
        },
      );
      console.log(
        `📋 Alert ${alert._id}: kept active — ${involvedIds.size} accounts involved`,
      );
    }
  }
}
