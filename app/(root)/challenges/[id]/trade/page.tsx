import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getUserPositions } from '@/lib/actions/trading/position.actions';
import { getMarginThresholds } from '@/lib/actions/trading/risk-settings.actions';
import { getCompetitionTradeHistory } from '@/lib/actions/trading/trade-history.actions';
import { getUserOrders } from '@/lib/actions/trading/order.actions';
import Challenge from '@/database/models/trading/challenge.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import { connectToDatabase } from '@/database/mongoose';
import TradingInterface, { TradingModeProvider } from '@/components/trading/TradingInterface';
import ChartWrapper from '@/components/trading/ChartWrapper';
import PositionsTable from '@/components/trading/PositionsTable';
import TradeHistory from '@/components/trading/TradeHistory';
import MarketStatusBanner from '@/components/trading/MarketStatusBanner';
import InteractiveTPSL from '@/components/trading/InteractiveTPSL';
import PendingOrders from '@/components/trading/PendingOrders';
import { LiveAccountInfo } from '@/components/trading/LiveAccountInfo';
import { PriceProvider } from '@/contexts/PriceProvider';
import { ChartSymbolProvider } from '@/contexts/ChartSymbolContext';
import { TradingArsenalProvider } from '@/contexts/TradingArsenalContext';
import { PositionEventsProvider } from '@/contexts/PositionEventsProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChallengeInfoHeader } from '@/components/trading/ChallengeInfoHeader';
import ChallengeStatusMonitor from '@/components/trading/ChallengeStatusMonitor';
import TradingArsenalPanel from '@/components/trading/TradingArsenalPanel';
import { ArrowLeft, Swords } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ChallengeTradingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ viewOnly?: string }>;
}

