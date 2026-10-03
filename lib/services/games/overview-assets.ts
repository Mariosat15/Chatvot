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
  /**
   * Owner neon plates (3 Oct 2026) — black export canvases; knock out with
   * `mix-blend-screen` at the call site (same as Suggested badge plates).
   */
  wallet: "/assets/neon/overview/items/icon-wallet.jpg",
  chart2: "/assets/neon/overview/items/icon-chart-2.png",
  chart: "/assets/neon/overview/items/icon-chart.jpg",
  trophyNeon: "/assets/neon/overview/items/icon-trophy-neon.jpg",
  games: "/assets/neon/overview/items/icon-games.jpg",
  fire: "/assets/neon/overview/items/icon-fire.jpg",
  calendarNeon: "/assets/neon/overview/items/icon-calendar-neon.png",
  star: "/assets/neon/overview/items/icon-star.jpg",
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

/** KPI plate art — wallet / chart2 / chart / trophy (owner 3 Oct 2026). */
export const OVERVIEW_KPI_ART = {
  credits: OVERVIEW_ICON_ART.wallet,
  winRate: OVERVIEW_ICON_ART.chart2,
  roi: OVERVIEW_ICON_ART.chart,
  prizes: OVERVIEW_ICON_ART.trophyNeon,
} as const;

/**
 * Streak tile icons — contest-shaped labels (owner 3 Oct 2026).
 * Header uses `OVERVIEW_ICON_ART.fire` separately.
 */
export const OVERVIEW_STREAK_ART = {
  podiumStreak: OVERVIEW_ICON_ART.fire,
  bestStreak: OVERVIEW_ICON_ART.trophyNeon,
  contestWins: OVERVIEW_ICON_ART.chart2,
  contestsPlayed: OVERVIEW_ICON_ART.games,
  topThreeFinishes: OVERVIEW_ICON_ART.chart,
  weeksActive: OVERVIEW_ICON_ART.calendarNeon,
} as const;

/**
 * Owner `ui/match/uper` HUD plates (29 Sep 2026) — kept on disk for reference.
 * The live Header does **not** mount these: owner rejected both five floating
 * plates and the shared-frame reading, and asked to keep the Lucide gold-pill
 * strip. Still listed in the asset inventory so a missing file fails the suite.
 */
export const OVERVIEW_NAV_TAB_ART = {
  overview: "/assets/neon/overview/nav/tab-overview.png",
  wallet: "/assets/neon/overview/nav/tab-wallet.png",
  performance: "/assets/neon/overview/nav/tab-performance.png",
  contests: "/assets/neon/overview/nav/tab-competitions.png",
  tutorials: "/assets/neon/overview/nav/tab-tutorials.png",
  frame: "/assets/neon/overview/nav/nav-frame.png",
} as const;

/**
 * Mobile Overview art — owner neon plates (3 Oct 2026).
 * Quick Actions / Quick Access / Wallet card all share these paths so a
 * remapped glyph cannot drift between tiles. Black canvases knock out with
 * `mix-blend-screen` at the call site.
 */
export const MOBILE_OVERVIEW_ART = {
  deposit: "/assets/neon/wallet/icon-deposit.jpg",
  withdraw: "/assets/neon/wallet/icon-withdrawal.jpg",
  /** Compete — trophy plate (replaces old compete.webp). */
  compete: "/assets/neon/wallet/icon-trophy.jpg",
  /** Play — games controller plate. */
  play: "/assets/neon/wallet/icon-games.jpg",
  /** Wallet / Volts hero label. */
  volt: "/assets/neon/wallet/icon-wallet.jpg",
  /** Wallet Analytics Quick Access. */
  walletChart: "/assets/neon/wallet/icon-wallet.jpg",
  /** Performance Quick Access. */
  performance: "/assets/neon/wallet/icon-chart.jpg",
  /** Tutorials Quick Access. */
  tutorials: "/assets/neon/overview/items/icon-lamp.jpg",
  /** Marketplace Quick Access. */
  marketplace: "/assets/neon/wallet/icon-purchases.jpg",
  star: OVERVIEW_ICON_ART.star,
  gift: "/assets/neon/wallet/icon-gift.jpg",
} as const;

/**
 * Suggested-for-you art (owner Image 2 target, 3 Oct 2026; high-resolution
 * replacements supplied by the owner the same day).
 * Every file here is a genuinely TRANSPARENT PNG cropped to its artwork,
 * produced by `node tools/overview/key-out-black.mjs` from the black-canvas
 * originals beside them. Reason: `mix-blend-screen` only hid the black over a
 * dark page and kept the padding in the layout box, so badges rendered tiny and
 * plates showed black edges - the owner rejected both. The `-hr` files are kept
 * at full source resolution and rendered `unoptimized`, so the browser only
 * ever scales them DOWN: re-encoding them at the ~95px layout width is what made
 * the previous badges look blurred.
 */
export const SUGGESTED_PRIZE_ART = {
  /** Trophy left of the prize amount. The decorative right-hand art was removed. */
  icon: "/assets/neon/overview/suggested/prize-icon-hr.png",
} as const;

export const SUGGESTED_UI_ART = {
  /** Section header star. */
  star: "/assets/neon/overview/suggested/icon-star-clear.png",
  clock: "/assets/neon/overview/suggested/icon-clock-clear.png",
  users: "/assets/neon/overview/suggested/icon-users-clear.png",
  badgeGmFunded: "/assets/neon/overview/suggested/badge-gm-hr.png",
  badgePrivate: "/assets/neon/overview/suggested/badge-private-hr.png",
  badgePublic: "/assets/neon/overview/suggested/badge-public-hr.png",
  /** Full-width Join button. Decorative: the label is supplied by `alt`. */
  join: "/assets/neon/overview/suggested/btn-join-hr.png",
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
    ...Object.values(SUGGESTED_PRIZE_ART),
    ...Object.values(SUGGESTED_UI_ART),
    ...ranks,
    ...levels,
  ];
}
