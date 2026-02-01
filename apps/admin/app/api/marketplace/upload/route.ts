import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { writeFile, mkdir, access, stat } from "fs/promises";
import { constants } from "fs";
import path from "path";
import sharp from "sharp";

// Image optimization settings based on cosmetic type
const IMAGE_SETTINGS = {
  avatar: { width: 256, height: 256, quality: 85 },
  badge: { width: 128, height: 128, quality: 85 },
  border: { width: 512, height: 512, quality: 80 },
  background: { width: 1920, height: 1080, quality: 75 },
  effect: { width: 512, height: 512, quality: 80 },
  default: { width: 512, height: 512, quality: 80 },
};

// POST - Upload marketplace cosmetic images
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const itemSlug = formData.get("slug") as string;
    const cosmeticType = (formData.get("cosmeticType") as string) || "avatar";

    console.log(
      `📤 [Marketplace Upload] Received upload for slug: ${itemSlug}, type: ${cosmeticType}, file: ${file?.name}, size: ${file?.size}`,
    );

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 },
      );
    }

    // Validate file size (10MB max for input - will be compressed)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 },
      );
    }

    // Get optimization settings for this cosmetic type
    const settings =
      IMAGE_SETTINGS[cosmeticType as keyof typeof IMAGE_SETTINGS] ||
      IMAGE_SETTINGS.default;

    // Generate filename - always output as WebP for best compression
    const timestamp = Date.now();
    const safeSlug = (itemSlug || "item")
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase();
    const filename = `${cosmeticType}-${safeSlug}-${timestamp}.webp`;

    // Create upload directory for marketplace cosmetics
    // Try multiple paths for monorepo compatibility
    const possibleUploadDirs = [
      // Production: /var/www/chartvolt/public/uploads/marketplace
      path.join("/var/www/chartvolt", "public", "uploads", "marketplace"),
      // Monorepo local dev: from apps/admin up to root's public
      path.join(process.cwd(), "..", "..", "public", "uploads", "marketplace"),
      // Fallback: current app's public folder
      path.join(process.cwd(), "public", "uploads", "marketplace"),
    ];

    console.log(`📁 [Marketplace Upload] cwd: ${process.cwd()}`);
    console.log(
      `📁 [Marketplace Upload] Trying directories:`,
      possibleUploadDirs,
    );

    // Find the first writable directory or create it
    let uploadDir: string | null = null;
    for (const dir of possibleUploadDirs) {
      try {
        await mkdir(dir, { recursive: true });
        // Verify we can write to this directory
        const testFile = path.join(dir, ".write-test");
        await writeFile(testFile, "test");
        // Clean up test file (ignore errors)
        try {
          await import("fs/promises").then((fs) => fs.unlink(testFile));
        } catch {}
        uploadDir = dir;
        console.log(
          `✅ [Marketplace Upload] Using writable directory: ${uploadDir}`,
        );
        break;
      } catch (e) {
        console.warn(`❌ [Marketplace Upload] Cannot use directory ${dir}:`, e);
        continue;
      }
    }

    if (!uploadDir) {
      console.error(`❌ [Marketplace Upload] No writable directory found!`);
      return NextResponse.json(
        { error: "No writable upload directory available" },
        { status: 500 },
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);
    console.log(
      `📦 [Marketplace Upload] Original size: ${inputBuffer.length} bytes`,
    );

    // Optimize image using Sharp
    let optimizedBuffer: Buffer;
    try {
      optimizedBuffer = await sharp(inputBuffer)
        .resize(settings.width, settings.height, {
          fit: "inside", // Maintain aspect ratio, fit within bounds
          withoutEnlargement: true, // Don't upscale small images
        })
        .webp({
          quality: settings.quality,
          effort: 4, // Balance between speed and compression
        })
        .toBuffer();

      const compressionRatio = (
        (1 - optimizedBuffer.length / inputBuffer.length) *
        100
      ).toFixed(1);
      console.log(
        `🗜️ [Marketplace Upload] Optimized: ${inputBuffer.length} → ${optimizedBuffer.length} bytes (${compressionRatio}% smaller)`,
      );
    } catch (sharpError) {
      console.error(
        `⚠️ [Marketplace Upload] Sharp optimization failed, using original:`,
        sharpError,
      );
      optimizedBuffer = inputBuffer;
    }

    // Write optimized file
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, optimizedBuffer);
    console.log(`💾 [Marketplace Upload] File written to: ${filePath}`);

    // Verify the file was written
    try {
      await access(filePath, constants.R_OK);
      const fileStats = await stat(filePath);
      console.log(
        `✅ [Marketplace Upload] File verified: ${filePath}, size: ${fileStats.size} bytes`,
      );
    } catch (verifyError) {
      console.error(
        `❌ [Marketplace Upload] File verification failed:`,
        verifyError,
      );
      return NextResponse.json(
        { error: "File was not saved correctly" },
        { status: 500 },
      );
    }

    // Return API-served path (works in production without rebuild)
    // Use API route for dynamic serving, with timestamp for cache-busting
    const publicPath = `/api/assets/marketplace/${filename}?t=${timestamp}`;
    console.log(`🔗 [Marketplace Upload] Returning path: ${publicPath}`);

    return NextResponse.json({
      success: true,
      url: publicPath,
      filename,
      uploadDir, // Include for debugging
      originalSize: inputBuffer.length,
      optimizedSize: optimizedBuffer.length,
      compressionRatio: `${((1 - optimizedBuffer.length / inputBuffer.length) * 100).toFixed(1)}%`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("❌ [Marketplace Upload] Error:", error);
    return NextResponse.json(
      {
        error:
          "Failed to upload file: " +
          (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 },
    );
  }
}
