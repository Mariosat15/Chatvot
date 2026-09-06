"use client";

import { motion } from "framer-motion";
import { Flame, Zap, Calendar, TrendingUp, Award, BarChart2 } from "lucide-react";

interface StreaksShowcaseProps {
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  tradingDaysThisMonth: number;
  consecutiveProfitableDays: number;
}

interface StreakItem {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  borderColor: string;
  glowColor: string;
  isActive: boolean;
  suffix?: string;
}

export default function StreaksShowcase({
  currentWinStreak,
  currentLossStreak,
  longestWinStreak,
  longestLossStreak,
  tradingDaysThisMonth,
  consecutiveProfitableDays,
}: StreaksShowcaseProps) {
  const streaks: StreakItem[] = [
    {
      label: "Win Streak",
      value: currentWinStreak,
      icon: Flame,
      color: "#F97316",
      bg: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
      glowColor: "rgba(249,115,22,0.3)",
      isActive: currentWinStreak > 0,
    },
    {
      label: "Best Streak",
      value: longestWinStreak,
      icon: Award,
      color: "#EAB308",
      bg: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
      glowColor: "rgba(234,179,8,0.3)",
      isActive: longestWinStreak > 2,
    },
    {
      label: "Profitable Days",
      value: consecutiveProfitableDays,
      icon: TrendingUp,
      color: "#22C55E",
      bg: "bg-green-500/10",
      borderColor: "border-green-500/30",
      glowColor: "rgba(34,197,94,0.3)",
      isActive: consecutiveProfitableDays > 0,
      suffix: "d",
    },
    {
      label: "Trading Days",
      value: tradingDaysThisMonth,
      icon: Calendar,
      color: "#3B82F6",
      bg: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      glowColor: "rgba(59,130,246,0.3)",
      isActive: tradingDaysThisMonth > 5,
      suffix: "/mo",
    },
    {
      label: "Loss Streak",
      value: currentLossStreak,
      icon: Zap,
      color: "#EF4444",
      bg: "bg-red-500/10",
      borderColor: "border-red-500/30",
      glowColor: "rgba(239,68,68,0.3)",
      isActive: currentLossStreak > 0,
    },
    {
      label: "Worst Streak",
      value: longestLossStreak,
      icon: BarChart2,
      color: "#F43F5E",
      bg: "bg-rose-500/10",
      borderColor: "border-rose-500/30",
      glowColor: "rgba(244,63,94,0.3)",
      isActive: false,
    },
  ];

  return (
    <motion.div
      className="rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-4 sm:p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
        🔥 Streaks & Consistency
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {streaks.map((streak, i) => {
          const Icon = streak.icon;

          return (
            <motion.div
              key={streak.label}
              className={`relative overflow-hidden rounded-lg border ${streak.borderColor} ${streak.bg} p-3 text-center transition-all`}
              style={
                streak.isActive
                  ? {
                      boxShadow: `0 0 15px ${streak.glowColor}`,
                    }
                  : undefined
              }
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.06 }}
            >
              {/* Fire animation for active streaks */}
              {streak.isActive && streak.label.includes("Win") && (
                <div className="absolute top-1 right-1 animate-flame">
                  <Flame className="w-3.5 h-3.5 text-orange-400 opacity-60" />
                </div>
              )}

              <Icon
                className="w-5 h-5 mx-auto mb-1.5 opacity-70"
                style={{ color: streak.color }}
              />
              <div
                className="text-xl font-bold font-[var(--font-geist-mono)]"
                style={{ color: streak.color }}
              >
                {streak.value}{streak.suffix || ""}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                {streak.label}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
