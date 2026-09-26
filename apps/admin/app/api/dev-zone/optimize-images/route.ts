"use server";

import { NextRequest, NextResponse } from "next/server";
// `mkdir` was imported here and used by nothing - a dead import, removed rather than left,
// because this file is now linted on every commit that touches it.
import { readdir, stat, unlink, writeFile, rename } from "fs/promises";
import path from "path";
import { guardSection } from "@/lib/admin/section-route-guard";
import { IMAGE_DIRECTORIES } from "@/lib/admin/image-optimizer-directories";
import {
  isReferencedArtworkDir,
  retargetArtworkAfterOptimize,
} from "@/lib/admin/image-optimizer-artwork";
import {
  canOptimizeImage,
  isImageOptimized,
} from "@/lib/admin/image-optimizer-policy";

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
  // Reason: game banners/heroes are wide; 800×600 crushed them into mush while still
  // reporting "Optimized". Cap at ~2K so heavy PNGs shrink without killing the art.
  artwork: { width: 1920, height: 1080, quality: 80 },
  effect: { width: 512, height: 512, quality: 80 },
  gamemaster: { width: 800, height: 600, quality: 85 },
  indicator: { width: 800, height: 600, quality: 85 },
  strategy: { width: 800, height: 600, quality: 85 },
  cosmetic: { width: 512, height: 512, quality: 85 },
  default: { width: 800, height: 600, quality: 80 },
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
  // Reason: "Game Master" contains "game" — check the specific label before artwork.
  if (dirLower.includes("gamemaster") || dirLower.includes("game master"))
    return "gamemaster";
  if (
    dirLower.includes("branding") ||
    dirLower.includes("hero") ||
    dirLower.includes("game artwork") ||
    dirLower.includes("artwork")
  ) {
    return "artwork";
  }
  if (dirLower.includes("indicator")) return "indicator";
  if (dirLower.includes("strateg")) return "strategy";
  if (dirLower.includes("cosmetic")) return "cosmetic";

  // Check filename
  if (lower.includes("avatar")) return "avatar";
  if (lower.includes("badge")) return "badge";
  if (lower.includes("border")) return "border";
  if (lower.includes("background") || lower.includes("banner"))
    return "background";
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
  // `guardSection`, never `requireAdminAuth` - the latter asks only whether the caller is an
  // admin at all, so an employee granted one unrelated section would pass it. The section id
  // matches the tab that renders this data, so the grant that reveals the screen is the same
  // one that permits the read.
  const guard = await guardSection("image-optimizer");
  if (!guard.ok) return guard.response;

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

            // Reason: type-aware ceilings — artwork WebP at 200–350KB is healthy,
            // not a candidate. A flat 150KB rule kept re-encoding Featured tiles
            // forever while reporting success with ~0% savings.
            const isOptimized = isImageOptimized(
              ext,
              fileStats.size,
              imageType,
            );
            const canOptimize = canOptimizeImage(
              ext,
              fileStats.size,
              imageType,
            );

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
  /*
    Guarded separately from the GET, and that is the whole point rather than repetition: this
    handler re-encodes files in place and `unlink`s the original, so it is destructive, and a
    file whose only copy was on disk is gone. Until 8 September 2026 NEITHER handler had any
    authorization at all - the screen was gated behind the `image-optimizer` grant while the
    route behind it was reachable by anyone who could address the admin app, which is exactly
    why a guarded sibling is not evidence about the file next to it. Found by counting exported
    handlers against guards, the same method that found R40 and R47.
  */
  const guard = await guardSection("image-optimizer");
  if (!guard.ok) return guard.response;

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
              const imageType = getImageType(filename, dir.label);

              if (canOptimizeImage(ext, fileStats.size, imageType)) {
                imagesToProcess.push({
                  filename,
                  fullPath: filePath,
                  directory: dir.path,
                  directoryLabel: dir.label,
                  imageType,
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
        const ext = path.extname(img.filename).toLowerCase();
        // Reason: selected mode can still hand us an already-good WebP; refuse to
        // rewrite referenced artwork that the policy says is done.
        if (!canOptimizeImage(ext, fileStats.size, img.imageType)) {
          results.push({
            filename: img.filename,
            fullPath: img.fullPath,
            originalSize: fileStats.size,
            newSize: fileStats.size,
            savedBytes: 0,
            savedPercent: 0,
            newFilename: img.filename,
            success: true,
            error: "Already optimized — left unchanged",
          });
          continue;
        }

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

        const savedBytes = fileStats.size - optimizedBuffer.length;
        const savedPercent = (savedBytes / fileStats.size) * 100;

        // Reason: re-encoding an already-WebP hero often gains <5% and risks a
        // half-written file on crash. Leave the bytes alone when the pass is noise.
        if (
          ext === ".webp" &&
          savedPercent < 5 &&
          optimizedBuffer.length >= fileStats.size * 0.95
        ) {
          results.push({
            filename: img.filename,
            fullPath: img.fullPath,
            originalSize: fileStats.size,
            newSize: fileStats.size,
            savedBytes: 0,
            savedPercent: 0,
            newFilename: img.filename,
            success: true,
            error: "Negligible savings — left unchanged",
          });
          continue;
        }

        // Generate new filename
        const newFilename = img.filename.replace(/\.[^.]+$/, ".webp");
        const newFilePath = path.join(img.directory, newFilename);

        // Reason: write via a sibling temp then rename so a crash mid-write cannot
        // leave a truncated WebP that `<img>` then fails to decode (broken Featured).
        // Windows cannot rename onto an existing path, so drop the destination first
        // once the temp is safely on disk (source bytes already live in memory).
        const tempPath = `${newFilePath}.opt-tmp`;
        await writeFile(tempPath, optimizedBuffer);
        try {
          await unlink(newFilePath);
        } catch {
          // Destination did not exist yet (PNG→WebP rename case).
        }
        await rename(tempPath, newFilePath);

        totalSaved += Math.max(0, savedBytes);

        // Delete original if different (and still present)
        if (img.fullPath !== newFilePath) {
          try {
            await unlink(img.fullPath);
          } catch {
            // Already gone.
          }
        }

        // Reason: game artwork URLs are stored by filename on provider_game /
        // game_page_content (including gallery[].url) and as branding_asset keys.
        // Renaming on disk without rewriting those leaves every title broken while
        // this route reports success.
        if (isReferencedArtworkDir(img.directory, img.directoryLabel)) {
          try {
            await retargetArtworkAfterOptimize({
              oldFilename: img.filename,
              newFilename,
              buffer: optimizedBuffer,
            });
          } catch (retargetError) {
            console.warn(
              "⚠️ Artwork retarget failed after optimize:",
              img.filename,
              retargetError,
            );
          }
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
        console.error("❌ Failed to optimize", img.filename, ":", error);
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
  // Reason: `security/detect-object-injection` flags any computed index, and this one is a
  // logarithm of a local `number` that never touches request input - the rule's real target is
  // a request-supplied key looked up in an object, which walks the prototype chain. Suppressed
  // rather than reworked so this commit changes no behaviour outside the guard.
  // eslint-disable-next-line security/detect-object-injection
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
