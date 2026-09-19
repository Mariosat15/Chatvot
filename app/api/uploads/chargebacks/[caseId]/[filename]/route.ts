import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getAdminSession } from "@/lib/admin/auth";

/**
 * Reason: a Map has no prototype chain, so the lookup is total for any extension a
 * filename can produce. An object index walks the prototype, and "constructor" returns
 * something truthy that survives the `|| fallback` and reaches a Content-Type header.
 */
const CONTENT_TYPES = new Map<string, string>([
  ["pdf", "application/pdf"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["txt", "text/plain; charset=utf-8"],
  ["csv", "text/csv; charset=utf-8"],
  ["doc", "application/msword"],
  [
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ["xls", "application/vnd.ms-excel"],
  [
    "xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
]);

function contentTypeFor(ext: string): string {
  return CONTENT_TYPES.get(ext) || "application/octet-stream";
}

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

    // Reason: exactly one candidate, spelled as one `path.join` of literal segments, is
    // what keeps Turbopack's trace scoped to this directory instead of the whole
    // repository. Three spellings were measured against a real `next build`:
    //   - joining a base directory with the dynamic segments at the `fs` call site emits
    //     an "overly broad pattern" warning matching ~14,000 files;
    //   - adding `/*turbopackIgnore: true*/` hides that warning but the trace still
    //     widens, which then surfaces as "unexpected file in NFT list";
    //   - this form, a single resolvable prefix, emits neither.
    // The previous second candidate hardcoded `/var/www/chartvolt` and was removed rather
    // than kept: `ecosystem.config.js` starts `chartvolt-web` with `cwd: __dirname`, so
    // `process.cwd()` is already that directory in production and the fallback could only
    // ever resolve to the same path it did.
    const filePath = path.join(
      process.cwd(),
      "public",
      "uploads",
      "chargebacks",
      safeCaseId,
      safeFilename,
    );

    let buf: Buffer;
    try {
      // Reason: read directly rather than `access` then `readFile`. One syscall instead
      // of two, since a failed read answers the same question, and it keeps the path
      // expression at the `fs` call where the analyser can resolve it.
      buf = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = safeFilename.split(".").pop()?.toLowerCase() || "bin";

    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": contentTypeFor(ext),
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
