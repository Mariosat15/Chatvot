/**
 * Rewrite game / trading artwork URLs that still name a deleted `.png` after
 * Image Optimizer wrote the sibling `.webp` into `branding_asset`.
 *
 * Report-only until `--apply`. Safe to re-run. Uses the raw driver so it does
 * not depend on admin path aliases.
 *
 * Usage (from repo root):
 *   npx tsx tools/branding/repair-stale-artwork-urls.ts
 *   npx tsx tools/branding/repair-stale-artwork-urls.ts --apply
 */

import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ARTWORK_URL_FIELDS = [
  "thumbnailUrl",
  "bannerUrl",
  "howToPlayImageUrl",
  "highlightsImageUrl",
  "gameplayPreviewUrl",
] as const;

const COLLECTIONS = ["provider_game", "game_page_content"] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function countMatches(
  db: mongoose.mongo.Db,
  oldFilename: string,
): Promise<number> {
  const pattern = escapeRegex(oldFilename);
  let total = 0;
  for (const name of COLLECTIONS) {
    const col = db.collection(name);
    for (const field of ARTWORK_URL_FIELDS) {
      total += await col.countDocuments({ [field]: { $regex: pattern } });
    }
    total += await col.countDocuments({
      "gallery.url": { $regex: pattern },
    });
  }
  return total;
}

async function rewritePair(
  db: mongoose.mongo.Db,
  oldFilename: string,
  newFilename: string,
): Promise<void> {
  const pattern = escapeRegex(oldFilename);
  const galleryMap = {
    $map: {
      input: { $ifNull: ["$gallery", []] },
      as: "item",
      in: {
        $mergeObjects: [
          "$$item",
          {
            url: {
              $replaceAll: {
                input: { $ifNull: ["$$item.url", ""] },
                find: oldFilename,
                replacement: newFilename,
              },
            },
          },
        ],
      },
    },
  };

  for (const name of COLLECTIONS) {
    const col = db.collection(name);
    for (const field of ARTWORK_URL_FIELDS) {
      await col.updateMany({ [field]: { $regex: pattern } }, [
        {
          $set: {
            [field]: {
              $replaceAll: {
                input: `$${field}`,
                find: oldFilename,
                replacement: newFilename,
              },
            },
          },
        },
      ]);
    }
    await col.updateMany({ "gallery.url": { $regex: pattern } }, [
      { $set: { gallery: galleryMap } },
    ]);
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("❌ MONGODB_URI is not set. Nothing was changed.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ No database handle after connect.");
    process.exit(1);
  }

  console.log(
    `\n🖼️  Stale artwork URL repair - ${
      apply ? "APPLYING CHANGES" : "REPORT ONLY, nothing will be written"
    }\n`,
  );

  const webps = await db
    .collection("branding_asset")
    .find({ filename: { $regex: /\.webp$/i } })
    .project({ filename: 1 })
    .toArray();

  const pairs: Array<{
    oldFilename: string;
    newFilename: string;
    matched: number;
  }> = [];

  for (const row of webps) {
    const filename = String(row.filename ?? "");
    if (!filename) continue;
    const stem = filename.replace(/\.webp$/i, "");
    for (const ext of [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"]) {
      const oldFilename = `${stem}${ext}`;
      const matched = await countMatches(db, oldFilename);
      if (matched === 0) continue;
      pairs.push({ oldFilename, newFilename: filename, matched });
      if (apply) {
        await rewritePair(db, oldFilename, filename);
      }
    }
  }

  if (pairs.length === 0) {
    console.log("No stale PNG/JPEG gallery or scalar URLs found.\n");
    await mongoose.disconnect();
    return;
  }

  for (const pair of pairs) {
    console.log(
      `  ${pair.oldFilename}  →  ${pair.newFilename}  (${pair.matched} match${
        pair.matched === 1 ? "" : "es"
      })`,
    );
  }

  console.log(
    apply
      ? `\n  ✅ Rewrote ${pairs.length} filename pair(s).\n`
      : `\n  📋 ${pairs.length} pair(s) would be rewritten. Re-run with --apply.\n`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
