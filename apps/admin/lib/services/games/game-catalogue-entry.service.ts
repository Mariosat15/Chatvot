/**
 * Thin GameCatalogueEntry helpers (X11 Slice 2, option 1).
 *
 * Ensures one shop-window row per playable game without touching page content.
 * Upserts are `$setOnInsert` only — operator merchandising (featured, order, hide,
 * coming soon) must survive every sync and every list call.
 *
 * NEVER DELETE. Disabling a title leaves the row; discovery gates hide it (R29).
 *
 * MIRRORED into `apps/admin/lib/services/games/` — `check:mirrors` compares models only,
 * so a byte-identical test pins this file.
 */

import GameCatalogueEntry from "@/database/models/games/game-catalogue-entry.model";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { TRADING_GAME_TYPE } from "@/lib/games/types";

const DEFAULT_PROVIDER_SORT = 100;
const DEFAULT_TRADING_SORT = 0;

export interface CatalogueMerchandisingPatch {
  sortOrder?: number;
  isFeatured?: boolean;
  isVisible?: boolean;
  comingSoon?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface CatalogueMerchandisingResult {
  success: boolean;
  error?: string;
}

/**
 * Insert a trading catalogue row if missing.
 *
 * Idempotent. Does not read enabledGameTypes — discovery still gates on that; the row
 * existing early lets an operator set coming-soon / featured before trading is toggled.
 */
export async function ensureTradingCatalogueEntry(): Promise<void> {
  await GameCatalogueEntry.updateOne(
    { gameKey: TRADING_GAME_TYPE },
    {
      $setOnInsert: {
        slug: TRADING_GAME_TYPE,
        gameKey: TRADING_GAME_TYPE,
        gameType: "trading",
        sortOrder: DEFAULT_TRADING_SORT,
        isFeatured: false,
        isVisible: true,
        comingSoon: false,
      },
    },
    { upsert: true },
  );
}

/**
 * Insert a provider catalogue row if missing.
 *
 * Slug seeds to `gameCode` so `/games/circuit-sprint` keeps working. If that slug is
 * already taken by another gameKey, falls back to `{providerKey}-{gameCode}`.
 */
export async function ensureProviderCatalogueEntry(title: {
  providerKey: string;
  gameCode: string;
  gameKey: string;
}): Promise<void> {
  const existing = await GameCatalogueEntry.findOne({
    gameKey: title.gameKey,
  })
    .select("_id")
    .lean();
  if (existing) return;

  const preferred = title.gameCode.trim();
  if (!preferred) return;

  const slugTaken = await GameCatalogueEntry.findOne({
    slug: preferred,
    gameKey: { $ne: title.gameKey },
  })
    .select("_id")
    .lean();

  const slug = slugTaken
    ? `${title.providerKey}-${preferred}`
    : preferred;

  try {
    await GameCatalogueEntry.create({
      slug,
      gameKey: title.gameKey,
      gameType: "provider",
      providerKey: title.providerKey,
      gameCode: title.gameCode,
      sortOrder: DEFAULT_PROVIDER_SORT,
      isFeatured: false,
      isVisible: true,
      comingSoon: false,
    });
  } catch (error) {
    // Reason: concurrent ensure (sync + player list) can both pass the findOne and race
    // on the unique index. E11000 means the row exists — success, not a fault.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return;
    }
    throw error;
  }
}

/**
 * Upsert missing shop-window rows for trading and every live-enabled provider title.
 *
 * Called after catalogue sync and as a safety net from the player hub. Never deletes.
 * Never rewrites operator fields on existing rows.
 */
export async function ensureCatalogueEntries(): Promise<{
  trading: boolean;
  providers: number;
}> {
  await ensureTradingCatalogueEntry();

  const providers = await GameProvider.find({ enabled: true })
    .select("providerKey")
    .lean<{ providerKey: string }[]>();
  if (providers.length === 0) {
    return { trading: true, providers: 0 };
  }

  const enabledKeys = providers.map((p) => p.providerKey);
  const titles = await ProviderGame.find({
    providerKey: { $in: enabledKeys },
    chartvoltEnabled: true,
    providerStatus: "active",
  })
    .select("providerKey gameCode gameKey")
    .lean<{ providerKey: string; gameCode: string; gameKey: string }[]>();

  for (const title of titles) {
    await ensureProviderCatalogueEntry(title);
  }

  return { trading: true, providers: titles.length };
}

