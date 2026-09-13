import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

// Reason: Track which missing filenames have already been warned about to avoid
// spamming server logs on every request for the same missing image.
const warnedMissing = new Set<string>();

/**
 * GET /api/assets/images/[filename]
 * Serve branding images from the assets directory
 * Falls back to database if file is missing from disk (auto-restores)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;

    // Sanitize filename to prevent directory traversal
    // Also strip query params
    const sanitizedFilename = path.basename(filename.split("?")[0]);

    // Look in this app's public folder, then the admin app's (monorepo: web app at the
    // root, admin at apps/admin).
    //
    // Reason for the shape - each `readFile` spells out its own directory rather than
    // looping over an array of candidates, which reads as needless repetition and is not.
    // Measured against a real `next build`: a path Turbopack cannot fold, such as a loop
    // variable over an array or an array index, makes the traced pattern a bare
    // `<dynamic>` matching every file in the repository, and `/*turbopackIgnore: true*/`
    // on `process.cwd()` hides the resulting warning without narrowing anything, so the
    // widened trace resurfaces as "unexpected file in NFT list" naming `next.config.ts`.
    // One literal-segment `path.join` per `fs` call emits neither warning.
    // Reading directly rather than `access` then `readFile` is also one syscall instead
    // of two, since a failed read answers the same question.
    //
    // The two hardcoded `/var/www/chartvolt` candidates that used to come first were
    // removed rather than kept: `ecosystem.config.js` starts `chartvolt-web` with
    // `cwd: __dirname`, so in production `process.cwd()` is already that directory and
    // they could only ever resolve to the same two paths.
    let fileBuffer: Buffer | null = null;

    try {
      fileBuffer = await readFile(
        path.join(
          process.cwd(),
          "public",
          "assets",
          "images",
          sanitizedFilename,
        ),
      );
    } catch {
      // Not in this app's public folder - try the admin app's.
    }

    if (!fileBuffer) {
      try {
        fileBuffer = await readFile(
          path.join(
            process.cwd(),
            "apps",
            "admin",
            "public",
            "assets",
            "images",
            sanitizedFilename,
          ),
        );
      } catch {
        // Not on disk at all - fall through to the database restore below.
      }
    }

    if (fileBuffer) {
      const ext = sanitizedFilename.split(".").pop()?.toLowerCase();

      return new NextResponse(fileBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": getContentType(ext),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    // File not on disk - try to restore from database backup.
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
        console.log(`🔄 [Serve] Restoring branding image from DB: ${sanitizedFilename}`);
        const buffer = fileEntry.data;

        // Auto-restore file to disk for future requests.
        // Reason: the restore target is spelled out rather than taken from
        // `dirname(possiblePaths[0])`. That first candidate was the hardcoded
        // `/var/www/chartvolt` path, so in development this wrote the recovered image
        // into a directory the app never reads from - and it created that directory to
        // do it - which meant every subsequent request went back to the database.
        try {
          const restoreDir = path.join(
            process.cwd(),
            "public",
            "assets",
            "images",
          );
          await mkdir(restoreDir, { recursive: true });
          await writeFile(path.join(restoreDir, sanitizedFilename), buffer);
          console.log(
            `✅ [Serve] Auto-restored to disk: ${path.join(restoreDir, sanitizedFilename)}`,
          );
        } catch (restoreErr) {
          console.warn(`⚠️ [Serve] Could not auto-restore to disk:`, restoreErr);
        }

        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": fileEntry.contentType,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
      }
    } catch (dbErr) {
      console.warn(`⚠️ [Serve] DB fallback failed:`, dbErr);
    }

    // Reason: Only warn once per filename per server lifecycle to avoid log spam.
    // Missing branding files are a content issue — re-upload from admin panel to fix.
    if (!warnedMissing.has(sanitizedFilename)) {
      warnedMissing.add(sanitizedFilename);
      console.warn(
        `⚠️ Branding image not found: ${sanitizedFilename} (checked disk + DB). Re-upload from Admin > Settings > Branding to fix.`,
      );
    }

    // Return a 1x1 transparent PNG instead of JSON error so <img> tags
    // degrade gracefully without broken image icons or fetch errors.
    const transparentPixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==",
      "base64",
    );
    return new NextResponse(transparentPixel as unknown as BodyInit, {
      status: 404,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error serving branding image:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 },
    );
  }
}

function getContentType(ext: string | undefined): string {
  const contentTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };
  return contentTypes[ext || "png"] || "image/png";
}
