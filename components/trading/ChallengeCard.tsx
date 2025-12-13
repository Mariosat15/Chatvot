'use client';

import { Trophy, Users, Clock, Zap, Target, Timer, ChevronRight, Swords, Crown, Shield, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAppSettings } from '@/contexts/AppSettingsContext';

interface ChallengeCardProps {
  challenge: any;
  userId: string;
  viewMode?: 'card' | 'list';
  onAccept?: (challengeId: string) => void;
  onDecline?: (challengeId: string) => void;
  responding?: boolean;
}

// Challenge themes based on ranking method
const CHALLENGE_THEMES: Record<string, { gradient: string; glow: string; icon: string; bgPattern: string }> = {
  pnl: {
    gradient: 'from-orange-600 via-red-500 to-pink-400',
    glow: 'shadow-orange-500/50',
    icon: '⚔️',
    bgPattern: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-900/40 via-gray-900 to-gray-900',
  },
  roi: {
    gradient: 'from-cyan-600 via-blue-500 to-indigo-400',
    glow: 'shadow-cyan-500/50',
    icon: '📈',
    bgPattern: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/40 via-gray-900 to-gray-900',
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
  pnl: { name: 'Profit & Loss', description: 'Highest profit wins' },
  roi: { name: 'Return on Investment', description: 'Best % return wins' },
  total_capital: { name: 'Total Capital', description: 'Highest capital wins' },
  win_rate: { name: 'Win Rate', description: 'Best win % wins' },
  total_wins: { name: 'Total Wins', description: 'Most wins wins' },
  profit_factor: { name: 'Profit Factor', description: 'Best ratio wins' },
};

export default function ChallengeCard({
  challenge,
  userId,
  viewMode = 'card',
  onAccept,
  onDecline,
  responding = false,
}: ChallengeCardProps) {
  const [liveCountdown, setLiveCountdown] = useState('');
  const { settings } = useAppSettings();

  const isChallenger = challenge.challengerId === userId;
  const opponentName = isChallenger ? challenge.challengedName : challenge.challengerName;
  const canRespond = !isChallenger && challenge.status === 'pending';
  const isWinner = challenge.winnerId === userId;
  const isLoser = challenge.loserId === userId;
  const isActive = challenge.status === 'active';
  const isPending = challenge.status === 'pending';
  const isCompleted = challenge.status === 'completed';
  const isDeclined = challenge.status === 'declined';
  const isExpired = challenge.status === 'expired';
  const isCancelled = challenge.status === 'cancelled';

  const rankingMethod = challenge.rules?.rankingMethod || 'pnl';
  const theme = CHALLENGE_THEMES[rankingMethod] || CHALLENGE_THEMES.pnl;
  const rankingInfo = RANKING_DESCRIPTIONS[rankingMethod] || RANKING_DESCRIPTIONS.pnl;

  // Live countdown
  const getTimeRemaining = (targetDate: string) => {
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target.getTime() - now.getTime();

    if (diff < 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  useEffect(() => {
    const targetDate = isActive ? challenge.endTime : challenge.acceptDeadline;
    if (targetDate && (isActive || isPending)) {
      setLiveCountdown(getTimeRemaining(targetDate));
      const interval = setInterval(() => {
        setLiveCountdown(getTimeRemaining(targetDate));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive, isPending, challenge.endTime, challenge.acceptDeadline]);

  // Format date helper
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Get status style
  const getStatusStyle = () => {
    if (isCompleted) {
      if (isWinner) return { text: 'WON', color: 'text-green-500/30', shadow: 'rgba(34, 197, 94, 0.4)' };
      if (isLoser) return { text: 'LOST', color: 'text-red-500/30', shadow: 'rgba(239, 68, 68, 0.4)' };
      if (challenge.isTie) return { text: 'TIE', color: 'text-yellow-500/30', shadow: 'rgba(234, 179, 8, 0.4)' };
    }
    if (isCancelled) return { text: 'CANCELLED', color: 'text-red-500/30', shadow: 'rgba(239, 68, 68, 0.4)' };
    if (isDeclined) return { text: 'DECLINED', color: 'text-gray-500/30', shadow: 'rgba(156, 163, 175, 0.4)' };
    if (isExpired) return { text: 'EXPIRED', color: 'text-gray-500/30', shadow: 'rgba(156, 163, 175, 0.4)' };
    if (isActive) return { text: 'LIVE', color: 'text-blue-500/25', shadow: 'rgba(59, 130, 246, 0.3)' };
    if (isPending) return { text: 'PENDING', color: 'text-yellow-500/25', shadow: 'rgba(234, 179, 8, 0.3)' };
    return null;
  };

  const statusStyle = getStatusStyle();

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <Link href={`/challenges/${challenge._id}`}>
        <div className={`group relative overflow-hidden rounded-xl ${theme.bgPattern} border border-gray-700/50 hover:border-orange-500/50 transition-all duration-300 hover:shadow-xl hover:${theme.glow}`}>
          <div className="flex items-center gap-4 p-4">
            {/* Icon */}
            <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-2xl shadow-lg ${theme.glow}`}>
              <Swords className="h-7 w-7 text-white" />
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-100 truncate group-hover:text-orange-400 transition-colors">
                  vs {opponentName}
                </h3>
                {isActive && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold animate-pulse">
                    LIVE
                  </span>
                )}
                {isCompleted && isWinner && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-bold">
                    WON
                  </span>
                )}
                {isCompleted && isLoser && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    LOST
                  </span>
                )}
                {isPending && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-yellow-500 text-black text-[10px] font-bold">
                    PENDING
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${theme.gradient}`}></span>
                  {rankingInfo.name}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {challenge.duration}m
                </span>
              </div>
            </div>

            {/* Prize */}
            <div className="flex-shrink-0 text-right px-3 border-l border-gray-700">
              <div className="flex items-center gap-1 text-yellow-500">
                <Trophy className="h-4 w-4" />
                <span className="text-xl font-black">{challenge.winnerPrize?.toFixed(0) || 0}</span>
              </div>
              <p className="text-xs text-gray-500">Winner Takes</p>
            </div>

            {/* Entry Fee */}
            <div className="flex-shrink-0 text-right px-4 border-l border-gray-700">
              <div className="text-lg font-bold text-gray-100">{challenge.entryFee}</div>
              <p className="text-xs text-gray-500">Entry Each</p>
            </div>

            {/* Countdown/Status */}
            <div className="flex-shrink-0 w-24 text-center">
              {(isPending || isActive) && (
                <div className={`px-3 py-1.5 rounded-lg ${isActive ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-yellow-500/20 border border-yellow-500/30'}`}>
                  <p className={`text-xs font-mono font-bold ${isActive ? 'text-blue-400' : 'text-yellow-400'}`}>
                    {liveCountdown}
                  </p>
                </div>
              )}
              {isCompleted && (
                <div className={`px-3 py-1.5 rounded-lg ${isWinner ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                  <p className={`text-xs font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                    {isWinner ? 'WON' : challenge.isTie ? 'TIE' : 'LOST'}
                  </p>
                </div>
              )}
            </div>

            {/* Arrow */}
            <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-orange-500 transition-colors" />
          </div>
        </div>
      </Link>
    );
  }

  // CARD VIEW (Default)
  const bgPattern = isCancelled || isDeclined || isExpired 
    ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-800/40 via-gray-900 to-gray-900'
    : (isCompleted && isLoser)
      ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/40 via-gray-900 to-gray-900'
      : (isCompleted && isWinner)
        ? 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-900/40 via-gray-900 to-gray-900'
        : theme.bgPattern;

  return (
    <div className={`group relative overflow-hidden rounded-2xl ${bgPattern} border ${(isCancelled || isDeclined || isExpired) ? 'border-gray-700/50' : (isCompleted && isLoser) ? 'border-red-700/50 hover:border-red-500/50' : (isCompleted && isWinner) ? 'border-green-700/50 hover:border-green-500/50' : 'border-gray-700/50 hover:border-orange-500/50'} transition-all duration-500 hover:shadow-2xl hover:${theme.glow} hover:-translate-y-2`}>
      {/* Animated Background Effects */}
      <div className="absolute inset-0 opacity-30">
        <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${theme.gradient} rounded-full blur-3xl -translate-y-32 translate-x-32 group-hover:scale-150 transition-transform duration-700`}></div>
        <div className={`absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr ${theme.gradient} rounded-full blur-3xl translate-y-24 -translate-x-24 group-hover:scale-150 transition-transform duration-700`}></div>
      </div>

      {/* Large Diagonal Watermark for Status */}
      {statusStyle && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center overflow-hidden">
          <div 
            className={`font-black tracking-wider uppercase select-none text-4xl md:text-5xl ${statusStyle.color}`}
            style={{
              transform: 'rotate(-25deg)',
              textShadow: `0 0 40px ${statusStyle.shadow}`,
              letterSpacing: '0.12em',
            }}
          >
            {statusStyle.text}
          </div>
        </div>
      )}

      {/* Status Badges */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {canRespond && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold border border-yellow-500/40 animate-pulse">
            <Sparkles className="h-3 w-3" />
            RESPOND
          </span>
        )}
        {isChallenger && isPending && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/40">
            <Swords className="h-3 w-3" />
            SENT
          </span>
        )}
      </div>

      {/* Card Content */}
      <div className="relative z-10 p-6">
        {/* Challenge Type Badge */}
        <div className="flex justify-center mb-4">
          <div className="relative group/type cursor-default">
            <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} rounded-xl blur opacity-50 group-hover/type:opacity-80 transition-opacity`}></div>
            <div className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/80 border border-gray-700 backdrop-blur">
              <Swords className="h-5 w-5 text-orange-400" />
              <div>
                <p className={`text-sm font-black bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                  1v1 Challenge
                </p>
                <p className="text-[10px] text-gray-400">{rankingInfo.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Opponent Name */}
        <h3 className="text-xl font-black text-center text-gray-100 mb-2 group-hover:text-orange-400 transition-colors">
          vs {opponentName}
        </h3>
        <p className="text-sm text-gray-400 text-center mb-4">
          {isChallenger ? 'You challenged' : 'Challenged you'}
        </p>

        {/* Winner Prize Pool - Casino Style */}
        <div className="relative mb-5">
          <div className={`absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 rounded-2xl blur-xl`}></div>
          <div className="relative p-5 rounded-2xl bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent border-2 border-yellow-500/40 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Winner Takes</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 drop-shadow-lg">
                    {challenge.winnerPrize?.toFixed(0) || 0}
                  </span>
                  <span className="text-sm font-bold text-yellow-400/80">{settings?.credits.symbol}</span>
                </div>
                {settings?.credits.showEUREquivalent && (
                  <p className="text-xs text-gray-500">≈ €{(challenge.winnerPrize * (settings?.credits.valueInEUR || 1)).toFixed(2)}</p>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-lg opacity-30 animate-pulse"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-xl flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform">
                  <Trophy className="h-9 w-9 text-yellow-900" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="relative overflow-hidden rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
            <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/10 rounded-full blur-lg"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Zap className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Entry Fee</p>
                <p className="text-sm font-bold text-gray-100">{challenge.entryFee} {settings?.credits.symbol}</p>
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
                <p className="text-sm font-bold text-gray-100">1v1</p>
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
                <p className="text-sm font-bold text-gray-100">${(challenge.startingCapital || 10000).toLocaleString()}</p>
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
                <p className="text-sm font-bold text-gray-100">{challenge.duration}m</p>
              </div>
            </div>
          </div>
        </div>

        {/* Countdown Timer */}
        {(isPending || isActive) && (
          <div className={`mb-4 p-3 rounded-xl ${isActive ? 'bg-gradient-to-r from-blue-500/10 via-blue-500/10 to-blue-500/10 border border-blue-500/30' : 'bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-yellow-500/10 border border-yellow-500/30'}`}>
            <div className="flex items-center justify-center gap-3">
              <Clock className={`h-4 w-4 ${isActive ? 'text-blue-500' : 'text-yellow-500'} animate-pulse`} />
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">{isActive ? 'Ends in' : 'Accept by'}</span>
                <span className={`px-2 py-1 rounded bg-gray-900/80 font-mono font-bold text-sm ${isActive ? 'text-blue-400' : 'text-yellow-400'}`}>
                  {liveCountdown}
                </span>
              </div>
              <Clock className={`h-4 w-4 ${isActive ? 'text-blue-500' : 'text-yellow-500'} animate-pulse`} />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {canRespond && onAccept && onDecline ? (
          <div className="flex gap-2">
            <Button
              onClick={() => onAccept(challenge._id)}
              disabled={responding}
              className="flex-1 font-black py-6 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/30 transition-all duration-300 transform hover:scale-105"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Accept
            </Button>
            <Button
              onClick={() => onDecline(challenge._id)}
              disabled={responding}
              variant="outline"
              className="flex-1 font-bold py-6 rounded-xl border-2 border-red-600 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300"
            >
              Decline
            </Button>
          </div>
        ) : (
          <Link href={`/challenges/${challenge._id}`} className="block">
            <Button
              className={`w-full font-black text-base py-6 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                  : isCompleted && isWinner
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/30'
                  : `bg-gradient-to-r ${theme.gradient} text-gray-900 shadow-lg ${theme.glow} hover:shadow-xl`
              }`}
            >
              {isActive ? (
                <span className="flex items-center gap-2">
                  <Swords className="h-5 w-5" />
                  Trade Now
                </span>
              ) : isCompleted ? (
                <span className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  View Results
                </span>
              ) : isPending && isChallenger ? (
                <span className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Awaiting Response
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Swords className="h-5 w-5" />
                  View Challenge
                </span>
              )}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

