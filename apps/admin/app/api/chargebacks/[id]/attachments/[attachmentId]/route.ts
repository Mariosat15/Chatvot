import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { getAdminSession } from "@/lib/admin/auth";
import Chargeback from "../../../../../../../../database/models/chargeback.model";
import AuditLog from "../../../../../../../../database/models/audit-log.model";
import { connectToDatabase } from "../../../../../../../../database/mongoose";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, attachmentId } = await params;
    await connectToDatabase();

    const c = await Chargeback.findById(id);
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const before = c.attachments.length;
    const removed = c.attachments.find(
      (a: { id?: string }) => a.id === attachmentId,
    );
    c.attachments = c.attachments.filter(
      (a: { id?: string }) => a.id !== attachmentId,
    );

    if (c.attachments.length === before) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    c.timeline.push({
      at: new Date(),
      actorId: session.id,
      actorName: session.name || session.email,
      action: "attachment_removed",
      notes: removed?.originalName || attachmentId,
    });
    await c.save();

    // Best-effort: remove the file from disk. Failure here is non-fatal
    // (the attachment is already de-registered from the case).
    if (removed?.filename) {
      const candidates = [
        path.join(
          /*turbopackIgnore: true*/ process.cwd(),
          "public",
          "uploads",
          "chargebacks",
          id,
          path.basename(removed.filename),
        ),
        path.join(
          "/var/www/chartvolt",
          "public",
          "uploads",
          "chargebacks",
          id,
          path.basename(removed.filename),
        ),
      ];
      for (const p of candidates) {
        try {
          await unlink(p);
          break;
        } catch {
          // try next
        }
      }
    }

    try {
      await AuditLog.logAction({
        userId: session.id,
        userName: session.name || session.email,
        userEmail: session.email,
        userRole: "admin",
        action: "chargeback_attachment_removed",
        actionCategory: "security",
        description: `Removed attachment from chargeback ${id}`,
        targetType: "user",
        targetId: c.userId,
        metadata: {
          chargebackId: id,
          attachmentId,
          originalName: removed?.originalName,
        },
        status: "success",
      });
    } catch (err) {
      console.error("⚠️ AuditLog.logAction failed:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ [chargebacks] delete attachment failed:", err);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 },
    );
  }
}
