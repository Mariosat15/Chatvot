import { Trophy, Users, DollarSign, Clock, Calendar, TrendingUp, ArrowLeft, Target, Shield, AlertTriangle, Zap, Info, Percent, BarChart3, Skull, Bell, Ban, Gauge } from 'lucide-react';
import { calculateCompetitionDifficulty, DifficultyLevel } from '@/lib/utils/competition-difficulty';
import { getCompetitionById, getCompetitionLeaderboard, isUserInCompetition, getUserParticipant } from '@/lib/actions/trading/competition.actions';
import { getWalletBalance } from '@/lib/actions/trading/wallet.actions';
import { getTradingRiskSettings } from '@/lib/actions/trading/risk-settings.actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import CompetitionLeaderboard from '@/components/trading/CompetitionLeaderboard';
import CompetitionEntryButton from '@/components/trading/CompetitionEntryButton';
import CompetitionStatusWrapper from '@/components/trading/CompetitionStatusWrapper';
import CompetitionDashboard from '@/components/trading/CompetitionDashboard';
import CompetitionStatusMonitor from '@/components/trading/CompetitionStatusMonitor';
import UTCClock from '@/components/trading/UTCClock';
import LiveCountdown from '@/components/trading/LiveCountdown';
import InlineCountdown from '@/components/trading/InlineCountdown';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

interface CompetitionDetailsPageProps {
  params: Promise<{ id: string }>;
}

