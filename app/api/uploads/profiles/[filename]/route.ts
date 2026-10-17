import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Reason: a Map has no prototype chain, so the lookup is total for any extension a
 * filename can produce. An object index walks the prototype, and a key such as
 * "constructor" returns something truthy that survives a `|| fallback` and would reach
 * a Content-Type header.
 */
const CONTENT_TYPES = new Map<string, string>([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
]);

function contentTypeFor(ext: string): string {
  return CONTENT_TYPES.get(ext) || "image/jpeg";
}

/**
 * GET /api/uploads/profiles/[filename]
 * Serve profile images from the uploads directory
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);

    // Look under `public/uploads/profiles`, then a bare `uploads/profiles`.
    //
    // Reason for the shape - each `readFile` spells out its own directory rather than
    // looping over an array of candidates, which reads as needless repetition and is not.
    // Measured against a real `next build`: a path Turbopack cannot fold, such as a loop
    // variable over an array, makes the traced pattern a bare `<dynamic>` matching every
    // file in the repository, and `/*turbopackIgnore: true*/` on `process.cwd()` hides
    // the resulting warning without narrowing anything, so the widened trace resurfaces
    // as "unexpected file in NFT list" naming `next.config.ts`. Reading directly rather
    // than `access` then `readFile` is one syscall instead of two, since a failed read
    // answers the same question.
    //
    // Three of the five candidates were removed rather than kept. Two hardcoded
    // `/var/www/chartvolt`, which `ecosystem.config.js` already makes `process.cwd()` in
    // production, and one reached `..` out of the project "in case running from .next",
    // which the PM2 `cwd: __dirname` means never happens.
    let fileBuffer: Buffer | null = null;

    try {
      fileBuffer = await readFile(
        path.join(
          process.cwd(),
          "public",
          "uploads",
          "profiles",
          sanitizedFilename,
        ),
      );
    } catch {
      // Not under public/ - try the bare uploads directory.
    }

    if (!fileBuffer) {
      try {
        fileBuffer = await readFile(
          path.join(process.cwd(), "uploads", "profiles", sanitizedFilename),
        );
      } catch {
        // Neither location has it.
      }
    }

    if (!fileBuffer) {
      console.error("❌ Profile image not found:", sanitizedFilename);
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const ext = sanitizedFilename.split(".").pop()?.toLowerCase() || "jpg";

    return new NextResponse(fileBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentTypeFor(ext),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving profile image:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 },
    );
  }
}
