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

    const _getTimeRemaining = () => {
      const now = new Date();
      const end = new Date(competition.endTime);
      const diff = end.getTime() - now.getTime();

      if (diff < 0) return 'Ended';

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
      }
      return `${hours}h ${minutes}m`;
    };

    return (
      <div className="flex min-h-screen flex-col gap-8 p-4 md:p-8">
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

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500/20 via-gray-800 to-gray-900 p-8 shadow-xl border border-yellow-500/20">
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

            <h1 className="text-4xl font-bold text-gray-100 mb-2">{competition.name}</h1>
            <p className="text-gray-400 mb-6 max-w-2xl">{competition.description}</p>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Prize Pool</p>
                <p className="text-3xl font-bold text-yellow-500">
                  €{(competition.prizePool || competition.prizePoolCredits || 0).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Entry Fee</p>
                <p className="text-3xl font-bold text-gray-100">
                  €{competition.entryFee || competition.entryFeeCredits || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Participants</p>
                <p className="text-3xl font-bold text-gray-100">
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
                <div className={`text-3xl font-bold ${isCancelled ? 'text-red-500' : isActive ? 'text-yellow-400' : 'text-gray-100'}`}>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* User's Comprehensive Dashboard */}
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

            {/* Competition Rules */}
            {competition.rules && (
              <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">🏆 Competition Rules</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Ranking Method:</span>
                        <span className="font-semibold text-blue-400">
                          {competition.rules.rankingMethod === 'pnl' && 'Highest P&L'}
                          {competition.rules.rankingMethod === 'roi' && 'Highest ROI %'}
                          {competition.rules.rankingMethod === 'total_capital' && 'Highest Capital'}
                          {competition.rules.rankingMethod === 'win_rate' && 'Highest Win Rate'}
                          {competition.rules.rankingMethod === 'total_wins' && 'Most Winning Trades'}
                          {competition.rules.rankingMethod === 'profit_factor' && 'Best Profit Factor'}
                        </span>
                      </div>
                      {competition.rules.minimumTrades > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Minimum Trades:</span>
                          <span className="font-semibold text-amber-400">{competition.rules.minimumTrades} trades</span>
                        </div>
                      )}
                      {competition.rules.minimumWinRate && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Minimum Win Rate:</span>
                          <span className="font-semibold text-amber-400">{competition.rules.minimumWinRate}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Link
                    href="/help/competitions"
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    View Rules Guide
                  </Link>
                </div>
              </div>
            )}

            {/* ⚠️ DISQUALIFICATION RULES - Prominent Warning Section */}
            {competition.rules && (competition.rules.minimumTrades > 0 || competition.rules.disqualifyOnLiquidation || competition.rules.minimumWinRate) && (
              <div className="rounded-xl bg-gradient-to-br from-red-500/20 via-red-900/20 to-orange-900/20 border-2 border-red-500/40 p-6 shadow-lg shadow-red-500/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <Skull className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-400">⚠️ Disqualification Rules</h3>
                    <p className="text-sm text-red-300/70">Breaking any rule below will result in DISQUALIFICATION from prizes</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Minimum Trades Requirement */}
                  {competition.rules.minimumTrades > 0 && (
                    <div className="p-4 bg-gray-900/70 rounded-xl border border-red-500/30">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-orange-500/20 rounded-lg shrink-0">
                          <AlertTriangle className="h-5 w-5 text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-orange-400">Minimum Trades Requirement</h4>
                            <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-lg font-black rounded-lg">
                              {competition.rules.minimumTrades} trades
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">
                            You <strong className="text-white">MUST</strong> complete at least <strong className="text-orange-400">{competition.rules.minimumTrades} trade(s)</strong> before the competition ends.
                          </p>
                          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                            <Ban className="h-3.5 w-3.5" />
                            <span>Failing to meet this requirement = <strong>DISQUALIFIED</strong> (no prizes, regardless of rank)</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Liquidation = Disqualification */}
                  {competition.rules.disqualifyOnLiquidation && (
                    <div className="p-4 bg-gray-900/70 rounded-xl border border-red-500/30">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-red-500/20 rounded-lg shrink-0">
                          <Skull className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-red-400">Liquidation = Disqualification</h4>
                            <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm font-bold rounded-lg animate-pulse">
                              ACTIVE
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">
                            If your margin level drops to <strong className="text-red-400">{riskSettings.marginLiquidation}%</strong> and your positions are liquidated, you will be <strong className="text-red-400">IMMEDIATELY DISQUALIFIED</strong>.
                          </p>
                          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                            <Ban className="h-3.5 w-3.5" />
                            <span>Getting liquidated = <strong>DISQUALIFIED</strong> (no prizes, even if you were #1)</span>
                          </p>
                          <div className="mt-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                            <p className="text-xs text-gray-400">
                              💡 <strong>Tip:</strong> Use proper risk management! Set stop-losses and don&apos;t over-leverage. 
                              Keep your margin level above <span className="text-yellow-400 font-bold">{riskSettings.marginWarning}%</span> to stay safe.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Minimum Win Rate (if set) */}
                  {competition.rules.minimumWinRate && competition.rules.minimumWinRate > 0 && (
                    <div className="p-4 bg-gray-900/70 rounded-xl border border-yellow-500/30">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-yellow-500/20 rounded-lg shrink-0">
                          <Target className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-yellow-400">Minimum Win Rate</h4>
                            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-lg font-black rounded-lg">
                              {competition.rules.minimumWinRate}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">
                            Your win rate must be at least <strong className="text-yellow-400">{competition.rules.minimumWinRate}%</strong> at the end of the competition.
                          </p>
                          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                            <Ban className="h-3.5 w-3.5" />
                            <span>Win rate below {competition.rules.minimumWinRate}% = <strong>DISQUALIFIED</strong></span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary Warning */}
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Important:</strong> Disqualified participants will be marked with a strikethrough on the leaderboard 
                      and will NOT receive any prizes, even if they would have finished in a prize-winning position.
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Level Requirement */}
            {competition.levelRequirement && competition.levelRequirement.enabled && (
              <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      👑 Level Requirement
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Required Level:</span>
                        <span className="font-semibold text-purple-400">
                          {(() => {
                            const levelNames = [
                              '',
                              '🌱 Novice Trader',
                              '📚 Apprentice Trader',
                              '⚔️ Skilled Trader',
                              '🎯 Expert Trader',
                              '💎 Elite Trader',
                              '👑 Master Trader',
                              '🔥 Grand Master',
                              '⚡ Trading Champion',
                              '🌟 Market Legend',
                              '👑 Trading God',
                            ];
                            const minLevel = competition.levelRequirement.minLevel;
                            const maxLevel = competition.levelRequirement.maxLevel;
                            
                            if (maxLevel) {
                              return `${levelNames[minLevel]} - ${levelNames[maxLevel]}`;
                            } else {
                              return `${levelNames[minLevel]} or higher`;
                            }
                          })()}
                        </span>
                      </div>
                      
                      <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-xs text-purple-300">
                          {competition.levelRequirement.maxLevel
                            ? `Only traders between Level ${competition.levelRequirement.minLevel} and Level ${competition.levelRequirement.maxLevel} can enter this competition.`
                            : `Only traders at Level ${competition.levelRequirement.minLevel} or higher can enter this competition.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Difficulty Level Section */}
            {(() => {
              // Check if competition has manual difficulty
              const manualDifficulty = (competition as { difficulty?: { mode: 'auto' | 'manual'; manualLevel?: string } }).difficulty;
              let difficultyData: { level: DifficultyLevel; label: string; score: number; factors: { factor: string; impact: string; score: number }[] };
              
              if (manualDifficulty?.mode === 'manual' && manualDifficulty.manualLevel) {
                // Use manual difficulty - map old names to new trader level names
                const levelMap: Record<string, { level: DifficultyLevel; label: string; score: number }> = {
                  'beginner': { level: 'Novice', label: 'Novice Trader', score: 10 },
                  'intermediate': { level: 'Skilled', label: 'Skilled Trader', score: 25 },
                  'advanced': { level: 'Elite', label: 'Elite Trader', score: 45 },
                  'expert': { level: 'Grand Master', label: 'Grand Master', score: 65 },
                  'extreme': { level: 'Trading God', label: 'Trading God', score: 95 },
                };
                const mapped = levelMap[manualDifficulty.manualLevel] || { level: 'Skilled' as DifficultyLevel, label: 'Skilled Trader', score: 25 };
                difficultyData = {
                  level: mapped.level,
                  label: mapped.label,
                  score: mapped.score,
                  factors: [{ factor: 'Manually Set', impact: 'high', score: mapped.score }],
                };
              } else {
                // Calculate auto difficulty
                const calculated = calculateCompetitionDifficulty({
                  entryFee: competition.entryFee || competition.entryFeeCredits || 0,
                  startingCapital: competition.startingCapital || competition.startingTradingPoints || 10000,
                  maxLeverage: competition.leverage?.max || competition.leverageAllowed || 100,
                  duration: Math.round((new Date(competition.endTime).getTime() - new Date(competition.startTime).getTime()) / (1000 * 60)),
                  rules: competition.rules,
                  riskLimits: competition.riskLimits,
                  levelRequirement: competition.levelRequirement,
                });
                difficultyData = {
                  level: calculated.level,
                  label: calculated.label,
                  score: calculated.score,
                  factors: calculated.factors,
                };
              }
              
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
                'Novice': '🌱',
                'Apprentice': '📚',
                'Skilled': '⚔️',
                'Expert': '🎯',
                'Elite': '💎',
                'Master': '👑',
                'Grand Master': '🔥',
                'Champion': '⚡',
                'Legend': '🌟',
                'Trading God': '👑',
              };
              
              const descriptionMap: Record<DifficultyLevel, string> = {
                'Novice': 'Perfect for new traders learning the basics. Low risk, forgiving conditions.',
                'Apprentice': 'Building your trading skills. Slightly more challenging with room to grow.',
                'Skilled': 'For traders with experience. Moderate challenge with balanced risk.',
                'Expert': 'Requires solid strategies. Higher stakes for experienced traders.',
                'Elite': 'Challenging competition for skilled traders. Strong performance needed.',
                'Master': 'Professional level competition. Discipline and strategy are essential.',
                'Grand Master': 'Very challenging. Expert risk management required.',
                'Champion': 'Elite competition with high pressure. Prove your trading skills.',
                'Legend': 'Extreme difficulty for the best traders only. High risk, high reward.',
                'Trading God': 'Ultimate challenge. Only legends survive these brutal conditions.',
              };
              
              const colors = colorMap[difficultyData.level];
              
              return (
                <div className={`rounded-xl bg-gradient-to-br ${colors.bg} border-2 ${colors.border} p-6`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${colors.barColor}/20`}>
                        <Gauge className={`h-6 w-6 ${colors.text}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          Difficulty Level
                          <span className={`text-2xl`}>{emojiMap[difficultyData.level]}</span>
                        </h3>
                        <p className="text-xs text-gray-400">
                          {manualDifficulty?.mode === 'manual' ? 'Manually set by organizer' : 'Auto-calculated based on settings'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-xl font-black text-lg ${colors.barColor}/20 ${colors.text}`}>
                      {difficultyData.label}
                    </div>
                  </div>
                  
                  {/* Difficulty Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                      <span>Easier</span>
                      <span className={`font-bold ${colors.text}`}>{difficultyData.score}/100</span>
                      <span>Harder</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden relative">
                      {/* Level markers */}
                      <div className="absolute inset-0 flex">
                        <div className="flex-1 border-r border-gray-700"></div>
                        <div className="flex-1 border-r border-gray-700"></div>
                        <div className="flex-1 border-r border-gray-700"></div>
                        <div className="flex-1 border-r border-gray-700"></div>
                        <div className="flex-1"></div>
                      </div>
                      {/* Progress fill */}
                      <div 
                        className={`h-full ${colors.barColor} transition-all duration-1000 ease-out relative`}
                        style={{ width: `${difficultyData.score}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>🌱</span>
                      <span>📊</span>
                      <span>⚡</span>
                      <span>🔥</span>
                      <span>💀</span>
                    </div>
                  </div>
                  
                  {/* Description */}
                  <div className={`p-4 rounded-xl bg-gray-900/50 border ${colors.border.replace('border-', 'border-').replace('/40', '/20')}`}>
                    <p className="text-sm text-gray-300">
                      {descriptionMap[difficultyData.level]}
                    </p>
                  </div>
                  
                  {/* Difficulty Factors */}
                  {manualDifficulty?.mode !== 'manual' && difficultyData.factors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-gray-400 mb-2 font-semibold">Contributing Factors:</p>
                      <div className="flex flex-wrap gap-2">
                        {difficultyData.factors.slice(0, 5).map((factor, idx) => (
                          <span 
                            key={idx}
                            className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              factor.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                              factor.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {factor.factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Leaderboard */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <h2 className="text-2xl font-bold text-gray-100">Leaderboard</h2>
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Entry Button/Info */}
            {(!isCompleted || (isUserIn && userParticipant)) && (
              <CompetitionEntryButton
                competition={competition}
                userBalance={walletBalance.balance}
                isUserIn={isUserIn}
                isFull={isFull}
                participantStatus={userParticipant?.status}
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

            {/* Schedule (Prominent) */}
            <div className="rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-orange-400" />
                <h3 className="text-lg font-semibold text-gray-100">Schedule (UTC)</h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-green-400">START TIME</span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {formatUTCDate(new Date(competition.startTime))}
                  </p>
                </div>
                
                <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-red-400">END TIME</span>
                  </div>
                  <p className="text-2xl font-black text-white">
                    {formatUTCDate(new Date(competition.endTime))}
                  </p>
                </div>
              </div>
            </div>

            {/* Competition Details */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                Competition Details
              </h3>

              <div className="space-y-4">
                {/* Competition Type */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold text-blue-400">Competition Type</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {competition.competitionType === 'time_based' && '⏱️ Time-Based Competition'}
                    {competition.competitionType === 'goal_based' && '🎯 Goal-Based Competition'}
                    {competition.competitionType === 'hybrid' && '🔄 Hybrid Competition'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {competition.competitionType === 'time_based' && 'Winner is determined at the end time based on ranking criteria.'}
                    {competition.competitionType === 'goal_based' && 'First to reach the target goal wins!'}
                    {competition.competitionType === 'hybrid' && 'Combines time and goal-based elements.'}
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Starting Capital</p>
                    <p className="text-lg font-bold text-green-400">
                      ${(competition.startingCapital || competition.startingTradingPoints || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Maximum Leverage</p>
                    <p className="text-lg font-bold text-purple-400">
                      1:{competition.leverage?.max || competition.leverageAllowed || 100}
                    </p>
                    <p className="text-xs text-gray-500">
                      Range: 1:{competition.leverage?.min || 1} to 1:{competition.leverage?.max || competition.leverageAllowed || 100}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Asset Classes</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {competition.assetClasses.map((asset: string) => (
                        <span
                          key={asset}
                          className="px-3 py-1 rounded-lg bg-blue-500/20 text-sm font-semibold text-blue-400 uppercase"
                        >
                          {asset === 'forex' && '💱 '}
                          {asset === 'crypto' && '₿ '}
                          {asset === 'stocks' && '📈 '}
                          {asset}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Position Limits</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="p-2 bg-gray-900/50 rounded-lg text-center">
                        <p className="text-xs text-gray-500">Max Open Positions</p>
                        <p className="text-lg font-bold text-cyan-400">{competition.maxOpenPositions || 10}</p>
                      </div>
                      <div className="p-2 bg-gray-900/50 rounded-lg text-center">
                        <p className="text-xs text-gray-500">Max Position Size</p>
                        <p className="text-lg font-bold text-cyan-400">{competition.maxPositionSize || 100}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Limits - Always Show */}
            <div className={`rounded-xl p-6 ${
              competition.riskLimits?.enabled 
                ? 'bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30' 
                : 'bg-gray-800/50 border border-gray-700'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <Shield className={`h-5 w-5 ${competition.riskLimits?.enabled ? 'text-red-400' : 'text-gray-400'}`} />
                <h3 className="text-lg font-semibold text-gray-100">Risk Limits</h3>
                {competition.riskLimits?.enabled ? (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded animate-pulse">🛡️ ACTIVE</span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs font-bold rounded">DISABLED</span>
                )}
              </div>
              
              <div className="space-y-3">
                {/* Balance Drawdown */}
                <div className={`p-3 rounded-lg ${
                  competition.riskLimits?.enabled 
                    ? 'bg-gray-900/50 border border-red-500/20' 
                    : 'bg-gray-900/30 border border-gray-700/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${competition.riskLimits?.enabled ? 'text-red-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-gray-300">Max Balance Drawdown</span>
                      {competition.riskLimits?.enabled && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded">ENFORCED</span>
                      )}
                    </div>
                    <span className={`text-lg font-bold ${competition.riskLimits?.enabled ? 'text-red-400' : 'text-gray-500'}`}>
                      {competition.riskLimits?.maxDrawdownPercent || 50}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {competition.riskLimits?.enabled 
                      ? `🛑 Trading blocked if balance drops ${competition.riskLimits?.maxDrawdownPercent || 50}% below starting capital`
                      : `Balance drawdown limit: ${competition.riskLimits?.maxDrawdownPercent || 50}% (not enforced)`
                    }
                  </p>
                </div>
                
                {/* Daily Loss Limit */}
                <div className={`p-3 rounded-lg ${
                  competition.riskLimits?.enabled 
                    ? 'bg-gray-900/50 border border-orange-500/20' 
                    : 'bg-gray-900/30 border border-gray-700/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className={`h-4 w-4 ${competition.riskLimits?.enabled ? 'text-orange-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-gray-300">Daily Loss Limit</span>
                      {competition.riskLimits?.enabled && (
                        <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded">ENFORCED</span>
                      )}
                    </div>
                    <span className={`text-lg font-bold ${competition.riskLimits?.enabled ? 'text-orange-400' : 'text-gray-500'}`}>
                      {competition.riskLimits?.dailyLossLimitPercent || 20}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {competition.riskLimits?.enabled 
                      ? `⏰ Trading blocked for the day if daily losses exceed ${competition.riskLimits?.dailyLossLimitPercent || 20}%`
                      : `Daily loss limit: ${competition.riskLimits?.dailyLossLimitPercent || 20}% (not enforced)`
                    }
                  </p>
                </div>

                {/* Equity Drawdown - Anti-Fraud */}
                <div className={`p-3 rounded-lg ${
                  competition.riskLimits?.equityCheckEnabled 
                    ? 'bg-purple-500/10 border border-purple-500/30' 
                    : 'bg-gray-900/30 border border-gray-700/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Percent className={`h-4 w-4 ${competition.riskLimits?.equityCheckEnabled ? 'text-purple-400' : 'text-gray-500'}`} />
                      <span className="text-sm text-gray-300">Equity Drawdown</span>
                      {competition.riskLimits?.equityCheckEnabled ? (
                        <>
                          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded">ENFORCED</span>
                          <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-300 text-[10px] font-bold rounded">ANTI-FRAUD</span>
                        </>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-gray-700 text-gray-500 text-[10px] font-bold rounded">DISABLED</span>
                      )}
                    </div>
                    <span className={`text-lg font-bold ${competition.riskLimits?.equityCheckEnabled ? 'text-purple-400' : 'text-gray-500'}`}>
                      {competition.riskLimits?.equityDrawdownPercent || 30}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {competition.riskLimits?.equityCheckEnabled 
                      ? `🛡️ Trading blocked if equity (balance + unrealized P&L) drops ${competition.riskLimits?.equityDrawdownPercent || 30}% below starting`
                      : `Equity drawdown limit: ${competition.riskLimits?.equityDrawdownPercent || 30}% (not enforced - unrealized losses not tracked)`
                    }
                  </p>
                </div>
              </div>

              {/* Info Box */}
              {competition.riskLimits?.enabled ? (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Important:</strong> If you hit any risk limit, you won&apos;t be able to open new positions until your account recovers or the next trading day (for daily limits).
                    </span>
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400 flex items-start gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Note:</strong> Risk limits are not enforced in this competition. You can trade freely without balance or equity restrictions, but manage your risk wisely!
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Margin Levels & Liquidation */}
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-red-500/10 border border-amber-500/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Skull className="h-5 w-5 text-red-400" />
                <h3 className="text-lg font-semibold text-gray-100">Margin Levels</h3>
              </div>
              
              <div className="space-y-3">
                {/* Stopout / Liquidation Level */}
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skull className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-semibold text-red-400">Stopout (Liquidation)</span>
                    </div>
                    <span className="text-xl font-black text-red-500">{riskSettings.marginLiquidation}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    💀 All positions auto-close when margin level drops to {riskSettings.marginLiquidation}%
                  </p>
                </div>
                
                {/* Margin Call Level */}
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-orange-400" />
                      <span className="text-sm font-semibold text-orange-400">Margin Call</span>
                    </div>
                    <span className="text-xl font-black text-orange-400">{riskSettings.marginCall}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    🚨 High risk warning when margin level drops to {riskSettings.marginCall}%
                  </p>
                </div>
                
                {/* Warning Level */}
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm font-semibold text-yellow-400">Warning Level</span>
                    </div>
                    <span className="text-xl font-black text-yellow-400">{riskSettings.marginWarning}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ⚠️ Caution warning when margin level drops to {riskSettings.marginWarning}%
                  </p>
                </div>
                
                {/* Safe Level */}
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-semibold text-green-400">Safe Level</span>
                    </div>
                    <span className="text-xl font-black text-green-400">{riskSettings.marginSafe}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ✅ Recommended minimum margin level for safe trading
                  </p>
                </div>
              </div>

              {/* Visual Margin Scale */}
              <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-3 font-semibold">Margin Level Scale:</p>
                <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-600 to-red-500"
                    style={{ width: `${(riskSettings.marginLiquidation / riskSettings.marginSafe) * 100}%` }}
                  />
                  <div 
                    className="absolute top-0 h-full bg-gradient-to-r from-orange-500 to-orange-400"
                    style={{ 
                      left: `${(riskSettings.marginLiquidation / riskSettings.marginSafe) * 100}%`,
                      width: `${((riskSettings.marginCall - riskSettings.marginLiquidation) / riskSettings.marginSafe) * 100}%` 
                    }}
                  />
                  <div 
                    className="absolute top-0 h-full bg-gradient-to-r from-yellow-500 to-yellow-400"
                    style={{ 
                      left: `${(riskSettings.marginCall / riskSettings.marginSafe) * 100}%`,
                      width: `${((riskSettings.marginWarning - riskSettings.marginCall) / riskSettings.marginSafe) * 100}%` 
                    }}
                  />
                  <div 
                    className="absolute top-0 h-full bg-gradient-to-r from-green-500 to-green-400"
                    style={{ 
                      left: `${(riskSettings.marginWarning / riskSettings.marginSafe) * 100}%`,
                      width: `${((riskSettings.marginSafe - riskSettings.marginWarning) / riskSettings.marginSafe) * 100}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>💀 {riskSettings.marginLiquidation}%</span>
                  <span>🚨 {riskSettings.marginCall}%</span>
                  <span>⚠️ {riskSettings.marginWarning}%</span>
                  <span>✅ {riskSettings.marginSafe}%+</span>
                </div>
              </div>
            </div>

            {/* Prize Distribution */}
            <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-gray-800/50 border border-yellow-500/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Prize Distribution
                </h3>
                {competition.platformFeePercentage > 0 && (
                  <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <p className="text-xs font-semibold text-blue-300">
                      Platform Fee: {competition.platformFeePercentage}%
                    </p>
                  </div>
                )}
              </div>

              {/* Dynamic Prize Redistribution Info */}
              {(() => {
                const prizePositions = competition.prizeDistribution.length;
                const currentParticipants = competition.currentParticipants || 0;
                const prizePool = competition.prizePool || competition.prizePoolCredits || 0;
                const platformFeePercentage = (competition.platformFeePercentage || 0) / 100;
                
                // Calculate unclaimed percentage if fewer participants than prize positions
                const filledPositions = Math.min(currentParticipants, prizePositions);
                const unclaimedPositions = prizePositions - filledPositions;
                
                let unclaimedPercentage = 0;
                if (currentParticipants < prizePositions) {
                  competition.prizeDistribution.forEach((prize: { percentage: number }, index: number) => {
                    if (index >= currentParticipants) {
                      unclaimedPercentage += prize.percentage;
                    }
                  });
                }
                
                const bonusPerWinner = filledPositions > 0 ? unclaimedPercentage / filledPositions : 0;

                return (
                  <>
                    {/* Participants vs Prize Positions Status */}
                    <div className={`mb-4 p-3 rounded-lg ${
                      currentParticipants >= prizePositions 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-amber-500/10 border border-amber-500/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className={`h-4 w-4 ${currentParticipants >= prizePositions ? 'text-green-400' : 'text-amber-400'}`} />
                          <span className={`text-sm font-semibold ${currentParticipants >= prizePositions ? 'text-green-400' : 'text-amber-400'}`}>
                            {currentParticipants} / {prizePositions} prize positions filled
                          </span>
                        </div>
                        {currentParticipants < prizePositions && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded">
                            🎁 BONUS ACTIVE
                          </span>
                        )}
                      </div>
                      
                      {currentParticipants < prizePositions && (
                        <div className="mt-2 text-xs text-amber-300">
                          <p className="mb-1">
                            ⚠️ <strong>{unclaimedPositions} prize position{unclaimedPositions > 1 ? 's' : ''}</strong> have no winner yet ({unclaimedPercentage}% unclaimed)
                          </p>
                          <p className="text-amber-400/80">
                            🎁 Unclaimed {unclaimedPercentage}% will be split equally among all {filledPositions > 0 ? filledPositions : 'future'} winner{filledPositions !== 1 ? 's' : ''} 
                            {filledPositions > 0 && <span className="font-bold"> (+{bonusPerWinner.toFixed(1)}% each)</span>}
                          </p>
                        </div>
                      )}
                      
                      {currentParticipants >= prizePositions && (
                        <p className="mt-1 text-xs text-green-300">
                          ✅ All prize positions have eligible participants - standard distribution applies
                        </p>
                      )}
                    </div>

                    {/* Prize Distribution List */}
                    <div className="space-y-2">
                      {competition.prizeDistribution.map((prize: { percentage: number; rank?: number }, index: number) => {
                        const isFilled = index < currentParticipants;
                        const basePercentage = prize.percentage;
                        
                        // Calculate adjusted percentage with bonus
                        let adjustedPercentage = basePercentage;
                        if (currentParticipants > 0 && currentParticipants < prizePositions && isFilled) {
                          adjustedPercentage = basePercentage + bonusPerWinner;
                        }
                        
                        const grossAmount = (prizePool * adjustedPercentage) / 100;
                        const netAmount = grossAmount * (1 - platformFeePercentage);
                        const feeAmount = grossAmount - netAmount;
                        
                        // Original amounts (without bonus)
                        const originalGrossAmount = (prizePool * basePercentage) / 100;
                        const originalNetAmount = originalGrossAmount * (1 - platformFeePercentage);
                        
                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-xl transition-colors ${
                              isFilled 
                                ? 'bg-gray-800/50 border border-gray-700 hover:border-yellow-500/30' 
                                : 'bg-gray-900/30 border border-gray-700/50 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {index === 0 && <Trophy className={`h-5 w-5 ${isFilled ? 'text-yellow-500' : 'text-gray-600'}`} />}
                                {index === 1 && <Trophy className={`h-5 w-5 ${isFilled ? 'text-gray-400' : 'text-gray-600'}`} />}
                                {index === 2 && <Trophy className={`h-5 w-5 ${isFilled ? 'text-orange-600' : 'text-gray-600'}`} />}
                                {index > 2 && <Trophy className="h-5 w-5 text-gray-600" />}
                                <span className={`text-sm font-bold ${isFilled ? 'text-gray-300' : 'text-gray-500'}`}>
                                  Rank #{prize.rank ?? (index + 1)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  isFilled ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-500'
                                }`}>
                                  {basePercentage}%
                                </span>
                                {!isFilled && (
                                  <span className="px-2 py-0.5 bg-gray-700/50 text-gray-500 text-xs rounded">
                                    No winner yet
                                  </span>
                                )}
                                {isFilled && bonusPerWinner > 0 && (
                                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded animate-pulse">
                                    +{bonusPerWinner.toFixed(1)}% bonus
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                {isFilled ? (
                                  <div>
                                    <p className="text-lg font-black text-yellow-500 flex items-baseline gap-1">
                                      {netAmount.toFixed(2)}
                                      <span className="text-xs font-semibold text-yellow-400">credits</span>
                                    </p>
                                    {bonusPerWinner > 0 && (
                                      <p className="text-xs text-gray-500 line-through">
                                        was {originalNetAmount.toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">
                                    → Redistributed
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {isFilled && competition.platformFeePercentage > 0 && (
                              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700/50">
                                <span>From pool: {grossAmount.toFixed(2)} credits ({adjustedPercentage.toFixed(1)}%)</span>
                                <span>Fee: -{feeAmount.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {competition.platformFeePercentage > 0 && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-300 flex items-start gap-2">
                    <span className="text-blue-400 font-bold">ℹ️</span>
                    <span>
                      Winners receive the net amount after {competition.platformFeePercentage}% platform fee is deducted. 
                      Prize percentages are calculated from the total prize pool of {(competition.prizePool || competition.prizePoolCredits || 0).toFixed(2)} credits.
                    </span>
                  </p>
                </div>
              )}
              
              {/* How Redistribution Works */}
              <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-xs text-purple-300 flex items-start gap-2">
                  <span className="text-purple-400 font-bold">🎁</span>
                  <span>
                    <strong>Prize Redistribution:</strong> If there are fewer participants than prize positions, 
                    unclaimed prize percentages are split equally among all actual winners. 
                    More participants = standard distribution.
                  </span>
                </p>
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

