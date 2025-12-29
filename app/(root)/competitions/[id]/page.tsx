import { Trophy, Users, DollarSign, Clock, Calendar, TrendingUp, ArrowLeft, Target, Shield, AlertTriangle, Zap, Info, Percent, BarChart3, Skull, Ban, Gauge, ChevronDown, ChevronUp, Award, Timer } from 'lucide-react';
import { calculateCompetitionDifficulty, DifficultyLevel } from '@/lib/utils/competition-difficulty';
import { getCompetitionById, getCompetitionLeaderboard, isUserInCompetition, getUserParticipant } from '@/lib/actions/trading/competition.actions';
import { getWalletBalance } from '@/lib/actions/trading/wallet.actions';
import { getTradingRiskSettings } from '@/lib/actions/trading/risk-settings.actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import CompetitionLeaderboard from '@/components/trading/CompetitionLeaderboard';
import CompetitionEntryButton from '@/components/trading/CompetitionEntryButton';
import CompetitionStatusMonitor from '@/components/trading/CompetitionStatusMonitor';
import CompetitionDashboard from '@/components/trading/CompetitionDashboard';
import UTCClock from '@/components/trading/UTCClock';
import InlineCountdown from '@/components/trading/InlineCountdown';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

interface CompetitionDetailsPageProps {
  params: Promise<{ id: string }>;
}

