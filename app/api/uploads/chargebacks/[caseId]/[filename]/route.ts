import { NextRequest, NextResponse } from "next/server";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import path from "path";
import { getAdminSession } from "@/lib/admin/auth";

/**
 * GET /api/uploads/chargebacks/[caseId]/[filename]
 *
 * Admin-only: serves attachments belonging to a chargeback defense packet.
 * NOT public. We check the admin cookie before reading any bytes.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string; filename: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { caseId, filename } = await params;

    // Sanitize against traversal. Both values come from the URL path.
    const safeCaseId = path.basename(caseId);
    const safeFilename = path.basename(filename);
    if (safeCaseId !== caseId || safeFilename !== filename) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const candidates = [
      path.join(
        /*turbopackIgnore: true*/ process.cwd(),
        "public",
        "uploads",
        "chargebacks",
        safeCaseId,
        safeFilename,
      ),
      path.join(
        "/var/www/chartvolt",
        "public",
        "uploads",
        "chargebacks",
        safeCaseId,
        safeFilename,
      ),
    ];

    let filePath: string | null = null;
    for (const p of candidates) {
      try {
        await access(p, constants.R_OK);
        filePath = p;
        break;
      } catch {
        // try next
      }
    }

    if (!filePath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buf = await readFile(filePath);
    const ext = safeFilename.split(".").pop()?.toLowerCase() || "bin";
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      txt: "text/plain; charset=utf-8",
      csv: "text/csv; charset=utf-8",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    // eslint-disable-next-line security/detect-object-injection -- ext is a lowercased word from a path.basename(); not user HTML.
    const contentType = contentTypes[ext] || "application/octet-stream";

    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        // No cache: admin review, may be superseded by re-uploads.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("❌ [chargebacks] serve attachment failed:", err);
    return NextResponse.json(
      { error: "Failed to serve attachment" },
      { status: 500 },
    );
  }
}
