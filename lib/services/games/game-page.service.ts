/**
 * Aggregates everything the player `/games/[slug]` page needs in one payload.
 *
 * MAIN-APP ONLY. Admin edits catalogue content through the provider Games dialog; mirroring
 * a player reader ahead of an admin caller is the R42 trap.
 *
 * Discovery is gated by `getBrowsableGameBySlug` (which may call `getEnabledGameTypes`).
 * Reason: this service MUST NOT call `getEnabledGameTypes` for stats or contest listing
 * (R29) — `listContestsForGame` already follows that rule.
 */

import ProviderGame from "@/database/models/games/provider-game.model";
import { TRADING_GAME_TYPE } from "@/lib/games";
import { resolveGameCategory } from "@/lib/services/games/game-categories";
import { resolveGamePageTheme } from "@/lib/services/games/game-page-themes";
import type {
  GamePageBannerFeature,
  GamePageContestSummary,
  GamePageData,
  GamePageGalleryItem,
  GamePageHowItWorksStep,
} from "@/lib/services/games/game-page.types";
import {
  getBrowsableGameBySlug,
  listContestsForGame,
  type BrowsableGame,
} from "@/lib/services/games/player-catalogue.service";

/** Matches `TRADING_CATALOGUE_CARD` in player-catalogue — kept local so that card stays private. */
const TRADING_PAGE_COPY = {
  displayName: "Trading",
  tagline: "Compete on live forex markets with virtual capital.",
  description:
    "Join timed trading contests, manage risk with simulated capital, and climb the leaderboard on real market prices.",
  category: "trading",
  rulesSummary:
    "Rankings use your contest trading performance. Liquidation and trade-floor rules follow each contest's settings.",
  howToPlay:
    "Enter a contest, open the trading terminal when it starts, place trades within the rules, and finish with the strongest result when the clock ends.",
} as const;

const PROVIDER_PAGE_SELECT = [
  "providerKey",
  "gameCode",
  "gameKey",
  "displayName",
  "tagline",
  "description",
  "category",
  "thumbnailUrl",
  "bannerUrl",
  "rulesSummary",
  "howToPlay",
  "highlights",
  "howToPlayImageUrl",
  "highlightsImageUrl",
  "heroFeatures",
  "supportsCompetition",
  "supportsOneVsOne",
  "supportsPractice",
  "typicalDurationSeconds",
  "maxDurationSeconds",
  "zeroIsValidResult",
  "minimumEligibleScore",
  "scoreUnit",
  "pageThemeId",
  "stylizedQuote",
  "gallery",
  "supportedDevices",
  "skillLevelLabel",
  "gameplayPreviewUrl",
  "gameplayVideoUrl",
  "howItWorksSteps",
  "descriptionTags",
  "playMode",
  "playModeOverride",
  "providerStatus",
  "chartvoltEnabled",
  "configSchema",
  "challengeDefaults",
  "family",
].join(" ");

type ProviderPageLean = {
  _id: { toString(): string };
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
  highlights?: { title: string; detail: string }[];
  howToPlayImageUrl?: string;
  highlightsImageUrl?: string;
  heroFeatures?: { icon: string; label: string }[];
  supportsCompetition?: boolean;
  supportsOneVsOne?: boolean;
  supportsPractice?: boolean;
  typicalDurationSeconds?: number;
  maxDurationSeconds?: number;
  zeroIsValidResult?: boolean;
  minimumEligibleScore?: number;
  scoreUnit?: string;
  pageThemeId?: string;
  stylizedQuote?: string;
  gallery?: { url: string; title?: string; type?: string }[];
  supportedDevices?: {
    desktop?: boolean;
    tablet?: boolean;
    mobile?: boolean;
  };
  skillLevelLabel?: string;
  gameplayPreviewUrl?: string;
  gameplayVideoUrl?: string;
  howItWorksSteps?: { title: string; detail: string; icon?: string }[];
  descriptionTags?: string[];
  playMode?: string;
  playModeOverride?: string;
  providerStatus?: string;
  chartvoltEnabled?: boolean;
  configSchema?: Record<string, unknown>;
  challengeDefaults?: Record<string, unknown>;
  family?: string;
};

const DEFAULT_DEVICES = {
  desktop: true,
  tablet: true,
  mobile: true,
} as const;

