import { NEON_ICON } from "@/lib/services/games/overview-assets";

/**
 * Performance Analytics palette and neon icon map.
 *
 * Reason: the glossy section and metric identities are the supplied Menuitems
 * WebPs (owner, 3 Oct 2026). CSS draws only cards, borders, glows and layout,
 * so every icon on this page resolves through `NEON_ICON` and nowhere else.
 */

export const PERF = {
  bg: "#020817",
  bg2: "#041025",
  bg3: "#07172c",
  cyan: "#00d9ff",
  blue: "#168cff",
  purple: "#9d39ff",
  magenta: "#ff36ca",
  gold: "#ffc51b",
  orange: "#ff7b17",
  green: "#00e6a3",
  red: "#ff4b67",
  text: "#f5f8ff",
  muted: "#8ea4c5",
} as const;

export type PerfAccent =
  | "cyan"
  | "blue"
  | "purple"
  | "magenta"
  | "gold"
  | "orange"
  | "green"
  | "red";

/** Section header identities. */
export const PERF_SECTION_ICON = {
  page: NEON_ICON("chart-growth-orange"),
  highlights: NEON_ICON("star"),
  games: NEON_ICON("gamepad-blue"),
  trend: NEON_ICON("growth-green"),
  trading: NEON_ICON("candles"),
  challenges: NEON_ICON("swords"),
  competitions: NEON_ICON("trophy-purple"),
  holidays: NEON_ICON("calendar-gold"),
} as const;

/** Metric card identities. */
export const PERF_METRIC_ICON = {
  winRate: NEON_ICON("target-purple"),
  roi: NEON_ICON("chart-growth-orange"),
  playTime: NEON_ICON("clock-v2"),
  activeDays: NEON_ICON("calendar-blue"),
  bestScore: NEON_ICON("star"),
  competitionsWon: NEON_ICON("trophy-green"),
  challengeWins: NEON_ICON("swords"),
  consistency: NEON_ICON("fire"),
  tradeWinRate: NEON_ICON("target-purple"),
  tradeRoi: NEON_ICON("growth-green"),
  profitFactor: NEON_ICON("chart-bars-blue"),
  totalTrades: NEON_ICON("candles"),
  avgWin: NEON_ICON("deposit"),
  avgLoss: NEON_ICON("withdrawal"),
  largestWin: NEON_ICON("rocket"),
  largestLoss: NEON_ICON("chart-bars-red"),
  gameFallback: NEON_ICON("games-orange"),
  crown: NEON_ICON("crown"),
  contests: NEON_ICON("users-v2"),
  rounds: NEON_ICON("clock-v2"),
  trophy: NEON_ICON("trophy-green"),
} as const;

/** Every asset the page can request — the test asserts each file exists. */
export function allPerformanceAssets(): string[] {
  return [
    ...Object.values(PERF_SECTION_ICON),
    ...Object.values(PERF_METRIC_ICON),
  ];
}
