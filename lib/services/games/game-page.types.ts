/**
 * Player `/games/[slug]` page payload shape (`External game plans/game_page.md` §7 + extensions).
 *
 * MODEL-FREE. Types only — safe for client components that receive the aggregated payload.
 * The aggregator that builds this lives in `game-page.service.ts` (main-app only).
 */

import type { GamePageTheme } from "./game-page-themes";

export interface GamePageHighlight {
  title: string;
  description: string;
}

export interface GamePageBannerFeature {
  title: string;
  icon?: string;
}

export interface GamePageGalleryItem {
  id: string;
  url: string;
  type?: string;
  title?: string;
}

export interface GamePageHowItWorksStep {
  title: string;
  detail: string;
  icon?: string;
}

export interface GamePageFormats {
  competition: boolean;
  challenge: boolean;
  practice: boolean;
}

export interface GamePageSupportedDevices {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
}

export interface GamePagePrizeEligibility {
  zeroScoreEligible: boolean;
  minimumScore?: number;
  scoreUnit?: string;
}

export interface GamePageProviderRef {
  providerId?: string;
  providerGameId?: string;
  syncStatus?: string;
}

/** Live / upcoming contest card on the game page (matches catalogue summary). */
export interface GamePageContestSummary {
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

/** Alias used by client helpers — same row as `GamePageContestSummary`. */
export type GamePageContest = GamePageContestSummary;

/**
 * One clean payload for the rebuilt game detail page.
 *
 * `bannerFeatures` is the plan name for stored `heroFeatures` (icon + label → icon + title).
 * `heroFeatures` is kept as an alias so arena-shaped consumers stay readable.
 */
export interface GamePageData {
  id: string;
  slug: string;
  gameKey: string;
  kind: "trading" | "provider";

  title: string;
  tagline?: string;
  genre?: string;
  /** Category slug used for theme fallback (never a display label). */
  categorySlug?: string;
  description?: string;

  rulesSummary?: string;
  /** Split lines from the stored how-to-play string. */
  howToPlay?: string[];

  logoUrl?: string;
  bannerUrl?: string;

  howItWorksImageUrl?: string;
  gameTipsImageUrl?: string;

  highlights?: GamePageHighlight[];

  bannerFeatures?: GamePageBannerFeature[];
  /** Alias of `bannerFeatures` using the stored field name. */
  heroFeatures?: GamePageBannerFeature[];

  pageThemeId?: string;
  /** Resolved theme for CSS vars — always present after aggregation. */
  theme: GamePageTheme;

  stylizedQuote?: string;
  /** Always an array after aggregation — empty means no Featured strip. */
  gallery: GamePageGalleryItem[];
  supportedDevices?: GamePageSupportedDevices;
  skillLevelLabel?: string;
  gameplayPreviewUrl?: string;
  gameplayVideoUrl?: string;
  /** Always an array after aggregation — empty shows the how-to placeholder. */
  howItWorksSteps: GamePageHowItWorksStep[];
  /** Always an array after aggregation — empty hides the tag row. */
  descriptionTags: string[];

  typicalDurationSeconds?: number;
  maxDurationSeconds?: number;

  formats: GamePageFormats;

  playStyle?: string;

  minPlayers?: number;
  maxPlayers?: number;

  status: "active" | "inactive" | "deprecated";

  prizeEligibility?: GamePagePrizeEligibility;

  provider?: GamePageProviderRef;

  gameSettings?: Record<string, unknown>;

  joinableContests: GamePageContestSummary[];
}
