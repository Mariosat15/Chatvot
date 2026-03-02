import { NextRequest, NextResponse } from "next/server";
import { readFile, access, writeFile, mkdir } from "fs/promises";
import path from "path";
import { constants } from "fs";

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

    // Try multiple possible locations for the file
    // Production path comes first for speed in production
    const possiblePaths = [
      // Production: /var/www/chartvolt/public/assets/images
      path.join(
        "/var/www/chartvolt",
        "public",
        "assets",
        "images",
        sanitizedFilename,
      ),
      // Production admin fallback
      path.join(
        "/var/www/chartvolt",
        "apps",
        "admin",
        "public",
        "assets",
        "images",
        sanitizedFilename,
      ),
      // Local dev: current app's public folder
      path.join(process.cwd(), "public", "assets", "images", sanitizedFilename),
      // Local dev: admin app's public folder (monorepo)
      path.join(
        process.cwd(),
        "apps",
        "admin",
        "public",
        "assets",
        "images",
        sanitizedFilename,
      ),
    ];

    let filePath: string | null = null;

    for (const possiblePath of possiblePaths) {
      try {
        await access(possiblePath, constants.R_OK);
        filePath = possiblePath;
        break;
      } catch {
        // File doesn't exist at this path, try next
      }
    }

    // If file found on disk, serve it directly
    if (filePath) {
      const fileBuffer = await readFile(filePath);
      const ext = sanitizedFilename.split(".").pop()?.toLowerCase();
      const contentType = getContentType(ext);

      return new NextResponse(fileBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    // File not on disk - try to restore from database backup
    try {
      const { connectToDatabase } = await import("@/database/mongoose");
      const { WhiteLabel } = await import("@/database/models/whitelabel.model");
      await connectToDatabase();

      const settings = await WhiteLabel.findOne();
      const fileEntry = settings?.brandingFiles?.get(sanitizedFilename);

      if (fileEntry?.data) {
        console.log(`🔄 [Serve] Restoring branding image from DB: ${sanitizedFilename}`);
        const buffer = Buffer.from(fileEntry.data, "base64");

        // Auto-restore file to disk for future requests
        try {
          const restoreDir = possiblePaths[0] ? path.dirname(possiblePaths[0]) : null;
          if (restoreDir) {
            await mkdir(restoreDir, { recursive: true });
            await writeFile(path.join(restoreDir, sanitizedFilename), buffer);
            console.log(`✅ [Serve] Auto-restored to disk: ${path.join(restoreDir, sanitizedFilename)}`);
          }
        } catch (restoreErr) {
          console.warn(`⚠️ [Serve] Could not auto-restore to disk:`, restoreErr);
        }

        return new NextResponse(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": fileEntry.contentType || "image/png",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
      }
    } catch (dbErr) {
      console.warn(`⚠️ [Serve] DB fallback failed:`, dbErr);
    }

    // Reason: Downgrade to warn — missing branding files are a content issue,
    // not a code error. Log once at warn level to avoid spamming server logs.
    console.warn(
      `⚠️ Branding image not found: ${sanitizedFilename} (checked ${possiblePaths.length} paths)`,
    );

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