const CompetitionDetailsPage = async ({ params }: CompetitionDetailsPageProps) => {
  noStore();
  
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || '';

  try {
    const competition = await getCompetitionById(id);
    const leaderboard = await getCompetitionLeaderboard(id, 50);
    const isUserIn = await isUserInCompetition(id);
    const userParticipant = isUserIn ? await getUserParticipant(id) : null;
    const walletBalance = await getWalletBalance();
    const riskSettings = await getTradingRiskSettings();
    
    // Get user level for level requirement check
    let userLevel = { level: 1, title: 'Novice Trader', icon: '🌱' };
    if (userId) {
      try {
        const { getUserLevel: fetchUserLevel } = await import('@/lib/services/xp-level.service');
        const levelData = await fetchUserLevel(userId);
        userLevel = {
          level: levelData.currentLevel || 1,
          title: levelData.currentTitle || 'Novice Trader',
          icon: levelData.currentIcon || '🌱',
        };
      } catch {
        // Use default level if fetch fails
      }
    }

    const isActive = competition.status === 'active';
    const isUpcoming = competition.status === 'upcoming';
    const isCompleted = competition.status === 'completed';
    const isCancelled = competition.status === 'cancelled';
    const isFull = competition.currentParticipants >= competition.maxParticipants;

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      }) + ' UTC';
    };

    // Calculate duration
    const startDate = new Date(competition.startTime);
    const endDate = new Date(competition.endTime);
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = Math.round(durationMs / (1000 * 60 * 60));
    const durationDays = Math.floor(durationHours / 24);
    const durationDisplay = durationDays > 0 
      ? `${durationDays}d ${durationHours % 24}h` 
      : `${durationHours}h`;

    // Calculate difficulty
    const maxLeverage = competition.leverage?.max || competition.leverageAllowed || 100;
    const difficulty = calculateCompetitionDifficulty({
      entryFee: competition.entryFee || competition.entryFeeCredits || 0,
      startingCapital: competition.startingCapital || competition.startingTradingPoints || 10000,
      maxLeverage,
      duration: Math.round(durationMs / (1000 * 60)),
      rules: competition.rules,
      riskLimits: competition.riskLimits,
      levelRequirement: competition.levelRequirement,
    });

    const levelNames: Record<number, { icon: string; name: string }> = {
      1: { icon: '🌱', name: 'Novice Trader' },
      2: { icon: '📚', name: 'Apprentice Trader' },
      3: { icon: '⚔️', name: 'Skilled Trader' },
      4: { icon: '🎯', name: 'Expert Trader' },
      5: { icon: '💎', name: 'Elite Trader' },
      6: { icon: '👑', name: 'Master Trader' },
      7: { icon: '🔥', name: 'Grand Master' },
      8: { icon: '⚡', name: 'Trading Champion' },
      9: { icon: '🌟', name: 'Market Legend' },
      10: { icon: '👑', name: 'Trading God' },
    };

    return (
      <div className="min-h-screen bg-gray-950">
        <CompetitionStatusMonitor 
          competitionId={id} 
          initialStatus={competition.status}
          userId={userId}
        />
        
        {/* Top Navigation Bar */}
        <div className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/competitions">
              <Button variant="ghost" size="sm" className="gap-2 text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <UTCClock />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-purple-500/5"></div>
            <div className="relative p-6 md:p-8">
              {/* Status & Title */}
              <div className="flex flex-wrap items-start gap-3 mb-4">
                {isCancelled && (
                  <span className="px-3 py-1 rounded-full bg-red-500 text-white text-sm font-bold">
                    CANCELLED
                  </span>
                )}
                {isCompleted && (
                  <span className="px-3 py-1 rounded-full bg-gray-600 text-white text-sm font-bold">
                    COMPLETED
                  </span>
                )}
                {isActive && (
                  <span className="px-3 py-1 rounded-full bg-green-500 text-white text-sm font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    LIVE
                  </span>
                )}
                {isUpcoming && (
                  <span className="px-3 py-1 rounded-full bg-blue-500 text-white text-sm font-bold">
                    STARTING SOON
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${difficulty.bgColor} ${difficulty.color} border ${difficulty.borderColor}`}>
                  {difficulty.emoji} {difficulty.label}
                </span>
              </div>
              
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{competition.name}</h1>
              <p className="text-gray-400 text-sm md:text-base max-w-3xl mb-6">{competition.description}</p>

              {/* Key Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Prize Pool</div>
                  <div className="text-xl font-bold text-yellow-400">
                    €{(competition.prizePool || competition.prizePoolCredits || 0).toFixed(0)}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Entry Fee</div>
                  <div className="text-xl font-bold text-white">
                    €{competition.entryFee || competition.entryFeeCredits || 0}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Players</div>
                  <div className="text-xl font-bold text-white">
                    {competition.currentParticipants}/{competition.maxParticipants}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Duration</div>
                  <div className="text-xl font-bold text-white">{durationDisplay}</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Capital</div>
                  <div className="text-xl font-bold text-green-400">
                    ${(competition.startingCapital || competition.startingTradingPoints || 10000).toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="text-xs text-gray-500 mb-1">Leverage</div>
                  <div className="text-xl font-bold text-purple-400">1:{maxLeverage}</div>
                </div>
              </div>

              {/* Countdown */}
              {!isCompleted && !isCancelled && (
                <div className="mt-6 flex items-center justify-center">
                  <div className="bg-gray-900/80 rounded-xl px-6 py-3 border border-gray-700">
                    <div className="text-xs text-gray-500 text-center mb-1">
                      {isActive ? '⏱️ Ends In' : '🚀 Starts In'}
                    </div>
                    <div className="text-2xl font-mono font-bold text-white">
                      <InlineCountdown 
                        targetDate={isActive ? competition.endTime : competition.startTime}
                        type={isActive ? 'end' : 'start'}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cancellation Notice */}
          {isCancelled && competition.cancellationReason && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
              <p className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span><strong>Cancellation Reason:</strong> {competition.cancellationReason}</span>
              </p>
            </div>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Your Dashboard - Only for participants */}
              {isUserIn && userParticipant && (
                <CompetitionDashboard
                  competitionId={id}
                  initialParticipant={{
                    _id: userParticipant._id.toString(),
                    currentCapital: userParticipant.currentCapital,
                    pnl: userParticipant.pnl,
                    pnlPercentage: userParticipant.pnlPercentage,
                    totalTrades: userParticipant.totalTrades,
                    currentRank: userParticipant.currentRank,
                    winningTrades: userParticipant.winningTrades,
                    losingTrades: userParticipant.losingTrades,
                    status: userParticipant.status,
                  }}
                  competitionStatus={isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'}
                  startTime={new Date(competition.startTime).toISOString()}
                  endTime={new Date(competition.endTime).toISOString()}
                  startingCapital={competition.startingCapital || competition.startingTradingPoints || 10000}
                  competitionRules={competition.rules ? {
                    minimumTrades: competition.rules.minimumTrades,
                    minimumWinRate: competition.rules.minimumWinRate,
                    disqualifyOnLiquidation: competition.rules.disqualifyOnLiquidation,
                  } : undefined}
                  totalParticipants={competition.currentParticipants}
                />
              )}

              {/* Rules & Requirements Card */}
              <div className="rounded-xl bg-gray-900/50 border border-gray-800 overflow-hidden">
                <div className="p-5 border-b border-gray-800">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-400" />
                    Competition Rules & Requirements
                  </h2>
                </div>
                
                <div className="p-5 space-y-4">
                  {/* Ranking Method */}
                  <div className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl">
                    <div className="p-2 bg-blue-500/20 rounded-lg shrink-0">
                      <Trophy className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-400 mb-1">Ranking Method</div>
                      <div className="text-lg font-bold text-white">
                        {competition.rules?.rankingMethod === 'pnl' && '📈 Highest Profit & Loss'}
                        {competition.rules?.rankingMethod === 'roi' && '📊 Highest ROI Percentage'}
                        {competition.rules?.rankingMethod === 'total_capital' && '💰 Highest Total Capital'}
                        {competition.rules?.rankingMethod === 'win_rate' && '🎯 Highest Win Rate'}
                        {competition.rules?.rankingMethod === 'total_wins' && '🏆 Most Winning Trades'}
                        {competition.rules?.rankingMethod === 'profit_factor' && '⚡ Best Profit Factor'}
                        {!competition.rules?.rankingMethod && '📈 Highest Profit & Loss'}
                      </div>
                    </div>
                  </div>

                  {/* Requirements Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Min Trades */}
                    <div className={`p-4 rounded-xl border ${
                      competition.rules?.minimumTrades > 0 
                        ? 'bg-orange-500/10 border-orange-500/30' 
                        : 'bg-gray-800/30 border-gray-700/50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Min Trades</span>
                        {competition.rules?.minimumTrades > 0 && (
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-bold rounded">Required</span>
                        )}
                      </div>
                      <div className={`text-2xl font-bold ${
                        competition.rules?.minimumTrades > 0 ? 'text-orange-400' : 'text-gray-500'
                      }`}>
                        {competition.rules?.minimumTrades || 0}
                      </div>
                    </div>

                    {/* Liquidation Rule */}
                    <div className={`p-4 rounded-xl border ${
                      competition.rules?.disqualifyOnLiquidation 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-gray-800/30 border-gray-700/50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Liquidation DQ</span>
                        {competition.rules?.disqualifyOnLiquidation && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded">Active</span>
                        )}
                      </div>
                      <div className={`text-lg font-bold ${
                        competition.rules?.disqualifyOnLiquidation ? 'text-red-400' : 'text-gray-500'
                      }`}>
                        {competition.rules?.disqualifyOnLiquidation ? '💀 Yes' : '✓ No'}
                      </div>
                    </div>

                    {/* Min Win Rate */}
                    {competition.rules?.minimumWinRate && competition.rules.minimumWinRate > 0 && (
                      <div className="p-4 rounded-xl border bg-yellow-500/10 border-yellow-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Min Win Rate</span>
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded">Required</span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-400">
                          {competition.rules.minimumWinRate}%
                        </div>
                      </div>
                    )}

                    {/* Level Requirement */}
                    {competition.levelRequirement?.enabled && (
                      <div className="p-4 rounded-xl border bg-purple-500/10 border-purple-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Level Required</span>
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-bold rounded">Restricted</span>
                        </div>
                        <div className="text-sm font-bold text-purple-400">
                          {(() => {
                            const min = levelNames[competition.levelRequirement.minLevel];
                            const max = competition.levelRequirement.maxLevel ? levelNames[competition.levelRequirement.maxLevel] : null;
                            if (max) {
                              return `${min?.icon} ${min?.name} - ${max.icon} ${max.name}`;
                            }
                            return `${min?.icon} ${min?.name}+`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Disqualification Warning */}
                  {(competition.rules?.minimumTrades > 0 || competition.rules?.disqualifyOnLiquidation) && (
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-300">
                          <strong>Warning:</strong> Failing to meet minimum trades or getting liquidated will result in 
                          <strong> disqualification</strong> from prizes, regardless of your ranking position.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Risk Limits */}
                  {competition.riskLimits?.enabled && (
                    <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-semibold text-white">Risk Limits Active</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-gray-900/50 rounded-lg">
                          <div className="text-xs text-gray-500">Max Drawdown</div>
                          <div className="text-lg font-bold text-red-400">{competition.riskLimits.maxDrawdownPercent || 50}%</div>
                        </div>
                        <div className="p-2 bg-gray-900/50 rounded-lg">
                          <div className="text-xs text-gray-500">Daily Loss</div>
                          <div className="text-lg font-bold text-orange-400">{competition.riskLimits.dailyLossLimitPercent || 20}%</div>
                        </div>
                        <div className="p-2 bg-gray-900/50 rounded-lg">
                          <div className="text-xs text-gray-500">Margin Call</div>
                          <div className="text-lg font-bold text-yellow-400">{riskSettings.marginLiquidation || 259}%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Leaderboard */}
              <div className="rounded-xl bg-gray-900/50 border border-gray-800 overflow-hidden">
                <div className="p-5 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-400" />
                      Leaderboard
                    </h2>
                    <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-400">
                      {leaderboard.length} traders
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <CompetitionLeaderboard
                    leaderboard={leaderboard}
                    userParticipantId={userParticipant?._id}
                    prizeDistribution={competition.prizeDistribution}
                    minimumTrades={competition.rules?.minimumTrades || 0}
                    competitionStatus={competition.status}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Entry Button */}
              {(!isCompleted || (isUserIn && userParticipant)) && (
                <CompetitionEntryButton
                  competition={competition}
                  userBalance={walletBalance.balance}
                  isUserIn={isUserIn}
                  isFull={isFull}
                  participantStatus={userParticipant?.status}
                  userLevel={userLevel}
                />
              )}

              {/* Schedule Card */}
              <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  Schedule (UTC)
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-400">Starts</span>
                    </div>
                    <span className="text-sm font-medium text-white">{formatDate(startDate)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-xs text-gray-400">Ends</span>
                    </div>
                    <span className="text-sm font-medium text-white">{formatDate(endDate)}</span>
                  </div>
                </div>
              </div>

              {/* Quick Info Card */}
              <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Info className="h-4 w-4 text-purple-400" />
                  Quick Info
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Asset Classes</span>
                    <div className="flex gap-1">
                      {competition.assetClasses.map((asset: string) => (
                        <span key={asset} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded uppercase">
                          {asset}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Max Positions</span>
                    <span className="text-white font-medium">{competition.maxOpenPositions || 10}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Position Size</span>
                    <span className="text-white font-medium">{competition.maxPositionSize || 100}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Min Players</span>
                    <span className={`font-medium ${
                      competition.currentParticipants >= (competition.minParticipants || 2)
                        ? 'text-green-400'
                        : 'text-orange-400'
                    }`}>
                      {competition.minParticipants || 2}
                      {competition.currentParticipants < (competition.minParticipants || 2) && ' (need more!)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prize Distribution */}
              {competition.prizeDistribution && competition.prizeDistribution.length > 0 && (
                <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-400" />
                    Prize Distribution
                  </h3>
                  <div className="space-y-2">
                    {competition.prizeDistribution.slice(0, 5).map((prize: { rank: number; percentage: number }, index: number) => {
                      const prizeAmount = ((competition.prizePool || competition.prizePoolCredits || 0) * prize.percentage / 100);
                      return (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-500 text-yellow-900' :
                              index === 1 ? 'bg-gray-400 text-gray-900' :
                              index === 2 ? 'bg-orange-600 text-orange-100' :
                              'bg-gray-700 text-gray-300'
                            }`}>
                              {prize.rank}
                            </span>
                            <span className="text-sm text-gray-400">{prize.percentage}%</span>
                          </div>
                          <span className="text-sm font-bold text-yellow-400">€{prizeAmount.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Difficulty Card */}
              <div className={`rounded-xl p-5 border ${difficulty.bgColor} ${difficulty.borderColor}`}>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  Difficulty Level
                </h3>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xl font-bold ${difficulty.color}`}>
                    {difficulty.emoji} {difficulty.label}
                  </span>
                  <span className={`text-sm font-mono ${difficulty.color}`}>{difficulty.score}/100</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      difficulty.score <= 20 ? 'bg-green-500' :
                      difficulty.score <= 40 ? 'bg-blue-500' :
                      difficulty.score <= 60 ? 'bg-yellow-500' :
                      difficulty.score <= 80 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${difficulty.score}%` }}
                  />
                </div>
                {difficulty.factors && difficulty.factors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {difficulty.factors.slice(0, 3).map((factor, i) => (
                      <div key={i} className="text-xs text-gray-500 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          factor.impact === 'high' ? 'bg-red-400' :
                          factor.impact === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                        }`}></span>
                        {factor.factor}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading competition:', error);
    notFound();
  }
};

export default CompetitionDetailsPage;
