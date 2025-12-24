'use client';

import { Trophy, TrendingUp, TrendingDown, Target, AlertCircle, CheckCircle2, Crown, Medal, Zap, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
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

  // Calculate gap to leader
  const gap = winData.metricValue - winData.topCompetitorMetric;
  const gapAbs = Math.abs(gap);
  const isLeading = gap >= 0 && winData.currentRank === 1;
  
  // Get status styling
  const getStatusConfig = () => {
    if (winData.status === 'disqualified') {
      return {
        gradient: 'from-red-950 to-gray-900',
        border: 'border-red-500/40',
        accent: 'text-red-400',
        accentBg: 'bg-red-500/20',
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        RankIcon: AlertCircle,
      };
    }
    if (winData.status === 'winning') {
      return {
        gradient: 'from-emerald-950 to-gray-900',
        border: 'border-emerald-500/40',
        accent: 'text-emerald-400',
        accentBg: 'bg-emerald-500/20',
        badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        RankIcon: winData.currentRank === 1 ? Crown : Medal,
      };
    }
    if (winData.status === 'close') {
      return {
        gradient: 'from-amber-950 to-gray-900',
        border: 'border-amber-500/40',
        accent: 'text-amber-400',
        accentBg: 'bg-amber-500/20',
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        RankIcon: TrendingUp,
      };
    }
    return {
      gradient: 'from-slate-800 to-gray-900',
      border: 'border-slate-600/40',
      accent: 'text-slate-400',
      accentBg: 'bg-slate-500/20',
      badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      RankIcon: Target,
    };
  };

  const config = getStatusConfig();
  const { RankIcon } = config;

  // Prize eligibility check
  const isInPrizePosition = winData.currentRank <= winData.totalWinners;

  return (
    <Link 
      href={`/competitions/${competition._id}`}
      className={cn(
        "block bg-gradient-to-br rounded-xl border overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:shadow-black/20 hover:border-opacity-60 hover:-translate-y-0.5",
        config.gradient,
        config.border
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("p-1.5 rounded-lg shrink-0", config.accentBg)}>
              <Trophy className={cn("h-4 w-4", config.accent)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {competition.name}
              </p>
              <p className="text-xs text-gray-500">
                {allParticipants.length} participants
              </p>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-medium border shrink-0",
            config.badge
          )}>
            {winData.status === 'winning' ? '🏆 Winning' : 
             winData.status === 'close' ? '🔥 Close' :
             winData.status === 'disqualified' ? '⚠️ DQ' : '📊 Active'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Rank & Score Row */}
        <div className="flex items-center justify-between mb-4">
          {/* Current Rank */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              isInPrizePosition ? config.accentBg : 'bg-gray-800/80'
            )}>
              {winData.currentRank === 1 ? (
                <Crown className={cn("h-7 w-7", config.accent)} />
              ) : winData.currentRank <= 3 ? (
                <Medal className={cn("h-7 w-7", config.accent)} />
              ) : (
                <span className={cn("text-2xl font-black", config.accent)}>
                  {winData.currentRank > 0 ? winData.currentRank : '-'}
                </span>
              )}
            </div>
            <div>
              <p className={cn("text-2xl font-black", config.accent)}>
                #{winData.currentRank > 0 ? winData.currentRank : '-'}
              </p>
              <p className="text-xs text-gray-500">
                {isInPrizePosition ? (
                  <span className={config.accent}>Prize position</span>
                ) : (
                  `Top ${winData.totalWinners} win`
                )}
              </p>
            </div>
          </div>

          {/* Win Score Gauge */}
          <div className="text-right">
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  className="text-gray-800"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - winData.probabilityScore / 100)}`}
                  className={cn("transition-all duration-700", config.accent)}
                  strokeLinecap="round"
                />
              </svg>
              <span className={cn("absolute text-sm font-bold", config.accent)}>
                {winData.probabilityScore}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Score</p>
          </div>
        </div>

        {/* Gap Indicator */}
        {winData.currentRank > 1 && !winData.status.includes('disqualified') && (
          <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {gap >= 0 ? (
                  <ArrowUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-400" />
                )}
                <span className="text-xs text-gray-400">Gap to #1</span>
              </div>
              <span className={cn(
                "text-sm font-bold",
                gap >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {gap >= 0 ? '+' : ''}{formatMetricValue(gap, competition.rankingMethod)}
              </span>
            </div>
            
            {/* Progress bar showing gap */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    isLeading ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                  style={{ 
                    width: `${Math.min(100, isLeading ? 100 : (winData.metricValue / (winData.topCompetitorMetric || 1)) * 100)}%` 
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 shrink-0">
                {isLeading ? 'Leading' : `${((winData.metricValue / (winData.topCompetitorMetric || 1)) * 100).toFixed(0)}%`}
              </span>
            </div>
          </div>
        )}

        {/* Leading indicator for 1st place */}
        {winData.currentRank === 1 && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center justify-center gap-2">
              <Crown className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                You're in the lead! 🎯
              </span>
            </div>
            {gap > 0 && allParticipants.length > 1 && (
              <p className="text-xs text-emerald-400/70 text-center mt-1">
                +{formatMetricValue(gap, competition.rankingMethod)} ahead of #2
              </p>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Your Score */}
          <div className="p-2.5 rounded-lg bg-gray-800/50">
            <p className="text-xs text-gray-500 mb-1">Your {getMetricName(competition.rankingMethod)}</p>
            <p className={cn("text-lg font-bold", config.accent)}>
              {formatMetricValue(winData.metricValue, competition.rankingMethod)}
            </p>
          </div>
          
          {/* Leader Score */}
          <div className="p-2.5 rounded-lg bg-gray-800/50">
            <p className="text-xs text-gray-500 mb-1">Leader</p>
            <p className="text-lg font-bold text-yellow-400">
              {formatMetricValue(winData.topCompetitorMetric, competition.rankingMethod)}
            </p>
          </div>
        </div>

        {/* Minimum Trades Warning */}
        {!winData.meetsMinimumTrades && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-xs text-red-400 font-medium">Min trades required</span>
              </div>
              <span className="text-sm font-bold text-red-400">
                {userParticipation.totalTrades}/{competition.minimumTrades}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-red-900/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${(userParticipation.totalTrades / competition.minimumTrades) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={cn(
        "px-4 py-2.5 border-t border-white/5 flex items-center justify-between",
        "bg-black/20"
      )}>
        <span className="text-xs text-gray-500">
          {getMetricName(competition.rankingMethod)}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          View Details
          <Zap className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}
