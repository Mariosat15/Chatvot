import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { requireAdminAuth } from "@/lib/admin/auth";
import { readFile, writeFile, mkdir, access, copyFile } from "fs/promises";
import { constants } from "fs";
import path from "path";

/**
 * POST /api/marketplace/save-defaults
 *
 * Saves all current marketplace items as committed defaults:
 * 1. Copies all item images to public/assets/marketplace/ (git-tracked)
 * 2. Writes a JSON defaults file with all item data
 * 3. Updates imageUrl in DB to point to the committed static path
 *
 * After running this, the admin should commit and push so that
 * white-label instances and fresh DB seeds get all items + images.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const items = await MarketplaceItem.find().lean();

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No marketplace items found to save" },
        { status: 400 },
      );
    }

    console.log(
      `💾 [Save Defaults] Starting - ${items.length} items to process`,
    );

    // ---- Resolve directories ----
    // Find the repo root (monorepo) to place committed assets
    const possibleRoots = [
      "/var/www/chartvolt", // Production
      path.join(process.cwd(), "..", ".."), // Dev: apps/admin -> repo root
      process.cwd(), // Fallback
    ];

    let repoRoot: string | null = null;
    for (const root of possibleRoots) {
      try {
        // Verify this is the repo root by checking for package.json
        await access(path.join(root, "package.json"), constants.R_OK);
        repoRoot = root;
        break;
      } catch {
        continue;
      }
    }

    if (!repoRoot) {
      return NextResponse.json(
        { success: false, error: "Could not find repo root directory" },
        { status: 500 },
      );
    }

    console.log(`📁 [Save Defaults] Repo root: ${repoRoot}`);

    // Create committed assets directory
    const assetsDir = path.join(repoRoot, "public", "assets", "marketplace");
    await mkdir(assetsDir, { recursive: true });

    // Create data directory for JSON defaults
    const dataDir = path.join(repoRoot, "apps", "admin", "lib", "data");
    await mkdir(dataDir, { recursive: true });

    // ---- Source directories for finding existing images ----
    const uploadDirs = [
      path.join(repoRoot, "public", "uploads", "marketplace"),
      path.join(repoRoot, "apps", "admin", "public", "uploads", "marketplace"),
      path.join(repoRoot, "public", "assets", "marketplace"),
    ];

    // Also check for avatar images (could be anywhere on the server)
    const avatarDirs = [
      path.join(repoRoot, "public", "assets", "avatars"),
      path.join(repoRoot, "public", "avatars"),
      path.join(repoRoot, "apps", "admin", "public", "assets", "avatars"),
      path.join(repoRoot, "apps", "admin", "public", "avatars"),
      // Web app might serve avatars from its own public
      path.join(repoRoot, "apps", "web", "public", "assets", "avatars"),
      // Production paths
      path.join("/var/www/chartvolt", "public", "assets", "avatars"),
      path.join("/var/www/chartvolt", "public", "avatars"),
    ];

    // ---- Helper: generate filename variants (original + webp fallback) ----
    function getFilenameVariants(filename: string): string[] {
      const variants = [filename];
      // If the filename has a non-webp extension, also try .webp
      // (upload route converts all images to .webp)
      const webpVariant = filename.replace(
        /\.(jpg|jpeg|png|gif|bmp|tiff)$/i,
        ".webp",
      );
      if (webpVariant !== filename) {
        variants.push(webpVariant);
      }
      return variants;
    }

    // ---- Helper: try to find file in directories with variants ----
    async function tryFindInDirs(
      filename: string,
      dirs: string[],
    ): Promise<string | null> {
      const variants = getFilenameVariants(filename);
      for (const variant of variants) {
        for (const dir of dirs) {
          const fullPath = path.join(dir, variant);
          try {
            await access(fullPath, constants.R_OK);
            return fullPath;
          } catch {
            continue;
          }
        }
      }
      return null;
    }

    // ---- Helper: find an image file on disk ----
    async function findImageFile(
      imageUrl: string,
    ): Promise<string | null> {
      if (!imageUrl) return null;

      // Extract filename from URL (handle query params)
      const urlPath = imageUrl.split("?")[0];

      // Case 1: /api/assets/marketplace/filename.webp (or .png → .webp)
      if (urlPath.includes("/api/assets/marketplace/")) {
        const filename = urlPath.split("/api/assets/marketplace/")[1];
        const found = await tryFindInDirs(filename, uploadDirs);
        if (found) return found;
      }

      // Case 2: /assets/avatars/name.png (or .webp)
      if (urlPath.includes("/assets/avatars/")) {
        const filename = urlPath.split("/assets/avatars/")[1];
        const found = await tryFindInDirs(filename, avatarDirs);
        if (found) return found;
      }

      // Case 3: /assets/marketplace/name.ext (already committed - with or without /api prefix)
      if (urlPath.includes("/assets/marketplace/")) {
        const filename = urlPath.split("/assets/marketplace/")[1];
        const found = await tryFindInDirs(filename, [assetsDir, ...uploadDirs]);
        if (found) return found;
      }

      return null;
    }

    // ---- Process each item ----
    let imagesCopied = 0;
    let imagesMissing = 0;
    const defaultItems: Record<string, unknown>[] = [];

    for (const item of items) {
      let newImageUrl = item.imageUrl || "";

      // If the item has an image, try to copy it to the committed directory
      if (item.imageUrl) {
        const sourceFile = await findImageFile(item.imageUrl);

        if (sourceFile) {
          // Determine target filename: use slug + original extension
          const ext = path.extname(sourceFile) || ".webp";
          const targetFilename = `${item.slug}${ext}`;
          const targetPath = path.join(assetsDir, targetFilename);

          try {
            await copyFile(sourceFile, targetPath);
            newImageUrl = `/api/assets/marketplace/${targetFilename}`;
            imagesCopied++;
            console.log(
              `  ✅ Copied image for "${item.slug}": ${sourceFile} → ${targetPath}`,
            );
          } catch (copyErr) {
            console.error(
              `  ❌ Failed to copy image for "${item.slug}":`,
              copyErr,
            );
            imagesMissing++;
          }
        } else {
          console.warn(
            `  ⚠️ Image file not found for "${item.slug}": ${item.imageUrl}`,
          );
          imagesMissing++;
          // Keep the existing URL - might still work
        }
      }

      // Build the default item data (exclude transient/runtime fields)
      const defaultItem: Record<string, unknown> = {
        name: item.name,
        slug: item.slug,
        shortDescription: item.shortDescription,
        fullDescription: item.fullDescription,
        category: item.category,
        price: item.price,
        originalPrice: item.originalPrice,
        isFree: item.isFree,
        status: item.status,
        isPublished: item.isPublished,
        isFeatured: item.isFeatured,
        version: item.version || "1.0.0",
        imageUrl: newImageUrl || undefined,
        iconUrl: item.iconUrl,
        iconName: item.iconName,
        cosmeticType: item.cosmeticType,
        indicatorType: item.indicatorType,
        codeTemplate: item.codeTemplate || "{}",
        defaultSettings: item.defaultSettings || {},
        supportedAssets: item.supportedAssets || [],
        tags: item.tags || [],
        riskLevel: item.riskLevel || "low",
        riskWarning: item.riskWarning,
      };

      // Include strategy config if present
      if (item.strategyConfig) {
        defaultItem.strategyConfig = item.strategyConfig;
      }

      // Include game master config if present
      if (item.gameMasterConfig) {
        defaultItem.gameMasterConfig = item.gameMasterConfig;
      }

      // Remove undefined values for cleaner JSON
      for (const key of Object.keys(defaultItem)) {
        if (defaultItem[key] === undefined || defaultItem[key] === null) {
          delete defaultItem[key];
        }
      }

      defaultItems.push(defaultItem);

      // Update the item in DB with the new static image path
      if (newImageUrl && newImageUrl !== item.imageUrl) {
        await MarketplaceItem.updateOne(
          { _id: item._id },
          { $set: { imageUrl: newImageUrl } },
        );
      }
    }

    // ---- Write JSON defaults file ----
    const jsonPath = path.join(dataDir, "marketplace-defaults.json");
    const jsonContent = JSON.stringify(defaultItems, null, 2);
    await writeFile(jsonPath, jsonContent, "utf-8");

    console.log(
      `💾 [Save Defaults] Complete! ${defaultItems.length} items saved to ${jsonPath}`,
    );
    console.log(
      `   Images: ${imagesCopied} copied, ${imagesMissing} missing/not found`,
    );
    console.log(
      `   📌 IMPORTANT: Commit and push the following to include defaults in the repo:`,
    );
    console.log(`   - ${assetsDir}/ (marketplace images)`);
    console.log(`   - ${jsonPath} (items data)`);

    return NextResponse.json({
      success: true,
      totalItems: defaultItems.length,
      imagesCopied,
      imagesMissing,
      jsonPath: "apps/admin/lib/data/marketplace-defaults.json",
      assetsDir: "public/assets/marketplace/",
      message: `Saved ${defaultItems.length} items as defaults. ${imagesCopied} images copied. Now commit and push to include in the repo.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    console.error("❌ [Save Defaults] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
