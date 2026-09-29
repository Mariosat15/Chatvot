/**
 * Overview neon asset map.
 *
 * Play-card art FALLBACK only — Overview prefers `bannerUrl` / `thumbnailUrl`
 * from the catalogue (same source as `/games` cards). These keyed neon plates
 * cover titles that have no admin artwork yet. Unknown codes fall through to
 * the generic trophy. Do not enumerate games for stats here (R29).
 *
 * KPI / Progress / Mission icons are owner neon tiles from `ui/items`
 * (29 Sep 2026). Global Rank plates live under `ranks/` (from `ui/Rank`).
 * Level plates are stored under `levels/` (from `ui/levels`) for later screens
 * — Overview must not use them for Global Rank.
 */

import { overviewRankSrc, OVERVIEW_RANK_TOP_N } from "@/lib/utils/overview-rank-badge";

export const OVERVIEW_HERO_BANNER =
  "/assets/neon/overview/hero-banner-elements.jpg";
/** Page-wide Overview backdrop (owner mountain plate, 29 Sep 2026). */
export const OVERVIEW_BACKDROP = "/assets/neon/overview/overview-backdrop.jpg";
export const OVERVIEW_NAV_ICONS = "/assets/neon/overview/nav-icons-strip.png";
export const OVERVIEW_KPI_ICONS = "/assets/neon/overview/kpi-icons-strip.png";
export const OVERVIEW_STREAK_ICONS =
  "/assets/neon/overview/streak-icons-strip.png";

/** Standalone neon tiles used as KPI / Progress / Mission / Activity icons. */
export const OVERVIEW_ICON_ART = {
  progress: "/assets/neon/overview/items/icon-progress.png",
  target: "/assets/neon/overview/items/icon-target.png",
  growth: "/assets/neon/overview/items/icon-growth.png",
  trophy: "/assets/neon/overview/items/icon-trophy.png",
  /** Calendar glass tile — Recent Activity header (transparent, 29 Sep 2026). */
  activity: "/assets/neon/overview/items/icon-activity-calendar.png",
  /** Neon glass trophy for activity rows (transparent, 29 Sep 2026). */
  trophyGlass: "/assets/neon/overview/items/icon-trophy-glass.png",
} as const;

/**
 * Compete chrome — owner plates with keyed black backgrounds.
 * Buttons already carry their own label art.
 */
export const OVERVIEW_COMPETE_ART = {
  swords: "/assets/neon/overview/compete/icon-swords.png",
  crown: "/assets/neon/overview/compete/icon-crown.png",
  oneVsOne: "/assets/neon/overview/compete/icon-1v1-badge.png",
  level: "/assets/neon/overview/compete/icon-level-crown.png",
  score: "/assets/neon/overview/compete/icon-score-target.png",
  competitions: "/assets/neon/overview/compete/icon-competitions-trophy.png",
  avatarRing: "/assets/neon/overview/compete/avatar-ring.png",
  matchingCards: "/assets/neon/overview/compete/btn-matching-cards.png",
  challenge: "/assets/neon/overview/compete/btn-challenge.png",
  viewLeaderboard: "/assets/neon/overview/compete/btn-view-leaderboard.png",
} as const;

/** KPI plate art — credits / win rate / ROI / prizes. */
export const OVERVIEW_KPI_ART = {
  credits: OVERVIEW_ICON_ART.progress,
  winRate: OVERVIEW_ICON_ART.target,
  roi: OVERVIEW_ICON_ART.growth,
  prizes: OVERVIEW_ICON_ART.trophy,
} as const;

/** Streak tile icons — contest-shaped labels, game art (image 7). */
export const OVERVIEW_STREAK_ART = {
  podiumStreak: "/assets/neon/overview/items/streak-flame.png",
  bestStreak: "/assets/neon/overview/items/streak-calendar.png",
  contestWins: "/assets/neon/overview/items/streak-trend.png",
  contestsPlayed: "/assets/neon/overview/items/streak-days.png",
  topThreeFinishes: "/assets/neon/overview/items/streak-trophy.png",
  weeksActive: "/assets/neon/overview/items/streak-bars.png",
} as const;

