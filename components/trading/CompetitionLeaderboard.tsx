'use client';

import { Trophy, Ban, AlertTriangle, Skull, ShieldX } from 'lucide-react';

interface LeaderboardEntry {
  _id: string;
  username: string;
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
  currentCapital: number;
  startingCapital: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  currentRank: number;
  status: string;
  isTied?: boolean;
  tiedWith?: string[];
  qualificationStatus?: 'qualified' | 'disqualified';
  disqualificationReason?: string;
}

interface CompetitionLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  userParticipantId?: string;
  prizeDistribution: { rank: number; percentage: number }[];
  minimumTrades?: number;
  competitionStatus?: 'upcoming' | 'active' | 'completed' | 'cancelled';
}

export default function CompetitionLeaderboard({
  leaderboard,
  userParticipantId,
  prizeDistribution,
  minimumTrades = 0,
  competitionStatus,
}: CompetitionLeaderboardProps) {
  const getPrizePercentage = (rank: number) => {
    const prize = prizeDistribution.find((p) => p.rank === rank);
    return prize ? prize.percentage : 0;
  };

  const getRankIcon = (rank: number, isDisqualified: boolean, isTied?: boolean) => {
    if (isDisqualified) {
      return <Ban className="h-5 w-5 text-red-500" />;
    }
    
    // Add tie indicator ring for tied positions
    const tieRingClass = isTied ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-gray-900 rounded-full' : '';
    
    switch (rank) {
      case 1:
        return (
          <div className={`${tieRingClass} flex items-center justify-center`}>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>
        );
      case 2:
        return (
          <div className={`${tieRingClass} flex items-center justify-center`}>
            <Trophy className="h-5 w-5 text-gray-400" />
          </div>
        );
      case 3:
        return (
          <div className={`${tieRingClass} flex items-center justify-center`}>
            <Trophy className="h-5 w-5 text-orange-600" />
          </div>
        );
      default:
        return (
          <span className={`w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 ${tieRingClass}`}>
            {rank}
          </span>
        );
    }
  };

  // Helper to get disqualification icon
  const getDisqualificationIcon = (reason?: string) => {
    if (!reason) return <Ban className="h-3.5 w-3.5" />;
    
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('liquidat')) return <Skull className="h-3.5 w-3.5" />;
    if (lowerReason.includes('fraud') || lowerReason.includes('ban')) return <ShieldX className="h-3.5 w-3.5" />;
    if (lowerReason.includes('trade')) return <AlertTriangle className="h-3.5 w-3.5" />;
    return <Ban className="h-3.5 w-3.5" />;
  };

  // Check if entry is disqualified (either explicitly or via status)
  // Only check minimum trades when competition is completed - don't confuse users during active competition
  const isEntryDisqualified = (entry: LeaderboardEntry) => {
    if (entry.qualificationStatus === 'disqualified') return true;
    if (entry.status === 'liquidated') return true;
    // Only disqualify for minimum trades when competition is COMPLETED
    if (competitionStatus === 'completed' && minimumTrades > 0 && entry.totalTrades < minimumTrades) return true;
    return false;
  };

  // Get disqualification reason
  const getDisqualificationReason = (entry: LeaderboardEntry) => {
    if (entry.disqualificationReason) return entry.disqualificationReason;
    if (entry.status === 'liquidated') return 'Liquidated';
    // Only show min trades reason when competition is completed
    if (competitionStatus === 'completed' && minimumTrades > 0 && entry.totalTrades < minimumTrades) {
      return `Insufficient trades (${entry.totalTrades}/${minimumTrades})`;
    }
    return 'Disqualified';
  };

  if (leaderboard.length === 0) {
    return (
      <div className="py-12 text-center">
        <Trophy className="h-12 w-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No participants yet</p>
      </div>
    );
  }

  const calculateProfitFactor = (entry: LeaderboardEntry) => {
    if (entry.losingTrades === 0) return entry.winningTrades > 0 ? 9999 : 0;
    return entry.winningTrades / entry.losingTrades;
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-2 md:gap-3 px-3 md:px-4 pb-2 border-b border-gray-700 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <div className="flex-shrink-0">Rank</div>
        <div className="min-w-0">Trader</div>
        <div className="text-right flex-shrink-0 min-w-[100px]">Capital</div>
        <div className="text-right flex-shrink-0 min-w-[80px]">P&L</div>
        <div className="text-right flex-shrink-0 min-w-[70px]">ROI %</div>
        <div className="text-right flex-shrink-0 min-w-[70px]">Win Rate</div>
        <div className="text-right flex-shrink-0 min-w-[50px]">Trades</div>
        <div className="text-right flex-shrink-0 min-w-[60px]">P.Factor</div>
      </div>

      {/* Leaderboard Entries */}
      <div className="space-y-1">
        {leaderboard.map((entry, index) => {
          const isCurrentUser = entry._id === userParticipantId;
          const isPrizePosition = getPrizePercentage(entry.currentRank || index + 1) > 0;
          const winRate = entry.totalTrades > 0 ? (entry.winningTrades / entry.totalTrades) * 100 : 0;
          const profitFactor = calculateProfitFactor(entry);
          const isDisqualified = isEntryDisqualified(entry);
          const disqualificationReason = isDisqualified ? getDisqualificationReason(entry) : '';

          return (
            <div
              key={entry._id}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-2 md:gap-3 p-3 md:p-4 rounded-lg transition-colors relative ${
                isDisqualified
                  ? 'bg-red-500/5 border border-red-500/30 opacity-70'
                  : isCurrentUser
                  ? 'bg-blue-500/10 border border-blue-500/30'
                  : isPrizePosition
                  ? 'bg-yellow-500/5 border border-yellow-500/20 hover:bg-yellow-500/10'
                  : 'bg-gray-800/30 border border-transparent hover:bg-gray-800/50'
              }`}
            >
              {/* Red strikethrough line for disqualified */}
              {isDisqualified && (
                <div className="absolute inset-0 flex items-center pointer-events-none z-10">
                  <div className="w-full h-[2px] bg-red-500/60"></div>
                </div>
              )}

              {/* Rank */}
              <div className="flex items-center flex-shrink-0">
                {getRankIcon(entry.currentRank || index + 1, isDisqualified, entry.isTied)}
              </div>

              {/* Trader */}
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <p className={`text-sm font-medium truncate ${
                    isDisqualified 
                      ? 'text-red-400/70 line-through' 
                      : isCurrentUser 
                      ? 'text-blue-400' 
                      : 'text-gray-100'
                  }`}>
                    {entry.username}
                  </p>
                  {entry.userTitle && !isDisqualified && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${entry.userTitleColor || 'text-purple-400'} bg-gray-800/80 border border-gray-700`}>
                      {entry.userTitleIcon} {entry.userTitle}
                    </span>
                  )}
                  {isCurrentUser && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 flex-shrink-0">
                      You
                    </span>
                  )}
                  {entry.isTied && !isDisqualified && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 flex-shrink-0 font-semibold flex items-center gap-1">
                      = #{entry.currentRank}
                      {entry.tiedWith && entry.tiedWith.length > 0 && (
                        <span className="text-amber-300/70">({entry.tiedWith.length + 1} equal)</span>
                      )}
                    </span>
                  )}
                  {isDisqualified && (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 font-bold flex items-center gap-1 flex-shrink-0">
                      {getDisqualificationIcon(disqualificationReason)}
                      DISQUALIFIED
                    </span>
                  )}
                </div>
                {/* Disqualification reason */}
                {isDisqualified && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                      ❌ Reason: {disqualificationReason}
                    </span>
                  </div>
                )}
              </div>

              {/* Capital */}
              <div className="flex items-center justify-end gap-1 flex-shrink-0 min-w-[100px]">
                <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                  isDisqualified ? 'text-gray-500 line-through' : 'text-gray-100'
                }`}>
                  {entry.currentCapital.toLocaleString()}
                </p>
                <span className="text-xs text-gray-500 flex-shrink-0">pts</span>
              </div>

              {/* P&L */}
              <div className="flex flex-col items-end justify-center flex-shrink-0 min-w-[80px]">
                <p
                  className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                    isDisqualified 
                      ? 'text-gray-500 line-through' 
                      : entry.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {entry.pnl >= 0 ? '+' : ''}
                  {entry.pnl.toFixed(2)}
                </p>
              </div>

              {/* ROI % */}
              <div className="flex items-center justify-end flex-shrink-0 min-w-[70px]">
                <p
                  className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                    isDisqualified 
                      ? 'text-gray-500 line-through' 
                      : entry.pnlPercentage >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {entry.pnlPercentage >= 0 ? '+' : ''}
                  {entry.pnlPercentage.toFixed(2)}%
                </p>
              </div>

              {/* Win Rate */}
              <div className="flex flex-col items-end justify-center flex-shrink-0 min-w-[70px]">
                <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                  isDisqualified ? 'text-gray-500 line-through' : 'text-gray-100'
                }`}>
                  {winRate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  {entry.winningTrades}W/{entry.losingTrades}L
                </p>
              </div>

              {/* Trades */}
              <div className="flex items-center justify-end flex-shrink-0 min-w-[50px]">
                <p className={`text-sm font-semibold tabular-nums ${
                  isDisqualified 
                    ? competitionStatus === 'completed' && minimumTrades > 0 && entry.totalTrades < minimumTrades 
                      ? 'text-red-400' 
                      : 'text-gray-500 line-through'
                    : minimumTrades > 0 && entry.totalTrades < minimumTrades && competitionStatus === 'active'
                      ? 'text-yellow-400'  // Warning color during active competition
                      : 'text-gray-100'
                }`}>
                  {entry.totalTrades}
                  {minimumTrades > 0 && (
                    <span className={`text-xs ml-0.5 ${
                      entry.totalTrades >= minimumTrades 
                        ? 'text-green-400' 
                        : competitionStatus === 'completed' 
                          ? 'text-red-400' 
                          : 'text-yellow-400'
                    }`}>/{minimumTrades}</span>
                  )}
                </p>
              </div>

              {/* Profit Factor */}
              <div className="flex items-center justify-end flex-shrink-0 min-w-[60px]">
                <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                  isDisqualified 
                    ? 'text-gray-500 line-through' 
                    : profitFactor >= 2 ? 'text-green-500' : profitFactor >= 1 ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {profitFactor === 9999 ? '∞' : profitFactor.toFixed(2)}
                </p>
              </div>

              {/* Prize Indicator - Full Width (only for qualified) */}
              {isPrizePosition && !isDisqualified && (
                <div className="col-span-full mt-2 pt-2 border-t border-gray-700/50">
                  <p className="text-xs text-yellow-500">
                    🏆 Prize position: {getPrizePercentage(entry.currentRank || index + 1)}% of pool
                    {entry.isTied && entry.tiedWith && entry.tiedWith.length > 0 && (
                      <span className="ml-2 text-amber-400">
                        (Split with {entry.tiedWith.length} other{entry.tiedWith.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* No Prize - Disqualified */}
              {isPrizePosition && isDisqualified && (
                <div className="col-span-full mt-2 pt-2 border-t border-red-500/30">
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <Ban className="h-3 w-3" />
                    Not eligible for prize - {disqualificationReason}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

