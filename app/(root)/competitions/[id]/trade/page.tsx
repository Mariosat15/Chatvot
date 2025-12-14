import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getCompetitionById } from '@/lib/actions/trading/competition.actions';
import { getUserPositions } from '@/lib/actions/trading/position.actions';
import { getWalletBalance } from '@/lib/actions/trading/wallet.actions';
import { getMarginThresholds } from '@/lib/actions/trading/risk-settings.actions';
import { getCompetitionTradeHistory } from '@/lib/actions/trading/trade-history.actions';
import { getUserOrders } from '@/lib/actions/trading/order.actions';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompetitionInfoHeader } from '@/components/trading/CompetitionInfoHeader';
import CompetitionStatusMonitor from '@/components/trading/CompetitionStatusMonitor';
import TradingArsenalPanel from '@/components/trading/TradingArsenalPanel';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface TradingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ viewOnly?: string }>;
}

const TradingPage = async ({ params, searchParams }: TradingPageProps) => {
  // Disable caching to ensure fresh position data (including TP/SL)
  noStore();
  
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const { id: competitionId } = await params;
  const { viewOnly } = await searchParams;
  const isViewOnly = viewOnly === 'true';

  // Get competition details
  const competition = await getCompetitionById(competitionId);
  if (!competition) {
    redirect('/competitions');
  }

  // Check if competition is active OR if user is viewing results of completed competition
  const isCompleted = competition.status === 'completed';
  const isCancelled = competition.status === 'cancelled';
  
  // Redirect if competition is cancelled
  if (isCancelled) {
    redirect(`/competitions/${competitionId}`);
  }
  
  if (competition.status !== 'active' && !isCompleted) {
    redirect(`/competitions/${competitionId}`);
  }
  
  // If competition is completed and not in view-only mode, redirect to results
  if (isCompleted && !isViewOnly) {
    redirect(`/competitions/${competitionId}/results`);
  }

  // Check if user is participant
  await connectToDatabase();
  const participantDoc = await CompetitionParticipant.findOne({
    competitionId,
    userId: session.user.id,
  }).lean();

  if (!participantDoc) {
    redirect(`/competitions/${competitionId}`);
  }

  // Type assertion for proper TypeScript inference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participant = participantDoc as any;

  // Get user's positions
  const positions = await getUserPositions(competitionId);

  // Get trade history
  const tradeHistoryResult = await getCompetitionTradeHistory(competitionId);
  const tradeHistory = tradeHistoryResult.success ? tradeHistoryResult.trades : [];

  // Get pending orders
  const pendingOrders = await getUserOrders(competitionId, 'pending');

  // Get wallet balance
  const _walletBalance = await getWalletBalance();

  // Load admin risk settings (fail gracefully to defaults)
  let marginThresholds;
  let defaultLeverage = 10; // Fallback default
  try {
    marginThresholds = await getMarginThresholds();
    const { getTradingRiskSettings } = await import('@/lib/actions/trading/risk-settings.actions');
    const riskSettings = await getTradingRiskSettings();
    defaultLeverage = riskSettings?.defaultLeverage || 10;
  } catch (error) {
    console.error('⚠️ Failed to load admin risk settings, using defaults:', error);
    marginThresholds = undefined; // Will use DEFAULT_MARGIN_THRESHOLDS in components
  }

  // Calculate stats
  const equity = participant.currentCapital + participant.unrealizedPnl;
  const marginLevel = participant.usedMargin > 0 
    ? (equity / participant.usedMargin) * 100 
    : Infinity;

  // Calculate daily realized P&L (from today's closed trades)
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
        <TradingModeProvider>
        {/* Monitor competition status and redirect when it ends - ONLY when not in view-only mode */}
        {!isViewOnly && (
          <CompetitionStatusMonitor 
            competitionId={competitionId} 
            initialStatus={competition.status}
          />
        )}
        
        <div className="min-h-screen bg-gradient-to-br from-dark-100 via-dark-100 to-dark-200">
        {/* View-Only Banner for Completed Competitions */}
        {isViewOnly && (
          <div className="bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-purple-500/20 border-b border-purple-500/30">
            <div className="container-custom py-3">
              <div className="flex items-center justify-center gap-3 text-purple-300">
                <span className="text-xl">📊</span>
                <span className="font-medium">Viewing completed competition results — Trading is disabled</span>
                <Link 
                  href={`/competitions/${competitionId}/results`}
                  className="ml-4 px-3 py-1 bg-purple-500/30 hover:bg-purple-500/40 rounded-lg text-sm font-medium transition-colors"
                >
                  View Full Results
                </Link>
              </div>
            </div>
          </div>
        )}
        
        {/* Professional Header with Gradient */}
        <div className="relative bg-gradient-to-r from-dark-200 via-dark-200/95 to-dark-300/90 border-b border-dark-400/50 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
          
          <div className="container-custom py-4 md:py-6 relative z-10">
            <div className="flex flex-col gap-5 md:gap-6">
              {/* Back & Title with Better Spacing */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Link 
                    href={isViewOnly ? `/competitions/${competitionId}/results` : `/competitions/${competitionId}`}
                    className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-300/50 hover:bg-dark-300 border border-dark-400/30 hover:border-dark-400 transition-all duration-200"
                  >
                    <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="text-sm font-medium text-light-900">{isViewOnly ? 'Back to Results' : 'Back'}</span>
                  </Link>
                  <div className="border-l border-dark-400/30 pl-4 h-10 flex flex-col justify-center">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-light-900 tracking-tight">
                      {competition.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isViewOnly ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-400">
                          <span className="size-1.5 bg-purple-400 rounded-full" />
                          Viewing Results
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                          <span className="size-1.5 bg-green-400 rounded-full animate-pulse" />
                          Live Trading
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Competition Info Header */}
              <CompetitionInfoHeader
                endTime={competition.endTime}
                currentParticipants={competition.currentParticipants}
                prizePool={competition.prizePool}
              />
            </div>

            {/* Enhanced Margin Level Warning with Gradient - Only show for active trading */}
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

        {/* Professional Main Content */}
        <div className="container-custom py-5 md:py-8">
          {/* Market Status Banner with Better Styling */}
          <MarketStatusBanner className="mb-5 md:mb-7 shadow-lg" />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-7">
            {/* Left Column: Chart + Account Info + Positions */}
            <div className="lg:col-span-2 space-y-5 md:space-y-7">
              {/* Professional Chart Container */}
              <div className="group relative bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-2xl p-3 md:p-5 border border-dark-400/30 shadow-2xl hover:shadow-primary/10 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                <div className="relative">
                  <ChartWrapper competitionId={competitionId} positions={positions} pendingOrders={pendingOrders} />
                </div>
              </div>

              {/* Professional Positions & Trade History Tabs - MOVED ABOVE TRADE STATS */}
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
                        competitionId={competitionId}
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

              {/* Live Account Info - Enhanced Card - NOW BELOW TABS */}
              <div className="relative">
                <LiveAccountInfo
                  competitionId={competitionId}
                  initialBalance={participant.currentCapital}
                  initialEquity={equity}
                  initialUnrealizedPnl={participant.unrealizedPnl}
                  initialUsedMargin={participant.usedMargin}
                  initialAvailableCapital={participant.availableCapital}
                  positions={positions}
                  marginThresholds={marginThresholds}
                  startingCapital={competition.startingCapital}
                  dailyRealizedPnl={dailyRealizedPnl}
                />
              </div>
            </div>

            {/* Right Column: Professional Trading Interface */}
            <div className="lg:col-span-1">
              {isViewOnly ? (
                /* View-Only Mode - Show Summary Instead of Trading Interface */
                <div className="bg-gradient-to-br from-purple-500/10 to-dark-300/50 rounded-2xl p-4 md:p-6 border border-purple-500/30 shadow-2xl lg:sticky lg:top-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg md:text-xl font-bold text-light-900 tracking-tight">
                      📊 Competition Ended
                    </h2>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded">
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

                    <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                      <p className="text-sm text-purple-300 text-center mb-3">
                        Trading is disabled for completed competitions
                      </p>
                      <Link href={`/competitions/${competitionId}/results`} className="block">
                        <button className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-colors">
                          View Full Results
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                /* Active Competition - Show Trading Interface */
                <div className="space-y-4 lg:sticky lg:top-6">
                  {/* Trading Arsenal Panel */}
                  <TradingArsenalPanel
                    contestType="competition"
                    contestId={competitionId}
                    participantId={participant._id?.toString() || ''}
                  />
                  
                  {/* Manual Trading Interface */}
                  <div className="bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-2xl p-4 md:p-6 border border-dark-400/30 shadow-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg md:text-xl font-bold text-light-900 tracking-tight">
                        Place Order
                      </h2>
                      <div className="size-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                    </div>
                      <TradingInterface
                      competitionId={competitionId}
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
      
      {/* Interactive TP/SL Handler - Manages position refreshing and editing - Only for active trading */}
      {!isViewOnly && (
        <InteractiveTPSL 
          positions={positions}
          competitionId={competitionId}
        />
      )}
      
      </TradingModeProvider>
        </TradingArsenalProvider>
      </ChartSymbolProvider>
    </PriceProvider>
  );
};

export default TradingPage;

