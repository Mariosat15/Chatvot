"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Trophy,
  Target,
} from "lucide-react";

interface HeroStatsBarProps {
  totalCapital: number;
  totalPnL: number;
  totalPnLPercentage: number;
  winRate: number;
  activeContests: number;
  totalTrades: number;
}

// Reason: Each stat card has its own glow color and icon, configured here for consistency.
const STAT_CONFIG = [
  {
    key: "capital",
    label: "Total Capital",
    icon: DollarSign,
    color: "#3B82F6",
    gradient: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/30",
    text: "text-blue-400",
    glowColor: "rgba(59,130,246,0.35)",
    glowFaint: "rgba(59,130,246,0.12)",
  },
  {
    key: "pnl",
    label: "Total P&L",
    icon: TrendingUp,
    color: "#22C55E",
    gradient: "from-green-500/20 to-emerald-600/5",
    border: "border-green-500/30",
    text: "text-green-400",
    glowColor: "rgba(34,197,94,0.35)",
    glowFaint: "rgba(34,197,94,0.12)",
  },
  {
    key: "winrate",
    label: "Win Rate",
    icon: Target,
    color: "#A855F7",
    gradient: "from-purple-500/20 to-violet-600/5",
    border: "border-purple-500/30",
    text: "text-purple-400",
    glowColor: "rgba(168,85,247,0.35)",
    glowFaint: "rgba(168,85,247,0.12)",
  },
  {
    key: "activity",
    label: "Active Contests",
    icon: Trophy,
    color: "#EAB308",
    gradient: "from-yellow-500/20 to-amber-600/5",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    glowColor: "rgba(234,179,8,0.35)",
    glowFaint: "rgba(234,179,8,0.12)",
  },
];

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

export default function HeroStatsBar({
  totalCapital,
  totalPnL,
  totalPnLPercentage,
  winRate,
  activeContests,
  totalTrades,
}: HeroStatsBarProps) {
  const stats = useMemo(
    () => [
      {
        ...STAT_CONFIG[0],
        value: formatCurrency(totalCapital),
        sub: `${totalTrades} trades`,
      },
      {
        ...STAT_CONFIG[1],
        value: formatCurrency(totalPnL),
        sub: `${totalPnLPercentage >= 0 ? "+" : ""}${totalPnLPercentage.toFixed(1)}%`,
        isNeg: totalPnL < 0,
      },
      {
        ...STAT_CONFIG[2],
        value: `${winRate.toFixed(1)}%`,
        sub: "accuracy",
      },
      {
        ...STAT_CONFIG[3],
        value: String(activeContests),
        sub: "competing",
      },
    ],
    [totalCapital, totalPnL, totalPnLPercentage, winRate, activeContests, totalTrades]
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const isNeg = "isNeg" in stat && stat.isNeg;

        return (
          <motion.div
            key={stat.key}
            className={`relative overflow-hidden rounded-xl border ${stat.border} bg-gradient-to-br ${stat.gradient} backdrop-blur-sm p-4 sm:p-5 animate-glow-pulse`}
            style={{
              "--glow-color": stat.glowColor,
              "--glow-color-faint": stat.glowFaint,
            } as React.CSSProperties}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            {/* Background decoration */}
            <div
              className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10"
              style={{ background: stat.color }}
            />

            {/* Icon + label */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${stat.color}22` }}
              >
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <span className="text-xs sm:text-sm text-gray-400 font-medium truncate">
                {stat.label}
              </span>
            </div>

            {/* Value */}
            <div
              className={`text-xl sm:text-2xl font-bold ${
                isNeg ? "text-red-400" : "text-white"
              }`}
              style={{ fontFamily: "var(--font-geist-mono), monospace" }}
            >
              {stat.value}
            </div>

            {/* Subvalue */}
            <div className="flex items-center gap-1 mt-1">
              {stat.key === "pnl" && (
                isNeg ? (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                ) : (
                  <TrendingUp className="w-3 h-3 text-green-400" />
                )
              )}
              {stat.key === "activity" && (
                <Activity className="w-3 h-3 text-yellow-400" />
              )}
              <span className="text-xs sm:text-sm text-gray-500">{stat.sub}</span>
            </div>

            {/* Sparkline decoration (subtle animated line) */}
            <svg
              className="absolute bottom-0 left-0 w-full h-8 opacity-15"
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
            >
              <motion.path
                d="M0,15 Q10,5 20,12 T40,8 T60,14 T80,6 T100,10"
                fill="none"
                stroke={stat.color}
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: i * 0.15 }}
              />
            </svg>
          </motion.div>
        );
      })}
    </div>
  );
}
