import { NextResponse } from "next/server";
import { getAdminSession, requireAdminAuth } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";
import { wipeUserData } from "@/lib/services/user-data-reset.service";

/**
 * ⚠️ DANGER: Reset ALL activity data — keep every account and every setting.
 *
 * Deletes ALL activity (both user actions AND admin actions): trades, positions,
 * orders, wallet transactions, withdrawals, invoices/VAT, platform earnings,
 * fraud/risk data, notifications, KYC sessions, sessions, audit logs, admin
 * operation logs, messaging, game-master/referral data, bot runs, and visitor
 * analytics. User wallets are kept but zeroed (balances, counters, KYC status).
 *
 * ✅ PRESERVES so the admin panel works exactly as before (no re-setup needed):
 *   - User accounts + login credentials (kept; only their activity is wiped)
 *   - Employee/admin accounts, role templates
 *   - ALL settings (app / fee / KYC / challenge / white-label / assignment / …)
 *   - Payment provider keys, marketplace items, vendors
 *   - Notification templates, journey milestones/maps, badge & XP configs
 *   - Landing pages (counters zeroed) + blocked-visitor rules
 *
 * The exact activity/preserve lists live in one place:
 *   apps/admin/lib/services/user-data-reset.service.ts
 *
 * POST /api/reset-all-data
 */
export async function POST(request: Request) {
  try {
    await requireAdminAuth();

    const { confirmationCode } = await request.json();

    // Require confirmation code to prevent accidental deletion
    if (confirmationCode !== "RESET_ALL_DATA") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid confirmation code. Must be exactly: RESET_ALL_DATA",
        },
        { status: 400 },
      );
    }

    console.log("🚨🚨🚨 STARTING FULL ACTIVITY RESET (accounts kept) 🚨🚨🚨");

    const result = await wipeUserData({ deleteAccounts: false });

    console.log("🎉 ACTIVITY RESET COMPLETE", result.deleted);

    // Log this action to audit log (recreated after the wipe as the first entry)
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logDatabaseReset(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split("@")[0],
            role: "admin",
          },
          result.deleted,
        );
      }
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message:
        "All activity data has been reset. Accounts and all settings are preserved.",
      deleted: result.deleted,
      walletsReset: result.walletsReset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ Error resetting data:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to reset data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
