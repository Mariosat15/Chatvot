import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

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

    // Reason for the shape - one literal-segment `path.join` inline at the `fs` call.
    // Measured against a real `next build`: a path Turbopack cannot fold, such as a loop
    // variable over an array of candidates, makes the traced pattern a bare `<dynamic>`
    // matching every file in the repository, and `/*turbopackIgnore: true*/` on
    // `process.cwd()` hides the resulting warning without narrowing anything, so the
    // widened trace resurfaces as "unexpected file in NFT list" naming `next.config.ts`.
    // Reading directly rather than `access` then `readFile` is one syscall instead of
    // two, since a failed read answers the same question.
    //
    // The hardcoded `/var/www/chartvolt` candidate that used to come first was removed
    // rather than kept: `ecosystem.config.js` starts `chartvolt-web` with
    // `cwd: __dirname`, so in production `process.cwd()` is already that directory.
    const heroDir = path.join(process.cwd(), "public", "uploads", "hero");

    try {
      const fileBuffer = await readFile(path.join(heroDir, sanitizedFilename));
      const ext = sanitizedFilename.split(".").pop()?.toLowerCase();
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": getContentType(ext),
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      // Not on disk - fall through to the database restore below.
    }

    // File not on disk — try to restore from database backup.
    //
    // Reason: one service owns where those bytes live, because the store changed on
    // 8 September 2026 - a per-file collection, with the old shared-document map read as a
    // fallback for anything uploaded before then. A reader that knew either location
    // directly would silently stop finding half the images.
    try {
      const { readBrandingAsset } = await import(
        "@/lib/services/branding-assets.service"
      );
      const fileEntry = await readBrandingAsset(sanitizedFilename);

      if (fileEntry) {
        console.log(`🔄 [Hero Serve] Restoring from DB: ${sanitizedFilename}`);
        const buffer = fileEntry.data;

        // Auto-restore to disk.
        // Reason: restores into the directory this route actually reads. It used to take
        // `dirname(possiblePaths[0])`, which was the hardcoded `/var/www/chartvolt` path,
        // so in development the recovered image was written somewhere never read back and
        // every later request went to the database again.
        try {
          await mkdir(heroDir, { recursive: true });
          await writeFile(path.join(heroDir, sanitizedFilename), buffer);
        } catch {
          // Serving from memory still works; the next request will restore again.
        }

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": fileEntry.contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    } catch {}

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
