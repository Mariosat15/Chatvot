"use server";

import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, unlink, writeFile, mkdir } from "fs/promises";
import path from "path";

// Dynamically import sharp to handle potential import issues
async function getSharp() {
  try {
    const sharp = (await import("sharp")).default;
    return sharp;
  } catch {
    return null;
  }
}

// Image optimization settings based on image type
const IMAGE_SETTINGS: Record<
  string,
  { width: number; height: number; quality: number }
> = {
  avatar: { width: 512, height: 512, quality: 85 },
  badge: { width: 256, height: 256, quality: 85 },
  border: { width: 512, height: 512, quality: 80 },
  background: { width: 1920, height: 1080, quality: 75 },
  effect: { width: 512, height: 512, quality: 80 },
  gamemaster: { width: 800, height: 600, quality: 85 },
  indicator: { width: 800, height: 600, quality: 85 },
  strategy: { width: 800, height: 600, quality: 85 },
  cosmetic: { width: 512, height: 512, quality: 85 },
  default: { width: 800, height: 600, quality: 80 },
};

// All possible image directories to scan
const IMAGE_DIRECTORIES = {
  production: [
    {
      path: "/var/www/chartvolt/public/uploads/marketplace",
      label: "Marketplace Uploads",
    },
    {
      path: "/var/www/chartvolt/public/assets/avatars",
      label: "Default Avatars",
    },
    { path: "/var/www/chartvolt/public/uploads/cosmetics", label: "Cosmetics" },
    {
      path: "/var/www/chartvolt/public/uploads/indicators",
      label: "Indicators",
    },
    {
      path: "/var/www/chartvolt/public/uploads/strategies",
      label: "Strategies",
    },
    {
      path: "/var/www/chartvolt/public/uploads/gamemaster",
      label: "Game Master",
    },
    { path: "/var/www/chartvolt/public/uploads", label: "General Uploads" },
  ],
  development: [
    {
      path: path.join(
        process.cwd(),
        "..",
        "..",
        "public",
        "uploads",
        "marketplace",
      ),
      label: "Marketplace Uploads",
    },
    {
      path: path.join(process.cwd(), "..", "..", "public", "assets", "avatars"),
      label: "Default Avatars",
    },
    {
      path: path.join(
        process.cwd(),
        "..",
        "..",
        "public",
        "uploads",
        "cosmetics",
      ),
      label: "Cosmetics",
    },
    {
      path: path.join(
        process.cwd(),
        "..",
        "..",
        "public",
        "uploads",
        "indicators",
      ),
      label: "Indicators",
    },
    {
      path: path.join(
        process.cwd(),
        "..",
        "..",
        "public",
        "uploads",
        "strategies",
      ),
      label: "Strategies",
    },
    {
      path: path.join(
        process.cwd(),
        "..",
        "..",
        "public",
        "uploads",
        "gamemaster",
      ),
      label: "Game Master",
    },
    {
      path: path.join(process.cwd(), "..", "..", "public", "uploads"),
      label: "General Uploads",
    },
    {
      path: path.join(process.cwd(), "public", "uploads", "marketplace"),
      label: "Admin Marketplace",
    },
    {
      path: path.join(process.cwd(), "public", "uploads"),
      label: "Admin Uploads",
    },
  ],
};

interface DirectoryInfo {
  path: string;
  label: string;
  exists: boolean;
  imageCount: number;
}

async function findAllImageDirectories(): Promise<DirectoryInfo[]> {
  const allDirs = [
    ...IMAGE_DIRECTORIES.production,
    ...IMAGE_DIRECTORIES.development,
  ];
  const uniqueDirs = new Map<string, { path: string; label: string }>();

  // Dedupe by resolved path
  for (const dir of allDirs) {
    const resolved = path.resolve(dir.path);
    if (!uniqueDirs.has(resolved)) {
      uniqueDirs.set(resolved, { path: dir.path, label: dir.label });
    }
  }

  const results: DirectoryInfo[] = [];

  for (const [resolved, dir] of uniqueDirs) {
    try {
      await stat(resolved);
      const files = await readdir(resolved);
      const imageFiles = files.filter((f) =>
        /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f),
      );
      results.push({
        path: resolved,
        label: dir.label,
        exists: true,
        imageCount: imageFiles.length,
      });
    } catch {
      // Directory doesn't exist, skip it
    }
  }

  return results;
}

