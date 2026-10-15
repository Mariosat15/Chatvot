"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Ban,
  Boxes,
  CalendarClock,
  ClipboardList,
  Clock,
  Flame,
  Gauge,
  Layers,
  RefreshCw,
  Target,
  Ticket,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { formatVolts } from "@/lib/utils/format-volts";
import { RANKING_LABELS } from "@/components/trading/lobby/trading-lobby-labels";
import { DashboardBanners } from "./competition-dashboard/DashboardBanners";
import { MobileRunPanel } from "./competition-dashboard/MobileRunPanel";
import {
  DASH_CARD,
  DashboardActions,
  DashboardHeader,
  HeroScoreCard,
  PlayTile,
  RowsPanel,
  SectionTitle,
  type PanelRow,
  type PlayTileData,
} from "./competition-dashboard/DashboardPieces";
import { DATA_ICON } from "@/lib/constants/data-icons";
import {
  equityPolyline,
  formatCash,
  formatHoldTime,
  formatPercent,
  headerCopy,
  rankStanding,
  rankedFigure,
  type CompetitionRules,
  type DashboardStats,
  type DashboardStatus,
  type EquityPoint,
} from "./competition-dashboard/dashboard-model";

interface CompetitionDashboardProps {
  competitionId: string;
  competitionName?: string;
  initialParticipant: {
    _id: string;
    currentCapital: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    currentRank?: number;
    winningTrades?: number;
    losingTrades?: number;
    status?: string;
  } | null;
  competitionStatus: DashboardStatus;
  startTime: string;
  endTime: string;
  startingCapital: number;
  totalParticipants: number;
  competitionRules?: CompetitionRules;
  /** What this contest ranks on; the hero figure follows it. */
  rankingMethod?: string;
  /** Entry fee in credits. Absent hides the row; 0 reads "Free". */
  entryFee?: number;
  /** The page's credit symbol; the settings symbol is the fallback. */
  creditSymbol?: string;
  /**
   * `"mobile"` draws the phone panel from the SAME computed figures; desktop is the default
   * and its markup is untouched. The desktop panel cannot fit 390px (13 Oct 2026).
   */
  layout?: "desktop" | "mobile";
  /** Where "View Leaderboard" points; the phone lobby opens its Leaderboard tab instead. */
  leaderboardHref?: string;
}

const LEADERBOARD_ANCHOR = "#competition-leaderboard";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: DashboardStatus }) {
  if (status === "active") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">
        <span className="h-2 w-2 animate-ping rounded-full bg-green-400" />
        LIVE NOW
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="rounded-full border border-purple-500/40 bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-300">
        🏁 FINAL
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-red-500/50 bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">
        <Ban className="h-3.5 w-3.5" />
        CANCELLED
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300">
      <Clock className="h-3.5 w-3.5" />
      Starting Soon
    </span>
  );
}

