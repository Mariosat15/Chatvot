/**
 * Pure helpers for the player's own competition panel (`CompetitionDashboard`).
 *
 * Kept free of React and of lucide components so the figures can be tested in Node and so
 * nothing here can cross a server/client boundary as a function (R39).
 */

export type DashboardStatus = "upcoming" | "active" | "completed" | "cancelled";

export interface CompetitionRules {
  minimumTrades?: number;
  minimumWinRate?: number;
  disqualifyOnLiquidation?: boolean;
}

/** What `/api/user/competition-stats` returns for this contest, or the seat-based fallback. */
export interface DashboardStats {
  competitionName?: string;
  startingCapital?: number;
  currentCapital: number;
  currentRank?: number | null;
  totalParticipants?: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  openPositionsCount: number;
  unrealizedPnL: number;
  realizedPnL: number;
  equity: number;
  todayPnL: number;
  todayTrades?: number;
  winStreak: number;
  loseStreak?: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin?: number;
  largestLoss?: number;
  avgHoldingTime?: number;
}

export interface EquityPoint {
  time: string;
  equity: number;
}

/** Simulated trading money. Never Volts: capital and P&L are not credits. */
export function formatCash(value: number | null | undefined, signed = false): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!signed) return `${value < 0 ? "-" : ""}$${abs}`;
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}$${abs}`;
}

export function formatPercent(value: number | null | undefined, signed = false): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export interface RankedFigure {
  /** Caption above the hero value, e.g. "Return %". */
  label: string;
  value: string;
  tone: "gold" | "loss";
}

/**
 * The hero figure is whatever THIS contest ranks on, never a fixed P&L.
 *
 * Reason: the owner asked for the panel to follow the competition (12 Oct 2026). A contest
 * ranked on win rate that headlines P&L tells the player to chase the wrong number. An unknown
 * method falls back to P&L, which is also the schema default.
 */
export function rankedFigure(method: string | undefined, stats: DashboardStats): RankedFigure {
  const gainTone = (n: number) => (n < 0 ? "loss" : "gold") as RankedFigure["tone"];
  switch (method) {
    case "roi":
      return { label: "Return", value: formatPercent(stats.pnlPercentage, true), tone: gainTone(stats.pnlPercentage) };
    case "total_capital":
      return { label: "Total capital", value: formatCash(stats.currentCapital), tone: "gold" };
    case "win_rate":
      return { label: "Win rate", value: formatPercent(stats.winRate), tone: "gold" };
    case "total_wins":
      return { label: "Winning trades", value: String(stats.winningTrades), tone: "gold" };
    case "profit_factor":
      return {
        label: "Profit factor",
        value: stats.profitFactor >= 999 ? "∞" : stats.profitFactor.toFixed(2),
        tone: "gold",
      };
    default:
      return { label: "Total P&L", value: formatCash(stats.pnl, true), tone: gainTone(stats.pnl) };
  }
}

export interface RankStanding {
  /** 0-100, how far up the board the player is. 0 when unranked. */
  progress: number;
  line: string;
  tone: "great" | "good" | "neutral";
}

/** The encouragement under the rank, and the bar's fill. */
export function rankStanding(rank: number | null | undefined, total: number): RankStanding {
  if (!rank || rank < 1 || total < 1) {
    return { progress: 0, line: "Make a trade to get on the board", tone: "neutral" };
  }
  const progress = Math.max(4, Math.round(((total - rank + 1) / total) * 100));
  const percentile = (rank / total) * 100;
  if (rank === 1) return { progress, line: "Top of the board!", tone: "great" };
  if (rank <= 3) return { progress, line: "Podium pace - hold it!", tone: "great" };
  if (percentile <= 10) return { progress, line: "Top 10% - great performance!", tone: "great" };
  if (percentile <= 25) return { progress, line: "Top 25% - keep climbing!", tone: "good" };
  if (percentile <= 50) return { progress, line: "Top half - push on!", tone: "good" };
  return { progress, line: "Every trade counts - climb!", tone: "neutral" };
}

export function headerCopy(status: DashboardStatus): { title: [string, string]; subtitle: string } {
  switch (status) {
    case "completed":
      return { title: ["RUN", "COMPLETE"], subtitle: "Final whistle! Here's how your run finished." };
    case "upcoming":
      return { title: ["WARMING", "UP"], subtitle: "You're in. Your stats go live the moment it starts." };
    case "cancelled":
      return { title: ["RUN", "CANCELLED"], subtitle: "This competition was cancelled." };
    default:
      return { title: ["YOUR", "ARENA RUN"], subtitle: "Live stats - every trade moves you on the board." };
  }
}

export function equityPolyline(points: EquityPoint[]): string | null {
  if (points.length < 2) return null;
  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${100 - ((p.equity - min) / range) * 100}`)
    .join(" ");
}

export function formatHoldTime(minutes: number | undefined): string {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return "-";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${Math.round(minutes % 60)}m`;
}
