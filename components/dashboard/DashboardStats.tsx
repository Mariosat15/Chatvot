'use client';

import { TrendingUp, TrendingDown, Trophy, Target, Activity, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

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
  const pnlPercentage = overallStats.totalCapital > 0
    ? (overallStats.totalPnL / overallStats.totalCapital) * 100
    : 0;

  const stats = [
    {
      label: 'Active Competitions',
      value: overallStats.activeCompetitionsCount,
      icon: Trophy,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      trend: null,
    },
    {
      label: 'Total Capital',
      value: formatCurrency(overallStats.totalCapital),
      icon: DollarSign,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      trend: null,
    },
    {
      label: 'Total P&L',
      value: formatCurrency(overallStats.totalPnL),
      icon: isProfitable ? TrendingUp : TrendingDown,
      color: isProfitable ? 'text-green-500' : 'text-red-500',
      bgColor: isProfitable ? 'bg-green-500/10' : 'bg-red-500/10',
      trend: `${pnlPercentage >= 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%`,
    },
    {
      label: 'Open Positions',
      value: overallStats.totalPositions,
      icon: Activity,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      trend: null,
    },
    {
      label: 'Total Trades',
      value: overallStats.totalTrades,
      icon: Target,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      trend: `${overallStats.totalWinningTrades}W / ${overallStats.totalLosingTrades}L`,
    },
    {
      label: 'Overall Win Rate',
      value: `${overallStats.overallWinRate.toFixed(1)}%`,
      icon: Trophy,
      color: overallStats.overallWinRate >= 50 ? 'text-green-500' : 'text-orange-500',
      bgColor: overallStats.overallWinRate >= 50 ? 'bg-green-500/10' : 'bg-orange-500/10',
      trend: overallStats.profitFactor > 0 
        ? `PF: ${overallStats.profitFactor === 9999 ? '∞' : overallStats.profitFactor.toFixed(2)}`
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
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
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