function splitHowToPlay(raw?: string | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function mapHeroFeatures(
  rows?: { icon: string; label: string }[] | null,
): GamePageBannerFeature[] | undefined {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  return rows.map((row) => ({
    title: row.label,
    icon: row.icon || undefined,
  }));
}

function mapHighlights(
  rows?: { title: string; detail: string }[] | null,
): GamePageData["highlights"] {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  return rows.map((row) => ({
    title: row.title,
    description: row.detail,
  }));
}

function mapGallery(
  rows?: { url: string; title?: string; type?: string }[] | null,
): GamePageGalleryItem[] {
  // Reason: always an array — Overview calls `.slice` and an undefined gallery crashes
  // the whole page with no empty-state path (production 21 Sep 2026).
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows
    .filter((row) => typeof row.url === "string" && row.url.trim() !== "")
    .map((row, index) => ({
      id: `gallery-${index}`,
      url: row.url.trim(),
      type: row.type || undefined,
      title: row.title || undefined,
    }));
}

function resolveDevices(
  stored?: { desktop?: boolean; tablet?: boolean; mobile?: boolean } | null,
): GamePageData["supportedDevices"] {
  // Reason: absent means all three on — same reading as playModeOverride / empty allowedGameTypes.
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_DEVICES };
  }
  return {
    desktop: stored.desktop !== false,
    tablet: stored.tablet !== false,
    mobile: stored.mobile !== false,
  };
}

/**
 * Derive How It Works steps from how-to-play lines when the operator has not authored any.
 * First three non-empty lines; title = short leading phrase or "Step N".
 */
export function deriveHowItWorksSteps(
  howToPlayLines: string[] | null | undefined,
): GamePageHowItWorksStep[] {
  // Reason: callers must survive absent howToPlay — `.filter` on undefined is the
  // same crash class as gallery.slice (production 21 Sep 2026).
  const source = Array.isArray(howToPlayLines) ? howToPlayLines : [];
  const lines = source.filter((line) => line.trim() !== "").slice(0, 3);
  if (lines.length === 0) return [];

  return lines.map((line, index) => {
    const trimmed = line.trim();
    // Reason: a leading "Connect — …" or "Connect: …" is a natural step title.
    const sep = trimmed.search(/[:—–-]/);
    if (sep > 0 && sep <= 40) {
      const title = trimmed.slice(0, sep).trim();
      const detail = trimmed.slice(sep + 1).trim();
      if (title && detail) {
        return { title, detail };
      }
    }
    return {
      title: `Step ${index + 1}`,
      detail: trimmed,
    };
  });
}

function deriveDescriptionTags(
  authored?: string[] | null,
  highlights?: { title: string; description: string }[] | null,
): string[] {
  if (Array.isArray(authored) && authored.length > 0) {
    const cleaned = authored
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter((tag) => tag !== "");
    return cleaned;
  }
  if (!Array.isArray(highlights) || highlights.length === 0) return [];
  return highlights
    .map((h) => h.title?.trim())
    .filter((t): t is string => Boolean(t));
}

function mapStatus(
  providerStatus?: string,
  chartvoltEnabled?: boolean,
): GamePageData["status"] {
  if (chartvoltEnabled === false) return "inactive";
  if (providerStatus === "deprecated") return "deprecated";
  if (providerStatus === "maintenance") return "inactive";
  return "active";
}

function buildTradingPage(
  card: BrowsableGame,
  contests: GamePageContestSummary[],
): GamePageData {
  const howToPlay = splitHowToPlay(TRADING_PAGE_COPY.howToPlay);
  const theme = resolveGamePageTheme("trading-forge", "trading");

  return {
    id: TRADING_GAME_TYPE,
    slug: card.slug,
    gameKey: card.gameKey,
    kind: "trading",
    title: TRADING_PAGE_COPY.displayName,
    tagline: TRADING_PAGE_COPY.tagline,
    genre: "Trading",
    categorySlug: "trading",
    description: TRADING_PAGE_COPY.description,
    rulesSummary: TRADING_PAGE_COPY.rulesSummary,
    howToPlay,
    howItWorksSteps: deriveHowItWorksSteps(howToPlay),
    pageThemeId: "trading-forge",
    theme,
    gallery: [],
    descriptionTags: [],
    supportedDevices: { ...DEFAULT_DEVICES },
    formats: {
      competition: true,
      challenge: true,
      // Reason: trading has no free practice mode in the catalogue sense.
      practice: false,
    },
    status: "active",
    joinableContests: contests,
  };
}

