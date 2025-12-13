'use client';

import { useState } from 'react';
import { Users, UserCheck, Skull, UserX, Trophy, TrendingUp, TrendingDown, Crown, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ParticipantStatsProps {
  stats: {
    counts: {
      active: number;
      liquidated: number;
      completed: number;
      disqualified: number;
      total: number;
    };
    active: any[];
    liquidated: any[];
    disqualified: any[];
  };
}

type ViewMode = 'overview' | 'active' | 'liquidated' | 'disqualified';

export default function ParticipantStats({ stats }: ParticipantStatsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  const participantData = [
    {
      mode: 'active' as ViewMode,
      label: 'Active',
      count: stats.counts.active,
      icon: UserCheck,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      hoverBg: 'hover:bg-green-500/20',
    },
    {
      mode: 'liquidated' as ViewMode,
      label: 'Liquidated',
      count: stats.counts.liquidated,
      icon: Skull,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      hoverBg: 'hover:bg-red-500/20',
    },
    {
      mode: 'disqualified' as ViewMode,
      label: 'Disqualified',
      count: stats.counts.disqualified,
      icon: UserX,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      hoverBg: 'hover:bg-orange-500/20',
    },
  ];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Trophy className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Trophy className="h-4 w-4 text-orange-600" />;
    return <span className="text-xs font-bold text-gray-500">#{rank}</span>;
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden sticky top-4">
      {/* Total Participants Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-transparent p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Users className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Participants</p>
            <p className="text-3xl font-bold text-gray-100">{stats.counts.total}</p>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="p-4 space-y-2">
        {participantData.map((item) => (
          <button
            key={item.mode}
            onClick={() => setViewMode(viewMode === item.mode ? 'overview' : item.mode)}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${item.bgColor} ${item.borderColor} ${item.hoverBg} ${
              viewMode === item.mode ? 'ring-2 ring-yellow-500/50 scale-[1.02]' : 'hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className={`h-5 w-5 ${item.color}`} />
              <span className="text-sm font-semibold text-gray-300">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${item.color}`}>{item.count}</span>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${
                viewMode === item.mode ? 'rotate-180' : ''
              }`} />
            </div>
          </button>
        ))}
      </div>

      {/* Participant Details */}
      {viewMode !== 'overview' && (
        <div className="border-t border-gray-700/50">
          <div className="p-4 max-h-96 overflow-y-auto scrollbar-hide">
            {viewMode === 'active' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-yellow-500" />
                  Active Traders (Top {stats.active.length})
                </p>
                {stats.active.map((participant: any) => (
                  <div
                    key={participant._id}
                    className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 hover:border-green-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getRankIcon(participant.currentRank)}
                        <span className="text-sm font-bold text-gray-200 truncate max-w-[140px]">
                          {participant.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {participant.pnl >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className={`text-xs font-bold ${participant.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {participant.pnlPercentage >= 0 ? '+' : ''}{participant.pnlPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Capital:</span>
                        <span className="font-semibold text-gray-300">{formatCurrency(participant.currentCapital)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Win Rate:</span>
                        <span className="font-semibold text-yellow-500">{participant.winRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Trades:</span>
                        <span className="font-semibold text-gray-300">{participant.totalTrades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Positions:</span>
                        <span className="font-semibold text-blue-500">{participant.currentOpenPositions}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'liquidated' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Skull className="h-3 w-3 text-red-500" />
                  Liquidated Traders
                </p>
                {stats.liquidated.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No liquidations yet</p>
                ) : (
                  stats.liquidated.map((participant: any) => (
                    <div
                      key={participant._id}
                      className="bg-red-500/10 rounded-lg p-3 border border-red-500/30 hover:border-red-500/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-200 truncate max-w-[140px]">
                          {participant.username}
                        </span>
                        <span className="text-xs font-bold text-red-500">
                          {formatCurrency(participant.pnl)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Final Capital:</span>
                          <span className="font-semibold text-gray-300">{formatCurrency(participant.currentCapital)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Trades:</span>
                          <span className="font-semibold text-gray-300">{participant.totalTrades}</span>
                        </div>
                      </div>
                      {participant.liquidationReason && (
                        <p className="text-xs text-red-400 bg-red-500/10 rounded p-2 border border-red-500/20">
                          💀 {participant.liquidationReason}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {viewMode === 'disqualified' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <UserX className="h-3 w-3 text-orange-500" />
                  Disqualified Traders
                </p>
                {stats.disqualified.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No disqualifications</p>
                ) : (
                  stats.disqualified.map((participant: any) => (
                    <div
                      key={participant._id}
                      className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/30 hover:border-orange-500/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-200 truncate max-w-[140px]">
                          {participant.username}
                        </span>
                        <span className="text-xs font-bold text-orange-500">
                          {formatCurrency(participant.pnl)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Capital:</span>
                          <span className="font-semibold text-gray-300">{formatCurrency(participant.currentCapital)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Trades:</span>
                          <span className="font-semibold text-gray-300">{participant.totalTrades}</span>
                        </div>
                      </div>
                      {participant.disqualificationReason && (
                        <p className="text-xs text-orange-400 bg-orange-500/10 rounded p-2 border border-orange-500/20">
                          ⚠️ {participant.disqualificationReason}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Survival Rate - Always Visible */}
      {viewMode === 'overview' && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Survival Rate</span>
            <span className="text-sm font-bold text-yellow-500">
              {((stats.counts.active / stats.counts.total) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-yellow-600 transition-all duration-500 relative"
              style={{ width: `${(stats.counts.active / stats.counts.total) * 100}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

