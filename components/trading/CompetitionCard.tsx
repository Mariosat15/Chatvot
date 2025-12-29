'use client';

import { Trophy, Users, Clock, Calendar, CheckCircle, Zap, Target, Flame, Crown, Sparkles, Timer, ChevronRight, Swords, Gamepad2, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { enterCompetition } from '@/lib/actions/trading/competition.actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { DifficultyBadge } from '@/components/ui/difficulty-badge';
import { calculateCompetitionDifficulty } from '@/lib/utils/competition-difficulty';

// Level names mapping
const LEVEL_NAMES: Record<number, { emoji: string; name: string }> = {
  1: { emoji: '🌱', name: 'Novice Trader' },
  2: { emoji: '📚', name: 'Apprentice Trader' },
  3: { emoji: '⚔️', name: 'Skilled Trader' },
  4: { emoji: '🎯', name: 'Expert Trader' },
  5: { emoji: '💎', name: 'Elite Trader' },
  6: { emoji: '👑', name: 'Master Trader' },
  7: { emoji: '🔥', name: 'Grand Master' },
  8: { emoji: '⚡', name: 'Trading Champion' },
  9: { emoji: '🌟', name: 'Market Legend' },
  10: { emoji: '👑', name: 'Trading God' },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CompetitionCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  userBalance: number;
  isCompleted?: boolean;
  isUserIn?: boolean;
  viewMode?: 'card' | 'list';
}

// Competition type images and colors
const COMPETITION_THEMES: Record<string, { gradient: string; glow: string; icon: string; bgPattern: string }> = {
  pnl: {
    gradient: 'from-emerald-600 via-green-500 to-teal-400',
    glow: 'shadow-emerald-500/50',
    icon: '💰',
    bgPattern: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/40 via-gray-900 to-gray-900',
  },
  roi: {
    gradient: 'from-blue-600 via-cyan-500 to-sky-400',
    glow: 'shadow-blue-500/50',
    icon: '📈',
    bgPattern: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/40 via-gray-900 to-gray-900',
  },
  total_capital: {
    gradient: 'from-purple-600 via-violet-500 to-fuchsia-400',
    glow: 'shadow-purple-500/50',
    icon: '💎',
    bgPattern: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/40 via-gray-900 to-gray-900',
  },
  win_rate: {
    gradient: 'from-amber-600 via-yellow-500 to-orange-400',
    glow: 'shadow-amber-500/50',
    icon: '🎯',
    bgPattern: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-900/40 via-gray-900 to-gray-900',
  },
  total_wins: {
    gradient: 'from-red-600 via-rose-500 to-pink-400',
    glow: 'shadow-red-500/50',
    icon: '🏆',
    bgPattern: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/40 via-gray-900 to-gray-900',
  },
  profit_factor: {
    gradient: 'from-indigo-600 via-blue-500 to-cyan-400',
    glow: 'shadow-indigo-500/50',
    icon: '⚡',
    bgPattern: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-gray-900 to-gray-900',
  },
};

const RANKING_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  pnl: { name: 'Profit & Loss', description: 'Highest absolute profit wins' },
  roi: { name: 'Return on Investment', description: 'Best % return wins' },
  total_capital: { name: 'Total Capital', description: 'Highest final balance wins' },
  win_rate: { name: 'Win Rate', description: 'Best win percentage wins' },
  total_wins: { name: 'Total Wins', description: 'Most winning trades wins' },
  profit_factor: { name: 'Profit Factor', description: 'Best profit/loss ratio wins' },
};

