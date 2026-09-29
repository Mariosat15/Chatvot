/**
 * Overview neon asset map.
 *
 * Play-card art FALLBACK only — Overview prefers `bannerUrl` / `thumbnailUrl`
 * from the catalogue (same source as `/games` cards). These keyed neon plates
 * cover titles that have no admin artwork yet. Unknown codes fall through to
 * the generic trophy. Do not enumerate games for stats here (R29).
 */

export const OVERVIEW_HERO_BANNER = "/assets/neon/overview/hero-banner.png";
export const OVERVIEW_NAV_ICONS = "/assets/neon/overview/nav-icons-strip.png";
export const OVERVIEW_KPI_ICONS = "/assets/neon/overview/kpi-icons-strip.png";
export const OVERVIEW_STREAK_ICONS =
  "/assets/neon/overview/streak-icons-strip.png";

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
  return [
    OVERVIEW_HERO_BANNER,
    OVERVIEW_NAV_ICONS,
    OVERVIEW_KPI_ICONS,
    OVERVIEW_STREAK_ICONS,
    PLAY_GENERIC,
    ...PLAY_BY_CODE.values(),
    "/assets/neon/overview/rank-badge-shell.png",
    "/assets/neon/overview/rank-badge-dash.png",
  ];
}
