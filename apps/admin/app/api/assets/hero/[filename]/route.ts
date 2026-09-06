import { NextRequest, NextResponse } from "next/server";
import { readFile, access, writeFile, mkdir } from "fs/promises";
import path from "path";
import { constants } from "fs";
import { encodeBrandingFileKey } from "@/lib/utils/branding-file-key";

/**
 * GET /api/assets/hero/[filename]
 * Serve hero images from the uploads directory.
 * Falls back to database if file is missing from disk (auto-restores).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const sanitizedFilename = path.basename(filename.split("?")[0]);

    const possiblePaths = [
      path.join("/var/www/chartvolt", "public", "uploads", "hero", sanitizedFilename),
      path.join(process.cwd(), "..", "..", "public", "uploads", "hero", sanitizedFilename),
      path.join(process.cwd(), "public", "uploads", "hero", sanitizedFilename),
    ];

    let filePath: string | null = null;
    for (const p of possiblePaths) {
      try {
        await access(p, constants.R_OK);
        filePath = p;
        break;
      } catch {}
    }

    if (filePath) {
      const fileBuffer = await readFile(filePath);
      const ext = sanitizedFilename.split(".").pop()?.toLowerCase();
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": getContentType(ext),
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // File not on disk — try to restore from database backup
    try {
      const { connectToDatabase } = await import("@/database/mongoose");
      const { WhiteLabel } = await import("@/database/models/whitelabel.model");
      await connectToDatabase();

      const settings = await WhiteLabel.findOne();
      // Reason: stored with the dots encoded, because Mongoose rejects map keys containing
      // one. See branding-file-key.ts.
      const fileEntry = settings?.brandingFiles?.get(
        encodeBrandingFileKey(sanitizedFilename),
      );

      if (fileEntry?.data) {
        console.log(`🔄 [Hero Serve] Restoring from DB: ${sanitizedFilename}`);
        const buffer = Buffer.from(fileEntry.data, "base64");

        // Auto-restore to disk
        try {
          const restoreDir = path.dirname(possiblePaths[0]);
          await mkdir(restoreDir, { recursive: true });
          await writeFile(path.join(restoreDir, sanitizedFilename), buffer);
          console.log(`✅ [Hero Serve] Auto-restored to disk`);
        } catch {}

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": fileEntry.contentType || "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    } catch (dbErr) {
      console.warn(`⚠️ [Hero Serve] DB fallback failed:`, dbErr);
    }

    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  } catch (error) {
    console.error("❌ [Hero Serve] Error:", error);
    return NextResponse.json({ error: "Failed to serve image" }, { status: 500 });
  }
}

function getContentType(ext: string | undefined): string {
  const types: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm",
  };
  return types[ext || "png"] || "image/png";
}
