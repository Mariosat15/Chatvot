import { NextRequest, NextResponse } from "next/server";
import { readFile, access } from "fs/promises";
import path from "path";
import { constants } from "fs";

/**
 * GET /api/assets/game-icons/[filename]
 * Serve game icons from the main app's public/game-icons/ directory.
 * The admin app doesn't have its own copy of game icons - they live
 * in the root public/game-icons/ folder (main app).
 * Works on any VPS since git pull brings all icons to disk.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(decodeURIComponent(filename).split("?")[0]);

    // Try multiple possible locations for the file
    const possiblePaths = [
      // Production: /var/www/chartvolt/public/game-icons/
      path.join("/var/www/chartvolt", "public", "game-icons", sanitizedFilename),
      // Local dev: main app's public folder (monorepo root, from apps/admin)
      path.join(process.cwd(), "..", "..", "public", "game-icons", sanitizedFilename),
      // Fallback: cwd-relative (if running from project root)
      path.join(process.cwd(), "public", "game-icons", sanitizedFilename),
    ];

    for (const filePath of possiblePaths) {
      try {
        await access(filePath, constants.R_OK);
        const fileBuffer = await readFile(filePath);
        const ext = sanitizedFilename.split(".").pop()?.toLowerCase();

        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": ext === "webp" ? "image/webp" : "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } catch {
        // File doesn't exist at this path, try next
      }
    }

    return NextResponse.json({ error: "Icon not found" }, { status: 404 });
  } catch (error) {
    console.error("❌ Error serving game icon:", error);
    return NextResponse.json({ error: "Failed to serve icon" }, { status: 500 });
  }
}
