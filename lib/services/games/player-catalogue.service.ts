import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import GameCatalogueEntry from "@/database/models/games/game-catalogue-entry.model";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { getEnabledGameTypes, TRADING_GAME_TYPE } from "@/lib/games";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import { resolveGameCategory } from "@/lib/services/games/game-categories";
import {
  ensureCatalogueEntries,
} from "@/lib/services/games/game-catalogue-entry.service";
import { loadTradingPageContent } from "@/lib/services/games/trading-page-content";
import { TRADING_PAGE_DEFAULTS } from "@/lib/services/games/trading-page-defaults";

/**
 * Player-facing games catalogue (X11 Slice 1 + thin merchandising Slice 2).
 *
 * Discovery reads `game_catalogue_entry` for order / featured / visible / coming-soon,
 * then merges page presentation from `provider_game` or trading `game_page_content`.
 * Content is NOT stored on the merchandising row (owner option 1, 22 Sep 2026).
 *
 * MAIN-APP ONLY for this reader. Admin edits merchandising through the workspace PATCH.
 *
 * Discovery may call `getEnabledGameTypes()`; stats and leaderboard reads must not (R29).
 */

export type BrowsableGameKind = "trading" | "provider";

export interface BrowsableGame {
  /** URL segment under `/games/[slug]` — from the catalogue entry (seeded as gameCode / trading). */
  slug: string;
  /** Immutable join key for contests and stats. */
  gameKey: string;
  kind: BrowsableGameKind;
  displayName: string;
  tagline?: string;
  description?: string;
  /** Resolved genre label for display. */
  category?: string;
  /** Vocabulary slug for discovery filtering — never free text. */
  categorySlug?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  rulesSummary?: string;
  howToPlay?: string;
  /** Present on provider titles only — for empty-state challenge links. */
  providerKey?: string;
  gameCode?: string;
  supportsOneVsOne?: boolean;
  isFeatured: boolean;
  comingSoon: boolean;
  sortOrder: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface CatalogueContestSummary {
  id: string;
  name: string;
  status: "upcoming" | "active";
  entryFee: number;
  prizePool: number;
  currentParticipants: number;
  maxParticipants: number;
  startTime: string;
  endTime: string;
}

/** Fallback when the DB read fails mid-list — same copy the store seeds from. */
const TRADING_CATALOGUE_FALLBACK: Omit<
  BrowsableGame,
  "isFeatured" | "comingSoon" | "sortOrder" | "seoTitle" | "seoDescription"
> = {
  slug: TRADING_GAME_TYPE,
  gameKey: TRADING_GAME_TYPE,
  kind: "trading",
  displayName: TRADING_PAGE_DEFAULTS.displayName,
  tagline: TRADING_PAGE_DEFAULTS.tagline,
  description: TRADING_PAGE_DEFAULTS.description,
  category: "Trading",
  categorySlug: "trading",
  rulesSummary: TRADING_PAGE_DEFAULTS.rulesSummary,
  howToPlay: TRADING_PAGE_DEFAULTS.howToPlay,
};

async function tradingContentCard(): Promise<
  Omit<
    BrowsableGame,
    "isFeatured" | "comingSoon" | "sortOrder" | "seoTitle" | "seoDescription"
  >
> {
  try {
    const content = await loadTradingPageContent();
    return {
      slug: TRADING_GAME_TYPE,
      gameKey: TRADING_GAME_TYPE,
      kind: "trading",
      displayName: content.displayName,
      tagline: content.tagline,
      description: content.description,
      // Reason: discovery filter chips key on categorySlug; without it trading never joins
      // the genre list even though category reads "Trading" (fallback path already sets both).
      category: "Trading",
      categorySlug: "trading",
      thumbnailUrl: content.thumbnailUrl,
      bannerUrl: content.bannerUrl,
      rulesSummary: content.rulesSummary,
      howToPlay: content.howToPlay,
    };
  } catch (error) {
    console.warn("⚠️ Trading page content unavailable; using defaults:", error);
    return TRADING_CATALOGUE_FALLBACK;
  }
}

function mapProviderTitle(title: {
  providerKey: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  tagline?: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  rulesSummary?: string;
  howToPlay?: string;
  supportsOneVsOne?: boolean;
}): Omit<
  BrowsableGame,
  "slug" | "isFeatured" | "comingSoon" | "sortOrder" | "seoTitle" | "seoDescription"
> {
  return {
    gameKey: title.gameKey,
    kind: "provider",
    displayName: title.displayName,
    tagline: title.tagline || undefined,
    description: title.description || undefined,
    category: resolveGameCategory(title.category)?.label,
    categorySlug: resolveGameCategory(title.category)?.slug,
    thumbnailUrl: title.thumbnailUrl || undefined,
    bannerUrl: title.bannerUrl || undefined,
    rulesSummary: title.rulesSummary || undefined,
    howToPlay: title.howToPlay || undefined,
    providerKey: title.providerKey,
    gameCode: title.gameCode,
    supportsOneVsOne: Boolean(title.supportsOneVsOne),
  };
}

const LIVE_STATUSES = ["upcoming", "active"] as const;

type EntryLean = {
  slug: string;
  gameKey: string;
  gameType: "trading" | "provider";
  providerKey?: string;
  gameCode?: string;
  sortOrder: number;
  isFeatured: boolean;
  isVisible: boolean;
  comingSoon: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

function withMerchandising(
  base: Omit<
    BrowsableGame,
    "slug" | "isFeatured" | "comingSoon" | "sortOrder" | "seoTitle" | "seoDescription"
  > & { slug?: string },
  entry: EntryLean,
): BrowsableGame {
  return {
    ...base,
    slug: entry.slug,
    isFeatured: Boolean(entry.isFeatured),
    comingSoon: Boolean(entry.comingSoon),
    sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : 100,
    seoTitle: entry.seoTitle || undefined,
    seoDescription: entry.seoDescription || undefined,
  };
}

/**
 * Provider titles that may back a catalogue card — same switches as before.
 * Does not apply merchandising visibility (that is on the entry).
 */
async function loadPlayableProviderTitles(): Promise<
  Map<
    string,
    ReturnType<typeof mapProviderTitle>
  >
> {
  const settings = await WhiteLabel.findOne()
    .select("externalGamesEnabled")
    .lean<{ externalGamesEnabled?: boolean } | null>();

  if (!settings?.externalGamesEnabled) return new Map();

  const providers = await GameProvider.find({ enabled: true }).lean<
    { providerKey: string }[]
  >();
  if (providers.length === 0) return new Map();

  const enabledKeys = providers.map((p) => p.providerKey);
  const titles = await ProviderGame.find({
    providerKey: { $in: enabledKeys },
    chartvoltEnabled: true,
    providerStatus: "active",
  })
    .select(
      "providerKey gameCode gameKey displayName tagline description category thumbnailUrl bannerUrl rulesSummary howToPlay supportsOneVsOne",
    )
    .lean();

  const map = new Map<string, ReturnType<typeof mapProviderTitle>>();
  for (const title of titles) {
    if (!getProviderAdapter(title.providerKey)) continue;
    map.set(title.gameKey, mapProviderTitle(title));
  }
  return map;
}

/**
 * Every game a signed-in player may browse.
 *
 * Reads visible catalogue entries (ensure first), merges content, gates trading via
 * enabledGameTypes and providers via the playable-title map.
 */
export async function listBrowsableGames(): Promise<BrowsableGame[]> {
  await connectToDatabase();
  await ensureCatalogueEntries();

  const enabledTypes = await getEnabledGameTypes();
  const tradingOn = enabledTypes.includes(TRADING_GAME_TYPE);
  const providerTitles = await loadPlayableProviderTitles();

  const entries = await GameCatalogueEntry.find({ isVisible: true })
    .sort({ sortOrder: 1, slug: 1 })
    .lean<EntryLean[]>();

  const out: BrowsableGame[] = [];

  for (const entry of entries) {
    if (entry.gameType === "trading") {
      if (!tradingOn) continue;
      const content = await tradingContentCard();
      out.push(withMerchandising(content, entry));
      continue;
    }

    const title = providerTitles.get(entry.gameKey);
    if (!title) continue;
    out.push(withMerchandising(title, entry));
  }

  return out;
}

/**
 * Resolve `/games/[slug]` → catalogue card.
 *
 * Returns `null` for unknown, hidden, or disabled slugs — never throws. Pages call `notFound()`.
 * Coming-soon titles still resolve (shown, not joinable).
 */
export async function getBrowsableGameBySlug(
  slug: string | undefined | null,
): Promise<BrowsableGame | null> {
  const trimmed = typeof slug === "string" ? slug.trim() : "";
  if (!trimmed) return null;

  await connectToDatabase();
  await ensureCatalogueEntries();

  const entry = await GameCatalogueEntry.findOne({ slug: trimmed }).lean<EntryLean | null>();
  if (!entry || !entry.isVisible) return null;

  if (entry.gameType === "trading") {
    const enabledTypes = await getEnabledGameTypes();
    if (!enabledTypes.includes(TRADING_GAME_TYPE)) return null;
    const content = await tradingContentCard();
    return withMerchandising(content, entry);
  }

  const providerTitles = await loadPlayableProviderTitles();
  const title = providerTitles.get(entry.gameKey);
  if (!title) return null;
  return withMerchandising(title, entry);
}

function tradingContestFilter(): Record<string, unknown> {
  // Reason: invariant 5 — absent / null / "" gameKey resolves to trading. Match all three
  // missing shapes plus the stored label so pre-X1 and raw-driver rows stay visible here.
  return {
    status: { $in: [...LIVE_STATUSES] },
    $or: [
      { gameKey: TRADING_GAME_TYPE },
      { gameKey: { $exists: false } },
      { gameKey: null },
      { gameKey: "" },
    ],
  };
}

function providerContestFilter(gameKey: string): Record<string, unknown> {
  return {
    status: { $in: [...LIVE_STATUSES] },
    gameKey,
  };
}

/**
 * Live and upcoming contests for one catalogue game.
 *
 * Never invents zeros for an empty board — returns `[]`. Does not call
 * `getEnabledGameTypes()` (R29): a contest still running after a title is toggled off stays
 * listed so players already entered can find the lobby.
 */
export async function listContestsForGame(
  gameKey: string,
): Promise<CatalogueContestSummary[]> {
  const trimmed = gameKey?.trim();
  if (!trimmed) return [];

  await connectToDatabase();

  const query =
    trimmed === TRADING_GAME_TYPE
      ? tradingContestFilter()
      : providerContestFilter(trimmed);

  const rows = await Competition.find(query)
    .select(
      "name status entryFee prizePool currentParticipants maxParticipants startTime endTime gameType gameKey providerKey currentParticipants",
    )
    .sort({ startTime: 1 })
    .limit(50)
    .lean<
      {
        _id: { toString(): string };
        name: string;
        status: string;
        entryFee?: number;
        prizePool?: number;
        currentParticipants?: number;
        maxParticipants?: number;
        startTime: Date;
        endTime: Date;
        gameType?: string;
        gameKey?: string;
        providerKey?: string;
      }[]
    >();

  // Reason: same hub rule as `getCompetitions` — hide empty upcoming provider contests while
  // that provider is blocking entry, so the game page does not advertise a seat nobody can take.
  const { listProvidersBlockingEntries, shouldHideUpcomingEmptyDuringOutage } =
    await import("@/lib/services/game-providers/provider-entry-gate");
  const blocking = await listProvidersBlockingEntries();
  const visible = rows.filter(
    (c) => !shouldHideUpcomingEmptyDuringOutage(c as never, blocking),
  );

  return visible.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    status: c.status === "active" ? "active" : "upcoming",
    entryFee: typeof c.entryFee === "number" ? c.entryFee : 0,
    prizePool: typeof c.prizePool === "number" ? c.prizePool : 0,
    currentParticipants:
      typeof c.currentParticipants === "number" ? c.currentParticipants : 0,
    maxParticipants:
      typeof c.maxParticipants === "number" ? c.maxParticipants : 0,
    startTime: new Date(c.startTime).toISOString(),
    endTime: new Date(c.endTime).toISOString(),
  }));
}
