import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

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

    // Search four directories, in order, for each candidate filename. No hardcoded
    // paths, so this works whatever directory the server was started from.
    //
    // Reason for the shape - each `readFile` spells out its own directory instead of
    // looping over an array of them, which reads as needless repetition and is not.
    // Measured against a real `next build`:
    //   - looping over an array of base directories leaves Turbopack unable to fold the
    //     loop variable, so the traced pattern includes a bare `<dynamic>` matching every
    //     file in the repository. That is the "overly broad pattern" warning this route
    //     used to emit, and it also fired on an array index (`baseDirs[1]`) and on a
    //     `string | null` assigned in a loop and read after it;
    //   - `/*turbopackIgnore: true*/` on `process.cwd()` silences that warning without
    //     narrowing anything, so the widened trace resurfaces as "unexpected file in NFT
    //     list" naming `next.config.ts`. Comments to that effect were here, doing that;
    //   - one literal-segment `path.join` per `fs` call emits neither warning.
    // Reading directly rather than `access` then `readFile` is also one syscall per
    // candidate instead of two, since a failed read answers the same question.
    for (const fname of filenamesToTry) {
      let fileBuffer: Buffer | null = null;

      // Committed assets (defaults saved via "Save as Defaults") - check first
      try {
        fileBuffer = await readFile(
          path.join(process.cwd(), "public", "assets", "marketplace", fname),
        );
      } catch {
        // Not here - fall through to the next directory.
      }

      // Runtime uploads
      if (!fileBuffer) {
        try {
          fileBuffer = await readFile(
            path.join(process.cwd(), "public", "uploads", "marketplace", fname),
          );
        } catch {
          // Not here either.
        }
      }

      // The admin app's directories (monorepo: web app at root, admin at apps/admin)
      if (!fileBuffer) {
        try {
          fileBuffer = await readFile(
            path.join(
              process.cwd(),
              "apps",
              "admin",
              "public",
              "uploads",
              "marketplace",
              fname,
            ),
          );
        } catch {
          // Not here either.
        }
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
              "marketplace",
              fname,
            ),
          );
        } catch {
          // Not on disk under this filename - try the next filename, then the database.
        }
      }

      if (fileBuffer) {
        return new NextResponse(fileBuffer as unknown as BodyInit, {
          headers: {
            "Content-Type": getContentType(
              fname.split(".").pop()?.toLowerCase(),
            ),
            "Cache-Control":
              "public, max-age=3600, stale-while-revalidate=86400",
          },
        });
      }
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

        // Auto-restore to disk for future requests.
        // Reason: the literal join is repeated rather than read back out of `baseDirs`.
        // `baseDirs[1]` is an array index the analyser cannot fold, which turned this
        // write into a `<dynamic> '/' <dynamic>` pattern covering the whole project.
        try {
          const restoreDir = path.join(
            process.cwd(),
            "public",
            "uploads",
            "marketplace",
          );
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
