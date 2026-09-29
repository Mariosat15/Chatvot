/**
 * Global Rank badge art for the Overview.
 *
 * Ranks 1–20 use one shell asset with the number overlaid in the UI.
 * Rank 21+, 0, or missing use the dash badge. Baking twenty near-identical
 * WebPs would drift the first time any one is regenerated — one shell is the
 * maintainable form of "recreate the first 20".
 */

export const OVERVIEW_RANK_TOP_N = 20;

export const RANK_BADGE_SHELL_SRC =
  "/assets/neon/overview/rank-badge-shell.png";
export const RANK_BADGE_DASH_SRC =
  "/assets/neon/overview/rank-badge-dash.png";

export type OverviewRankBadge = {
  /** Asset to render behind / as the badge. */
  src: string;
  /** When set, draw this label in the hexagon centre (e.g. "#3"). */
  overlay: string | null;
  /** True when the player is inside the top-N window. */
  inTopN: boolean;
  /** Raw rank from the Global board; 0 means unranked. */
  rank: number;
};

/**
 * Pick badge art for a Global board rank.
 * Never invents a number outside 1..OVERVIEW_RANK_TOP_N.
 */
export function resolveOverviewRankBadge(
  rank: number | null | undefined,
): OverviewRankBadge {
  const n = typeof rank === "number" && Number.isFinite(rank) ? Math.floor(rank) : 0;
  if (n >= 1 && n <= OVERVIEW_RANK_TOP_N) {
    return {
      src: RANK_BADGE_SHELL_SRC,
      overlay: `#${n}`,
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
