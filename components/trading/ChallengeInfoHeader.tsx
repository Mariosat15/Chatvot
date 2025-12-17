'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Swords, Target, Trophy, User, RefreshCw } from 'lucide-react';
import { 
  RankingMethod, 
  ParticipantStats, 
  getRankingValue, 
  determineWinningStatus, 
  formatRankingValue,
  getMyStatLabel,
  getRankingLabel
} from '@/lib/utils/ranking-utils';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

interface ChallengeInfoHeaderProps {
  challengeId: string;
  endTime: Date;
  entryFee: number;
  winnerPrize: number;
  opponentId: string;
  opponentUsername: string;
  rankingMethod: RankingMethod; // Challenge type determines ranking
  initialMyStats?: Partial<ParticipantStats>;
  initialOpponentStats?: Partial<ParticipantStats>;
}

// Default stats for new participants
const defaultStats: ParticipantStats = {
  pnl: 0,
  pnlPercentage: 0,
  currentCapital: 0,
  winRate: 0,
  winningTrades: 0,
  losingTrades: 0,
  totalTrades: 0,
  unrealizedPnl: 0,
  startingCapital: 10000, // Default starting capital
};

export function ChallengeInfoHeader({ 
  challengeId,
  endTime, 
  entryFee,
  winnerPrize,
  opponentId,
  opponentUsername,
  rankingMethod,
  initialMyStats = {},
  initialOpponentStats = {},
}: ChallengeInfoHeaderProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [myStats, setMyStats] = useState<ParticipantStats>({ ...defaultStats, ...initialMyStats });
  const [opponentStats, setOpponentStats] = useState<ParticipantStats>({ ...defaultStats, ...initialOpponentStats });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch live stats data
  const fetchLiveData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/challenges/${challengeId}`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.success && data.participants && data.participants.length > 0) {
        const participants = data.participants;
        
        // Find opponent and me
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oppData = participants.find((p: any) => p.userId === opponentId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const myData = participants.find((p: any) => p.userId !== opponentId);
        
        if (myData) {
          setMyStats({
            pnl: myData.pnl || 0,
            pnlPercentage: myData.pnlPercentage || 0,
            currentCapital: myData.currentCapital || 0,
            winRate: myData.winRate || 0,
            winningTrades: myData.winningTrades || 0,
            losingTrades: myData.losingTrades || 0,
            totalTrades: myData.totalTrades || 0,
            unrealizedPnl: myData.unrealizedPnl || 0,
            startingCapital: myData.startingCapital || 0,
          });
        }
        
        if (oppData) {
          setOpponentStats({
            pnl: oppData.pnl || 0,
            pnlPercentage: oppData.pnlPercentage || 0,
            currentCapital: oppData.currentCapital || 0,
            winRate: oppData.winRate || 0,
            winningTrades: oppData.winningTrades || 0,
            losingTrades: oppData.losingTrades || 0,
            totalTrades: oppData.totalTrades || 0,
            unrealizedPnl: oppData.unrealizedPnl || 0,
            startingCapital: oppData.startingCapital || 0,
          });
        }
      }
    } catch (error) {
      // Silent fail - keep existing values
    } finally {
      setIsRefreshing(false);
    }
  }, [challengeId, opponentId]);

  // Time remaining countdown
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        return 'Challenge Ended';
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else {
        return `${minutes}m ${seconds}s`;
      }
    };

    setTimeRemaining(calculateTimeRemaining());

    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  // Poll for live data - optimized interval with visibility awareness
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLiveData(); // Refresh when tab becomes visible
      }
    };

    fetchLiveData();
    intervalId = setInterval(fetchLiveData, PERFORMANCE_INTERVALS.CHALLENGE_LIVE_DATA);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchLiveData]);

  // Determine who's winning based on the ranking method
  const winningStatus = determineWinningStatus(myStats, opponentStats, rankingMethod);
  const isWinning = winningStatus === 'winning';
  const isTied = winningStatus === 'tied';
  
  // Get formatted values based on ranking method
  const myRankingValue = getRankingValue(myStats, rankingMethod);
  const opponentRankingValue = getRankingValue(opponentStats, rankingMethod);
  const myFormattedValue = formatRankingValue(myRankingValue, rankingMethod);
  const opponentFormattedValue = formatRankingValue(opponentRankingValue, rankingMethod);
  const rankingLabel = getRankingLabel(rankingMethod);
  const myStatLabel = getMyStatLabel(rankingMethod);

  return (
    <div className="flex items-stretch gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
      {/* Time Remaining Card */}
      <div className="group relative bg-gradient-to-br from-dark-300 to-dark-300/80 px-4 md:px-6 py-3 md:py-4 rounded-xl border border-dark-400/30 hover:border-orange-500/30 transition-all duration-300 flex-shrink-0 shadow-lg hover:shadow-orange-500/20 min-w-[180px]">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">
            ⏱️
          </div>
          <div>
            <p className="text-xs font-medium text-dark-600 uppercase tracking-wider mb-0.5">
              Time Remaining
            </p>
            <p className={cn(
              "text-lg md:text-xl font-bold tabular-nums",
              timeRemaining === 'Challenge Ended' ? 'text-red-400' : 'text-light-900'
            )}>
              {timeRemaining}
            </p>
          </div>
        </div>
      </div>

      {/* Your Ranking Value Card - Dynamic based on ranking method */}
      <div className={cn(
        "group relative px-4 md:px-6 py-3 md:py-4 rounded-xl border transition-all duration-300 flex-shrink-0 shadow-lg min-w-[180px]",
        isWinning && !isTied 
          ? "bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30 hover:border-green-500/50 hover:shadow-green-500/20" 
          : isTied
            ? "bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/50 hover:shadow-yellow-500/20"
            : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30 hover:border-red-500/50 hover:shadow-red-500/20"
      )}>
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">
            <Target className={cn(
              "size-8",
              isWinning && !isTied ? "text-green-400" : isTied ? "text-yellow-400" : "text-red-400"
            )} />
          </div>
          <div>
            <p className="text-xs font-medium text-dark-600 uppercase tracking-wider mb-0.5">
              {myStatLabel}
            </p>
            <p className={cn(
              "text-lg md:text-xl font-bold tabular-nums",
              myRankingValue >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {myFormattedValue}
            </p>
          </div>
        </div>
      </div>

      {/* Opponent Ranking Value Card */}
      <div className={cn(
        "group relative px-4 md:px-6 py-3 md:py-4 rounded-xl border transition-all duration-300 flex-shrink-0 shadow-lg min-w-[180px]",
        !isWinning && !isTied 
          ? "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30" 
          : "bg-gradient-to-br from-dark-300 to-dark-300/80 border-dark-400/30"
      )}>
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">
            <User className={cn(
              "size-8",
              !isWinning && !isTied ? "text-red-400" : "text-orange-400"
            )} />
          </div>
          <div>
            <p className="text-xs font-medium text-dark-600 uppercase tracking-wider mb-0.5 truncate max-w-[120px]">
              {opponentUsername}
            </p>
            <p className={cn(
              "text-lg md:text-xl font-bold tabular-nums",
              opponentRankingValue >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {opponentFormattedValue}
            </p>
          </div>
        </div>
      </div>

      {/* Winner Takes Card */}
      <div className="group relative bg-gradient-to-br from-amber-500/10 to-amber-500/5 px-4 md:px-6 py-3 md:py-4 rounded-xl border border-amber-500/30 hover:border-amber-500/50 transition-all duration-300 flex-shrink-0 shadow-lg hover:shadow-amber-500/20 min-w-[200px]">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">
            <Trophy className="size-8 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-dark-600 uppercase tracking-wider mb-0.5">
              Winner Takes
            </p>
            <p className="text-lg md:text-xl font-bold text-amber-400 tabular-nums">
              {winnerPrize.toFixed(0)} Credits
            </p>
          </div>
        </div>
      </div>

      {/* Status Card - Dynamic based on ranking method */}
      <div className={cn(
        "group relative px-4 md:px-6 py-3 md:py-4 rounded-xl border transition-all duration-300 flex-shrink-0 shadow-lg min-w-[150px]",
        isWinning && !isTied 
          ? "bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30" 
          : isTied
            ? "bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/30"
            : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30"
      )}>
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">
            <Swords className={cn(
              "size-8",
              isWinning && !isTied ? "text-green-400" : isTied ? "text-yellow-400" : "text-red-400"
            )} />
          </div>
          <div>
            <p className="text-xs font-medium text-dark-600 uppercase tracking-wider mb-0.5">
              Status ({rankingLabel})
            </p>
            <p className={cn(
              "text-lg md:text-xl font-bold",
              isWinning && !isTied ? "text-green-400" : isTied ? "text-yellow-400" : "text-red-400"
            )}>
              {isWinning && !isTied ? 'WINNING' : isTied ? 'TIED' : 'LOSING'}
            </p>
          </div>
        </div>
      </div>

      {/* Refresh Indicator */}
      {isRefreshing && (
        <div className="absolute top-2 right-2">
          <RefreshCw className="size-4 text-orange-400 animate-spin" />
        </div>
      )}
    </div>
  );
}
