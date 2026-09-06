import { NextRequest, NextResponse } from "next/server";
import { readFile, access, writeFile, mkdir } from "fs/promises";
import path from "path";
import { constants } from "fs";

/**
 * GET /api/assets/marketplace/[filename]
 * Serve marketplace cosmetic images from the uploads directory
 * This allows the user app to access uploaded cosmetic images (avatars, etc.)
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

    // Base directories to search (no hardcoded paths - works on any server).
    // Reason: `/*turbopackIgnore: true*/` prevents Turbopack's NFT from
    // widening the trace to the whole project. These directories are
    // read at runtime only and should never be bundled.
    const baseDirs = [
      // Committed assets (defaults saved via "Save as Defaults") - check first
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "assets", "marketplace"),
      // Runtime uploads
      path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads", "marketplace"),
      // Admin app's directories (monorepo: web app is at root, admin at apps/admin)
      path.join(/*turbopackIgnore: true*/ process.cwd(), "apps", "admin", "public", "uploads", "marketplace"),
      path.join(/*turbopackIgnore: true*/ process.cwd(), "apps", "admin", "public", "assets", "marketplace"),
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

      return new NextResponse(fileBuffer as unknown as BodyInit, {
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

        // Auto-restore to disk for future requests
        try {
          const restoreDir = baseDirs[1]; // public/uploads/marketplace
          await mkdir(restoreDir, { recursive: true });
          await writeFile(path.join(restoreDir, sanitizedFilename), buffer);
          console.log(
            `✅ [Marketplace Serve] Auto-restored to disk: ${sanitizedFilename}`,
          );
        } catch (restoreErr) {
          console.warn(`⚠️ [Marketplace Serve] Could not auto-restore to disk:`, restoreErr);
        }

        return new NextResponse(buffer as unknown as BodyInit, {
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
      `❌ Marketplace image not found (disk or DB): ${sanitizedFilename}`,
    );
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  } catch (error) {
    console.error("Error serving marketplace image:", error);
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
