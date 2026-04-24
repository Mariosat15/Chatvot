import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getAdminSession } from "@/lib/admin/auth";
import Chargeback from "../../../../../../../database/models/chargeback.model";
import AuditLog from "../../../../../../../database/models/audit-log.model";
import { connectToDatabase } from "../../../../../../../database/mongoose";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeFilenameBase(original: string): string {
  const base = path.basename(original);
  // Reason: strip anything that could be used in a path-traversal or HTML
  // context. We preserve alphanumerics, dash, underscore, dot.
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "file";
}

async function resolveUploadDir(caseId: string): Promise<string> {
  const candidates = [
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "public",
      "uploads",
      "chargebacks",
      caseId,
    ),
    path.join(
      "/var/www/chartvolt",
      "public",
      "uploads",
      "chargebacks",
      caseId,
    ),
  ];
  for (const d of candidates) {
    try {
      await mkdir(d, { recursive: true });
      return d;
    } catch (err) {
      console.warn("Could not create upload dir:", d, err);
    }
  }
  // Last resort: first candidate (re-throw on write).
  return candidates[0];
}

/** POST — multipart upload. Field name: "file". Multiple files supported. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await connectToDatabase();
    const c = await Chargeback.findById(id);
    if (!c) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if ((key === "file" || key === "files") && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided (expected field name 'file')" },
        { status: 400 },
      );
    }

    const uploadsDir = await resolveUploadDir(id);
    const saved: Array<Record<string, unknown>> = [];

    for (const file of files) {
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json(
          { error: `File type not allowed: ${file.type}` },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${file.name}` },
          { status: 400 },
        );
      }

      const originalName = safeFilenameBase(file.name);
      const ext = originalName.includes(".")
        ? originalName.split(".").pop() || "bin"
        : "bin";
      const uniqueName = `${Date.now()}-${randomUUID()}.${ext}`;
      const filePath = path.join(uploadsDir, uniqueName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      const attachmentId = randomUUID();
      const attachment = {
        id: attachmentId,
        filename: uniqueName,
        originalName,
        mimeType: file.type,
        size: file.size,
        fileUrl: `/api/uploads/chargebacks/${id}/${uniqueName}`,
        uploadedAt: new Date(),
        uploadedBy: session.id,
        uploadedByName: session.name || session.email,
      };

      c.attachments.push(attachment);
      c.timeline.push({
        at: new Date(),
        actorId: session.id,
        actorName: session.name || session.email,
        action: "attachment_added",
        notes: originalName,
      });
      saved.push(attachment);
    }

    await c.save();

    try {
      await AuditLog.logAction({
        userId: session.id,
        userName: session.name || session.email,
        userEmail: session.email,
        userRole: "admin",
        action: "chargeback_attachment_added",
        actionCategory: "security",
        description: `Added ${saved.length} attachment${saved.length === 1 ? "" : "s"} to chargeback ${id}`,
        targetType: "user",
        targetId: c.userId,
        metadata: { chargebackId: id, count: saved.length },
        status: "success",
      });
    } catch (err) {
      console.error("⚠️ AuditLog.logAction failed:", err);
    }

    return NextResponse.json({ attachments: saved });
  } catch (err) {
    console.error("❌ [chargebacks] attachment upload failed:", err);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 },
    );
  }
}

/** GET — list attachments on a case. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await connectToDatabase();
    const c = await Chargeback.findById(id).lean<{
      attachments?: unknown[];
    } | null>();
    if (!c) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ attachments: c.attachments || [] });
  } catch (err) {
    console.error("❌ [chargebacks] list attachments failed:", err);
    return NextResponse.json(
      { error: "Failed to list attachments" },
      { status: 500 },
    );
  }
}