function getImageType(filename: string, dirLabel: string): string {
  const lower = filename.toLowerCase();
  const dirLower = dirLabel.toLowerCase();

  // Check directory label first
  if (dirLower.includes("avatar")) return "avatar";
  if (dirLower.includes("gamemaster") || dirLower.includes("game master"))
    return "gamemaster";
  if (dirLower.includes("indicator")) return "indicator";
  if (dirLower.includes("strateg")) return "strategy";
  if (dirLower.includes("cosmetic")) return "cosmetic";

  // Check filename
  if (lower.includes("avatar")) return "avatar";
  if (lower.includes("badge")) return "badge";
  if (lower.includes("border")) return "border";
  if (lower.includes("background")) return "background";
  if (lower.includes("effect")) return "effect";
  if (lower.includes("gamemaster") || lower.includes("gm-"))
    return "gamemaster";
  if (lower.includes("indicator")) return "indicator";
  if (lower.includes("strategy")) return "strategy";

  return "default";
}

interface ImageInfo {
  filename: string;
  fullPath: string;
  directory: string;
  directoryLabel: string;
  size: number;
  imageType: string;
  isOptimized: boolean;
  canOptimize: boolean;
}

interface OptimizeResult {
  filename: string;
  fullPath: string;
  originalSize: number;
  newSize: number;
  savedBytes: number;
  savedPercent: number;
  newFilename: string;
  success: boolean;
  error?: string;
}