const CompetitionDetailsPage = async ({ params }: CompetitionDetailsPageProps) => {
  // CRITICAL: Disable cache to always show fresh competition data
  noStore();
  
  const { id } = await params;

  // Get session for user identification
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || '';

  try {
    // Get competition data
    const competition = await getCompetitionById(id);
    const leaderboard = await getCompetitionLeaderboard(id, 50);
    const isUserIn = await isUserInCompetition(id);
    const userParticipant = isUserIn ? await getUserParticipant(id) : null;
    const walletBalance = await getWalletBalance();
    const riskSettings = await getTradingRiskSettings();
    
    // Get user level for level requirement check (client-side)
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

    const formatUTCDate = (date: Date) => {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
    };

    // Calculate difficulty
    const getDifficultyData = () => {
      const manualDifficulty = (competition as { difficulty?: { mode: 'auto' | 'manual'; manualLevel?: string } }).difficulty;
      
      if (manualDifficulty?.mode === 'manual' && manualDifficulty.manualLevel) {
        const levelMap: Record<string, { level: DifficultyLevel; label: string; score: number }> = {
          'beginner': { level: 'Novice', label: 'Novice Trader', score: 10 },
          'intermediate': { level: 'Skilled', label: 'Skilled Trader', score: 25 },
          'advanced': { level: 'Elite', label: 'Elite Trader', score: 45 },
          'expert': { level: 'Grand Master', label: 'Grand Master', score: 65 },
          'extreme': { level: 'Trading God', label: 'Trading God', score: 95 },
        };
        const mapped = levelMap[manualDifficulty.manualLevel] || { level: 'Skilled' as DifficultyLevel, label: 'Skilled Trader', score: 25 };
        return {
          level: mapped.level,
          label: mapped.label,
          score: mapped.score,
          factors: [{ factor: 'Manually Set', impact: 'high', score: mapped.score }],
          isManual: true,
        };
      }
      
      const calculated = calculateCompetitionDifficulty({
        entryFee: competition.entryFee || competition.entryFeeCredits || 0,
        startingCapital: competition.startingCapital || competition.startingTradingPoints || 10000,
        maxLeverage: riskSettings.maxLeverage,
        duration: Math.round((new Date(competition.endTime).getTime() - new Date(competition.startTime).getTime()) / (1000 * 60)),
        rules: competition.rules,
        riskLimits: competition.riskLimits,
        levelRequirement: competition.levelRequirement,
      });
      return {
        level: calculated.level,
        label: calculated.label,
        score: calculated.score,
        factors: calculated.factors,
        isManual: false,
      };
    };

    const difficultyData = getDifficultyData();
    
    const colorMap: Record<DifficultyLevel, { bg: string; border: string; text: string; barColor: string }> = {
      'Novice': { bg: 'from-green-500/20 to-emerald-500/10', border: 'border-green-500/40', text: 'text-green-400', barColor: 'bg-green-500' },
      'Apprentice': { bg: 'from-green-500/20 to-teal-500/10', border: 'border-green-500/40', text: 'text-green-300', barColor: 'bg-green-400' },
      'Skilled': { bg: 'from-blue-500/20 to-cyan-500/10', border: 'border-blue-500/40', text: 'text-blue-400', barColor: 'bg-blue-500' },
      'Expert': { bg: 'from-blue-500/20 to-indigo-500/10', border: 'border-blue-500/40', text: 'text-blue-300', barColor: 'bg-blue-400' },
      'Elite': { bg: 'from-yellow-500/20 to-amber-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', barColor: 'bg-yellow-500' },
      'Master': { bg: 'from-yellow-500/20 to-orange-500/10', border: 'border-yellow-500/40', text: 'text-yellow-300', barColor: 'bg-yellow-400' },
      'Grand Master': { bg: 'from-orange-500/20 to-red-500/10', border: 'border-orange-500/40', text: 'text-orange-400', barColor: 'bg-orange-500' },
      'Champion': { bg: 'from-orange-500/20 to-pink-500/10', border: 'border-orange-500/40', text: 'text-orange-300', barColor: 'bg-orange-400' },
      'Legend': { bg: 'from-red-500/20 to-pink-500/10', border: 'border-red-500/40', text: 'text-red-400', barColor: 'bg-red-500' },
      'Trading God': { bg: 'from-red-500/20 to-purple-500/10', border: 'border-red-500/40', text: 'text-red-500', barColor: 'bg-red-600' },
    };
    
    const emojiMap: Record<DifficultyLevel, string> = {
      'Novice': '🌱', 'Apprentice': '📚', 'Skilled': '⚔️', 'Expert': '🎯', 'Elite': '💎',
      'Master': '👑', 'Grand Master': '🔥', 'Champion': '⚡', 'Legend': '🌟', 'Trading God': '👑',
    };
    
    const descriptionMap: Record<DifficultyLevel, string> = {
      'Novice': 'Perfect for new traders learning the basics.',
      'Apprentice': 'Building your trading skills with room to grow.',
      'Skilled': 'Moderate challenge with balanced risk.',
      'Expert': 'Higher stakes for experienced traders.',
      'Elite': 'Challenging competition for skilled traders.',
      'Master': 'Professional level competition.',
      'Grand Master': 'Very challenging. Expert risk management required.',
      'Champion': 'Elite competition with high pressure.',
      'Legend': 'Extreme difficulty for the best traders only.',
      'Trading God': 'Ultimate challenge. Only legends survive.',
    };

    const diffColors = colorMap[difficultyData.level];

    return (
      <div className="flex min-h-screen flex-col gap-6 p-4 md:p-8">
        {/* Auto-refresh when competition status changes */}
        <CompetitionStatusMonitor 
          competitionId={id} 
          initialStatus={competition.status} 
          userId={userId}
        />
        
        {/* Header with Back Button and UTC Clock */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href="/competitions">
            <Button variant="ghost" className="w-fit gap-2 text-gray-400 hover:text-gray-100">
              <ArrowLeft className="h-4 w-4" />
              Back to Competitions
            </Button>
          </Link>
          <UTCClock />
        </div>

        {/* Competition Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500/20 via-gray-800 to-gray-900 p-6 md:p-8 shadow-xl border border-yellow-500/20">
          <div className="absolute top-0 right-0 opacity-10">
            <Trophy className="h-48 w-48 text-yellow-500" />
          </div>

          <div className="relative z-10">
            {/* Status Badge */}
            {isCancelled && (
              <div className="mb-4">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-lg font-bold">
                  🚫 CANCELLED
                </span>
                {competition.cancellationReason && (
                  <p className="mt-2 text-red-400 text-sm bg-red-900/30 px-4 py-2 rounded-lg border border-red-500/30">
                    <strong>Reason:</strong> {competition.cancellationReason}
                  </p>
                )}
              </div>
            )}
            {isActive && (
              <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-blue-500 text-white text-sm font-medium animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                LIVE NOW
              </span>
            )}

            <h1 className="text-3xl md:text-4xl font-bold text-gray-100 mb-2">{competition.name}</h1>
            <p className="text-gray-400 mb-6 max-w-2xl">{competition.description}</p>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Prize Pool</p>
                <p className="text-2xl md:text-3xl font-bold text-yellow-500">
                  €{(competition.prizePool || competition.prizePoolCredits || 0).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Entry Fee</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-100">
                  €{competition.entryFee || competition.entryFeeCredits || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Participants</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-100">
                  {competition.currentParticipants}/{competition.maxParticipants}
                </p>
                {isUpcoming && competition.minParticipants > 0 && (
                  <p className={`text-xs mt-1 ${competition.currentParticipants < competition.minParticipants ? 'text-orange-400' : 'text-green-400'}`}>
                    Min: {competition.minParticipants} {competition.currentParticipants < competition.minParticipants ? '(need more!)' : '✓'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {isCancelled ? 'Status' : isActive ? 'Time Remaining' : isCompleted ? 'Status' : 'Starts In'}
                </p>
                <div className={`text-2xl md:text-3xl font-bold ${isCancelled ? 'text-red-500' : isActive ? 'text-yellow-400' : 'text-gray-100'}`}>
                  {isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : (
                    <InlineCountdown 
                      targetDate={isActive ? competition.endTime : competition.startTime}
                      type={isActive ? 'end' : 'start'}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ========== LEFT COLUMN: MAIN CONTENT ========== */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* User's Dashboard */}
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

            {/* Leaderboard */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-bold text-gray-100">Leaderboard</h2>
                <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 text-xs font-medium">
                  {leaderboard.length} traders
                </span>
                {competition.rules?.minimumTrades > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium">
                    Min: {competition.rules.minimumTrades} trades
                  </span>
                )}
              </div>
              <CompetitionLeaderboard
                leaderboard={leaderboard}
                userParticipantId={userParticipant?._id}
                prizeDistribution={competition.prizeDistribution}
                minimumTrades={competition.rules?.minimumTrades || 0}
                competitionStatus={competition.status}
              />
            </div>
          </div>

          {/* ========== RIGHT COLUMN: SIDEBAR ========== */}
          <div className="space-y-4">
            
            {/* ===== SECTION 1: ACTION & TIMING ===== */}
            {/* Entry Button/Info */}
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

            {/* Live Countdown */}
            {isUpcoming && (
              <LiveCountdown
                targetDate={new Date(competition.startTime)}
                label="⏳ Competition Starts In"
                type="start"
                status="upcoming"
              />
            )}
            {isActive && (
              <LiveCountdown
                targetDate={new Date(competition.endTime)}
                label="⏱️ Time Remaining"
                type="end"
                status="active"
              />
            )}

            {/* Schedule */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-gray-100">Schedule (UTC)</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-400">Start</span>
                  </div>
                  <span className="text-sm font-bold text-white">{formatUTCDate(new Date(competition.startTime))}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-gray-400">End</span>
                  </div>
                  <span className="text-sm font-bold text-white">{formatUTCDate(new Date(competition.endTime))}</span>
                </div>
              </div>
            </div>

            {/* ===== SECTION 2: COMPETITION DETAILS ===== */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-gray-100">Competition Details</h3>
              </div>

              <div className="space-y-3">
                {/* Competition Type */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-blue-400">Type</span>
                  </div>
                  <p className="text-sm font-bold text-white">
                    {competition.competitionType === 'time_based' && '⏱️ Time-Based'}
                    {competition.competitionType === 'goal_based' && '🎯 Goal-Based'}
                    {competition.competitionType === 'hybrid' && '🔄 Hybrid'}
                  </p>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-gray-900/50 rounded-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Capital</p>
                    <p className="text-sm font-bold text-green-400">
                      ${(competition.startingCapital || competition.startingTradingPoints || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-900/50 rounded-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Leverage</p>
                    <p className="text-sm font-bold text-purple-400">
                      1:{riskSettings.maxLeverage}
                    </p>
                  </div>
                  <div className="p-2.5 bg-gray-900/50 rounded-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Max Positions</p>
                    <p className="text-sm font-bold text-cyan-400">{competition.maxOpenPositions || 10}</p>
                  </div>
                  <div className="p-2.5 bg-gray-900/50 rounded-lg text-center">
                    <p className="text-[10px] text-gray-500 uppercase">Position Size</p>
                    <p className="text-sm font-bold text-cyan-400">{competition.maxPositionSize || 100}%</p>
                  </div>
                </div>

                {/* Asset Classes */}
                <div className="flex flex-wrap gap-1.5">
                      {competition.assetClasses.map((asset: string) => (
                    <span key={asset} className="px-2 py-1 rounded bg-blue-500/20 text-xs font-medium text-blue-400 uppercase">
                      {asset === 'forex' && '💱 '}{asset === 'crypto' && '₿ '}{asset === 'stocks' && '📈 '}{asset}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

            {/* Difficulty Level */}
            <div className={`rounded-xl bg-gradient-to-br ${diffColors.bg} border ${diffColors.border} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gauge className={`h-4 w-4 ${diffColors.text}`} />
                  <span className="text-sm font-semibold text-white">Difficulty</span>
                  <span className="text-lg">{emojiMap[difficultyData.level]}</span>
                      </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${diffColors.barColor}/20 ${diffColors.text}`}>
                  {difficultyData.label}
                </span>
                      </div>
              
              {/* Progress Bar */}
              <div className="mb-2">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${diffColors.barColor} transition-all`} style={{ width: `${difficultyData.score}%` }} />
                    </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Easier</span>
                  <span className={diffColors.text}>{difficultyData.score}/100</span>
                  <span>Harder</span>
              </div>
            </div>

              <p className="text-xs text-gray-400">{descriptionMap[difficultyData.level]}</p>
              </div>
              
            {/* ===== SECTION 3: RULES & REQUIREMENTS ===== */}
            {/* Competition Rules */}
            {competition.rules && (
              <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <h3 className="text-sm font-semibold text-gray-100">Competition Rules</h3>
                  </div>
                  <Link href="/help/competitions" className="text-xs text-blue-400 hover:text-blue-300">
                    View Guide
                  </Link>
                    </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Ranking:</span>
                    <span className="font-medium text-blue-400">
                      {competition.rules.rankingMethod === 'pnl' && 'Highest P&L'}
                      {competition.rules.rankingMethod === 'roi' && 'Highest ROI %'}
                      {competition.rules.rankingMethod === 'total_capital' && 'Highest Capital'}
                      {competition.rules.rankingMethod === 'win_rate' && 'Highest Win Rate'}
                      {competition.rules.rankingMethod === 'total_wins' && 'Most Wins'}
                      {competition.rules.rankingMethod === 'profit_factor' && 'Best Profit Factor'}
                    </span>
                  </div>
                  {competition.rules.minimumTrades > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Min Trades:</span>
                      <span className="font-medium text-amber-400">{competition.rules.minimumTrades}</span>
                </div>
                  )}
                  {competition.rules.minimumWinRate > 0 && (
                  <div className="flex items-center justify-between">
                      <span className="text-gray-400">Min Win Rate:</span>
                      <span className="font-medium text-amber-400">{competition.rules.minimumWinRate}%</span>
                    </div>
                      )}
                    </div>
              </div>
            )}

            {/* Level Requirement */}
            {competition.levelRequirement?.enabled && (
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">👑</span>
                  <h3 className="text-sm font-semibold text-purple-400">Level Requirement</h3>
                  </div>
                <p className="text-sm font-medium text-white">
                  {(() => {
                    const levelNames = ['', '🌱 Novice', '📚 Apprentice', '⚔️ Skilled', '🎯 Expert', '💎 Elite', '👑 Master', '🔥 Grand Master', '⚡ Champion', '🌟 Legend', '👑 Trading God'];
                    const min = competition.levelRequirement.minLevel;
                    const max = competition.levelRequirement.maxLevel;
                    return max ? `${levelNames[min]} to ${levelNames[max]}` : `${levelNames[min]} or higher`;
                  })()}
                  </p>
                </div>
            )}

            {/* Disqualification Rules */}
            {competition.rules && (competition.rules.minimumTrades > 0 || competition.rules.disqualifyOnLiquidation || competition.rules.minimumWinRate) && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Skull className="h-4 w-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-red-400">⚠️ Disqualification Rules</h3>
                </div>
                
                <div className="space-y-2">
                  {competition.rules.minimumTrades > 0 && (
                    <div className="p-2.5 bg-gray-900/70 rounded-lg border border-orange-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-orange-400">Min Trades Required</span>
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-bold rounded">{competition.rules.minimumTrades}</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Complete {competition.rules.minimumTrades}+ trades or be disqualified</p>
                    </div>
                  )}
                  
                  {competition.rules.disqualifyOnLiquidation && (
                    <div className="p-2.5 bg-gray-900/70 rounded-lg border border-red-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-red-400">Liquidation = DQ</span>
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded animate-pulse">ACTIVE</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Getting liquidated = immediate disqualification</p>
                    </div>
                  )}
                  
                  {competition.rules.minimumWinRate > 0 && (
                    <div className="p-2.5 bg-gray-900/70 rounded-lg border border-yellow-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-yellow-400">Min Win Rate</span>
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded">{competition.rules.minimumWinRate}%</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Win rate below {competition.rules.minimumWinRate}% = disqualified</p>
                    </div>
                      )}
                    </div>
              </div>
            )}

            {/* ===== SECTION 4: RISK & MARGIN ===== */}
            {/* Risk Limits */}
            <div className={`rounded-xl p-4 ${competition.riskLimits?.enabled ? 'bg-red-500/10 border border-red-500/20' : 'bg-gray-800/50 border border-gray-700'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Shield className={`h-4 w-4 ${competition.riskLimits?.enabled ? 'text-red-400' : 'text-gray-400'}`} />
                <h3 className="text-sm font-semibold text-gray-100">Risk Limits</h3>
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${competition.riskLimits?.enabled ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-500'}`}>
                  {competition.riskLimits?.enabled ? '🛡️ ACTIVE' : 'OFF'}
                    </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg">
                  <span className="text-xs text-gray-400">Max Drawdown</span>
                  <span className={`text-sm font-bold ${competition.riskLimits?.enabled ? 'text-red-400' : 'text-gray-500'}`}>
                    {competition.riskLimits?.maxDrawdownPercent || 50}%
                    </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg">
                  <span className="text-xs text-gray-400">Daily Loss Limit</span>
                  <span className={`text-sm font-bold ${competition.riskLimits?.enabled ? 'text-orange-400' : 'text-gray-500'}`}>
                    {competition.riskLimits?.dailyLossLimitPercent || 20}%
                    </span>
                </div>
                {competition.riskLimits?.equityCheckEnabled && (
                  <div className="flex items-center justify-between p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <span className="text-xs text-purple-400">Equity Drawdown</span>
                    <span className="text-sm font-bold text-purple-400">{competition.riskLimits?.equityDrawdownPercent || 30}%</span>
                </div>
              )}
            </div>
              </div>
              
            {/* Margin Levels */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Skull className="h-4 w-4 text-red-400" />
                <h3 className="text-sm font-semibold text-gray-100">Margin Levels</h3>
                </div>
                
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="flex items-center gap-1.5">
                    <Skull className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-400">Liquidation</span>
                    </div>
                  <span className="text-sm font-black text-red-500">{riskSettings.marginLiquidation}%</span>
                  </div>
                <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <div className="flex items-center gap-1.5">
                    <Bell className="h-3 w-3 text-orange-400" />
                    <span className="text-xs text-orange-400">Margin Call</span>
                </div>
                  <span className="text-sm font-black text-orange-400">{riskSettings.marginCall}%</span>
                    </div>
                <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-yellow-400" />
                    <span className="text-xs text-yellow-400">Warning</span>
                  </div>
                  <span className="text-sm font-black text-yellow-400">{riskSettings.marginWarning}%</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-green-400" />
                    <span className="text-xs text-green-400">Safe</span>
                    </div>
                  <span className="text-sm font-black text-green-400">{riskSettings.marginSafe}%</span>
                </div>
              </div>

              {/* Visual Scale */}
              <div className="mt-3 p-2 bg-gray-900/50 rounded-lg">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
                  <div className="bg-red-500" style={{ width: '20%' }} />
                  <div className="bg-orange-500" style={{ width: '20%' }} />
                  <div className="bg-yellow-500" style={{ width: '20%' }} />
                  <div className="bg-green-500" style={{ width: '40%' }} />
                </div>
                <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                  <span>💀</span>
                  <span>🚨</span>
                  <span>⚠️</span>
                  <span>✅</span>
                </div>
              </div>
            </div>

            {/* ===== SECTION 5: PRIZES ===== */}
            <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-gray-800/50 border border-yellow-500/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <h3 className="text-sm font-semibold text-gray-100">Prize Distribution</h3>
            </div>
                {competition.platformFeePercentage > 0 && (
                  <span className="text-[10px] text-blue-400">Fee: {competition.platformFeePercentage}%</span>
                )}
              </div>

              {(() => {
                const prizePositions = competition.prizeDistribution.length;
                const currentParticipants = competition.currentParticipants || 0;
                const prizePool = competition.prizePool || competition.prizePoolCredits || 0;
                const platformFeePercentage = (competition.platformFeePercentage || 0) / 100;
                const filledPositions = Math.min(currentParticipants, prizePositions);
                
                let unclaimedPercentage = 0;
                if (currentParticipants < prizePositions) {
                  competition.prizeDistribution.forEach((prize: { percentage: number }, index: number) => {
                    if (index >= currentParticipants) unclaimedPercentage += prize.percentage;
                  });
                }
                const bonusPerWinner = filledPositions > 0 ? unclaimedPercentage / filledPositions : 0;

                return (
                  <>
                    {/* Status */}
                    <div className={`mb-3 p-2 rounded-lg text-xs ${currentParticipants >= prizePositions ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {currentParticipants >= prizePositions 
                        ? `✅ ${currentParticipants}/${prizePositions} positions filled` 
                        : `🎁 ${currentParticipants}/${prizePositions} filled - ${unclaimedPercentage}% bonus available!`}
                      </div>
                      
                    {/* Prize List */}
                    <div className="space-y-2">
                      {competition.prizeDistribution.map((prize: { percentage: number; rank?: number }, index: number) => {
                        const isFilled = index < currentParticipants;
                        const adjustedPercentage = isFilled && bonusPerWinner > 0 ? prize.percentage + bonusPerWinner : prize.percentage;
                        const netAmount = (prizePool * adjustedPercentage / 100) * (1 - platformFeePercentage);
                        
                        return (
                          <div key={index} className={`p-2.5 rounded-lg flex items-center justify-between ${isFilled ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-900/30 opacity-50'}`}>
                              <div className="flex items-center gap-2">
                              <Trophy className={`h-4 w-4 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : 'text-gray-600'}`} />
                              <span className="text-sm font-medium text-gray-300">#{prize.rank ?? index + 1}</span>
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-yellow-500/20 text-yellow-400">{prize.percentage}%</span>
                                {isFilled && bonusPerWinner > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400">+{bonusPerWinner.toFixed(1)}%</span>
                                )}
                              </div>
                            <span className={`text-sm font-bold ${isFilled ? 'text-yellow-500' : 'text-gray-500'}`}>
                              {isFilled ? `€${netAmount.toFixed(2)}` : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-[10px] text-gray-500">
                      🎁 Unclaimed positions split equally among winners
                    </p>
                  </>
                );
              })()}
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
