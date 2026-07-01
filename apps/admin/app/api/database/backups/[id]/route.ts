import { NextResponse } from "next/server";
import { getAdminSession, requireAdminAuth } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";
import { deleteBackup } from "@/lib/services/backup/backup.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/database/backups/[id] — remove a snapshot folder from the server.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAuth();
    const { id } = await params;

    await deleteBackup(id);

    const admin = await getAdminSession();
    if (admin) {
      await auditLogService.log({
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.email.split("@")[0],
          role: admin.role || "admin",
        },
        action: "database_backup_deleted",
        category: "data",
        description: `Deleted database backup ${id}`,
        targetId: id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [backups] delete failed:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete backup",
      },
      { status: 500 },
    );
  }
}