// GET - Scan images from ALL directories and return stats
export async function GET() {
  try {
    const directories = await findAllImageDirectories();

    if (directories.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No image directories found",
          message:
            "No directories containing images were found. Make sure uploads exist.",
        },
        { status: 404 },
      );
    }

    const allImages: ImageInfo[] = [];
    let totalSize = 0;
    let optimizableSize = 0;
    let optimizedCount = 0;

    // Scan all directories
    for (const dir of directories) {
      try {
        const files = await readdir(dir.path);
        const imageFiles = files.filter((f) =>
          /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f),
        );

        for (const filename of imageFiles) {
          const filePath = path.join(dir.path, filename);
          try {
            const fileStats = await stat(filePath);
            const ext = path.extname(filename).toLowerCase();
            const imageType = getImageType(filename, dir.label);

            // Consider optimized if WebP and under 150KB
            const isOptimized = ext === ".webp" && fileStats.size < 150 * 1024;
            const canOptimize = !isOptimized && fileStats.size > 10 * 1024; // Skip tiny files

            allImages.push({
              filename,
              fullPath: filePath,
              directory: dir.path,
              directoryLabel: dir.label,
              size: fileStats.size,
              imageType,
              isOptimized,
              canOptimize,
            });

            totalSize += fileStats.size;
            if (canOptimize) {
              optimizableSize += fileStats.size;
            }
            if (isOptimized) {
              optimizedCount++;
            }
          } catch {
            // Skip files we can't read
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    // Sort by size descending
    allImages.sort((a, b) => b.size - a.size);

    return NextResponse.json({
      success: true,
      directories: directories.filter((d) => d.imageCount > 0),
      stats: {
        totalImages: allImages.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        optimizedCount,
        needsOptimization: allImages.filter((i) => i.canOptimize).length,
        potentialSavings: formatBytes(optimizableSize * 0.7), // Estimate 70% savings
        directoriesScanned: directories.length,
      },
      images: allImages.slice(0, 100), // Return top 100 largest
    });
  } catch (error) {
    console.error("Error scanning images:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// POST - Optimize images from any directory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode = "all", images: selectedImages = [] } = body;

    const sharp = await getSharp();
    if (!sharp) {
      return NextResponse.json(
        {
          success: false,
          error: "Sharp library not available. Run: npm install sharp",
        },
        { status: 500 },
      );
    }

    // Get all images from all directories
    const directories = await findAllImageDirectories();

    if (directories.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No image directories found",
        },
        { status: 404 },
      );
    }

    // Build list of images to process
    interface ImageToProcess {
      filename: string;
      fullPath: string;
      directory: string;
      directoryLabel: string;
      imageType: string;
    }

    const imagesToProcess: ImageToProcess[] = [];

    if (mode === "selected" && selectedImages.length > 0) {
      // Use the selected images (which include full paths)
      for (const img of selectedImages) {
        if (img.fullPath && img.filename) {
          imagesToProcess.push({
            filename: img.filename,
            fullPath: img.fullPath,
            directory: img.directory || path.dirname(img.fullPath),
            directoryLabel: img.directoryLabel || "Unknown",
            imageType: img.imageType || "default",
          });
        }
      }
    } else {
      // Process all non-optimized images from all directories
      for (const dir of directories) {
        try {
          const files = await readdir(dir.path);
          const imageFiles = files.filter((f) =>
            /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f),
          );

          for (const filename of imageFiles) {
            const filePath = path.join(dir.path, filename);
            try {
              const fileStats = await stat(filePath);
              const ext = path.extname(filename).toLowerCase();
              const isOptimized =
                ext === ".webp" && fileStats.size < 150 * 1024;

              if (!isOptimized && fileStats.size > 10 * 1024) {
                imagesToProcess.push({
                  filename,
                  fullPath: filePath,
                  directory: dir.path,
                  directoryLabel: dir.label,
                  imageType: getImageType(filename, dir.label),
                });
              }
            } catch {
              // Skip files we can't read
            }
          }
        } catch {
          // Skip directories we can't read
        }
      }
    }

    const results: OptimizeResult[] = [];
    let totalSaved = 0;

    for (const img of imagesToProcess) {
      try {
        const fileStats = await stat(img.fullPath);
        const settings =
          IMAGE_SETTINGS[img.imageType] || IMAGE_SETTINGS.default;

        // Optimize
        const optimizedBuffer = await sharp(img.fullPath)
          .resize(settings.width, settings.height, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({
            quality: settings.quality,
            effort: 4,
          })
          .toBuffer();

        // Generate new filename
        const newFilename = img.filename.replace(/\.[^.]+$/, ".webp");
        const newFilePath = path.join(img.directory, newFilename);

        // Write optimized file
        await writeFile(newFilePath, optimizedBuffer);

        const savedBytes = fileStats.size - optimizedBuffer.length;
        const savedPercent = (savedBytes / fileStats.size) * 100;
        totalSaved += Math.max(0, savedBytes);

        // Delete original if different
        if (img.fullPath !== newFilePath) {
          await unlink(img.fullPath);
        }

        results.push({
          filename: img.filename,
          fullPath: img.fullPath,
          originalSize: fileStats.size,
          newSize: optimizedBuffer.length,
          savedBytes: Math.max(0, savedBytes),
          savedPercent: Math.max(0, savedPercent),
          newFilename,
          success: true,
        });

        console.log(
          `✅ Optimized ${img.filename}: ${formatBytes(fileStats.size)} → ${formatBytes(optimizedBuffer.length)} (${savedPercent.toFixed(1)}% saved)`,
        );
      } catch (error) {
        results.push({
          filename: img.filename,
          fullPath: img.fullPath,
          originalSize: 0,
          newSize: 0,
          savedBytes: 0,
          savedPercent: 0,
          newFilename: img.filename,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(`❌ Failed to optimize ${img.filename}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalSaved,
      totalSavedFormatted: formatBytes(totalSaved),
      results,
    });
  } catch (error) {
    console.error("Error optimizing images:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