function buildProviderPage(
  card: BrowsableGame,
  title: ProviderPageLean,
  contests: GamePageContestSummary[],
): GamePageData {
  const category = resolveGameCategory(title.category);
  const howToPlayLines = splitHowToPlay(title.howToPlay ?? card.howToPlay);
  const highlights = mapHighlights(title.highlights);
  const bannerFeatures = mapHeroFeatures(title.heroFeatures);
  const authoredSteps = Array.isArray(title.howItWorksSteps)
    ? title.howItWorksSteps
        .filter(
          (s) =>
            typeof s?.title === "string" &&
            s.title.trim() !== "" &&
            typeof s?.detail === "string" &&
            s.detail.trim() !== "",
        )
        .map((s) => ({
          title: s.title.trim(),
          detail: s.detail.trim(),
          icon: s.icon || undefined,
        }))
    : [];

  const howItWorksSteps =
    authoredSteps.length > 0
      ? authoredSteps
      : deriveHowItWorksSteps(howToPlayLines);

  const theme = resolveGamePageTheme(
    title.pageThemeId,
    category?.slug ?? undefined,
  );

  const playStyle =
    typeof title.playModeOverride === "string" && title.playModeOverride.trim()
      ? title.playModeOverride.trim()
      : typeof title.playMode === "string" && title.playMode.trim()
        ? title.playMode.trim()
        : undefined;

  return {
    id: title._id.toString(),
    slug: card.slug,
    gameKey: title.gameKey,
    kind: "provider",
    title: title.displayName || card.displayName,
    tagline: title.tagline || card.tagline,
    genre: category?.label ?? card.category,
    categorySlug: category?.slug,
    description: title.description || card.description,
    rulesSummary: title.rulesSummary || card.rulesSummary,
    howToPlay: howToPlayLines.length > 0 ? howToPlayLines : undefined,
    logoUrl: title.thumbnailUrl || card.thumbnailUrl,
    bannerUrl: title.bannerUrl || card.bannerUrl,
    howItWorksImageUrl: title.howToPlayImageUrl || undefined,
    gameTipsImageUrl: title.highlightsImageUrl || undefined,
    highlights,
    bannerFeatures,
    heroFeatures: bannerFeatures,
    pageThemeId: title.pageThemeId || undefined,
    theme,
    stylizedQuote: title.stylizedQuote?.trim() || undefined,
    gallery: mapGallery(title.gallery),
    supportedDevices: resolveDevices(title.supportedDevices),
    skillLevelLabel: title.skillLevelLabel?.trim() || undefined,
    gameplayPreviewUrl: title.gameplayPreviewUrl?.trim() || undefined,
    gameplayVideoUrl: title.gameplayVideoUrl?.trim() || undefined,
    howItWorksSteps,
    descriptionTags: deriveDescriptionTags(title.descriptionTags, highlights),
    typicalDurationSeconds: Number.isFinite(title.typicalDurationSeconds)
      ? title.typicalDurationSeconds
      : undefined,
    maxDurationSeconds: Number.isFinite(title.maxDurationSeconds)
      ? title.maxDurationSeconds
      : undefined,
    formats: {
      competition: Boolean(title.supportsCompetition),
      challenge: Boolean(title.supportsOneVsOne),
      practice: Boolean(title.supportsPractice),
    },
    playStyle,
    status: mapStatus(title.providerStatus, title.chartvoltEnabled),
    prizeEligibility: {
      zeroScoreEligible: title.zeroIsValidResult === true,
      minimumScore: Number.isFinite(title.minimumEligibleScore)
        ? title.minimumEligibleScore
        : undefined,
      scoreUnit: title.scoreUnit || undefined,
    },
    provider: {
      providerId: title.providerKey,
      providerGameId: title.gameCode,
      syncStatus: title.providerStatus,
    },
    gameSettings:
      title.configSchema && typeof title.configSchema === "object"
        ? title.configSchema
        : title.challengeDefaults && typeof title.challengeDefaults === "object"
          ? title.challengeDefaults
          : undefined,
    joinableContests: contests,
  };
}

/**
 * Resolve `/games/[slug]` into one page payload, or `null` so the route can `notFound()`.
 */
export async function getGamePageData(
  slug: string,
): Promise<GamePageData | null> {
  const card = await getBrowsableGameBySlug(slug);
  if (!card) return null;

  const contests = await listContestsForGame(card.gameKey);

  if (card.kind === "trading" || card.slug === TRADING_GAME_TYPE) {
    return buildTradingPage(card, contests);
  }

  const title = await ProviderGame.findOne({ gameKey: card.gameKey })
    .select(PROVIDER_PAGE_SELECT)
    .lean<ProviderPageLean | null>();

  // Reason: discovery already gated the card; a missing lean row is a sync race — refuse
  // rather than render a half-empty page that looks like missing admin content.
  if (!title) return null;

  return buildProviderPage(card, title, contests);
}
