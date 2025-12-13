'use client';

import { Trophy, TrendingUp, Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  calculateWinProbability, 
  getMetricName, 
  formatMetricValue,
  type RankingMethod 
} from '@/lib/services/win-probability.service';

interface WinPotentialCardProps {
  competition: {
    _id: string;
    name: string;
    rankingMethod: RankingMethod;
    prizeDistribution: { rank: number; percentage: number }[];
    minimumTrades: number;
  };
  userParticipation: {
    userId: string;
    currentCapital: number;
    startingCapital: number;
    pnl: number;
    pnlPercentage: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    currentRank: number;
    status: string;
  };
  allParticipants: any[];
}

export default function WinPotentialCard({ 
  competition, 
  userParticipation, 
  allParticipants 
}: WinPotentialCardProps) {
  const winData = calculateWinProbability(
    userParticipation,
    allParticipants,
    {
      rankingMethod: competition.rankingMethod,
      prizeDistribution: competition.prizeDistribution,
      totalParticipants: allParticipants.length,
      minimumTrades: competition.minimumTrades,
    }
  );

  const getStatusColor = () => {
    switch (winData.status) {
      case 'winning':
        return {
          bg: 'from-green-500/20 to-emerald-500/20',
          border: 'border-green-500/50',
          text: 'text-green-400',
          icon: CheckCircle2,
        };
      case 'close':
        return {
          bg: 'from-yellow-500/20 to-orange-500/20',
          border: 'border-yellow-500/50',
          text: 'text-yellow-400',
          icon: TrendingUp,
        };
      case 'far':
        return {
          bg: 'from-blue-500/10 to-purple-500/10',
          border: 'border-blue-500/30',
          text: 'text-blue-400',
          icon: Target,
        };
      case 'disqualified':
        return {
          bg: 'from-red-500/10 to-rose-500/10',
          border: 'border-red-500/30',
          text: 'text-red-400',
          icon: AlertCircle,
        };
    }
  };

  const statusColors = getStatusColor();
  const StatusIcon = statusColors.icon;

  return (
    <div className={cn(
      "bg-gradient-to-br rounded-xl border-2 p-4 transition-all hover:scale-[1.02]",
      statusColors.bg,
      statusColors.border
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg",
            winData.status === 'winning' ? 'bg-green-500/20' : 
            winData.status === 'close' ? 'bg-yellow-500/20' : 
            'bg-blue-500/20'
          )}>
            <Trophy className={cn("h-4 w-4", statusColors.text)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-300">Win Potential</p>
            <p className="text-xs text-gray-500">{competition.name}</p>
          </div>
        </div>
        <StatusIcon className={cn("h-5 w-5", statusColors.text)} />
      </div>

      {/* Rank Display */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className={cn("text-3xl font-black", statusColors.text)}>
            {winData.currentRank > 0 ? `#${winData.currentRank}` : '-'}
          </p>
          <p className="text-xs text-gray-400">
            {winData.totalWinners > 1 ? `Top ${winData.totalWinners} win prizes` : 'Winner takes all'}
          </p>
        </div>
        
        {/* Probability Gauge */}
        <div className="flex flex-col items-end">
          <div className="relative">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                className="text-gray-700"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - winData.probabilityScore / 100)}`}
                className={cn(
                  "transition-all duration-1000",
                  winData.status === 'winning' ? 'text-green-400' :
                  winData.status === 'close' ? 'text-yellow-400' :
                  'text-blue-400'
                )}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-lg font-bold", statusColors.text)}>
                {winData.probabilityScore}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Win Score</p>
        </div>
      </div>

      {/* Message */}
      <div className={cn(
        "rounded-lg p-2 mb-3 border",
        winData.status === 'winning' ? 'bg-green-500/10 border-green-500/30' :
        winData.status === 'close' ? 'bg-yellow-500/10 border-yellow-500/30' :
        winData.status === 'disqualified' ? 'bg-red-500/10 border-red-500/30' :
        'bg-blue-500/10 border-blue-500/30'
      )}>
        <p className="text-xs text-gray-200 text-center font-medium">
          {winData.message}
        </p>
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Criteria:</span>
          <span className="text-gray-200 font-semibold">
            {getMetricName(competition.rankingMethod)}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Your Score:</span>
          <span className={cn("font-bold", statusColors.text)}>
            {formatMetricValue(winData.metricValue, competition.rankingMethod)}
          </span>
        </div>

        {winData.currentRank > 1 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Leader:</span>
            <span className="text-yellow-400 font-bold">
              {formatMetricValue(winData.topCompetitorMetric, competition.rankingMethod)}
            </span>
          </div>
        )}

        {!winData.meetsMinimumTrades && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-700">
            <span className="text-red-400">⚠️ Minimum Trades:</span>
            <span className="text-red-400 font-bold">
              {userParticipation.totalTrades}/{competition.minimumTrades}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

