/**
 * Global Rank badge art for the Overview.
 *
 * Ranks 1–20 each have a dedicated PNG under `/assets/neon/overview/ranks/{n}.png`
 * (owner assets from `ui/levels`, 29 Sep 2026). The number is baked into the art —
 * do not overlay text. Rank 21+, 0, or missing use the dash badge.
 */

export const OVERVIEW_RANK_TOP_N = 20;

export const RANK_BADGE_DASH_SRC =
  "/assets/neon/overview/rank-badge-dash.png";

export type OverviewRankBadge = {
  /** Asset to render as the badge. */
  src: string;
  /**
   * Always null — rank numbers are painted into the PNG.
   * Kept so existing callers that check overlay still compile.
   */
  overlay: string | null;
  /** True when the player is inside the top-N window. */
  inTopN: boolean;
  /** Raw rank from the Global board; 0 means unranked. */
  rank: number;
};

/** Absolute public path for a top-N rank plate. */
export function overviewRankSrc(rank: number): string {
  return `/assets/neon/overview/ranks/${rank}.png`;
}

/**
 * Pick badge art for a Global board rank.
 * Never invents a number outside 1..OVERVIEW_RANK_TOP_N.
 */
export function resolveOverviewRankBadge(
  rank: number | null | undefined,
): OverviewRankBadge {
  const n =
    typeof rank === "number" && Number.isFinite(rank) ? Math.floor(rank) : 0;
  if (n >= 1 && n <= OVERVIEW_RANK_TOP_N) {
    return {
      src: overviewRankSrc(n),
      overlay: null,
      inTopN: true,
      rank: n,
    };
  }
  return {
    src: RANK_BADGE_DASH_SRC,
    overlay: null,
    inTopN: false,
    rank: n > 0 ? n : 0,
  };
}
