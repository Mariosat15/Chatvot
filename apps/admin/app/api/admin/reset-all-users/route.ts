import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { wipeUserData } from "@/lib/services/user-data-reset.service";

/**
 * POST /api/admin/reset-all-users
 * DANGER: Deletes ALL user accounts and ALL activity (user + admin actions).
 *
 * Same activity wipe as "Reset All Data" but ALSO removes the user accounts and
 * their wallets. Every configuration/identity item is preserved (employee/admin
 * accounts, role templates, all settings, marketplace items, vendors, notification
 * templates, journey/badge/XP configs, landing pages). The exact activity/preserve
 * lists live in apps/admin/lib/services/user-data-reset.service.ts.
 *
 * Requires explicit confirmation to prevent accidental data loss.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();

    const body = await request.json();
    const { confirmation } = body;

    // Require explicit confirmation
    if (confirmation !== "DELETE_ALL_USERS") {
      return NextResponse.json(
        {
          error:
            'Invalid confirmation. You must type "DELETE_ALL_USERS" exactly.',
        },
        { status: 400 },
      );
    }

    console.log("🚨 [ADMIN] Starting FULL USER RESET (accounts + activity)...");

    const result = await wipeUserData({ deleteAccounts: true });

    const totalDeleted =
      Object.values(result.deleted).reduce((sum, count) => sum + count, 0);

    console.log(
      `🚨 [ADMIN] USER RESET COMPLETE - ${totalDeleted} documents deleted (${result.accountsDeleted} accounts)`,
    );

    // Log this action for audit purposes (recreated after the wipe)
    try {
      const AuditLog = (await import("@/database/models/audit-log.model"))
        .default;
      await AuditLog.create({
        action: "reset_all_users",
        actionCategory: "system",
        description: `Full user reset - deleted ${totalDeleted} documents (${result.accountsDeleted} accounts). Settings preserved.`,
        metadata: result.deleted,
        status: "success",
        userId: "system-action",
        userName: "System",
        userEmail: "system@internal",
        userRole: "superadmin",
        timestamp: new Date(),
      });
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${totalDeleted} documents (${result.accountsDeleted} user accounts). All settings preserved.`,
      details: result.deleted,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error resetting user data:", error);
    return NextResponse.json(
      { error: "Failed to reset user data" },
      { status: 500 },
    );
  }
}
