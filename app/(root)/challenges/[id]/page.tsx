import { Trophy, Users, DollarSign, Clock, Calendar, TrendingUp, ArrowLeft, Target, Shield, AlertTriangle, Zap, Info, Skull, Swords, Crown } from 'lucide-react';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import Challenge from '@/database/models/trading/challenge.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import { getTradingRiskSettings } from '@/lib/actions/trading/risk-settings.actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import UTCClock from '@/components/trading/UTCClock';
import InlineCountdown from '@/components/trading/InlineCountdown';
import LiveCountdown from '@/components/trading/LiveCountdown';
import ChallengeStatusMonitor from '@/components/trading/ChallengeStatusMonitor';
import ChallengeEntryActions from '@/components/trading/ChallengeEntryActions';
import { notFound, redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

interface ChallengePageProps {
  params: Promise<{ id: string }>;
}

const RANKING_LABELS: Record<string, string> = {
  pnl: 'Highest P&L',
  roi: 'Highest ROI %',
  total_capital: 'Highest Capital',
  win_rate: 'Highest Win Rate',
  total_wins: 'Most Winning Trades',
  profit_factor: 'Best Profit Factor',
};

const TIEBREAKER_LABELS: Record<string, string> = {
  trades_count: 'Most Trades',
  win_rate: 'Higher Win Rate',
  total_capital: 'Higher Capital',
  roi: 'Higher ROI',
  join_time: 'First to Join',
  split_prize: 'Split Prize',
};

export default async function ChallengePage({ params }: ChallengePageProps) {
  // CRITICAL: Disable cache to always show fresh challenge data
  noStore();

  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect('/sign-in');
  }

  try {
    await connectToDatabase();

    // Fetch challenge with potential auto-finalization
    let challenge = await Challenge.findById(id);

    if (!challenge) {
      notFound();
    }

    // Only participants can view
    if (challenge.challengerId !== session.user.id && challenge.challengedId !== session.user.id) {
      notFound();
    }

    // Auto-finalize if challenge is 'active' but has ended
    if (
      challenge.status === 'active' &&
      challenge.endTime &&
      new Date() >= new Date(challenge.endTime) &&
      !challenge.winnerId
    ) {
      try {
        const { finalizeChallenge } = await import('@/lib/actions/trading/challenge-finalize.actions');
        await finalizeChallenge(id);
        challenge = await Challenge.findById(id);
      } catch (error) {
        console.error(`Failed to auto-finalize challenge ${id}:`, error);
      }
    }

    // Get participants
    const participants = await ChallengeParticipant.find({ challengeId: id }).lean();
    const riskSettings = await getTradingRiskSettings();

    const isChallenger = challenge.challengerId === session.user.id;
    const isChallenged = challenge.challengedId === session.user.id;
    const opponentName = isChallenger ? challenge.challengedName : challenge.challengerName;
    const isWinner = challenge.winnerId === session.user.id;
    const isLoser = challenge.loserId === session.user.id;
    const myStats = isChallenger ? challenge.challengerFinalStats : challenge.challengedFinalStats;
    const opponentStats = isChallenger ? challenge.challengedFinalStats : challenge.challengerFinalStats;

    const isActive = challenge.status === 'active';
    const isPending = challenge.status === 'pending';
    const isCompleted = challenge.status === 'completed';
    const isDeclined = challenge.status === 'declined';
    const isExpired = challenge.status === 'expired';
    const isCancelled = challenge.status === 'cancelled';

    const formatUTCDate = (date: Date) => {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
    };

    return (
      <div className="flex min-h-screen flex-col gap-8 p-4 md:p-8">
        {/* Auto-refresh when challenge status changes */}
        <ChallengeStatusMonitor 
          challengeId={id} 
          initialStatus={challenge.status} 
        />

        {/* Header with Back Button and UTC Clock */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href="/challenges">
            <Button variant="ghost" className="w-fit gap-2 text-gray-400 hover:text-gray-100">
              <ArrowLeft className="h-4 w-4" />
              Back to Challenges
            </Button>
          </Link>
          <UTCClock />
        </div>

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/20 via-gray-800 to-gray-900 p-8 shadow-xl border border-orange-500/20">
          <div className="absolute top-0 right-0 opacity-10">
            <Swords className="h-48 w-48 text-orange-500" />
          </div>

          <div className="relative z-10">
            {/* Status Badge */}
            {isCompleted && (
              <div className="mb-4">
                {isWinner ? (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 text-white text-lg font-bold">
                    🏆 YOU WON!
                  </span>
                ) : challenge.isTie ? (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-600 text-white text-lg font-bold">
                    🤝 TIE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-lg font-bold">
                    😔 YOU LOST
                  </span>
                )}
              </div>
            )}
            {(isDeclined || isExpired || isCancelled) && (
              <div className="mb-4">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-600 text-white text-lg font-bold">
                  🚫 {challenge.status.toUpperCase()}
                </span>
              </div>
            )}
            {isActive && (
              <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-blue-500 text-white text-sm font-medium animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                LIVE NOW
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-yellow-500 text-black text-sm font-medium">
                ⏳ AWAITING RESPONSE
              </span>
            )}

            <h1 className="text-4xl font-bold text-gray-100 mb-2 flex items-center gap-3">
              <Swords className="h-10 w-10 text-orange-500" />
              Challenge vs {opponentName}
            </h1>
            <p className="text-gray-400 mb-6">
              {isChallenger ? 'You challenged' : 'Challenged you'} • {challenge.duration} minute battle
            </p>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Winner Prize</p>
                <p className="text-3xl font-bold text-yellow-500">
                  {challenge.winnerPrize?.toFixed(0) || 0} ⚡
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Entry Fee</p>
                <p className="text-3xl font-bold text-gray-100">
                  {challenge.entryFee} ⚡
                </p>
                <p className="text-xs text-gray-500">each player</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Platform Fee</p>
                <p className="text-3xl font-bold text-gray-100">
                  {challenge.platformFeePercentage || 0}%
                </p>
                <p className="text-xs text-gray-500">{challenge.platformFeeAmount?.toFixed(2) || 0} ⚡</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {isActive ? 'Time Remaining' : isPending ? 'Accept By' : 'Status'}
                </p>
                <div className="text-3xl font-bold text-gray-100">
                  {isCompleted || isDeclined || isExpired || isCancelled ? (
                    <span className={isCompleted && isWinner ? 'text-green-500' : isCompleted && isLoser ? 'text-red-500' : 'text-gray-500'}>
                      {challenge.status.charAt(0).toUpperCase() + challenge.status.slice(1)}
                    </span>
                  ) : (
                    <InlineCountdown
                      targetDate={isActive ? challenge.endTime : challenge.acceptDeadline}
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
            {/* Your Results Card (if completed) */}
            {isCompleted && (myStats || opponentStats) && (
              <div className="rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Final Results
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Your Stats */}
                  <div className={`p-4 rounded-xl border ${isWinner ? 'bg-green-500/10 border-green-500/30' : isLoser ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-300">You</span>
                      {isWinner && <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">WINNER</span>}
                      {isLoser && <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded">LOST</span>}
                    </div>
                    {myStats && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Final Capital</span>
                          <span className="text-sm font-bold text-white">${myStats.finalCapital?.toFixed(2) || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">P&L</span>
                          <span className={`text-sm font-bold ${(myStats.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(myStats.pnl || 0) >= 0 ? '+' : ''}{myStats.pnl?.toFixed(2) || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">ROI</span>
                          <span className={`text-sm font-bold ${(myStats.pnlPercentage || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(myStats.pnlPercentage || 0) >= 0 ? '+' : ''}{myStats.pnlPercentage?.toFixed(2) || 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Trades</span>
                          <span className="text-sm font-bold text-white">{myStats.totalTrades || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Win Rate</span>
                          <span className="text-sm font-bold text-white">{myStats.winRate?.toFixed(1) || 0}%</span>
                        </div>
                        {myStats.isDisqualified && (
                          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400">
                            ⚠️ Disqualified: {myStats.disqualificationReason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Opponent Stats */}
                  <div className={`p-4 rounded-xl border ${!isWinner && !challenge.isTie ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-300">{opponentName}</span>
                      {!isWinner && !challenge.isTie && <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">WINNER</span>}
                    </div>
                    {opponentStats && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Final Capital</span>
                          <span className="text-sm font-bold text-white">${opponentStats.finalCapital?.toFixed(2) || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">P&L</span>
                          <span className={`text-sm font-bold ${(opponentStats.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(opponentStats.pnl || 0) >= 0 ? '+' : ''}{opponentStats.pnl?.toFixed(2) || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">ROI</span>
                          <span className={`text-sm font-bold ${(opponentStats.pnlPercentage || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(opponentStats.pnlPercentage || 0) >= 0 ? '+' : ''}{opponentStats.pnlPercentage?.toFixed(2) || 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Trades</span>
                          <span className="text-sm font-bold text-white">{opponentStats.totalTrades || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Win Rate</span>
                          <span className="text-sm font-bold text-white">{opponentStats.winRate?.toFixed(1) || 0}%</span>
                        </div>
                        {opponentStats.isDisqualified && (
                          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400">
                            ⚠️ Disqualified: {opponentStats.disqualificationReason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Challenge Rules */}
            <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                🏆 Challenge Rules
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Ranking Method:</span>
                  <span className="font-semibold text-blue-400">
                    {RANKING_LABELS[challenge.rules?.rankingMethod] || 'Highest P&L'}
                  </span>
                </div>
                {challenge.rules?.tieBreaker1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Tie Breaker 1:</span>
                    <span className="font-semibold text-purple-400">
                      {TIEBREAKER_LABELS[challenge.rules.tieBreaker1] || challenge.rules.tieBreaker1}
                    </span>
                  </div>
                )}
                {challenge.rules?.tieBreaker2 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Tie Breaker 2:</span>
                    <span className="font-semibold text-purple-400">
                      {TIEBREAKER_LABELS[challenge.rules.tieBreaker2] || challenge.rules.tieBreaker2}
                    </span>
                  </div>
                )}
                {challenge.rules?.minimumTrades > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Minimum Trades:</span>
                    <span className="font-semibold text-amber-400">{challenge.rules.minimumTrades} trades</span>
                  </div>
                )}
              </div>
            </div>

            {/* Minimum Trades Warning */}
            {challenge.rules?.minimumTrades > 0 && (
              <div className="rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-orange-400" />
                  <h3 className="text-lg font-semibold text-gray-100">Minimum Trades Requirement</h3>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400 flex items-start gap-2">
                    <Skull className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>⚠️ Disqualification Warning:</strong> Players must complete at least 
                      <span className="font-black text-red-300 mx-1">{challenge.rules.minimumTrades}</span> 
                      trades. Failure to meet this requirement results in disqualification.
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Entry/Action Button */}
            <ChallengeEntryActions
              challengeId={id}
              status={challenge.status}
              isChallenger={isChallenger}
              isChallenged={isChallenged}
            />

            {/* Live Countdown */}
            {isPending && (
              <LiveCountdown
                targetDate={new Date(challenge.acceptDeadline)}
                label="⏳ Accept Deadline"
                type="start"
                status="upcoming"
              />
            )}
            {isActive && (
              <LiveCountdown
                targetDate={new Date(challenge.endTime)}
                label="⏱️ Time Remaining"
                type="end"
                status="active"
              />
            )}

            {/* Schedule */}
            <div className="rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-orange-400" />
                <h3 className="text-lg font-semibold text-gray-100">Schedule (UTC)</h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-yellow-400">CREATED</span>
                  </div>
                  <p className="text-xl font-black text-white">
                    {formatUTCDate(new Date(challenge.createdAt))}
                  </p>
                </div>

                {challenge.startTime && (
                  <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-semibold text-green-400">START TIME</span>
                    </div>
                    <p className="text-xl font-black text-white">
                      {formatUTCDate(new Date(challenge.startTime))}
                    </p>
                  </div>
                )}

                {challenge.endTime && (
                  <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-semibold text-red-400">END TIME</span>
                    </div>
                    <p className="text-xl font-black text-white">
                      {formatUTCDate(new Date(challenge.endTime))}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Challenge Details */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                Trading Settings
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Starting Capital</p>
                    <p className="text-lg font-bold text-green-400">
                      ${(challenge.startingCapital || 10000).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Leverage Range</p>
                    <p className="text-lg font-bold text-purple-400">
                      1:{challenge.leverage?.min || 1} to 1:{challenge.leverage?.max || 100}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Asset Classes</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(challenge.assetClasses || ['forex']).map((asset: string) => (
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
                  <Shield className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-300">Position Limits</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="p-2 bg-gray-900/50 rounded-lg text-center">
                        <p className="text-xs text-gray-500">Max Open</p>
                        <p className="text-lg font-bold text-cyan-400">{challenge.maxOpenPositions || 10}</p>
                      </div>
                      <div className="p-2 bg-gray-900/50 rounded-lg text-center">
                        <p className="text-xs text-gray-500">Max Size</p>
                        <p className="text-lg font-bold text-cyan-400">{challenge.maxPositionSize || 100}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trading Restrictions */}
            <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-gray-100">Trading Restrictions</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-sm text-gray-300">Short Selling</span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                    challenge.allowShortSelling ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {challenge.allowShortSelling ? '✅ Allowed' : '❌ Not Allowed'}
                  </span>
                </div>

                {challenge.rules?.disqualifyOnLiquidation && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400 flex items-center gap-2">
                      <Skull className="h-4 w-4" />
                      <strong>Liquidation = Disqualification</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Prize Pool */}
            <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-gray-800/50 border border-yellow-500/30 p-6">
              <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Prize Breakdown
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-sm text-gray-400">Total Pool</span>
                  <span className="text-lg font-bold text-gray-100">{challenge.prizePool || 0} ⚡</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-sm text-gray-400">Platform Fee ({challenge.platformFeePercentage || 0}%)</span>
                  <span className="text-lg font-bold text-red-400">-{challenge.platformFeeAmount?.toFixed(2) || 0} ⚡</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/30">
                  <span className="text-sm font-semibold text-yellow-400">Winner Takes</span>
                  <span className="text-2xl font-black text-yellow-400">{challenge.winnerPrize?.toFixed(0) || 0} ⚡</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading challenge:', error);
    notFound();
  }
}
