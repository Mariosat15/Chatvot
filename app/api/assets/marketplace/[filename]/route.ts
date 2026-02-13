import { NextRequest, NextResponse } from "next/server";
import { readFile, access } from "fs/promises";
import path from "path";
import { constants } from "fs";

/**
 * GET /api/assets/marketplace/[filename]
 * Serve marketplace cosmetic images from the uploads directory
 * This allows the user app to access uploaded cosmetic images (avatars, etc.)
 *
 * Smart fallback: If original file not found, tries .webp version (after optimization)
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

    // Generate WebP fallback filename (for optimized images)
    const webpFilename = sanitizedFilename.replace(
      /\.(jpg|jpeg|png|gif|bmp|tiff)$/i,
      ".webp",
    );

    // Filenames to try: original first, then webp version
    const filenamesToTry = [sanitizedFilename];
    if (webpFilename !== sanitizedFilename) {
      filenamesToTry.push(webpFilename);
    }

    // Base directories to search (no hardcoded paths - works on any server)
    const cwd = process.cwd();
    const baseDirs = [
      // Committed assets (defaults saved via "Save as Defaults") - check first
      path.join(cwd, "public", "assets", "marketplace"),
      // Runtime uploads
      path.join(cwd, "public", "uploads", "marketplace"),
      // Admin app's directories (monorepo: web app is at root, admin at apps/admin)
      path.join(cwd, "apps", "admin", "public", "uploads", "marketplace"),
      path.join(cwd, "apps", "admin", "public", "assets", "marketplace"),
    ];

    let filePath: string | null = null;
    let actualFilename: string = sanitizedFilename;

    // Try each filename in each directory
    outer: for (const fname of filenamesToTry) {
      for (const baseDir of baseDirs) {
        const possiblePath = path.join(baseDir, fname);
        try {
          await access(possiblePath, constants.R_OK);
          filePath = possiblePath;
          actualFilename = fname;
          break outer;
        } catch {
          // File doesn't exist at this path, try next
        }
      }
    }

    if (!filePath) {
      console.error(
        `❌ Marketplace image not found in any location: ${sanitizedFilename} (also tried: ${webpFilename})`,
      );
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Log if we used the webp fallback
    if (actualFilename !== sanitizedFilename) {
      // Serving optimized WebP fallback
    }

    const fileBuffer = await readFile(filePath);

    // Determine content type from actual file (may be webp fallback)
    const ext = actualFilename.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      ico: "image/x-icon",
    };
    const contentType = contentTypes[ext || "png"] || "image/png";

    return new NextResponse(fileBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        // Allow caching for marketplace images (1 hour, revalidate for 1 day)
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error serving marketplace image:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 },
    );
  }
}
