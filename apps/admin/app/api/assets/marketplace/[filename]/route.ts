import { NextRequest, NextResponse } from "next/server";
import { readFile, access, writeFile, mkdir } from "fs/promises";
import path from "path";
import { constants } from "fs";

/**
 * GET /api/assets/marketplace/[filename]
 * Serve marketplace cosmetic images from the uploads directory
 * This allows the admin panel and user app to access uploaded cosmetic images
 *
 * Fallback chain: disk -> MongoDB (imageData on MarketplaceItem) -> 404
 * If found in DB, auto-restores to disk for future requests.
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

    // Base directories to search
    const cwd = process.cwd();
    const baseDirs = [
      // Production: absolute paths (most reliable on VPS)
      path.join("/var/www/chartvolt", "public", "assets", "marketplace"),
      path.join("/var/www/chartvolt", "public", "uploads", "marketplace"),
      // Monorepo: admin cwd is apps/admin, go up 2 levels to repo root
      path.join(cwd, "..", "..", "public", "assets", "marketplace"),
      path.join(cwd, "..", "..", "public", "uploads", "marketplace"),
      // Direct: if cwd is repo root
      path.join(cwd, "public", "assets", "marketplace"),
      path.join(cwd, "public", "uploads", "marketplace"),
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

    // If found on disk, serve directly
    if (filePath) {
      const fileBuffer = await readFile(filePath);
      const ext = actualFilename.split(".").pop()?.toLowerCase();
      const contentType = getContentType(ext);

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    // Not on disk - try to serve from MongoDB (imageData on MarketplaceItem)
    try {
      const { connectToDatabase } = await import("@/database/mongoose");
      const { MarketplaceItem } = await import(
        "@/database/models/marketplace/marketplace-item.model"
      );
      await connectToDatabase();

      // Find item whose imageUrl contains this filename
      const item = await MarketplaceItem.findOne({
        imageUrl: { $regex: sanitizedFilename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") },
      }).select("+imageData +imageContentType");

      if (item?.imageData) {
        console.log(
          `🔄 [Marketplace Serve] Restoring image from DB: ${sanitizedFilename} (item: ${item.slug})`,
        );
        const buffer = Buffer.from(item.imageData, "base64");

        // Auto-restore to disk for future requests (use production path first, then cwd)
        try {
          const restoreDir = baseDirs[0]; // /var/www/chartvolt/public/assets/marketplace
          await mkdir(restoreDir, { recursive: true });
          await writeFile(path.join(restoreDir, sanitizedFilename), buffer);
          console.log(
            `✅ [Marketplace Serve] Auto-restored to disk: ${path.join(restoreDir, sanitizedFilename)}`,
          );
        } catch (restoreErr) {
          // Try cwd-relative path
          try {
            const restoreDir2 = baseDirs[2]; // ../../public/assets/marketplace
            await mkdir(restoreDir2, { recursive: true });
            await writeFile(path.join(restoreDir2, sanitizedFilename), buffer);
            console.log(
              `✅ [Marketplace Serve] Auto-restored to disk (alt): ${path.join(restoreDir2, sanitizedFilename)}`,
            );
          } catch {
            console.warn(`⚠️ [Marketplace Serve] Could not auto-restore to disk:`, restoreErr);
          }
        }

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": item.imageContentType || "image/webp",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          },
        });
      }
    } catch (dbErr) {
      console.warn(`⚠️ [Marketplace Serve] DB fallback failed:`, dbErr);
    }

    console.error(
      `❌ [Marketplace Serve] Image not found (disk or DB): ${sanitizedFilename}`,
    );
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  } catch (error) {
    console.error(
      "❌ [Marketplace Serve] Error serving marketplace image:",
      error,
    );
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