export default function CompetitionDashboard({
  competitionId,
  competitionName,
  initialParticipant,
  competitionStatus,
  startTime,
  endTime,
  startingCapital,
  totalParticipants,
  competitionRules,
  rankingMethod,
  entryFee,
  creditSymbol,
  layout = "desktop",
  leaderboardHref = LEADERBOARD_ANCHOR,
}: CompetitionDashboardProps) {
  const { settings } = useAppSettings();
  const symbol = creditSymbol ?? settings?.credits?.symbol;
  const [currentStats, setCurrentStats] = useState<DashboardStats | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const isActive = competitionStatus === "active";
  const isCompleted = competitionStatus === "completed";

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/user/competition-stats?competitionId=${competitionId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentStats(data.currentCompetitionStats);
        setEquityCurve(data.equityCurve || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("❌ Failed to fetch competition stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    fetchStats();
    if (isActive) {
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [fetchStats, isActive]);

  const sparkline = useMemo(() => equityPolyline(equityCurve), [equityCurve]);

  if (!initialParticipant) return null;

  if (isLoading) {
    return (
      <div className={`${DASH_CARD} p-8`}>
        <div className="flex items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-sky-400" />
          <span className="text-slate-400">Loading your arena run...</span>
        </div>
      </div>
    );
  }

  const seatTrades = initialParticipant.totalTrades;
  const seatWins = initialParticipant.winningTrades || 0;
  // Reason: the stats route can fail or lag; the seat the page already read is the floor.
  const stats: DashboardStats = currentStats || {
    currentCapital: initialParticipant.currentCapital,
    pnl: initialParticipant.pnl,
    pnlPercentage: initialParticipant.pnlPercentage,
    totalTrades: seatTrades,
    currentRank: initialParticipant.currentRank,
    winningTrades: seatWins,
    losingTrades: initialParticipant.losingTrades || 0,
    winRate: seatTrades > 0 ? (seatWins / seatTrades) * 100 : 0,
    unrealizedPnL: 0,
    realizedPnL: initialParticipant.pnl,
    equity: initialParticipant.currentCapital,
    openPositionsCount: 0,
    todayPnL: 0,
    winStreak: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    totalParticipants,
  };

  const total = stats.totalParticipants || totalParticipants;
  const winRate = stats.totalTrades > 0 ? (stats.winningTrades / stats.totalTrades) * 100 : 0;
  const isLiquidated = initialParticipant.status === "liquidated";
  const minimumTrades = competitionRules?.minimumTrades || 0;
  const minimumWinRate = competitionRules?.minimumWinRate || 0;
  const isAtRisk =
    !isLiquidated &&
    isActive &&
    ((minimumTrades > 0 && stats.totalTrades < minimumTrades) ||
      (minimumWinRate > 0 && winRate < minimumWinRate));

  const header = headerCopy(competitionStatus);
  const figure = rankedFigure(rankingMethod, stats);
  const standing = rankStanding(stats.currentRank, total);
  const methodLabel = RANKING_LABELS.get(rankingMethod ?? "pnl") ?? RANKING_LABELS.get("pnl");
  const noTrades = stats.totalTrades === 0;
  const tone = (n: number) => (n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-white");
  const name = competitionName || stats.competitionName || "This competition";

  const tiles: PlayTileData[] = [
    {
      key: "trades",
      icon: Boxes,
      tone: "blue",
      label: "Trades",
      value: String(stats.totalTrades),
      caption: minimumTrades > 0 ? `${Math.min(stats.totalTrades, minimumTrades)}/${minimumTrades} to qualify` : "Trades placed",
    },
    {
      key: "win-rate",
      icon: Target,
      tone: "purple",
      label: "Win rate",
      value: noTrades ? "-" : formatPercent(winRate),
      caption: `${stats.winningTrades}W / ${stats.losingTrades}L`,
    },
    {
      key: "open",
      icon: Layers,
      tone: "cyan",
      label: "Open positions",
      value: String(stats.openPositionsCount),
      caption: "Live right now",
    },
    {
      key: "today",
      icon: Zap,
      tone: "amber",
      label: "Today's P&L",
      value: formatCash(stats.todayPnL, true),
      caption: "Since the day began",
      valueTone: tone(stats.todayPnL),
    },
    {
      key: "unrealized",
      icon: Activity,
      tone: "red",
      label: "Unrealized",
      value: formatCash(stats.unrealizedPnL, true),
      caption: "Open P&L",
      valueTone: tone(stats.unrealizedPnL),
    },
  ];

  const summaryRows: PanelRow[] = [
    { key: "competition", icon: Trophy, label: "Competition", value: name },
    { key: "ranked", icon: Gauge, label: "Ranked on", value: methodLabel },
    ...(typeof entryFee === "number"
      ? [{ key: "fee", icon: Ticket, iconSrc: DATA_ICON.entryFee, label: "Entry fee", value: entryFee > 0 ? formatVolts(entryFee, { symbol }) : "Free" }]
      : []),
    { key: "start", icon: Wallet, label: "Started with", value: formatCash(stats.startingCapital ?? startingCapital) },
    { key: "equity", icon: BarChart3, label: "Equity now", value: formatCash(stats.equity) },
    { key: "when", icon: CalendarClock, label: "Schedule", value: `${formatWhen(startTime)} - ${formatWhen(endTime)}` },
  ];

  const breakdownRows: PanelRow[] = [
    { key: "realized", icon: TrendingUp, label: "Realized P&L", value: formatCash(stats.realizedPnL, true), valueTone: tone(stats.realizedPnL) },
    { key: "avg-win", icon: TrendingUp, label: "Average win", value: noTrades ? "-" : formatCash(stats.avgWin), valueTone: "text-emerald-400" },
    { key: "avg-loss", icon: TrendingDown, label: "Average loss", value: noTrades ? "-" : formatCash(-Math.abs(stats.avgLoss)), valueTone: "text-rose-400" },
    { key: "largest-win", icon: Trophy, label: "Largest win", value: noTrades ? "-" : formatCash(stats.largestWin), valueTone: "text-emerald-400" },
    { key: "factor", icon: Gauge, label: "Profit factor", value: noTrades ? "-" : stats.profitFactor >= 999 ? "∞" : stats.profitFactor.toFixed(2) },
    { key: "streak", icon: Flame, label: "Best win streak", value: String(stats.winStreak) },
    { key: "hold", icon: Clock, label: "Average hold", value: formatHoldTime(stats.avgHoldingTime) },
  ];

  const back = isActive
    ? { href: `/competitions/${competitionId}/trade`, title: "Open Terminal", subtitle: `${name} - keep trading` }
    : { href: "/dashboard?tab=performance", title: "Full Performance", subtitle: "Career stats and contest history" };
  const primary = isCompleted
    ? { href: `/competitions/${competitionId}/results`, title: "View Results" }
    : { href: leaderboardHref, title: "View Leaderboard" };

  const backdrop = sparkline ? (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <polyline points={sparkline} fill="none" stroke="#38BDF8" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  ) : undefined;

  const caption = [
    `Capital ${formatCash(stats.currentCapital)}`,
    figure.label === "Total P&L" ? `${formatPercent(stats.pnlPercentage, true)} return` : `P&L ${formatCash(stats.pnl, true)}`,
  ].join(" · ");

  const banners = (
    <DashboardBanners
      isDisqualified={isLiquidated}
      isLiquidated={isLiquidated}
      isAtRisk={isAtRisk}
      isActive={isActive}
      rules={competitionRules}
      totalTrades={stats.totalTrades}
      winRate={winRate}
    />
  );

  if (layout === "mobile") {
    // Reason (owner, 13 Oct 2026): on a phone the lobby hero and the schedule tab already show
    // the contest's name and dates, so the run summary drops both; and the "Starting Soon" pill
    // squeezed the WARMING UP heading into a truncation, so it is omitted while upcoming.
    const mobileSummaryRows = summaryRows.filter((row) => row.key !== "competition" && row.key !== "when");
    const mobileTiles = tiles.map((tile) => (tile.key === "open" ? { ...tile, label: "Positions" } : tile));
    return (
      <div className="space-y-3">
        {banners}
        <MobileRunPanel
          title={header.title}
          subtitle={header.subtitle}
          status={competitionStatus === "upcoming" ? null : <StatusPill status={competitionStatus} />}
          figure={figure}
          caption={caption}
          rank={stats.currentRank}
          total={total}
          standing={standing}
          tiles={mobileTiles}
          summaryRows={mobileSummaryRows}
          breakdownRows={breakdownRows}
          back={back}
          primary={primary}
          updatedLabel={lastUpdate.toLocaleTimeString()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DashboardBanners
        isDisqualified={isLiquidated}
        isLiquidated={isLiquidated}
        isAtRisk={isAtRisk}
        isActive={isActive}
        rules={competitionRules}
        totalTrades={stats.totalTrades}
        winRate={winRate}
      />

      <section className="relative space-y-5 overflow-hidden rounded-3xl border-2 border-sky-500/40 bg-gradient-to-b from-[#081634] via-[#061028] to-[#050B1E] p-6 shadow-[0_0_60px_-20px_rgba(56,189,248,0.8)]">
        <DashboardHeader title={header.title} subtitle={header.subtitle} status={<StatusPill status={competitionStatus} />}>
          <HeroScoreCard figure={figure} caption={caption} rank={stats.currentRank} total={total} standing={standing} backdrop={backdrop} />
        </DashboardHeader>

        <div className={`${DASH_CARD} p-5`}>
          <SectionTitle icon={BarChart3}>How you&apos;re trading</SectionTitle>
          <div className="mt-4 grid grid-cols-5 gap-3">
            {tiles.map((tile) => (
              <PlayTile key={tile.key} tile={tile} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <RowsPanel icon={ClipboardList} title="Run summary" rows={summaryRows} align="inline" />
          <RowsPanel icon={BarChart3} title="Score breakdown" rows={breakdownRows} align="end" />
        </div>

        <DashboardActions back={back} primary={primary} />

        <p className="flex items-center justify-end gap-1 text-xs text-slate-500">
            <RefreshCw className="h-3 w-3" />
            Updated {lastUpdate.toLocaleTimeString()}
        </p>
      </section>
    </div>
  );
}
