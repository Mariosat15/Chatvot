'use client';

import Link from 'next/link';
import { Trophy, TrendingUp, TrendingDown, Users, Clock, Target, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ActiveCompetitionCardProps {
  competition: any;
  participation: any;
  openPositionsCount: number;
  recentTrades: any[];
  participantStats?: {
    active: number;
    liquidated: number;
    completed: number;
    disqualified: number;
    total: number;
  };
}

export default function ActiveCompetitionCard({
  competition,
  participation,
  openPositionsCount,
  recentTrades,
  participantStats,
}: ActiveCompetitionCardProps) {
  const isProfitable = participation.pnl >= 0;
  const capitalPercentage = (participation.currentCapital / participation.startingCapital) * 100;
  const isAtRisk = capitalPercentage < 60;

  const timeRemaining = new Date(competition.endTime).getTime() - Date.now();
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
  const daysRemaining = Math.floor(hoursRemaining / 24);

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden hover:border-yellow-500/70 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/20 hover:scale-[1.02]">
      {/* Header with Gradient */}
      <div className="relative bg-gradient-to-r from-yellow-500/20 via-yellow-500/10 to-transparent p-6 border-b border-gray-700/50">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex-1">
              <Link
                href={`/competitions/${competition._id}/trade`}
                className="text-2xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent hover:from-yellow-500 hover:to-yellow-400 transition-all duration-300 inline-block"
              >
                {competition.name}
              </Link>
              <p className="text-sm text-gray-400 mt-2 line-clamp-2">{competition.description}</p>
            </div>
            
            <div className="flex flex-row md:flex-col items-center md:items-end gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 backdrop-blur-sm rounded-full border border-yellow-500/30 shadow-lg shadow-yellow-500/10">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <div className="text-center">
                  <p className="text-xs text-yellow-400/80">Rank</p>
                  <p className="text-lg font-bold text-yellow-500">#{participation.currentRank || '—'}</p>
                </div>
              </div>
              {isAtRisk && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 backdrop-blur-sm rounded-full border border-red-500/30 animate-pulse">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-bold text-red-500">At Risk</span>
                </div>
              )}
            </div>
          </div>

          {/* Time Remaining with Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">
                {daysRemaining > 0
                  ? `${daysRemaining} days ${hoursRemaining % 24}h remaining`
                  : `${hoursRemaining}h remaining`}
              </span>
            </div>
            {participantStats && (
              <div className="flex items-center gap-2 text-xs text-gray-500 sm:ml-auto">
                <Users className="h-3 w-3" />
                <span>{participantStats.active}/{participantStats.total} Active</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid - Responsive */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Capital */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-blue-500/50 transition-colors">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 block" />
            <span>Current Capital</span>
          </div>
          <p className="text-xl font-bold text-gray-100 mb-3">
            {formatCurrency(participation.currentCapital)}
          </p>
          <div className="mt-2">
            <Progress value={capitalPercentage} className="h-2" />
            <p className="text-xs text-gray-500 mt-2">
              {capitalPercentage.toFixed(1)}% of starting capital
            </p>
          </div>
        </div>

        {/* P&L */}
        <div className={`rounded-xl p-4 border transition-colors ${
          isProfitable 
            ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50' 
            : 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
        }`}>
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full block ${isProfitable ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>Total P&L</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            {isProfitable ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <p
              className={`text-xl font-bold ${
                isProfitable ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {formatCurrency(participation.pnl)}
            </p>
          </div>
          <p className={`text-xs font-semibold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
            {participation.pnlPercentage >= 0 ? '+' : ''}
            {participation.pnlPercentage.toFixed(2)}% ROI
          </p>
        </div>

        {/* Positions */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-purple-500/50 transition-colors">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 block" />
            <span>Open Positions</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5 text-purple-500" />
            <p className="text-xl font-bold text-gray-100">{openPositionsCount}</p>
          </div>
          <p className="text-xs text-gray-500">
            {formatCurrency(participation.usedMargin)} margin
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-yellow-500/50 transition-colors">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 block" />
            <span>Win Rate</span>
          </div>
          <p className="text-xl font-bold text-yellow-500 mb-1">
            {participation.winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500">
            {participation.totalTrades} total trades
          </p>
        </div>
      </div>

      {/* Performance Metrics - Responsive Grid */}
      <div className="px-6 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-gray-700/50 pt-4">
        <div className="bg-gray-900/30 rounded-lg p-3 text-center border border-gray-700/30">
          <p className="text-xs text-gray-400 mb-1">Realized P&L</p>
          <p
            className={`text-base font-bold ${
              participation.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {formatCurrency(participation.realizedPnl)}
          </p>
        </div>
        <div className="bg-gray-900/30 rounded-lg p-3 text-center border border-gray-700/30">
          <p className="text-xs text-gray-400 mb-1">Unrealized P&L</p>
          <p
            className={`text-base font-bold ${
              participation.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {formatCurrency(participation.unrealizedPnl)}
          </p>
        </div>
        <div className="bg-gray-900/30 rounded-lg p-3 text-center border border-gray-700/30 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400 mb-1">Max Drawdown</p>
          <p className="text-base font-bold text-red-500">
            {participation.maxDrawdownPercentage.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Recent Trades - No Scrollbar Visible */}
      {recentTrades.length > 0 && (
        <div className="px-6 pb-4 border-t border-gray-700/50 pt-4">
          <div className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 block" />
            <span>Recent Trades</span>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
            {recentTrades.slice(0, 5).map((trade: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between text-xs bg-gray-900/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-200">{trade.symbol}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      trade.side === 'long'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {trade.side.toUpperCase()}
                  </span>
                </div>
                <span
                  className={`font-bold ${
                    (trade.realizedPnl || trade.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {formatCurrency(trade.realizedPnl || trade.pnl || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="p-4 bg-gradient-to-r from-gray-900/80 to-gray-900/50 border-t border-gray-700/50">
        <Link
          href={`/competitions/${competition._id}/trade`}
          className="block w-full py-3 px-6 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-gray-900 font-bold rounded-xl text-center transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-500/50"
        >
          <span className="flex items-center justify-center gap-2">
            Trade Now
            <TrendingUp className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}

