import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import AuditLog from "@/database/models/audit-log.model";

/**
 * POST /api/user/deactivate
 *
 * Allows a user to deactivate their own account.
 * The account is NOT deleted — data is preserved but login is blocked.
 */
export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection error" },
        { status: 500 },
      );
    }

    // Reason: Set isDeactivated and record the timestamp and reason.
    const result = await db.collection("user").updateOne(
      { _id: { $in: [userId, (() => { try { return new (require("mongodb").ObjectId)(userId); } catch { return userId; } })()] } },
      {
        $set: {
          isDeactivated: true,
          deactivatedAt: new Date(),
          deactivatedBy: "self",
          deactivationReason: "User requested account deactivation",
        },
      },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    console.log(`🔴 User ${userId} deactivated their own account`);

    // Reason: Log the deactivation in the audit trail for compliance and history tracking.
    try {
      await AuditLog.logAction({
        userId,
        userName: session.user.name || session.user.email || "User",
        userEmail: session.user.email || "unknown",
        userRole: "user",
        action: "account_deactivated",
        actionCategory: "account_management",
        description: `User self-deactivated their account.`,
        targetType: "user",
        targetId: userId,
        metadata: { deactivatedBy: "self" },
        status: "success",
      });
    } catch (auditError) {
      console.error("⚠️ Failed to log deactivation audit:", auditError);
    }

    // Reason: Trigger auto-resolution of fraud alerts involving this deactivated account.
    try {
      await autoResolveFraudAlertsForDeactivation(db, userId);
    } catch (fraudError) {
      console.error(
        "⚠️ Failed to auto-resolve fraud alerts after deactivation:",
        fraudError,
      );
      // Don't fail the deactivation if fraud resolution fails
    }

    return NextResponse.json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("❌ Error deactivating account:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

/**
 * Auto-resolve fraud alerts when an account is deactivated.
 *
 * Rules:
 * - If an alert involves ONLY the deactivated user + one other user → auto-resolve
 * - If an alert involves 3+ accounts (including the deactivated one) → keep active
 * - Only affects "pending" or "investigating" alerts
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
    // Collect all unique user IDs involved in this alert
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

    // Reason: Check how many non-deactivated accounts are involved.
    // We need to query the DB to see which other accounts are also deactivated.
    const otherIds = [...involvedIds].filter((id) => id !== deactivatedUserId);

    if (otherIds.length === 0) {
      // Only the deactivated user is involved — auto-resolve
      await resolveAlertDueToDeactivation(db, alert, deactivatedUserId);
      continue;
    }

    if (otherIds.length === 1) {
      // Exactly one other account — auto-resolve per business rules
      await resolveAlertDueToDeactivation(db, alert, deactivatedUserId);
      continue;
    }

    // 3+ accounts involved — keep alert active, but log that one was deactivated
    await db.collection("fraudalerts").updateOne(
      { _id: alert._id },
      {
        $push: {
          detectionHistory: {
            action: "account_deactivated",
            timestamp: new Date(),
            triggeredBy: "system",
            note: `Account ${deactivatedUserId} was deactivated. Alert remains active because ${involvedIds.size} accounts are involved.`,
          },
        },
      },
    );

    console.log(
      `📋 Alert ${alert._id}: Account ${deactivatedUserId} deactivated, but ${involvedIds.size} accounts involved — keeping active`,
    );
  }
}

async function resolveAlertDueToDeactivation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alert: any,
  deactivatedUserId: string,
) {
  const now = new Date();
  await db.collection("fraudalerts").updateOne(
    { _id: alert._id },
    {
      $set: {
        status: "resolved",
        resolvedAt: now,
        resolvedBy: "system",
        actionTaken: "account_deactivated",
        resolution: `Auto-resolved: Account ${deactivatedUserId} was deactivated by the user. Since this alert only involves this account and one other, the investigation is no longer needed.`,
        investigationClearedAt: now,
        clearanceNote: `Auto-resolved due to account deactivation of ${deactivatedUserId}`,
      },
      $push: {
        detectionHistory: {
          action: "auto_resolved_deactivation",
          timestamp: now,
          triggeredBy: "system",
          note: `Alert auto-resolved because account ${deactivatedUserId} was deactivated. Only 2 accounts were involved.`,
        },
      },
    },
  );

  console.log(
    `✅ Alert ${alert._id} auto-resolved due to deactivation of ${deactivatedUserId}`,
  );
}
