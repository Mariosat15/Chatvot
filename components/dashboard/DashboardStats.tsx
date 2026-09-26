"use client";

import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";
import { formatCurrency } from "@/lib/utils";

interface DashboardStatsProps {
  overallStats: {
    totalCapital: number;
    totalPnL: number;
    totalPositions: number;
    totalTrades: number;
    totalWinningTrades: number;
    totalLosingTrades: number;
    overallWinRate: number;
    profitFactor: number;
    activeCompetitionsCount: number;
  };
}

export default function DashboardStats({ overallStats }: DashboardStatsProps) {
  const isProfitable = overallStats.totalPnL >= 0;
  const pnlPercentage =
    overallStats.totalCapital > 0
      ? (overallStats.totalPnL / overallStats.totalCapital) * 100
      : 0;

  const stats: {
    label: string;
    value: string | number;
    iconName: GameIconName;
    color: string;
    bgColor: string;
    trend: string | null;
  }[] = [
    {
      label: "Active Competitions",
      value: overallStats.activeCompetitionsCount,
      iconName: "trophy",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      trend: null,
    },
    {
      label: "Total Capital",
      value: formatCurrency(overallStats.totalCapital),
      iconName: "coin",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      trend: null,
    },
    {
      label: "Total P&L",
      value: formatCurrency(overallStats.totalPnL),
      iconName: isProfitable ? "profit" : "loss",
      color: isProfitable ? "text-green-500" : "text-red-500",
      bgColor: isProfitable ? "bg-green-500/10" : "bg-red-500/10",
      trend: `${pnlPercentage >= 0 ? "+" : ""}${pnlPercentage.toFixed(2)}%`,
    },
    {
      label: "Open Positions",
      value: overallStats.totalPositions,
      iconName: "portfolio",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      trend: null,
    },
    {
      label: "Total Trades",
      value: overallStats.totalTrades,
      iconName: "target",
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      trend: `${overallStats.totalWinningTrades}W / ${overallStats.totalLosingTrades}L`,
    },
    {
      label: "Overall Win Rate",
      value: `${overallStats.overallWinRate.toFixed(1)}%`,
      iconName: "goldMedal",
      color:
        overallStats.overallWinRate >= 50
          ? "text-green-500"
          : "text-orange-500",
      bgColor:
        overallStats.overallWinRate >= 50
          ? "bg-green-500/10"
          : "bg-orange-500/10",
      trend:
        overallStats.profitFactor > 0
          ? `PF: ${overallStats.profitFactor >= 999 ? "∞" : overallStats.profitFactor.toFixed(2)}`
          : null,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10"
        >
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <GameIcon name={stat.iconName} size={24} />
            </div>
            {stat.trend && (
              <span className={`text-sm font-medium ${stat.color}`}>
                {stat.trend}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-100 mb-1">{stat.value}</p>
          <p className="text-sm text-gray-400">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