export default function CompetitionCard({
  competition,
  userBalance,
  isCompleted = false,
  isUserIn = false,
  viewMode = 'card',
}: CompetitionCardProps) {
  const [entering, setEntering] = useState(false);
  const [liveCountdown, setLiveCountdown] = useState('');
  const router = useRouter();
  const { formatCredits, settings } = useAppSettings();

  const canAfford = userBalance >= (competition.entryFee || competition.entryFeeCredits || 0);
  const isFull = competition.currentParticipants >= competition.maxParticipants;
  const isActive = competition.status === 'active';
  const isUpcoming = competition.status === 'upcoming';
  const isCancelled = competition.status === 'cancelled';

  const rankingMethod = competition.rules?.rankingMethod || 'pnl';
  const theme = COMPETITION_THEMES[rankingMethod] || COMPETITION_THEMES.pnl;
  const rankingInfo = RANKING_DESCRIPTIONS[rankingMethod] || RANKING_DESCRIPTIONS.pnl;

  // Calculate difficulty
  // Get the actual max leverage from competition settings
  const maxLeverage = competition.leverage?.max || competition.leverageAllowed || 100;

  const difficulty = useMemo(() => {
    // Check if competition has manual difficulty setting
    if (competition.difficulty?.mode === 'manual' && competition.difficulty?.manualLevel) {
      const levelMap: Record<string, { level: string; score: number }> = {
        'beginner': { level: 'Beginner', score: 20 },
        'intermediate': { level: 'Intermediate', score: 40 },
        'advanced': { level: 'Advanced', score: 60 },
        'expert': { level: 'Expert', score: 80 },
        'extreme': { level: 'Extreme', score: 95 },
      };
      const mapped = levelMap[competition.difficulty.manualLevel] || { level: 'Intermediate', score: 40 };
      return {
        level: mapped.level as 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Extreme',
        score: mapped.score,
        factors: [{ factor: 'Manually Set', impact: 'high' as const, score: mapped.score }],
      };
    }
    
    // Auto-calculate difficulty using the correct leverage field
    const start = new Date(competition.startTime);
    const end = new Date(competition.endTime);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return calculateCompetitionDifficulty({
      entryFeeCredits: competition.entryFee || competition.entryFeeCredits || 0,
      startingCapital: competition.startingCapital || competition.startingTradingPoints || 10000,
      leverageAllowed: maxLeverage,
      maxParticipants: competition.maxParticipants,
      participantCount: competition.currentParticipants,
      durationHours,
      rules: competition.rules,
      riskLimits: competition.riskLimits,
      levelRequirement: competition.levelRequirement,
    });
  }, [competition, maxLeverage]);

  // Live countdown
  const getTimeUntilStart = () => {
    const now = new Date();
    const start = new Date(competition.startTime);
    const diff = start.getTime() - now.getTime();

    if (diff < 0) return 'Started';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    if (isUpcoming) {
      setLiveCountdown(getTimeUntilStart());
      const interval = setInterval(() => {
        setLiveCountdown(getTimeUntilStart());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isUpcoming, competition.startTime]);

  const getDuration = () => {
    const start = new Date(competition.startTime);
    const end = new Date(competition.endTime);
    const diff = end.getTime() - start.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    
    return parts.join(' ');
  };

  const getPrizePool = () => competition.prizePool || competition.prizePoolCredits || 0;
  const getEntryFee = () => competition.entryFee || competition.entryFeeCredits || 0;

  const handleEnter = async () => {
    if (!canAfford || isFull) return;
    setEntering(true);
    try {
      await enterCompetition(competition._id);
      toast.success('Successfully entered competition!');
      router.push(`/competitions/${competition._id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to enter competition');
      setEntering(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <Link href={`/competitions/${competition._id}`}>
        <div className={`group relative overflow-hidden rounded-xl ${theme.bgPattern} border border-gray-700/50 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-xl hover:${theme.glow}`}>
          <div className="flex flex-col">
            {/* Main Row */}
            <div className="flex items-center gap-4 p-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-2xl shadow-lg ${theme.glow}`}>
                {theme.icon}
              </div>

              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-100 truncate group-hover:text-yellow-400 transition-colors">
                    {competition.name}
                  </h3>
                  {isActive && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold animate-pulse">
                      LIVE
                    </span>
                  )}
                  {isCompleted && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-bold">
                      COMPLETED
                    </span>
                  )}
                  {isCancelled && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      CANCELLED
                    </span>
                  )}
                  {isUserIn && !isCompleted && !isCancelled && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold border border-green-500/40">
                      ✓ ENTERED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${theme.gradient}`}></span>
                    {rankingInfo.name}
                  </span>
                  <DifficultyBadge difficulty={difficulty} size="sm" showTooltip={true} />
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {competition.currentParticipants}/{competition.maxParticipants}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getDuration()}
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="flex-shrink-0 text-right px-3 border-l border-gray-700/50">
                <div className="text-xs text-gray-500 mb-0.5">Start</div>
                <div className="text-sm font-medium text-gray-300">{formatDateTime(competition.startTime)}</div>
              </div>
              <div className="flex-shrink-0 text-right px-3 border-l border-gray-700/50">
                <div className="text-xs text-gray-500 mb-0.5">End</div>
                <div className="text-sm font-medium text-gray-300">{formatDateTime(competition.endTime)}</div>
              </div>

              {/* Prize */}
              <div className="flex-shrink-0 text-right px-3 border-l border-gray-700">
                <div className="flex items-center gap-1 text-yellow-500">
                  <Trophy className="h-4 w-4" />
                  <span className="text-xl font-black">{getPrizePool().toFixed(0)}</span>
                </div>
                <p className="text-xs text-gray-500">Prize Pool</p>
              </div>

              {/* Entry Fee */}
              <div className="flex-shrink-0 text-right px-4 border-l border-gray-700">
                <div className="text-lg font-bold text-gray-100">{getEntryFee()}</div>
                <p className="text-xs text-gray-500">Entry</p>
              </div>

              {/* Countdown/Status */}
              <div className="flex-shrink-0 w-24 text-center">
                {isUpcoming && (
                  <div className="px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                    <p className="text-xs text-yellow-400 font-mono font-bold">{liveCountdown}</p>
                  </div>
                )}
                {isActive && (
                  <div className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                    <p className="text-xs text-blue-400 font-bold">TRADING</p>
                  </div>
                )}
                {isCompleted && (
                  <div className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30">
                    <p className="text-xs text-green-400 font-bold">ENDED</p>
                  </div>
                )}
                {isCancelled && (
                  <div className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
                    <p className="text-xs text-red-400 font-bold">CANCELLED</p>
                  </div>
                )}
              </div>

              {/* Arrow */}
              <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-yellow-500 transition-colors" />
            </div>

            {/* Additional Info Row */}
            <div className="flex items-center gap-3 px-4 pb-3 pt-0 -mt-1">
              {/* Starting Capital */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Target className="h-3 w-3 text-purple-400" />
                <span className="text-[10px] text-purple-300 font-medium">
                  ${(competition.startingCapital || competition.startingTradingPoints || 10000).toLocaleString()}
                </span>
              </div>

              {/* Leverage */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Zap className="h-3 w-3 text-orange-400" />
                <span className="text-[10px] text-orange-300 font-medium">
                  1:{maxLeverage}
                </span>
              </div>

              {/* Minimum Trades */}
              {competition.rules?.minimumTrades && competition.rules.minimumTrades > 1 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <Swords className="h-3 w-3 text-cyan-400" />
                  <span className="text-[10px] text-cyan-300 font-medium">
                    Min {competition.rules.minimumTrades} trades
                  </span>
                </div>
              )}

              {/* Liquidation Risk */}
              {competition.rules?.disqualifyOnLiquidation && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Flame className="h-3 w-3 text-red-400" />
                  <span className="text-[10px] text-red-300 font-medium">
                    Liquidation = DQ
                  </span>
                </div>
              )}

              {/* Level Requirement */}
              {competition.levelRequirement?.enabled && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Crown className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] text-amber-300 font-medium">
                    Level {competition.levelRequirement.minLevel}+
                  </span>
                </div>
              )}

              {/* Risk Limits */}
              {competition.riskLimits?.enabled && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Target className="h-3 w-3 text-blue-400" />
                  <span className="text-[10px] text-blue-300 font-medium">
                    Max DD: {competition.riskLimits.maxDrawdownPercent}%
                  </span>
                </div>
              )}

              {/* Asset Classes */}
              <div className="flex items-center gap-1 ml-auto">
                {competition.assetClasses?.slice(0, 3).map((asset: string) => (
                  <span
                    key={asset}
                    className="px-2 py-0.5 rounded bg-gray-800/80 text-[10px] font-bold text-gray-400 uppercase border border-gray-700/50"
                  >
                    {asset === 'forex' && '💱'} {asset === 'crypto' && '₿'} {asset === 'stocks' && '📊'} {asset}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // CARD VIEW (Default)
  return (
    <div className={`group relative overflow-hidden rounded-2xl ${isCancelled ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/40 via-gray-900 to-gray-900' : theme.bgPattern} border ${isCancelled ? 'border-red-700/50 hover:border-red-500/50' : 'border-gray-700/50 hover:border-yellow-500/50'} transition-all duration-500 hover:shadow-2xl ${isCancelled ? 'hover:shadow-red-500/50' : `hover:${theme.glow}`} hover:-translate-y-2`}>
      {/* Animated Background Effects */}
      <div className="absolute inset-0 opacity-30">
        <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${isCancelled ? 'from-red-600 via-red-500 to-red-400' : theme.gradient} rounded-full blur-3xl -translate-y-32 translate-x-32 group-hover:scale-150 transition-transform duration-700`}></div>
        <div className={`absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr ${isCancelled ? 'from-red-600 via-red-500 to-red-400' : theme.gradient} rounded-full blur-3xl translate-y-24 -translate-x-24 group-hover:scale-150 transition-transform duration-700`}></div>
      </div>


      {/* Large Diagonal Watermark for Status */}
      {(isCompleted || isCancelled || isActive) && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center overflow-hidden">
          <div 
            className={`font-black tracking-wider uppercase select-none ${
              isCompleted 
                ? 'text-5xl md:text-6xl text-green-500/30' 
                : isCancelled
                ? 'text-5xl md:text-6xl text-red-500/30'
                : 'text-4xl md:text-5xl text-blue-500/25'
            }`}
            style={{
              transform: 'rotate(-25deg)',
              textShadow: isCompleted 
                ? '0 0 40px rgba(34, 197, 94, 0.4)' 
                : isCancelled
                ? '0 0 40px rgba(239, 68, 68, 0.4)'
                : '0 0 30px rgba(59, 130, 246, 0.3)',
              letterSpacing: '0.12em',
            }}
          >
            {isCompleted ? 'COMPLETED' : isCancelled ? 'CANCELLED' : 'LIVE'}
          </div>
        </div>
      )}

      {/* Status Badges - Only for upcoming and entered status */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {isUserIn && !isCompleted && !isCancelled && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold border border-green-500/40">
            <CheckCircle className="h-3 w-3" />
            ENTERED
          </span>
        )}
      </div>

      {/* Card Content */}
      <div className="relative z-10 p-6">
        {/* Competition Type Badge */}
        <div className="flex justify-center mb-4">
          <div className={`relative group/type cursor-default`}>
            <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} rounded-xl blur opacity-50 group-hover/type:opacity-80 transition-opacity`}></div>
            <div className={`relative flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/80 border border-gray-700 backdrop-blur`}>
              <span className="text-2xl">{theme.icon}</span>
              <div>
                <p className={`text-sm font-black bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                  {rankingInfo.name}
                </p>
                <p className="text-[10px] text-gray-400">{rankingInfo.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Competition Name */}
        <h3 className="text-xl font-black text-center text-gray-100 mb-2 group-hover:text-yellow-400 transition-colors">
          {competition.name}
        </h3>
        
        {/* Difficulty Badge */}
        <div className="flex justify-center mb-3">
          <DifficultyBadge difficulty={difficulty} size="md" showTooltip={true} />
        </div>
        
        <p className="text-sm text-gray-400 text-center mb-4">{competition.description}</p>

        {/* Prize Pool - Casino Style */}
        <div className="relative mb-5">
          <div className={`absolute inset-0 bg-gradient-to-r ${isCancelled ? 'from-red-500/20 via-red-500/20 to-red-500/20' : 'from-yellow-500/20 via-amber-500/20 to-yellow-500/20'} rounded-2xl blur-xl`}></div>
          <div className={`relative p-5 rounded-2xl bg-gradient-to-br ${isCancelled ? 'from-red-500/10 via-red-500/5 to-transparent border-2 border-red-500/40' : 'from-yellow-500/10 via-amber-500/5 to-transparent border-2 border-yellow-500/40'} overflow-hidden`}>
            {/* Casino-style decorative elements */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isCancelled ? 'via-red-400' : 'via-yellow-400'} to-transparent`}></div>
            <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isCancelled ? 'via-red-400' : 'via-yellow-400'} to-transparent`}></div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <Crown className={`h-4 w-4 ${isCancelled ? 'text-red-500' : 'text-yellow-500'}`} />
                  <p className={`text-xs font-bold ${isCancelled ? 'text-red-400' : 'text-yellow-400'} uppercase tracking-wider`}>
                    {isCancelled ? 'Prize Pool (Refunded)' : 'Grand Prize Pool'}
                  </p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${isCancelled ? 'from-red-400 via-red-300 to-red-500 line-through' : 'from-yellow-400 via-amber-300 to-yellow-500'} drop-shadow-lg`}>
                    {getPrizePool().toFixed(0)}
                  </span>
                  <span className={`text-sm font-bold ${isCancelled ? 'text-red-400/80' : 'text-yellow-400/80'}`}>{settings?.credits.symbol}</span>
                </div>
                {settings?.credits.showEUREquivalent && (
                  <p className="text-xs text-gray-500">≈ €{(getPrizePool() * (settings?.credits.valueInEUR || 1)).toFixed(2)}</p>
                )}
              </div>
              <div className="relative">
                <div className={`absolute inset-0 ${isCancelled ? 'bg-red-500' : 'bg-yellow-500'} rounded-xl blur-lg opacity-30 ${isCancelled ? '' : 'animate-pulse'}`}></div>
                <div className={`relative w-16 h-16 bg-gradient-to-br ${isCancelled ? 'from-red-400 to-red-600' : 'from-yellow-400 to-amber-600'} rounded-xl flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform`}>
                  <Trophy className={`h-9 w-9 ${isCancelled ? 'text-red-900' : 'text-yellow-900'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid - Gaming Style */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
            <div className={`absolute top-0 right-0 w-8 h-8 ${isCancelled ? 'bg-red-500/10' : 'bg-green-500/10'} rounded-full blur-lg`}></div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${isCancelled ? 'bg-red-500/20' : 'bg-green-500/20'} flex items-center justify-center`}>
                <Zap className={`h-4 w-4 ${isCancelled ? 'text-red-400' : 'text-green-400'}`} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Entry Fee</p>
                <p className={`text-sm font-bold ${isCancelled ? 'text-red-400 line-through' : 'text-gray-100'}`}>{getEntryFee()} {settings?.credits.symbol}</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
            <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500/10 rounded-full blur-lg"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Players</p>
                <p className="text-sm font-bold text-gray-100">
                  {competition.currentParticipants}
                  <span className="text-gray-500">/{competition.maxParticipants}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
            <div className="absolute top-0 right-0 w-8 h-8 bg-purple-500/10 rounded-full blur-lg"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Target className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Capital</p>
                <p className="text-sm font-bold text-gray-100">
                  ${(competition.startingCapital || 10000).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
            <div className="absolute top-0 right-0 w-8 h-8 bg-orange-500/10 rounded-full blur-lg"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Timer className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Duration</p>
                <p className="text-sm font-bold text-gray-100">{getDuration()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Leverage & Risk Info */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
            <div className="absolute top-0 right-0 w-8 h-8 bg-yellow-500/10 rounded-full blur-lg"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Zap className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Leverage</p>
                <p className="text-sm font-bold text-yellow-400">
                  1:{maxLeverage}
                </p>
              </div>
            </div>
          </div>

          {competition.rules?.minimumTrades && competition.rules.minimumTrades > 0 ? (
            <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
              <div className="absolute top-0 right-0 w-8 h-8 bg-cyan-500/10 rounded-full blur-lg"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Swords className="h-4 w-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Min Trades</p>
                  <p className="text-sm font-bold text-cyan-400">{competition.rules.minimumTrades}</p>
                </div>
              </div>
            </div>
          ) : competition.rules?.disqualifyOnLiquidation ? (
            <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
              <div className="absolute top-0 right-0 w-8 h-8 bg-red-500/10 rounded-full blur-lg"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Flame className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Liquidation</p>
                  <p className="text-sm font-bold text-red-400">= DQ</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
              <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/10 rounded-full blur-lg"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Status</p>
                  <p className="text-sm font-bold text-green-400">Open</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Starts</p>
                <p className="text-xs font-bold text-gray-100">{formatDate(competition.startTime)}</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Ends</p>
                <p className="text-xs font-bold text-gray-100">{formatDate(competition.endTime)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Countdown Timer - Casino Slot Style */}
        {isUpcoming && (
          <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center justify-center gap-3">
              <Flame className="h-4 w-4 text-yellow-500 animate-pulse" />
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Starts in</span>
                <span className="px-2 py-1 rounded bg-gray-900/80 font-mono text-yellow-400 font-bold text-sm">
                  {liveCountdown || getTimeUntilStart()}
                </span>
              </div>
              <Flame className="h-4 w-4 text-yellow-500 animate-pulse" />
            </div>
          </div>
        )}

        {/* Difficulty Bar */}
        <div className={`mb-4 p-3 rounded-xl border ${
          difficulty.level === 'Beginner' ? 'bg-green-500/10 border-green-500/30'
            : difficulty.level === 'Intermediate' ? 'bg-blue-500/10 border-blue-500/30'
            : difficulty.level === 'Advanced' ? 'bg-yellow-500/10 border-yellow-500/30'
            : difficulty.level === 'Expert' ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge className={`h-4 w-4 ${
                difficulty.level === 'Beginner' ? 'text-green-400'
                  : difficulty.level === 'Intermediate' ? 'text-blue-400'
                  : difficulty.level === 'Advanced' ? 'text-yellow-400'
                  : difficulty.level === 'Expert' ? 'text-orange-400'
                  : 'text-red-400'
              }`} />
              <span className={`text-xs font-bold ${
                difficulty.level === 'Beginner' ? 'text-green-400'
                  : difficulty.level === 'Intermediate' ? 'text-blue-400'
                  : difficulty.level === 'Advanced' ? 'text-yellow-400'
                  : difficulty.level === 'Expert' ? 'text-orange-400'
                  : 'text-red-400'
              }`}>
                {difficulty.level === 'Beginner' ? '🌱'
                  : difficulty.level === 'Intermediate' ? '📊'
                  : difficulty.level === 'Advanced' ? '⚡'
                  : difficulty.level === 'Expert' ? '🔥'
                  : '💀'} {difficulty.level}
              </span>
            </div>
            <span className={`text-xs font-mono ${
              difficulty.level === 'Beginner' ? 'text-green-400'
                : difficulty.level === 'Intermediate' ? 'text-blue-400'
                : difficulty.level === 'Advanced' ? 'text-yellow-400'
                : difficulty.level === 'Expert' ? 'text-orange-400'
                : 'text-red-400'
            }`}>
              {difficulty.score}/100
            </span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                difficulty.level === 'Beginner' ? 'bg-gradient-to-r from-green-600 to-green-400'
                  : difficulty.level === 'Intermediate' ? 'bg-gradient-to-r from-blue-600 to-blue-400'
                  : difficulty.level === 'Advanced' ? 'bg-gradient-to-r from-yellow-600 to-yellow-400'
                  : difficulty.level === 'Expert' ? 'bg-gradient-to-r from-orange-600 to-orange-400'
                  : 'bg-gradient-to-r from-red-600 to-red-400'
              }`}
              style={{ width: `${difficulty.score}%` }}
            />
          </div>
        </div>

        {/* Level Requirement */}
        {competition.levelRequirement?.enabled && (
          <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 via-violet-500/10 to-purple-500/10 border border-purple-500/30">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-purple-300">
                {(() => {
                  const minLevel = competition.levelRequirement.minLevel || 1;
                  const maxLevel = competition.levelRequirement.maxLevel;
                  const minInfo = LEVEL_NAMES[minLevel] || { emoji: '🌱', name: 'Novice Trader' };
                  
                  if (maxLevel && maxLevel !== minLevel) {
                    const maxInfo = LEVEL_NAMES[maxLevel] || { emoji: '👑', name: 'Trading God' };
                    return `${minInfo.emoji} ${minInfo.name} to ${maxInfo.emoji} ${maxInfo.name}`;
                  }
                  return `${minInfo.emoji} ${minInfo.name} or higher`;
                })()}
              </span>
            </div>
          </div>
        )}

        {/* Asset Classes */}
        <div className="flex flex-wrap gap-1.5 justify-center mb-4">
          {competition.assetClasses?.map((asset: string) => (
            <span
              key={asset}
              className="px-2 py-1 rounded-lg bg-gray-800/80 text-[10px] font-bold text-gray-300 uppercase border border-gray-700/50"
            >
              {asset === 'forex' && '💱'} {asset === 'crypto' && '₿'} {asset === 'stocks' && '📊'} {asset === 'indices' && '📈'} {asset}
            </span>
          ))}
        </div>

        {/* Action Button - Casino Style */}
        {!isCompleted && !isCancelled ? (
          <Link href={`/competitions/${competition._id}`} className="block">
            <Button
              className={`w-full font-black text-base py-6 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                isUserIn
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/30'
                  : isFull || !canAfford
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : `bg-gradient-to-r ${theme.gradient} text-gray-900 shadow-lg ${theme.glow} hover:shadow-xl`
              }`}
              disabled={entering || (isFull && !isUserIn) || (!canAfford && !isUserIn)}
            >
              {entering ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 animate-spin" />
                  Entering Arena...
                </span>
              ) : isUserIn ? (
                <span className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Enter Arena
                </span>
              ) : isFull ? (
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Arena Full
                </span>
              ) : !canAfford ? (
                <span className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Need {Math.abs(getEntryFee() - userBalance).toFixed(0)} More
                </span>
              ) : isUpcoming ? (
                <span className="flex items-center gap-2">
                  <Swords className="h-5 w-5" />
                  Join Now
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Swords className="h-5 w-5" />
                  View Competition
                </span>
              )}
            </Button>
          </Link>
        ) : (
          <Link href={`/competitions/${competition._id}`} className="block">
            <Button
              variant="outline"
              className={`w-full font-bold py-6 rounded-xl border-2 bg-transparent transition-all duration-300 transform hover:scale-105 ${
                isCancelled 
                  ? 'border-red-600 text-red-400 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 hover:text-white hover:border-transparent'
                  : 'border-gray-600 text-gray-100 hover:bg-gradient-to-r hover:from-yellow-500 hover:to-amber-500 hover:text-gray-900 hover:border-transparent'
              }`}
            >
              <Trophy className={`h-5 w-5 mr-2 ${isCancelled ? 'text-red-400' : ''}`} />
              {isCancelled ? 'View Details' : 'View Results'}
            </Button>
          </Link>
        )}

        {/* Insufficient Balance Warning */}
        {!canAfford && !isCompleted && !isCancelled && !isUserIn && (
          <p className="mt-2 text-xs text-center text-red-400 animate-pulse">
            ⚠️ Insufficient balance
          </p>
        )}
      </div>
    </div>
  );
}
