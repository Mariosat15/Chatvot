/**
 * Overview neon asset map.
 *
 * Play-card art FALLBACK only — Overview prefers `bannerUrl` / `thumbnailUrl`
 * from the catalogue (same source as `/games` cards). These keyed neon plates
 * cover titles that have no admin artwork yet. Unknown codes fall through to
 * the generic trophy. Do not enumerate games for stats here (R29).
 *
 * KPI / streak icons are owner plates from `ui/items` (29 Sep 2026 polish).
 */

import { overviewRankSrc, OVERVIEW_RANK_TOP_N } from "@/lib/utils/overview-rank-badge";

export const OVERVIEW_HERO_BANNER = "/assets/neon/overview/hero-banner.png";
export const OVERVIEW_NAV_ICONS = "/assets/neon/overview/nav-icons-strip.png";
export const OVERVIEW_KPI_ICONS = "/assets/neon/overview/kpi-icons-strip.png";
export const OVERVIEW_STREAK_ICONS =
  "/assets/neon/overview/streak-icons-strip.png";

/** KPI plate art matching image 9 (credits / win rate / ROI / prizes). */
export const OVERVIEW_KPI_ART = {
  credits: "/assets/neon/overview/items/kpi-credits.png",
  winRate: "/assets/neon/overview/items/kpi-winrate.png",
  roi: "/assets/neon/overview/items/kpi-roi.png",
  prizes: "/assets/neon/overview/items/kpi-prizes.png",
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
  return [
    OVERVIEW_HERO_BANNER,
    OVERVIEW_NAV_ICONS,
    OVERVIEW_KPI_ICONS,
    OVERVIEW_STREAK_ICONS,
    PLAY_GENERIC,
    ...PLAY_BY_CODE.values(),
    "/assets/neon/overview/rank-badge-dash.png",
    ...Object.values(OVERVIEW_KPI_ART),
    ...Object.values(OVERVIEW_STREAK_ART),
    ...ranks,
  ];
}
