"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Trophy,
  Swords,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Crown,
  Target,
} from "lucide-react";

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
    stats: { total: number; won: number; topThreeFinishes: number; averageRank: number };
  };
  challenges: {
    active: ChallengeData[];
    pending: ChallengeData[];
    stats: { total: number; wins: number; losses: number; winRate: number; totalWon: number };
  };
}

function TimeLeft({ endTime }: { endTime: Date }) {
  const ms = new Date(endTime).getTime() - Date.now();
  if (ms <= 0) return <span className="text-red-400 text-[10px]">Ended</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return <span className="text-gray-400 text-[10px]">{d}d left</span>;
  }
  return <span className="text-yellow-400 text-[10px]">{h}h {m}m left</span>;
}

export default function ContestsSidebar({
  competitions,
  challenges,
}: ContestsSidebarProps) {
  const [tab, setTab] = useState<"competitions" | "challenges">("competitions");

  const activeComps = competitions.active;
  const activeChallenges = challenges.active;

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
              <div className="text-lg font-bold text-white">{competitions.stats.total}</div>
              <div className="text-[10px] text-gray-500">Entered</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">{competitions.stats.won}</div>
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
                      {comp.currentRank <= 3 ? (
                        <Crown className="w-3.5 h-3.5 text-yellow-400" />
                      ) : (
                        <Target className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span className="text-xs text-gray-300 font-[var(--font-geist-mono)]">
                        Rank #{comp.currentRank}/{comp.totalParticipants}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        comp.pnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {comp.pnl >= 0 ? "+" : ""}{comp.pnlPercentage.toFixed(1)}%
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
              <div className="text-lg font-bold text-green-400">{challenges.stats.wins}</div>
              <div className="text-[10px] text-gray-500">Wins</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">{challenges.stats.losses}</div>
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
              <Link key={ch.id} href={`/challenges/${ch.id}`} className="block">
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
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      vs {ch.opponent?.name || "Waiting..."}
                    </span>
                    <span className={ch.isLeading ? "text-green-400" : "text-red-400"}>
                      {ch.userPnLPercentage >= 0 ? "+" : ""}{ch.userPnLPercentage.toFixed(1)}%
                    </span>
                  </div>
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
