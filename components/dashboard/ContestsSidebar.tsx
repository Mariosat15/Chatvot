"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Trophy,
  Swords,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Crown,
  Target,
} from "lucide-react";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";

interface CompetitionData {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime: Date;
  prizePool: number;
  currentRank: number;
  totalParticipants: number;
  pnl: number;
  pnlPercentage: number;
  openPositions: number;
  // Reason: Ranking method determines which metric to display in the dashboard card
  rankingMethod?: string;
  // Needed for non-PnL ranking methods
  currentCapital?: number;
  startingCapital?: number;
  totalTrades?: number;
  winningTrades?: number;
  losingTrades?: number;
  winRate?: number;
}

interface ChallengeData {
  id: string;
  name: string;
  status: string;
  startTime: Date;
  endTime: Date;
  stakeAmount: number;
  opponent: { name: string; pnl: number; pnlPercentage: number } | null;
  userPnL: number;
  userPnLPercentage: number;
  isLeading: boolean;
  isWinner?: boolean;
  prizeWon?: number;
}

interface ContestsSidebarProps {
  competitions: {
    active: CompetitionData[];
    upcoming: CompetitionData[];
    stats: {
      total: number;
      won: number;
      topThreeFinishes: number;
      averageRank: number;
    };
  };
  challenges: {
    active: ChallengeData[];
    pending: ChallengeData[];
    stats: {
      total: number;
      wins: number;
      losses: number;
      winRate: number;
      totalWon: number;
    };
  };
}

/**
 * Reason: .toFixed(1) rounds small values like 0.01% to "0.0%".
 * This formatter adapts precision based on the absolute value so
 * small but meaningful percentages are still visible (e.g. +0.013%).
 */
function formatPnlPercent(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return "0.00%";
  if (abs < 0.01) return value.toFixed(3) + "%";
  if (abs < 0.1) return value.toFixed(2) + "%";
  return value.toFixed(1) + "%";
}

/** Reason: Returns the correct display string based on the competition's ranking method */
function formatCompMetric(comp: CompetitionData): string {
  const method = comp.rankingMethod || "pnl";
  switch (method) {
    case "pnl":
      return `${comp.pnl >= 0 ? "+" : ""}$${Math.abs(comp.pnl).toFixed(2)}`;
    case "roi":
      return `${comp.pnlPercentage >= 0 ? "+" : ""}${formatPnlPercent(comp.pnlPercentage)}`;
    case "total_capital":
      return `$${(comp.currentCapital || 0).toLocaleString()}`;
    case "win_rate":
      return `${(comp.winRate || 0).toFixed(1)}%`;
    case "total_wins":
      return `${comp.winningTrades || 0} wins`;
    case "profit_factor": {
      const wins = comp.winningTrades || 0;
      const losses = comp.losingTrades || 0;
      const pf = losses === 0 ? (wins > 0 ? Infinity : 0) : wins / losses;
      return pf === Infinity ? "∞" : pf.toFixed(2);
    }
    default:
      return `${comp.pnl >= 0 ? "+" : ""}${formatPnlPercent(comp.pnlPercentage)}`;
  }
}

/** Reason: Returns the metric label suffix shown on the comp card */
function getCompMetricLabel(method?: string): string {
  switch (method) {
    case "pnl": return "P&L";
    case "roi": return "ROI";
    case "total_capital": return "Capital";
    case "win_rate": return "Win %";
    case "total_wins": return "Wins";
    case "profit_factor": return "PF";
    default: return "P&L";
  }
}

/** Reason: Determine if the metric value is positive for coloring */
function isCompMetricPositive(comp: CompetitionData): boolean {
  const method = comp.rankingMethod || "pnl";
  switch (method) {
    case "pnl": return comp.pnl >= 0;
    case "roi": return comp.pnlPercentage >= 0;
    case "total_capital":
      return (comp.currentCapital || 0) >= (comp.startingCapital || 10000);
    case "win_rate": return (comp.winRate || 0) > 50;
    case "total_wins": return (comp.winningTrades || 0) > 0;
    case "profit_factor": return (comp.winningTrades || 0) > (comp.losingTrades || 0);
    default: return comp.pnl >= 0;
  }
}

function TimeLeft({ endTime }: { endTime: Date }) {
  const ms = new Date(endTime).getTime() - Date.now();
  if (ms <= 0) return <span className="text-red-400 text-[10px]">Ended</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return (
      <span className="text-gray-400 text-[10px]">{d}d left</span>
    );
  }
  return (
    <span className="text-yellow-400 text-[10px]">
      {h}h {m}m left
    </span>
  );
}

