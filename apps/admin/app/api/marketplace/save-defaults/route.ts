import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { requireAdminAuth } from "@/lib/admin/auth";
import { readFile, writeFile, mkdir, access, copyFile, readdir, stat } from "fs/promises";
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
 * After running this, commit and push so white-label instances get everything.
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

    // ---- Resolve repo root dynamically ----
    const possibleRoots = [
      path.join(process.cwd(), "..", ".."),
      process.cwd(),
    ];

    let repoRoot: string | null = null;
    for (const root of possibleRoots) {
      try {
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

    const assetsDir = path.join(repoRoot, "public", "assets", "marketplace");
    await mkdir(assetsDir, { recursive: true });

    const dataDir = path.join(repoRoot, "apps", "admin", "lib", "data");
    await mkdir(dataDir, { recursive: true });

    // ---- All directories to search for images ----
    const allSearchDirs = [
      path.join(repoRoot, "public", "uploads", "marketplace"),
      path.join(repoRoot, "apps", "admin", "public", "uploads", "marketplace"),
      path.join(repoRoot, "public", "assets", "marketplace"),
      path.join(repoRoot, "public", "assets", "avatars"),
      path.join(repoRoot, "public", "avatars"),
    ];

    // ---- Build a full file index of all upload directories (once) ----
    // Maps filename (lowercase) -> full path, and also indexes by slug fragments
    const fileIndex: Map<string, string> = new Map();
    for (const dir of allSearchDirs) {
      try {
        const files = await readdir(dir);
        for (const f of files) {
          const fullPath = path.join(dir, f);
          try {
            const s = await stat(fullPath);
            if (s.isFile() && s.size > 0) {
              fileIndex.set(f.toLowerCase(), fullPath);
            }
          } catch { /* skip */ }
        }
      } catch { /* dir doesn't exist */ }
    }

    console.log(`📂 [Save Defaults] Indexed ${fileIndex.size} files across all directories`);

    // ---- Helper: find best image for an item ----
    function findImageForItem(imageUrl: string | undefined, slug: string): string | null {
      // Strategy 1: exact filename from imageUrl
      if (imageUrl) {
        const urlPath = imageUrl.split("?")[0];
        const filename = urlPath.split("/").pop();
        if (filename) {
          const found = fileIndex.get(filename.toLowerCase());
          if (found) return found;
          // Try .webp variant
          const webpName = filename.replace(/\.(jpg|jpeg|png|gif|bmp|tiff)$/i, ".webp");
          if (webpName !== filename) {
            const foundWebp = fileIndex.get(webpName.toLowerCase());
            if (foundWebp) return foundWebp;
          }
        }
      }

      // Strategy 2: look for {slug}.webp in assets dir (already committed)
      const slugFile = fileIndex.get(`${slug}.webp`);
      if (slugFile) return slugFile;

      // Strategy 3: search uploads for files containing the slug in the filename
      // Pick the NEWEST file (highest timestamp in filename)
      const slugLower = slug.toLowerCase();
      // Also try without common prefixes (avatar-, cosmetic-, etc.)
      const slugVariants = [slugLower];
      if (slugLower.startsWith("avatar-")) slugVariants.push(slugLower.slice(7));
      if (slugLower.startsWith("game-master-")) slugVariants.push(slugLower);

      let bestMatch: string | null = null;
      let bestTimestamp = 0;

      for (const [filename, fullPath] of fileIndex.entries()) {
        // Skip non-image files
        if (!filename.endsWith(".webp") && !filename.endsWith(".png") && !filename.endsWith(".jpg")) continue;

        for (const sv of slugVariants) {
          // Check if filename contains the slug
          // e.g. "avatar-avatar-shadow-trader-1770966280005.webp" contains "shadow-trader"
          // e.g. "avatar-bollinger-bands-1769416451404.webp" contains "bollinger-bands"
          if (filename.includes(sv)) {
            // Extract timestamp from filename to pick newest
            const timestampMatch = filename.match(/(\d{13})/);
            const ts = timestampMatch ? parseInt(timestampMatch[1], 10) : 0;
            if (ts > bestTimestamp || !bestMatch) {
              bestTimestamp = ts;
              bestMatch = fullPath;
            }
            break;
          }
        }
      }

      if (bestMatch) return bestMatch;

      // Strategy 4: for generic "avatar-item-TIMESTAMP" uploads, try matching by the
      // timestamp that was in the original imageUrl
      if (imageUrl) {
        const tsMatch = imageUrl.match(/(\d{13})/);
        if (tsMatch) {
          for (const [filename, fullPath] of fileIndex.entries()) {
            if (filename.includes(tsMatch[1])) return fullPath;
          }
        }
      }

      return null;
    }

    // ---- Process each item ----
    let imagesCopied = 0;
    let imagesMissing = 0;
    let imagesSkipped = 0;
    const defaultItems: Record<string, unknown>[] = [];

    for (const item of items) {
      let newImageUrl = item.imageUrl || "";

      // Find the best image file for this item
      const sourceFile = findImageForItem(item.imageUrl, item.slug);

      if (sourceFile) {
        const ext = path.extname(sourceFile) || ".webp";
        const targetFilename = `${item.slug}${ext}`;
        const targetPath = path.join(assetsDir, targetFilename);

        try {
          await copyFile(sourceFile, targetPath);
          newImageUrl = `/api/assets/marketplace/${targetFilename}`;
          imagesCopied++;
          console.log(
            `  ✅ "${item.slug}": ${path.basename(sourceFile)} → ${targetFilename}`,
          );

          // Backfill image to MongoDB for multi-server persistence
          try {
            const imgBuffer = await readFile(sourceFile);
            const base64Data = imgBuffer.toString("base64");
            await MarketplaceItem.updateOne(
              { _id: item._id },
              {
                $set: {
                  imageData: base64Data,
                  imageContentType: "image/webp",
                },
              },
            );
            console.log(
              `  💾 "${item.slug}": image backed up to DB (${Math.round(base64Data.length / 1024)}KB)`,
            );
          } catch (dbBackfillErr) {
            console.warn(`  ⚠️ "${item.slug}": DB backfill failed:`, dbBackfillErr);
          }
        } catch (copyErr) {
          console.error(`  ❌ Copy failed for "${item.slug}":`, copyErr);
          imagesMissing++;
        }
      } else if (item.imageUrl) {
        console.warn(`  ⚠️ No image found for "${item.slug}" (DB: ${item.imageUrl})`);
        imagesMissing++;
      } else {
        imagesSkipped++;
      }

      // Build the default item data
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

      if (item.strategyConfig) defaultItem.strategyConfig = item.strategyConfig;
      if (item.gameMasterConfig) defaultItem.gameMasterConfig = item.gameMasterConfig;

      for (const key of Object.keys(defaultItem)) {
        if (defaultItem[key] === undefined || defaultItem[key] === null) {
          delete defaultItem[key];
        }
      }

      defaultItems.push(defaultItem);

      // Update the item in DB with the new committed image path
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

    console.log(`💾 [Save Defaults] Complete! ${defaultItems.length} items saved`);
    console.log(`   ✅ Images copied: ${imagesCopied}`);
    console.log(`   ⚠️ Images missing: ${imagesMissing}`);
    console.log(`   ⏭️ No image: ${imagesSkipped}`);
    console.log(`   📌 Now run: scripts/sync-defaults-to-git.sh (or commit manually)`);

    return NextResponse.json({
      success: true,
      totalItems: defaultItems.length,
      imagesCopied,
      imagesMissing,
      imagesSkipped,
      jsonPath: "apps/admin/lib/data/marketplace-defaults.json",
      assetsDir: "public/assets/marketplace/",
      message: `Saved ${defaultItems.length} items. ${imagesCopied} images copied, ${imagesMissing} missing, ${imagesSkipped} no image. Commit and push to include in repo.`,
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
