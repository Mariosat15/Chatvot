import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, requireAdminAuth } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";
import { createBackup, getBackupState } from "@/lib/services/backup/backup.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/database/backups  — list snapshots + current restore/lock state.
 * POST /api/database/backups  — start a new full-database backup (background).
 */
export async function GET() {
  try {
    await requireAdminAuth();
    const state = await getBackupState();
    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [backups] list failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to load backups",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const admin = await getAdminSession();

    let label: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.label === "string") label = body.label;
    } catch {
      // no body is fine — a default label will be used
    }

    const { id } = await createBackup({
      label,
      createdBy: admin?.email,
    });

    if (admin) {
      await auditLogService.log({
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.email.split("@")[0],
          role: admin.role || "admin",
        },
        action: "database_backup_created",
        category: "data",
        description: `Started database backup ${id}`,
        targetId: id,
      });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [backups] create failed:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create backup",
      },
      { status: 500 },
    );
  }
}