export default function ContestsSidebar({
  competitions,
  challenges,
}: ContestsSidebarProps) {
  const [tab, setTab] = useState<"competitions" | "challenges">("competitions");

  const activeComps = competitions.active;

  // Reason: Live challenge data from polling replaces static server-side data
  const [liveChallenges, setLiveChallenges] = useState<ChallengeData[]>(
    challenges.active,
  );
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Reason: Poll the lightweight dashboard-live endpoint for real-time PnL updates
  const fetchLiveChallengeData = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      const res = await fetch("/api/challenges/dashboard-live");
      if (!res.ok) return;

      const data = await res.json();
      if (data.challenges && Array.isArray(data.challenges)) {
        setLiveChallenges((prev) => {
          // Merge live data into existing challenges, preserving any that aren't active
          const liveMap = new Map(
            data.challenges.map((c: ChallengeData) => [c.id, c]),
          );

          // Update active challenges with live data; keep non-active ones untouched
          const updated = prev.map((ch) => {
            const liveVersion = liveMap.get(ch.id);
            return liveVersion || ch;
          });

          // Add any new active challenges from live data that weren't in the original list
          for (const liveItem of data.challenges) {
            if (!updated.find((u) => u.id === liveItem.id)) {
              updated.push(liveItem);
            }
          }

          return updated;
        });
      }
    } catch {
      // Fail silently — live data is a nice-to-have enhancement
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Only poll when there are active challenges and we're on the challenges tab
    const hasActiveChallenges = challenges.active.length > 0;

    if (!hasActiveChallenges) {
      setLiveChallenges(challenges.active);
      return;
    }

    // Immediate fetch on mount
    fetchLiveChallengeData();

    const scheduleNextPoll = () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = setTimeout(async () => {
        await fetchLiveChallengeData();
        if (isMountedRef.current) scheduleNextPoll();
      }, PERFORMANCE_INTERVALS.CHALLENGE_LIVE_DATA);
    };

    scheduleNextPoll();

    // Pause/resume polling based on tab visibility
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLiveChallengeData();
        scheduleNextPoll();
      } else {
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [challenges.active.length, fetchLiveChallengeData]);

  // Use live data for display
  const activeChallenges = liveChallenges;

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5 h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-gray-700/30 rounded-lg p-0.5">
        <button
          onClick={() => setTab("competitions")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
            tab === "competitions"
              ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Competitions
          {activeComps.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] flex items-center justify-center">
              {activeComps.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("challenges")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
            tab === "challenges"
              ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          Challenges
          {activeChallenges.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[10px] flex items-center justify-center">
              {activeChallenges.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {tab === "competitions" ? (
        <div className="space-y-2.5">
          {/* Stats bar */}
          <div className="flex items-center justify-around text-center py-2 bg-gray-700/20 rounded-lg">
            <div>
              <div className="text-lg font-bold text-white">
                {competitions.stats.total}
              </div>
              <div className="text-[10px] text-gray-500">Entered</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">
                {competitions.stats.won}
              </div>
              <div className="text-[10px] text-gray-500">Won</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-400">
                #{competitions.stats.averageRank.toFixed(0) || "–"}
              </div>
              <div className="text-[10px] text-gray-500">Avg Rank</div>
            </div>
          </div>

          {/* Active competitions */}
          {activeComps.length === 0 ? (
            <div className="text-center py-6">
              <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No active competitions</p>
              <Link
                href="/competitions"
                className="text-xs text-yellow-500 hover:text-yellow-400 mt-1 inline-block"
              >
                Browse competitions →
              </Link>
            </div>
          ) : (
            activeComps.map((comp, i) => (
              <Link
                key={comp.id}
                href={`/competitions/${comp.id}`}
                className="block"
              >
                <motion.div
                  className="rounded-lg border border-gray-700/30 bg-gray-800/40 p-3 hover:border-yellow-500/30 transition-all cursor-pointer group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
                      {comp.name}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-yellow-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {comp.currentRank > 0 && comp.currentRank <= 3 ? (
                        <Crown className="w-3.5 h-3.5 text-yellow-400" />
                      ) : (
                        <Target className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span className="text-xs text-gray-300 font-[var(--font-geist-mono)]">
                        Rank #{comp.currentRank || "–"}/
                        {comp.totalParticipants}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isCompMetricPositive(comp) ? "text-green-400" : "text-red-400"
                      }`}
                      title={`Ranked by ${getCompMetricLabel(comp.rankingMethod)}`}
                    >
                      {formatCompMetric(comp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-500">
                      🏆 ${comp.prizePool.toLocaleString()}
                    </span>
                    <TimeLeft endTime={comp.endTime} />
                  </div>
                </motion.div>
              </Link>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Challenge stats bar */}
          <div className="flex items-center justify-around text-center py-2 bg-gray-700/20 rounded-lg">
            <div>
              <div className="text-lg font-bold text-green-400">
                {challenges.stats.wins}
              </div>
              <div className="text-[10px] text-gray-500">Wins</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">
                {challenges.stats.losses}
              </div>
              <div className="text-[10px] text-gray-500">Losses</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">
                ${challenges.stats.totalWon.toFixed(0)}
              </div>
              <div className="text-[10px] text-gray-500">Won</div>
            </div>
          </div>

          {/* Active challenges */}
          {activeChallenges.length === 0 ? (
            <div className="text-center py-6">
              <Swords className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No active challenges</p>
              <Link
                href="/challenges"
                className="text-xs text-purple-500 hover:text-purple-400 mt-1 inline-block"
              >
                Start a challenge →
              </Link>
            </div>
          ) : (
            activeChallenges.map((ch, i) => (
              <Link
                key={ch.id}
                href={`/challenges/${ch.id}`}
                className="block"
              >
                <motion.div
                  className="rounded-lg border border-gray-700/30 bg-gray-800/40 p-3 hover:border-purple-500/30 transition-all cursor-pointer group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-white truncate group-hover:text-purple-400">
                      {ch.name}
                    </span>
                    {ch.isLeading ? (
                      <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>

                  {/* User vs Opponent with live PnL */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      vs {ch.opponent?.name || "Waiting..."}
                    </span>
                    <span
                      className={
                        ch.userPnLPercentage >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {ch.userPnLPercentage >= 0 ? "+" : ""}
                      {formatPnlPercent(ch.userPnLPercentage)}
                    </span>
                  </div>

                  {/* Opponent PnL and stake */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-500">
                      ⚔️ ${ch.stakeAmount.toLocaleString()}
                    </span>
                    <TimeLeft endTime={ch.endTime} />
                  </div>
                </motion.div>
              </Link>
            ))
          )}
        </div>
      )}
    </motion.div>
  );
}
