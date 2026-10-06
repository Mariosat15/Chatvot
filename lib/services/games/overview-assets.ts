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

/**
 * Owner Menuitems icon set (5 Oct 2026) — genuinely transparent, trimmed to
 * the artwork and squared by `node tools/overview/import-menuitems.mjs`, so
 * every slot renders them the same size and centred with no blend trick.
 * Reason: the older black-canvas plates needed `mix-blend-screen`, which
 * washed out each tile's dark glass fill and left padding in the box.
 */
export const NEON_ICON = (slug: string) => `/assets/neon/icons/${slug}.webp`;

/** Standalone neon tiles used as KPI / Progress / Mission / Activity icons. */
export const OVERVIEW_ICON_ART = {
  progress: NEON_ICON("chart-growth-orange"),
  target: NEON_ICON("target-purple"),
  growth: NEON_ICON("growth-green"),
  trophy: NEON_ICON("trophy-green"),
  /** Recent Activity header. */
  activity: NEON_ICON("calendar-blue"),
  /** Activity rows. */
  trophyGlass: NEON_ICON("trophy-green"),
  wallet: NEON_ICON("wallet-blue"),
  chart2: NEON_ICON("chart-bars-red"),
  chart: NEON_ICON("chart-growth-orange"),
  trophyNeon: NEON_ICON("trophy-purple"),
  games: NEON_ICON("games-orange"),
  fire: NEON_ICON("fire"),
  calendarNeon: NEON_ICON("calendar-gold"),
  star: NEON_ICON("star"),
  /** Activity rows for trades and marketplace purchases. */
  tradeActivity: NEON_ICON("chart-growth-orange"),
  purchaseActivity: NEON_ICON("purchases"),
  /** Play by game header and the no-contests empty state. */
  gamepad: NEON_ICON("gamepad-blue"),
  /** Profile level chip on compete cards. */
  shield: NEON_ICON("shield"),
} as const;

/**
 * Compete chrome — icons from the Menuitems set (5 Oct 2026); avatar ring
 * and buttons are owner plates with keyed black backgrounds.
 * Buttons already carry their own label art.
 */
export const OVERVIEW_COMPETE_ART = {
  swords: NEON_ICON("swords"),
  crown: NEON_ICON("crown"),
  oneVsOne: NEON_ICON("swords"),
  level: NEON_ICON("crown"),
  score: NEON_ICON("target-purple"),
  competitions: NEON_ICON("trophy-blue"),
  avatarRing: "/assets/neon/overview/compete/avatar-ring.png",
  // Owner's high-resolution replacements (3 Oct 2026), keyed transparent by
  // tools/overview/key-out-black.mjs. New filenames so browsers drop the old art.
  matchingCards: "/assets/neon/overview/compete/btn-matching-cards-v3.png",
  challenge: "/assets/neon/overview/compete/btn-challenge-v3.png",
  viewLeaderboard: "/assets/neon/overview/compete/btn-view-leaderboard-hr.png",
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
 * Mobile Overview art — owner Menuitems set (5 Oct 2026).
 * Quick Actions / Quick Access / Wallet card all share these paths so a
 * remapped glyph cannot drift between tiles.
 */
export const MOBILE_OVERVIEW_ART = {
  deposit: NEON_ICON("deposit"),
  withdraw: NEON_ICON("withdrawal"),
  /** Compete — trophy. */
  compete: NEON_ICON("trophy-purple"),
  /** Play — games controller. */
  play: NEON_ICON("games-orange"),
  /** Wallet / Volts hero label. */
  volt: NEON_ICON("wallet-blue"),
  /** Wallet Analytics Quick Access. */
  walletChart: NEON_ICON("wallet-blue"),
  /** Performance Quick Access. */
  performance: NEON_ICON("chart-growth-orange"),
  /** Tutorials Quick Access. */
  tutorials: NEON_ICON("lightbulb"),
  /** Marketplace Quick Access. */
  marketplace: NEON_ICON("purchases"),
  star: OVERVIEW_ICON_ART.star,
  gift: NEON_ICON("gift"),
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
  star: NEON_ICON("star"),
  clock: NEON_ICON("clock-v2"),
  users: NEON_ICON("users-v2"),
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
