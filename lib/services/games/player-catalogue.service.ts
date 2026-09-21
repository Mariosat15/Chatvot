import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { getEnabledGameTypes, TRADING_GAME_TYPE } from "@/lib/games";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import { resolveGameCategory } from "@/lib/services/games/game-categories";

/**
 * Player-facing games catalogue (X11 Slice 1).
 *
 * BUILT ON EXISTING DATA — `provider_game` presentation plus trading as a first-class card.
 * There is deliberately NO `GameCatalogueEntry` merchandising model yet: with one live
 * provider title that already has editable content fields, a second table is empty
 * overhead. Slice 2 adds that model when a second title needs independent merchandising
 * over one provider row. See `External game plans/16` BUILT note.
 *
 * MAIN-APP ONLY. `apps/admin` already owns catalogue editing through the provider Games
 * content dialog; mirroring a player reader ahead of a caller is the R42 trap.
 *
 * Discovery may call `getEnabledGameTypes()`; stats and leaderboard reads must not (R29).
 */

export type BrowsableGameKind = "trading" | "provider";

export interface BrowsableGame {
  /** URL segment under `/games/[slug]`. Trading is `"trading"`; provider titles use `gameCode`. */
  slug: string;
  /** Immutable join key for contests and stats. */
  gameKey: string;
  kind: BrowsableGameKind;
  displayName: string;
  tagline?: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  rulesSummary?: string;
  howToPlay?: string;
  /** Present on provider titles only — for empty-state challenge links. */
  providerKey?: string;
  gameCode?: string;
  supportsOneVsOne?: boolean;
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

/** The trading card — one first-party module, not a hard-coded provider title. */
const TRADING_CATALOGUE_CARD: BrowsableGame = {
  slug: TRADING_GAME_TYPE,
  gameKey: TRADING_GAME_TYPE,
  kind: "trading",
  displayName: "Trading",
  tagline: "Compete on live forex markets with virtual capital.",
  description:
    "Join timed trading contests, manage risk with simulated capital, and climb the leaderboard on real market prices.",
  category: "Trading",
  rulesSummary:
    "Rankings use your contest trading performance. Liquidation and trade-floor rules follow each contest's settings.",
  howToPlay:
    "Enter a contest, open the trading terminal when it starts, place trades within the rules, and finish with the strongest result when the clock ends.",
};

const LIVE_STATUSES = ["upcoming", "active"] as const;

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
}): BrowsableGame {
  return {
    slug: title.gameCode,
    gameKey: title.gameKey,
    kind: "provider",
    displayName: title.displayName,
    tagline: title.tagline || undefined,
    description: title.description || undefined,
    category: resolveGameCategory(title.category)?.label,
    thumbnailUrl: title.thumbnailUrl || undefined,
    bannerUrl: title.bannerUrl || undefined,
    rulesSummary: title.rulesSummary || undefined,
    howToPlay: title.howToPlay || undefined,
    providerKey: title.providerKey,
    gameCode: title.gameCode,
    supportsOneVsOne: Boolean(title.supportsOneVsOne),
  };
}

/**
 * Provider titles a player may discover — same three switches as
 * `listChallengeableTitles`, WITHOUT the 1v1-only gates, WITH a hard
 * `externalGamesEnabled` gate (player has no "draft ahead of launch" case).
 */
async function listProviderCatalogueTitles(): Promise<BrowsableGame[]> {
  const settings = await WhiteLabel.findOne()
    .select("externalGamesEnabled")
    .lean<{ externalGamesEnabled?: boolean } | null>();

  // Reason: hard gate. A card that fails on enter is worse than an absent card.
  if (!settings?.externalGamesEnabled) return [];

  const providers = await GameProvider.find({ enabled: true }).lean<
    { providerKey: string }[]
  >();
  if (providers.length === 0) return [];

  const enabledKeys = providers.map((p) => p.providerKey);
  const titles = await ProviderGame.find({
    providerKey: { $in: enabledKeys },
    chartvoltEnabled: true,
    providerStatus: "active",
  })
    .select(
      "providerKey gameCode gameKey displayName tagline description category thumbnailUrl bannerUrl rulesSummary howToPlay supportsOneVsOne",
    )
    .sort({ displayName: 1 })
    .lean();

  return titles
    .filter((title) => Boolean(getProviderAdapter(title.providerKey)))
    .map(mapProviderTitle);
}

/**
 * Every game a signed-in player may browse.
 *
 * Trading first when enabled (`getEnabledGameTypes` / invariant 5). Provider rows only when
 * the platform master switch and the three title switches allow them.
 *
 * MUST NOT enumerate game codes. Cards come from stored rows (plus the one trading module).
 */
export async function listBrowsableGames(): Promise<BrowsableGame[]> {
  await connectToDatabase();

  const enabledTypes = await getEnabledGameTypes();
  const out: BrowsableGame[] = [];

  if (enabledTypes.includes(TRADING_GAME_TYPE)) {
    out.push(TRADING_CATALOGUE_CARD);
  }

  // Reason: provider discovery is gated by externalGamesEnabled inside the helper, not by
  // whether "provider" appears in enabledGameTypes alone — a misconfigured type list must
  // not surface titles the hard gate would refuse on play.
  const providers = await listProviderCatalogueTitles();
  out.push(...providers);

  return out;
}

/**
 * Resolve `/games/[slug]` → catalogue card.
 *
 * Returns `null` for unknown or disabled slugs — never throws. Pages call `notFound()`.
 */
export async function getBrowsableGameBySlug(
  slug: string | undefined | null,
): Promise<BrowsableGame | null> {
  const trimmed = typeof slug === "string" ? slug.trim() : "";
  if (!trimmed) return null;

  await connectToDatabase();

  if (trimmed === TRADING_GAME_TYPE) {
    const enabledTypes = await getEnabledGameTypes();
    return enabledTypes.includes(TRADING_GAME_TYPE)
      ? TRADING_CATALOGUE_CARD
      : null;
  }

  // Reason: slug is gameCode (plan). Filter the already-gated list so a disabled title
  // cannot be reached by guessing its code — same answer as absent from the hub.
  const titles = await listProviderCatalogueTitles();
  return titles.find((t) => t.slug === trimmed) ?? null;
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