/**
 * Desktop Header chrome — owner `ui/match/uper` (29 Sep 2026).
 * `frame` is the shared HUD shell the desktop strip renders inside.
 * Per-tab plates stay on disk for art reference; the live Header does not
 * mount five floating plates (owner rejected that reading the same day).
 * Phones keep Lucide pills — a full neon frame at phone width is too busy.
 */
export const OVERVIEW_NAV_TAB_ART = {
  overview: "/assets/neon/overview/nav/tab-overview.png",
  wallet: "/assets/neon/overview/nav/tab-wallet.png",
  performance: "/assets/neon/overview/nav/tab-performance.png",
  contests: "/assets/neon/overview/nav/tab-competitions.png",
  tutorials: "/assets/neon/overview/nav/tab-tutorials.png",
  /** Shared outer frame — the only plate the desktop Header mounts. */
  frame: "/assets/neon/overview/nav/nav-frame.png",
} as const;

/**
 * Mobile Overview art — owner `menu items/ui/wallet items` tiles (29 Sep 2026),
 * downsized to webp. Phones only; desktop keeps the plates above.
 */
export const MOBILE_OVERVIEW_ART = {
  deposit: "/assets/neon/overview/mobile/action-deposit.webp",
  withdraw: "/assets/neon/overview/mobile/action-withdraw.webp",
  compete: "/assets/neon/overview/mobile/action-compete.webp",
  play: "/assets/neon/overview/mobile/action-play.webp",
  volt: "/assets/neon/overview/mobile/icon-volt.webp",
  walletChart: "/assets/neon/overview/mobile/wallet-chart.webp",
  star: "/assets/neon/overview/mobile/icon-star.webp",
  gift: "/assets/neon/overview/mobile/icon-gift.webp",
} as const;

const PLAY_GENERIC = "/assets/neon/overview/play-generic.png";

const PLAY_BY_CODE = new Map<string, string>([
  ["trading", "/assets/neon/overview/play-trading.png"],
  ["circuit-sprint", "/assets/neon/overview/play-circuit-sprint.png"],
  ["volt-velocity", "/assets/neon/overview/play-volt-velocity.png"],
  ["volt-stack", "/assets/neon/overview/play-volt-stack.png"],
]);

/** Card background for a playable title. Unknown codes get the generic trophy. */
export function overviewPlayCardArt(
  gameCode?: string | null,
  isTrading?: boolean,
): string {
  if (isTrading) return PLAY_BY_CODE.get("trading") ?? PLAY_GENERIC;
  if (!gameCode) return PLAY_GENERIC;
  return PLAY_BY_CODE.get(gameCode) ?? PLAY_GENERIC;
}

/** Every overview asset a test can assert exists on disk. */
export function allOverviewAssets(): string[] {
  const ranks = Array.from({ length: OVERVIEW_RANK_TOP_N }, (_, i) =>
    overviewRankSrc(i + 1),
  );
  const levels = Array.from({ length: OVERVIEW_RANK_TOP_N }, (_, i) =>
    `/assets/neon/overview/levels/${i + 1}.png`,
  );
  return [
    OVERVIEW_HERO_BANNER,
    OVERVIEW_BACKDROP,
    OVERVIEW_NAV_ICONS,
    OVERVIEW_KPI_ICONS,
    OVERVIEW_STREAK_ICONS,
    PLAY_GENERIC,
    ...PLAY_BY_CODE.values(),
    "/assets/neon/overview/rank-badge-dash.png",
    ...Object.values(OVERVIEW_ICON_ART),
    ...Object.values(OVERVIEW_KPI_ART),
    ...Object.values(OVERVIEW_STREAK_ART),
    ...Object.values(OVERVIEW_COMPETE_ART),
    ...Object.values(OVERVIEW_NAV_TAB_ART),
    ...Object.values(MOBILE_OVERVIEW_ART),
    ...ranks,
    ...levels,
  ];
}
