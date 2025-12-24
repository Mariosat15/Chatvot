'use client';

import { Trophy, TrendingUp, TrendingDown, Target, AlertCircle, Crown, Medal, Zap, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { 
  calculateWinProbability, 
  formatMetricValue,
  type RankingMethod,
  type ParticipantMetrics,
} from '@/lib/services/win-probability.service';
import { getRankingConfig, getMetricIcon } from '@/lib/services/ranking-config.service';

interface WinPotentialCardProps {
  competition: {
    _id: string;
    name: string;
    rankingMethod: RankingMethod;
    prizeDistribution: { rank: number; percentage: number }[];
    minimumTrades: number;
  };
  userParticipation: ParticipantMetrics;
  allParticipants: ParticipantMetrics[];
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

  const rankingConfig = getRankingConfig(competition.rankingMethod);
  const RankingIcon = rankingConfig.icon;

  // Calculate gap to leader
  const gap = winData.gapToLeader;
  const gapAbs = Math.abs(gap);
  const isLeading = winData.currentRank === 1;
  
  // Color schemes based on ranking method
  const methodColorSchemes: Record<string, { gradient: string; border: string; accent: string; accentBg: string; badge: string }> = {
    emerald: {
      gradient: 'from-emerald-950/80 to-gray-900',
      border: 'border-emerald-500/40',
      accent: 'text-emerald-400',
      accentBg: 'bg-emerald-500/20',
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    blue: {
      gradient: 'from-blue-950/80 to-gray-900',
      border: 'border-blue-500/40',
      accent: 'text-blue-400',
      accentBg: 'bg-blue-500/20',
      badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    yellow: {
      gradient: 'from-yellow-950/80 to-gray-900',
      border: 'border-yellow-500/40',
      accent: 'text-yellow-400',
      accentBg: 'bg-yellow-500/20',
      badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
    cyan: {
      gradient: 'from-cyan-950/80 to-gray-900',
      border: 'border-cyan-500/40',
      accent: 'text-cyan-400',
      accentBg: 'bg-cyan-500/20',
      badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    },
    orange: {
      gradient: 'from-orange-950/80 to-gray-900',
      border: 'border-orange-500/40',
      accent: 'text-orange-400',
      accentBg: 'bg-orange-500/20',
      badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    },
    purple: {
      gradient: 'from-purple-950/80 to-gray-900',
      border: 'border-purple-500/40',
      accent: 'text-purple-400',
      accentBg: 'bg-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    indigo: {
      gradient: 'from-indigo-950/80 to-gray-900',
      border: 'border-indigo-500/40',
      accent: 'text-indigo-400',
      accentBg: 'bg-indigo-500/20',
      badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    },
    red: {
      gradient: 'from-red-950/80 to-gray-900',
      border: 'border-red-500/40',
      accent: 'text-red-400',
      accentBg: 'bg-red-500/20',
      badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
    pink: {
      gradient: 'from-pink-950/80 to-gray-900',
      border: 'border-pink-500/40',
      accent: 'text-pink-400',
      accentBg: 'bg-pink-500/20',
      badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    },
  };

  // Get status-based styling (override method color for DQ status)
  const getStatusConfig = () => {
    if (winData.status === 'disqualified') {
      return {
        gradient: 'from-red-950 to-gray-900',
        border: 'border-red-500/40',
        accent: 'text-red-400',
        accentBg: 'bg-red-500/20',
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
      };
    }
    
    // Use ranking method color for non-DQ statuses
    return methodColorSchemes[rankingConfig.color] || methodColorSchemes.emerald;
  };

  const config = getStatusConfig();

  // Status badge content
  const getStatusBadge = () => {
    if (winData.status === 'disqualified') return { emoji: '⚠️', text: 'DQ' };
    if (winData.status === 'winning') return { emoji: '🏆', text: 'Winning' };
    if (winData.status === 'close') return { emoji: '🔥', text: 'Close' };
    return { emoji: '📊', text: 'Active' };
  };

  const statusBadge = getStatusBadge();
  const isInPrizePosition = winData.currentRank <= winData.totalWinners && winData.currentRank > 0;

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
      {/* Header with Competition Name & Ranking Method */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center justify-between gap-2">
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
            {statusBadge.emoji} {statusBadge.text}
          </div>
        </div>
      </div>

      {/* Ranking Method Banner - PROMINENT DISPLAY */}
      <div className={cn(
        "px-4 py-2 flex items-center justify-between",
        config.accentBg,
        "border-b border-white/5"
      )}>
        <div className="flex items-center gap-2">
          <RankingIcon className={cn("h-4 w-4", config.accent)} />
          <span className={cn("text-sm font-bold", config.accent)}>
            {rankingConfig.fullName}
          </span>
        </div>
        <div className="group relative">
          <Info className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300 cursor-help" />
          <div className="absolute right-0 top-full mt-1 w-48 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
            {rankingConfig.description}
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
              ) : winData.currentRank <= 3 && winData.currentRank > 0 ? (
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

        {/* Gap Indicator (for non-leaders) */}
        {winData.currentRank > 1 && winData.status !== 'disqualified' && (
          <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {gap >= 0 ? (
                  <ArrowUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-400" />
                )}
                <span className="text-xs text-gray-400">Gap to #1 ({rankingConfig.name})</span>
              </div>
              <span className={cn(
                "text-sm font-bold",
                gap >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {gap >= 0 ? '+' : ''}{formatMetricValue(gap, competition.rankingMethod)}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    winData.percentOfLeader >= 90 ? 'bg-emerald-500' : 
                    winData.percentOfLeader >= 70 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${Math.min(100, Math.max(5, winData.percentOfLeader))}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 shrink-0 w-10 text-right">
                {winData.percentOfLeader}%
              </span>
            </div>
          </div>
        )}

        {/* Leading indicator for 1st place */}
        {isLeading && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center justify-center gap-2">
              <Crown className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                You're leading in {rankingConfig.name}! 🎯
              </span>
            </div>
            {winData.gapToNextRank !== null && allParticipants.length > 1 && (
              <p className="text-xs text-emerald-400/70 text-center mt-1">
                +{formatMetricValue(Math.abs(winData.gapToNextRank), competition.rankingMethod)} ahead of #2
              </p>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Your Score */}
          <div className="p-2.5 rounded-lg bg-gray-800/50">
            <p className="text-xs text-gray-500 mb-1">Your {rankingConfig.name}</p>
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
                style={{ width: `${Math.min(100, (userParticipation.totalTrades / competition.minimumTrades) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer with Ranking Method */}
      <div className={cn(
        "px-4 py-2.5 border-t border-white/5 flex items-center justify-between",
        "bg-black/20"
      )}>
        <div className="flex items-center gap-2">
          <RankingIcon className={cn("h-3.5 w-3.5", config.accent)} />
          <span className="text-xs text-gray-500">
            Ranked by {rankingConfig.name}
          </span>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          View Details
          <Zap className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}