/**
 * Operator merchandising update. Refuses identity fields (slug / gameKey / gameType).
 */
export async function updateCatalogueMerchandising(
  gameKey: string,
  patch: CatalogueMerchandisingPatch,
): Promise<CatalogueMerchandisingResult> {
  const trimmed = typeof gameKey === "string" ? gameKey.trim() : "";
  if (!trimmed) {
    return { success: false, error: "Missing game key." };
  }

  const $set: Record<string, unknown> = {};

  if (patch.sortOrder !== undefined) {
    if (
      typeof patch.sortOrder !== "number" ||
      !Number.isFinite(patch.sortOrder)
    ) {
      return { success: false, error: "Sort order must be a finite number." };
    }
    $set.sortOrder = patch.sortOrder;
  }
  if (patch.isFeatured !== undefined) {
    if (typeof patch.isFeatured !== "boolean") {
      return { success: false, error: "Featured must be true or false." };
    }
    $set.isFeatured = patch.isFeatured;
  }
  if (patch.isVisible !== undefined) {
    if (typeof patch.isVisible !== "boolean") {
      return { success: false, error: "Visible must be true or false." };
    }
    $set.isVisible = patch.isVisible;
  }
  if (patch.comingSoon !== undefined) {
    if (typeof patch.comingSoon !== "boolean") {
      return { success: false, error: "Coming soon must be true or false." };
    }
    $set.comingSoon = patch.comingSoon;
  }
  if (patch.seoTitle !== undefined) {
    $set.seoTitle =
      patch.seoTitle === null || patch.seoTitle === ""
        ? undefined
        : String(patch.seoTitle).trim();
  }
  if (patch.seoDescription !== undefined) {
    $set.seoDescription =
      patch.seoDescription === null || patch.seoDescription === ""
        ? undefined
        : String(patch.seoDescription).trim();
  }

  if (Object.keys($set).length === 0) {
    return { success: false, error: "No merchandising fields to update." };
  }

  // Reason: seo clear uses $unset so we do not store empty strings as "set".
  const $unset: Record<string, "" > = {};
  if (patch.seoTitle === null || patch.seoTitle === "") {
    delete $set.seoTitle;
    $unset.seoTitle = "";
  }
  if (patch.seoDescription === null || patch.seoDescription === "") {
    delete $set.seoDescription;
    $unset.seoDescription = "";
  }

  const update: Record<string, unknown> = {};
  if (Object.keys($set).length > 0) update.$set = $set;
  if (Object.keys($unset).length > 0) update.$unset = $unset;

  const result = await GameCatalogueEntry.findOneAndUpdate(
    { gameKey: trimmed },
    update,
    { new: true },
  );

  if (!result) {
    return {
      success: false,
      error: "No catalogue entry for that game. Enable the title first.",
    };
  }

  return { success: true };
}

/** Load merchandising for admin editors; null when ensure has not run yet. */
export async function getCatalogueMerchandising(gameKey: string): Promise<{
  slug: string;
  gameKey: string;
  sortOrder: number;
  isFeatured: boolean;
  isVisible: boolean;
  comingSoon: boolean;
  seoTitle?: string;
  seoDescription?: string;
} | null> {
  const trimmed = typeof gameKey === "string" ? gameKey.trim() : "";
  if (!trimmed) return null;

  const row = await GameCatalogueEntry.findOne({ gameKey: trimmed })
    .select(
      "slug gameKey sortOrder isFeatured isVisible comingSoon seoTitle seoDescription",
    )
    .lean<{
      slug: string;
      gameKey: string;
      sortOrder: number;
      isFeatured: boolean;
      isVisible: boolean;
      comingSoon: boolean;
      seoTitle?: string;
      seoDescription?: string;
    } | null>();

  return row;
}