const ChallengeTradingPage = async ({ params, searchParams }: ChallengeTradingPageProps) => {
  // Disable caching to ensure fresh position data
  noStore();
  
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const { id: challengeId } = await params;
  const { viewOnly } = await searchParams;
  const isViewOnly = viewOnly === 'true';

  // Get challenge details
  await connectToDatabase();
  const challengeDoc = await Challenge.findById(challengeId).lean();
  
  if (!challengeDoc) {
    redirect('/challenges');
  }
  
  // Serialize to plain object for Client Components
  const challenge = JSON.parse(JSON.stringify(challengeDoc));

  // Check if user is a participant
  const isChallenger = challenge.challengerId === session.user.id;
  const isChallenged = challenge.challengedId === session.user.id;
  
  if (!isChallenger && !isChallenged) {
    redirect('/challenges');
  }

  // Check challenge status
  const isCompleted = challenge.status === 'completed';
  const isCancelled = challenge.status === 'cancelled' || challenge.status === 'declined';
  
  if (isCancelled) {
    redirect(`/challenges/${challengeId}`);
  }
  
  if (challenge.status !== 'active' && !isCompleted) {
    redirect(`/challenges/${challengeId}`);
  }
  
  // If challenge is completed and not in view-only mode, redirect to details
  if (isCompleted && !isViewOnly) {
    redirect(`/challenges/${challengeId}`);
  }

  // Get participant data
  const participantDoc = await ChallengeParticipant.findOne({
    challengeId,
    userId: session.user.id,
  }).lean();

  if (!participantDoc) {
    redirect(`/challenges/${challengeId}`);
  }

  // Serialize to plain object for Client Components
  const participant = JSON.parse(JSON.stringify(participantDoc));

  // Get opponent participant for display
  const opponentDoc = await ChallengeParticipant.findOne({
    challengeId,
    userId: { $ne: session.user.id },
  }).lean();

  // Serialize to plain object for Client Components
  const opponent = opponentDoc ? JSON.parse(JSON.stringify(opponentDoc)) : null;

  // Get user's positions - using challengeId as the contextId (works with existing trading system)
  const positions = await getUserPositions(challengeId);

  // Get trade history
  const tradeHistoryResult = await getCompetitionTradeHistory(challengeId);
  const tradeHistory = tradeHistoryResult.success ? tradeHistoryResult.trades : [];

  // Get pending orders
  const pendingOrders = await getUserOrders(challengeId, 'pending');

  // Load admin risk settings
  let marginThresholds;
  let defaultLeverage = 10;
  try {
    marginThresholds = await getMarginThresholds();
    const { getTradingRiskSettings } = await import('@/lib/actions/trading/risk-settings.actions');
    const riskSettings = await getTradingRiskSettings();
    defaultLeverage = riskSettings?.defaultLeverage || 10;
  } catch (error) {
    console.error('⚠️ Failed to load admin risk settings, using defaults:', error);
    marginThresholds = undefined;
  }

  // Calculate stats
  const equity = participant.currentCapital + participant.unrealizedPnl;
  const marginLevel = participant.usedMargin > 0 
    ? (equity / participant.usedMargin) * 100 
    : Infinity;

  // Calculate daily realized P&L
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dailyRealizedPnl = tradeHistory
    .filter((trade: any) => trade.closedAt && new Date(trade.closedAt) >= today)
    .reduce((sum: number, trade: any) => sum + (trade.pnl ?? trade.realizedPnl ?? 0), 0);

  return (
    <PriceProvider>
      <ChartSymbolProvider>
        <TradingArsenalProvider>
        <PositionEventsProvider competitionId={challengeId} contestType="challenge">
        <TradingModeProvider>
        {/* Monitor challenge status */}
        {!isViewOnly && (
          <ChallengeStatusMonitor 
            challengeId={challengeId} 
            initialStatus={challenge.status}
            userId={session.user.id}
          />
        )}
        
        <div className="min-h-screen bg-gradient-to-br from-dark-100 via-dark-100 to-dark-200">
        {/* View-Only Banner for Completed Challenges */}
        {isViewOnly && (
          <div className="bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-orange-500/20 border-b border-orange-500/30">
            <div className="container-custom py-3">
              <div className="flex items-center justify-center gap-3 text-orange-300">
                <span className="text-xl">⚔️</span>
                <span className="font-medium">Challenge ended — Trading is disabled</span>
                <Link 
                  href={`/challenges/${challengeId}`}
                  className="ml-4 px-3 py-1 bg-orange-500/30 hover:bg-orange-500/40 rounded-lg text-sm font-medium transition-colors"
                >
                  View Results
                </Link>
              </div>
            </div>
          </div>
        )}
        
        {/* Professional Header with Gradient - Challenge Style */}
        <div className="relative bg-gradient-to-r from-dark-200 via-dark-200/95 to-dark-300/90 border-b border-orange-500/30 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none" />
          
          <div className="container-custom py-4 md:py-6 relative z-10">
            <div className="flex flex-col gap-5 md:gap-6">
              {/* Back & Title */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Link 
                    href={`/challenges/${challengeId}`}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-300/50 hover:bg-dark-300 border border-dark-400/30 hover:border-orange-500/30 transition-all duration-200"
                  >
                    <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="text-sm font-medium text-light-900">Back</span>
                  </Link>
                  <div className="border-l border-dark-400/30 pl-4 h-10 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <Swords className="size-5 text-orange-500" />
                      <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-light-900 tracking-tight">
                        1v1 Challenge
                      </h1>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-gray-400">
                        vs <span className="text-orange-400 font-medium">{opponent?.username || 'Opponent'}</span>
                      </span>
                      {isViewOnly ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 ml-2">
                          <span className="size-1.5 bg-orange-400 rounded-full" />
                          Viewing Results
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 ml-2">
                          <span className="size-1.5 bg-green-400 rounded-full animate-pulse" />
                          Live Trading
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Challenge Info Header - Dynamic with live updates based on ranking method */}
              {/* Uses TOTAL P&L (realized + unrealized) for accurate status */}
              <ChallengeInfoHeader
                challengeId={challengeId}
                endTime={challenge.endTime}
                entryFee={challenge.entryFee}
                winnerPrize={challenge.winnerPrize || challenge.prizePool}
                opponentId={opponent?.userId || ''}
                opponentUsername={opponent?.username || 'Opponent'}
                rankingMethod={challenge.rules?.rankingMethod || 'pnl'}
                initialMyStats={{
                  pnl: participant?.pnl || 0,
                  pnlPercentage: participant?.pnlPercentage || 0,
                  currentCapital: participant?.currentCapital || 0,
                  winRate: participant?.winRate || 0,
                  winningTrades: participant?.winningTrades || 0,
                  losingTrades: participant?.losingTrades || 0,
                  totalTrades: participant?.totalTrades || 0,
                  unrealizedPnl: participant?.unrealizedPnl || 0,
                  startingCapital: participant?.startingCapital || challenge.startingCapital || 10000,
                }}
                initialOpponentStats={{
                  pnl: opponent?.pnl || 0,
                  pnlPercentage: opponent?.pnlPercentage || 0,
                  currentCapital: opponent?.currentCapital || 0,
                  winRate: opponent?.winRate || 0,
                  winningTrades: opponent?.winningTrades || 0,
                  losingTrades: opponent?.losingTrades || 0,
                  totalTrades: opponent?.totalTrades || 0,
                  unrealizedPnl: opponent?.unrealizedPnl || 0,
                  startingCapital: opponent?.startingCapital || challenge.startingCapital || 10000,
                }}
              />
            </div>

            {/* Margin Level Warning */}
            {!isViewOnly && marginLevel < 150 && marginLevel !== Infinity && (
              <div className={cn(
                "mt-5 p-4 rounded-xl border backdrop-blur-sm relative overflow-hidden shadow-lg",
                marginLevel < 50 ? "bg-red-500/10 border-red-500/50" : 
                marginLevel < 100 ? "bg-orange-500/10 border-orange-500/50" : 
                "bg-yellow-500/10 border-yellow-500/50"
              )}>
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]",
                  marginLevel < 50 ? "opacity-100" : "opacity-50"
                )} />
                <div className="relative flex items-center gap-3">
                  <div className={cn(
                    "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    marginLevel < 50 ? "bg-red-500/20" : 
                    marginLevel < 100 ? "bg-orange-500/20" : 
                    "bg-yellow-500/20"
                  )}>
                    <span className="text-2xl">
                      {marginLevel < 50 ? '⚠️' : marginLevel < 100 ? '🚨' : '⚠️'}
                    </span>
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm md:text-base font-bold mb-0.5",
                      marginLevel < 50 ? "text-red-400" : 
                      marginLevel < 100 ? "text-orange-400" : 
                      "text-yellow-400"
                    )}>
                      {marginLevel < 50 ? 'LIQUIDATION WARNING' : 
                       marginLevel < 100 ? 'MARGIN CALL ALERT' : 
                       'LOW MARGIN WARNING'}
                    </p>
                    <p className="text-xs md:text-sm text-light-900/80">
                      Margin level at <span className="font-bold">{Number.isFinite(marginLevel) ? marginLevel.toFixed(1) : '∞'}%</span>
                      {marginLevel < 50 ? ' — Your positions may be liquidated!' : 
                       marginLevel < 100 ? ' — Add capital or close positions!' : 
                       ' — Consider reducing risk.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="container-custom py-5 md:py-8">
          {/* Market Status Banner */}
          <MarketStatusBanner className="mb-5 md:mb-7 shadow-lg" />
          
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-5">
            {/* Left Column: Chart + Account Info + Positions - Takes 3 of 5 columns on XL */}
            <div className="xl:col-span-3 space-y-4 md:space-y-5">
              {/* Chart Container */}
              <div className="group relative bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-2xl p-3 md:p-5 border border-dark-400/30 shadow-2xl hover:shadow-orange-500/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                <div className="relative">
                  <ChartWrapper 
                    competitionId={challengeId} 
                    positions={positions} 
                    pendingOrders={pendingOrders}
                    tradingProps={{
                      availableCapital: participant.availableCapital,
                      defaultLeverage,
                      openPositionsCount: participant.currentOpenPositions,
                      maxPositions: 10,
                      currentEquity: equity,
                      existingUsedMargin: participant.usedMargin,
                      currentBalance: participant.currentCapital,
                      marginThresholds,
                      startingCapital: challenge.startingCapital,
                      dailyRealizedPnl,
                    }}
                  />
                </div>
              </div>

              {/* Positions & Trade History Tabs */}
              <div className="bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-2xl p-4 md:p-6 border border-dark-400/30 shadow-2xl">
                <Tabs defaultValue="positions" className="w-full">
                  <TabsList className="bg-dark-300/80 border border-dark-400/50 mb-5 p-1 rounded-xl backdrop-blur-sm shadow-lg">
                    <TabsTrigger 
                      value="positions" 
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/50 rounded-lg font-semibold transition-all duration-200"
                    >
                      <span className="flex items-center gap-2">
                        Open Positions 
                        <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-xs font-bold">
                          {positions.length}
                        </span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="pending"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/50 rounded-lg font-semibold transition-all duration-200"
                    >
                      <span className="flex items-center gap-2">
                        Pending Orders 
                        <span className="inline-flex items-center justify-center size-5 rounded-full bg-blue-500/20 text-xs font-bold">
                          {pendingOrders.length}
                        </span>
                      </span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="history"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/50 rounded-lg font-semibold transition-all duration-200"
                    >
                      <span className="flex items-center gap-2">
                        History 
                        <span className="inline-flex items-center justify-center size-5 rounded-full bg-purple-500/20 text-xs font-bold">
                          {tradeHistory.length}
                        </span>
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="positions" className="mt-0">
                    <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                      <PositionsTable 
                        positions={positions} 
                        challengeId={challengeId}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="pending" className="mt-0">
                    <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                      <PendingOrders orders={pendingOrders} />
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="mt-0">
                    <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                      <TradeHistory trades={tradeHistory} />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Live Account Info */}
              <div className="relative">
                <LiveAccountInfo
                  competitionId={challengeId}
                  initialBalance={participant.currentCapital}
                  initialEquity={equity}
                  initialUnrealizedPnl={participant.unrealizedPnl}
                  initialUsedMargin={participant.usedMargin}
                  initialAvailableCapital={participant.availableCapital}
                  positions={positions}
                  marginThresholds={marginThresholds}
                  startingCapital={challenge.startingCapital}
                  dailyRealizedPnl={dailyRealizedPnl}
                />
              </div>
            </div>

            {/* Right Column: Trading Interface - Takes 2 of 5 columns on XL */}
            <div className="xl:col-span-2">
              {isViewOnly ? (
                /* View-Only Mode */
                <div className="bg-gradient-to-br from-orange-500/10 to-dark-300/50 rounded-2xl p-4 md:p-6 border border-orange-500/30 shadow-2xl lg:sticky lg:top-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg md:text-xl font-bold text-light-900 tracking-tight">
                      ⚔️ Challenge Ended
                    </h2>
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded">
                      COMPLETED
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-dark-300/50 rounded-xl border border-dark-400/30">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Final Capital</p>
                      <p className="text-2xl font-bold text-gray-100">${participant.currentCapital.toLocaleString()}</p>
                    </div>
                    
                    <div className="p-4 bg-dark-300/50 rounded-xl border border-dark-400/30">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total P&L</p>
                      <p className={`text-2xl font-bold ${participant.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {participant.pnl >= 0 ? '+' : ''}${participant.pnl?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    
                    <div className="p-4 bg-dark-300/50 rounded-xl border border-dark-400/30">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Trades</p>
                      <p className="text-2xl font-bold text-blue-400">{tradeHistory.length}</p>
                    </div>

                    <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                      <p className="text-sm text-orange-300 text-center mb-3">
                        Trading is disabled for completed challenges
                      </p>
                      <Link href={`/challenges/${challengeId}`} className="block">
                        <button className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors">
                          View Results
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                /* Active Challenge - Show Trading Interface */
                <div className="space-y-4 lg:sticky lg:top-6">
                  {/* Trading Arsenal Panel */}
                  <TradingArsenalPanel
                    contestType="challenge"
                    contestId={challengeId}
                    participantId={participant._id?.toString() || ''}
                  />
                  
                  {/* Manual Trading Interface */}
                  <div className="bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-2xl p-4 md:p-6 border border-orange-500/30 shadow-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg md:text-xl font-bold text-light-900 tracking-tight">
                        Place Order
                      </h2>
                      <div className="size-2 bg-orange-400 rounded-full animate-pulse shadow-lg shadow-orange-400/50" />
                    </div>
                    <TradingInterface
                      competitionId={challengeId}
                      availableCapital={participant.availableCapital}
                      defaultLeverage={defaultLeverage}
                      openPositionsCount={participant.currentOpenPositions}
                      maxPositions={10}
                      currentEquity={equity}
                      existingUsedMargin={participant.usedMargin}
                      currentBalance={participant.currentCapital}
                      marginThresholds={marginThresholds}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Interactive TP/SL Handler */}
      {!isViewOnly && (
        <InteractiveTPSL 
          positions={positions}
          competitionId={challengeId}
        />
      )}
      
      </TradingModeProvider>
        </PositionEventsProvider>
        </TradingArsenalProvider>
      </ChartSymbolProvider>
    </PriceProvider>
  );
};

export default ChallengeTradingPage;

