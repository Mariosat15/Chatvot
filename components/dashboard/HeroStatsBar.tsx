"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  Trophy,
  ShoppingCart,
  Percent,
} from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";

interface HeroStatsBarProps {
  creditBalance: number;
  totalSpent: number;
  winRate: number;
  roi: number;
  gmEarnings: number;
  totalPrizesWon: number;
  // Reason: "compact" = 4 key cards for Overview tab (balance, win rate, ROI, prizes)
  // "wallet" = 4 financial cards for Wallet tab (balance, spent, GM, prizes)
  // "full" (default) = all 6 cards
  variant?: "compact" | "wallet" | "full";
}

// Reason: Each stat card has its own glow color and icon, configured here for consistency.
const STAT_CONFIG = [
  {
    key: "balance",
    label: "Credit Balance",
    icon: Wallet,
    color: "#EAB308",
    gradient: "from-yellow-500/20 to-amber-600/5",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    glowColor: "rgba(234,179,8,0.35)",
    glowFaint: "rgba(234,179,8,0.12)",
  },
  {
    key: "spent",
    label: "Total Spent",
    icon: ShoppingCart,
    color: "#EF4444",
    gradient: "from-red-500/20 to-rose-600/5",
    border: "border-red-500/30",
    text: "text-red-400",
    glowColor: "rgba(239,68,68,0.35)",
    glowFaint: "rgba(239,68,68,0.12)",
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
    key: "roi",
    label: "ROI",
    icon: Percent,
    color: "#06B6D4",
    gradient: "from-cyan-500/20 to-blue-600/5",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    glowColor: "rgba(6,182,212,0.35)",
    glowFaint: "rgba(6,182,212,0.12)",
  },
  {
    key: "gm",
    label: "GM Earnings",
    icon: Trophy,
    color: "#22C55E",
    gradient: "from-green-500/20 to-emerald-600/5",
    border: "border-green-500/30",
    text: "text-green-400",
    glowColor: "rgba(34,197,94,0.35)",
    glowFaint: "rgba(34,197,94,0.12)",
  },
  {
    key: "prizes",
    label: "Prizes Won",
    icon: Trophy,
    color: "#F97316",
    gradient: "from-orange-500/20 to-red-600/5",
    border: "border-orange-500/30",
    text: "text-orange-400",
    glowColor: "rgba(249,115,22,0.35)",
    glowFaint: "rgba(249,115,22,0.12)",
  },
];

// Reason: Maps variant to which STAT_CONFIG keys to show in each dashboard tab.
function getVisibleKeys(variant: "compact" | "wallet" | "full"): string[] {
  switch (variant) {
    case "compact": return ["balance", "winrate", "roi", "prizes"];
    case "wallet": return ["balance", "spent", "gm", "prizes"];
    default: return ["balance", "spent", "winrate", "roi", "gm", "prizes"];
  }
}

export default function HeroStatsBar({
  creditBalance,
  totalSpent,
  winRate,
  roi,
  gmEarnings,
  totalPrizesWon,
  variant = "full",
}: HeroStatsBarProps) {
  const { settings } = useAppSettings();
  const decimals = settings?.credits?.decimals ?? 2;
  const symbol = settings?.credits?.symbol ?? "⚡";

  const allStats = useMemo(
    () => [
      {
        ...STAT_CONFIG[0],
        value: creditBalance.toFixed(decimals),
        sub: symbol,
      },
      {
        ...STAT_CONFIG[1],
        value: `${symbol} ${totalSpent.toFixed(decimals)}`,
        sub: "Comp + Challenges + Market",
      },
      {
        ...STAT_CONFIG[2],
        value: `${winRate.toFixed(1)}%`,
        sub: "accuracy",
      },
      {
        ...STAT_CONFIG[3],
        value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`,
        sub: "return on investment",
        isNeg: roi < 0,
      },
      {
        ...STAT_CONFIG[4],
        value: `${symbol} ${gmEarnings.toFixed(decimals)}`,
        sub: "referral earnings",
      },
      {
        ...STAT_CONFIG[5],
        value: `${symbol} ${totalPrizesWon.toFixed(decimals)}`,
        sub: "from competitions",
      },
    ],
    [creditBalance, totalSpent, winRate, roi, gmEarnings, totalPrizesWon, decimals, symbol],
  );

  const visibleKeys = getVisibleKeys(variant);
  const stats = allStats.filter((s) => visibleKeys.includes(s.key));

  const gridCols =
    stats.length <= 4
      ? "grid-cols-2 lg:grid-cols-4"
      : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";

  return (
    <div className={`grid ${gridCols} gap-3`}>
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
            transition={{ duration: 0.5, delay: i * 0.08 }}
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
              className={`text-lg sm:text-xl font-bold ${
                isNeg ? "text-red-400" : "text-white"
              }`}
              style={{ fontFamily: "var(--font-geist-mono), monospace" }}
            >
              {stat.value}
            </div>

            {/* Subvalue */}
            <div className="flex items-center gap-1 mt-1">
              {stat.key === "roi" &&
                (isNeg ? (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                ) : (
                  <TrendingUp className="w-3 h-3 text-green-400" />
                ))}
              <span className="text-xs text-gray-500 truncate">{stat.sub}</span>
            </div>

            {/* Sparkline decoration */}
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
                transition={{ duration: 1.5, delay: i * 0.1 }}
              />
            </svg>
          </motion.div>
        );
      })}
    </div>
  );
}
