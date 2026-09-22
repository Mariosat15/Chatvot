import path from "path";
import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import GamePageContent from "@/database/models/games/game-page-content.model";
import {
  putBrandingAsset,
  deleteBrandingAsset,
} from "@/lib/services/branding-assets.service";

/**
 * Keep player-facing URLs and the DB byte store in sync after Image Optimizer renames a file.
 *
 * Game and trading artwork live under `public/assets/images` and are addressed by
 * `/api/assets/images/<filename>`. That filename is stored on `provider_game`,
 * `game_page_content`, and as the key of a `branding_asset` row. Renaming on disk without
 * rewriting those leaves every title showing a broken image while the optimizer
 * reports success — the failure mode called out when R57 documented why this tool must
 * not casually touch game artwork.
 *
 * Call only when the directory is one we treat as referenced (see `isReferencedArtworkDir`).
 */

const ARTWORK_URL_FIELDS = [
  "thumbnailUrl",
  "bannerUrl",
  "howToPlayImageUrl",
  "highlightsImageUrl",
  "gameplayPreviewUrl",
] as const;

export function isReferencedArtworkDir(dirPath: string, label: string): boolean {
  const lower = `${dirPath} ${label}`.toLowerCase();
  return (
    lower.includes(`${path.sep}assets${path.sep}images`) ||
    lower.includes("/assets/images") ||
    lower.includes("\\assets\\images") ||
    lower.includes("artwork") ||
    lower.includes("branding")
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function rewriteScalarUrlFields(
  oldFilename: string,
  newFilename: string,
): Promise<void> {
  const pattern = escapeRegex(oldFilename);

  for (const field of ARTWORK_URL_FIELDS) {
    // Reason: aggregation-pipeline `$replaceAll` so a URL with `?t=` query still updates.
    await ProviderGame.updateMany(
      { [field]: { $regex: pattern } },
      [
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
      ],
    );

    await GamePageContent.updateMany(
      { [field]: { $regex: pattern } },
      [
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
      ],
    );
  }
}

/**
 * Gallery items are nested `{ url, title?, type? }[]` — a scalar field rewrite
 * never sees them, which is how Featured tiles on `/games/[slug]` went blank after
 * a PNG→WebP rename while the tips / preview fields still worked.
 */
async function rewriteGalleryUrls(
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

  await ProviderGame.updateMany({ "gallery.url": { $regex: pattern } }, [
    { $set: { gallery: galleryMap } },
  ]);

  await GamePageContent.updateMany({ "gallery.url": { $regex: pattern } }, [
    { $set: { gallery: galleryMap } },
  ]);
}

/**
 * After a rename on disk: store the new bytes under the new name, drop the old
 * branding_asset row, and rewrite every URL field that still names the old file.
 */
export async function retargetArtworkAfterOptimize(input: {
  oldFilename: string;
  newFilename: string;
  buffer: Buffer;
}): Promise<void> {
  const { oldFilename, newFilename, buffer } = input;
  if (oldFilename === newFilename) {
    // Same path — refresh the DB copy so other servers serve the lighter bytes.
    await putBrandingAsset(newFilename, buffer, "image/webp");
    return;
  }

  await putBrandingAsset(newFilename, buffer, "image/webp");
  await deleteBrandingAsset(oldFilename);

  await connectToDatabase();
  await rewriteScalarUrlFields(oldFilename, newFilename);
  await rewriteGalleryUrls(oldFilename, newFilename);
}
