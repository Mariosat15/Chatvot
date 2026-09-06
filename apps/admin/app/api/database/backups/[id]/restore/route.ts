import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminSession, requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import { Admin } from "@/database/models/admin.model";
import { auditLogService } from "@/lib/services/audit-log.service";
import { restoreBackup } from "@/lib/services/backup/backup.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/database/backups/[id]/restore
 *
 * Restores the database to the selected snapshot. This is destructive, so it
 * requires: admin auth + the current admin password + the exact confirmation
 * code "RESTORE". A pre-restore safety snapshot is created automatically before
 * anything is overwritten.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminAuth();
    const { id } = await params;

    const { password, confirmationCode } = await request.json();

    if (confirmationCode !== "RESTORE") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid confirmation code. Must be exactly: RESTORE",
        },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, message: "Password is required" },
        { status: 400 },
      );
    }

    // Verify the current admin's password against the stored hash.
    await connectToDatabase();
    const adminDoc = await Admin.findById(auth.adminId).select("password");
    if (!adminDoc || !(await bcrypt.compare(password, adminDoc.password))) {
      return NextResponse.json(
        { success: false, message: "Invalid password" },
        { status: 401 },
      );
    }

    const admin = await getAdminSession();
    await restoreBackup(id, admin?.email);

    if (admin) {
      await auditLogService.log({
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.email.split("@")[0],
          role: admin.role || "admin",
        },
        action: "database_restore_started",
        category: "data",
        description: `Started database restore from backup ${id} (a safety snapshot is taken first)`,
        targetId: id,
        status: "pending",
      });
    }

    return NextResponse.json({
      success: true,
      started: true,
      message:
        "Restore started. A safety snapshot is being created first, then the database will be restored.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [backups] restore failed:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to start restore",
      },
      { status: 500 },
    );
  }
}
