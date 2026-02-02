import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { getCompetitionById } from "@/lib/actions/trading/competition.actions";
import { getUserPositions } from "@/lib/actions/trading/position.actions";
import { getWalletBalance } from "@/lib/actions/trading/wallet.actions";
import { getMarginThresholds } from "@/lib/actions/trading/risk-settings.actions";
import { getCompetitionTradeHistory } from "@/lib/actions/trading/trade-history.actions";
import { getUserOrders } from "@/lib/actions/trading/order.actions";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { connectToDatabase } from "@/database/mongoose";
import TradingInterface, {
  TradingModeProvider,
} from "@/components/trading/TradingInterface";
import ChartWrapper from "@/components/trading/ChartWrapper";
import MarketStatusBanner from "@/components/trading/MarketStatusBanner";
import InteractiveTPSL from "@/components/trading/InteractiveTPSL";
import { PriceProvider } from "@/contexts/PriceProvider";
import { ChartSymbolProvider } from "@/contexts/ChartSymbolContext";
import { TradingArsenalProvider } from "@/contexts/TradingArsenalContext";
import { PositionEventsProvider } from "@/contexts/PositionEventsProvider";
import { CompetitionInfoHeader } from "@/components/trading/CompetitionInfoHeader";
import CompetitionStatusMonitor from "@/components/trading/CompetitionStatusMonitor";
import ParticipantStatusMonitor from "@/components/trading/ParticipantStatusMonitor";
import TradingArsenalPanel from "@/components/trading/TradingArsenalPanel";
import TradingPageContent from "@/components/trading/TradingPageContent";
import { AccountStrip } from "@/components/trading/AccountStrip";
import { BottomPositionsPanel } from "@/components/trading/BottomPositionsPanel";
import { ArrowLeft } from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TradingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ viewOnly?: string }>;
}

const TradingPage = async ({ params, searchParams }: TradingPageProps) => {
  // Disable caching to ensure fresh position data (including TP/SL)
  noStore();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const { id: competitionId } = await params;
  const { viewOnly } = await searchParams;
  const isViewOnly = viewOnly === "true";

  // Get competition details
  const competition = await getCompetitionById(competitionId);
  if (!competition) {
    redirect("/competitions");
  }

  // Check if competition is active OR if user is viewing results of completed competition
  const isCompleted = competition.status === "completed";
  const isCancelled = competition.status === "cancelled";
  const isPaused = competition.isPaused === true;
  const pauseReason = competition.pauseReason || "Technical issues";

  // Redirect if competition is cancelled
  if (isCancelled) {
    redirect(`/competitions/${competitionId}`);
  }

  if (competition.status !== "active" && !isCompleted) {
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

  // Check if participant is disqualified (liquidated or disqualified status)
  const isDisqualified =
    participant.status === "liquidated" ||
    participant.status === "disqualified";
  const participantStatus = participant.status;

  // Get user's positions
  const positions = await getUserPositions(competitionId);

  // Get trade history
  const tradeHistoryResult = await getCompetitionTradeHistory(competitionId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tradeHistory: any[] = tradeHistoryResult.success
    ? tradeHistoryResult.trades
    : [];

  // Get pending orders
  const pendingOrders = await getUserOrders(competitionId, "pending");

  // Get wallet balance
  const _walletBalance = await getWalletBalance();

  // Load admin risk settings (fail gracefully to defaults)
  let marginThresholds;
  let defaultLeverage = 10; // Fallback default
  try {
    marginThresholds = await getMarginThresholds();
    const { getTradingRiskSettings } =
      await import("@/lib/actions/trading/risk-settings.actions");
    const riskSettings = await getTradingRiskSettings();
    defaultLeverage = riskSettings?.defaultLeverage || 10;
  } catch (error) {
    console.error(
      "⚠️ Failed to load admin risk settings, using defaults:",
      error,
    );
    marginThresholds = undefined; // Will use DEFAULT_MARGIN_THRESHOLDS in components
  }

  // Calculate stats
  const equity = participant.currentCapital + participant.unrealizedPnl;
  const marginLevel =
    participant.usedMargin > 0
      ? (equity / participant.usedMargin) * 100
      : Infinity;

  // Calculate daily realized P&L (from today's closed trades)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dailyRealizedPnl = tradeHistory
    .filter((trade: any) => trade.closedAt && new Date(trade.closedAt) >= today)
    .reduce(
      (sum: number, trade: any) => sum + (trade.pnl ?? trade.realizedPnl ?? 0),
      0,
    );

  return (
    <PriceProvider>
      <ChartSymbolProvider>
        <TradingArsenalProvider>
          <PositionEventsProvider
            competitionId={competitionId}
            contestType="competition"
          >
            <TradingModeProvider>
              {/* Monitor competition status and redirect when it ends - ONLY when not in view-only mode */}
              {!isViewOnly && (
                <CompetitionStatusMonitor
                  competitionId={competitionId}
                  initialStatus={competition.status}
                  userId={session.user.id}
                />
              )}

              {/* Monitor participant status for live disqualification alerts - ONLY when not in view-only mode */}
              {!isViewOnly && (
                <ParticipantStatusMonitor
                  competitionId={competitionId}
                  initialParticipantStatus={participantStatus}
                  userId={session.user.id}
                />
              )}

              <TradingPageContent
                competition={{
                  _id: competitionId,
                  name: competition.name,
                  endTime: competition.endTime,
                  currentParticipants: competition.currentParticipants,
                  prizePool: competition.prizePool,
                }}
                participant={{
                  currentCapital: participant.currentCapital,
                  availableCapital: participant.availableCapital,
                  unrealizedPnl: participant.unrealizedPnl,
                  usedMargin: participant.usedMargin,
                  currentOpenPositions: participant.currentOpenPositions,
                }}
                positions={positions}
                competitionId={competitionId}
                defaultLeverage={defaultLeverage}
                startingCapital={competition.startingCapital}
                isDisqualified={isDisqualified}
                marginThresholds={marginThresholds}
                userId={session.user.id}
              >
                <div className="min-h-screen bg-gradient-to-br from-dark-100 via-dark-100 to-dark-200">
                  {/* Competition Paused Banner */}
                  {isPaused && !isViewOnly && (
                    <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-b border-yellow-500/40">
                      <div className="container-custom py-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex items-center gap-2 text-yellow-300">
                            <span className="text-2xl animate-pulse">⏸️</span>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                              <span className="font-bold text-lg">
                                Competition Paused
                              </span>
                              <span className="text-yellow-400/80 text-sm">
                                Trading is temporarily suspended
                              </span>
                            </div>
                          </div>
                          <div className="hidden md:block mx-4 w-px h-8 bg-yellow-500/30" />
                          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                            <span className="text-yellow-400 text-sm font-medium">
                              Reason:
                            </span>
                            <span className="text-yellow-300 text-sm">
                              {pauseReason}
                            </span>
                          </div>
                        </div>
                        <p className="text-center text-yellow-400/70 text-xs mt-2">
                          Please wait for the competition to resume. You will be
                          notified when trading resumes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* View-Only Banner for Completed Competitions */}
                  {isViewOnly && (
                    <div className="bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-purple-500/20 border-b border-purple-500/30">
                      <div className="container-custom py-3">
                        <div className="flex items-center justify-center gap-3 text-purple-300">
                          <span className="text-xl">📊</span>
                          <span className="font-medium">
                            Viewing completed competition results — Trading is
                            disabled
                          </span>
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
                              href={
                                isViewOnly
                                  ? `/competitions/${competitionId}/results`
                                  : `/competitions/${competitionId}`
                              }
                              className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-300/50 hover:bg-dark-300 border border-dark-400/30 hover:border-dark-400 transition-all duration-200"
                            >
                              <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
                              <span className="text-sm font-medium text-light-900">
                                {isViewOnly ? "Back to Results" : "Back"}
                              </span>
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
                                ) : isPaused ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400">
                                    <span className="size-1.5 bg-yellow-400 rounded-full animate-pulse" />
                                    Paused - Trading Suspended
                                  </span>
                                ) : isDisqualified ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 text-xs font-medium",
                                      participantStatus === "liquidated"
                                        ? "text-red-400"
                                        : "text-orange-400",
                                    )}
                                  >
                                    {participantStatus === "liquidated" ? (
                                      <>
                                        <GameIcon name="skull" size={14} />
                                        Liquidated - Trading Disabled
                                      </>
                                    ) : (
                                      <>
                                        <GameIcon name="warning" size={14} />
                                        Disqualified - Trading Disabled
                                      </>
                                    )}
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
                      {!isViewOnly &&
                        marginLevel < 150 &&
                        marginLevel !== Infinity && (
                          <div
                            className={cn(
                              "mt-5 p-4 rounded-xl border backdrop-blur-sm relative overflow-hidden shadow-lg",
                              marginLevel < 50
                                ? "bg-red-500/10 border-red-500/50"
                                : marginLevel < 100
                                  ? "bg-orange-500/10 border-orange-500/50"
                                  : "bg-yellow-500/10 border-yellow-500/50",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]",
                                marginLevel < 50 ? "opacity-100" : "opacity-50",
                              )}
                            />
                            <div className="relative flex items-center gap-3">
                              <div
                                className={cn(
                                  "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                  marginLevel < 50
                                    ? "bg-red-500/20"
                                    : marginLevel < 100
                                      ? "bg-orange-500/20"
                                      : "bg-yellow-500/20",
                                )}
                              >
                                <span className="text-2xl">
                                  {marginLevel < 50
                                    ? "⚠️"
                                    : marginLevel < 100
                                      ? "🚨"
                                      : "⚠️"}
                                </span>
                              </div>
                              <div>
                                <p
                                  className={cn(
                                    "text-sm md:text-base font-bold mb-0.5",
                                    marginLevel < 50
                                      ? "text-red-400"
                                      : marginLevel < 100
                                        ? "text-orange-400"
                                        : "text-yellow-400",
                                  )}
                                >
                                  {marginLevel < 50
                                    ? "LIQUIDATION WARNING"
                                    : marginLevel < 100
                                      ? "MARGIN CALL ALERT"
                                      : "LOW MARGIN WARNING"}
                                </p>
                                <p className="text-xs md:text-sm text-light-900/80">
                                  Margin level at{" "}
                                  <span className="font-bold">
                                    {Number.isFinite(marginLevel)
                                      ? marginLevel.toFixed(1)
                                      : "∞"}
                                    %
                                  </span>
                                  {marginLevel < 50
                                    ? " — Your positions may be liquidated!"
                                    : marginLevel < 100
                                      ? " — Add capital or close positions!"
                                      : " — Consider reducing risk."}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Account Strip - Always Visible */}
                  <AccountStrip
                    balance={participant.currentCapital}
                    initialEquity={equity}
                    initialUnrealizedPnl={participant.unrealizedPnl}
                    usedMargin={participant.usedMargin}
                    availableCapital={participant.availableCapital}
                    positions={positions}
                    startingCapital={competition.startingCapital}
                  />

                  {/* Professional Main Content - Redesigned Layout */}
                  <div className="container-custom py-4 md:py-6">
                    {/* Market Status Banner */}
                    <MarketStatusBanner className="mb-4 shadow-lg" />

                    {/* Main Grid: Chart + Order Panel */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
                      {/* Chart Area - Takes majority of space */}
                      <div className="xl:col-span-8">
                        <div className="group relative bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-2xl p-3 md:p-4 border border-dark-400/30 shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-[500px] xl:h-[600px]">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                          <div className="relative h-full">
                            <ChartWrapper
                              competitionId={competitionId}
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
                                startingCapital: competition.startingCapital,
                                dailyRealizedPnl,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Trading Interface - Compact */}
                      <div className="xl:col-span-4">
                        {isViewOnly ? (
                          /* View-Only Mode */
                          <div className="bg-gradient-to-br from-purple-500/10 to-dark-300/50 rounded-2xl p-4 border border-purple-500/30 shadow-2xl backdrop-blur-sm h-full">
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-lg font-bold text-light-900">
                                Competition Ended
                              </h2>
                              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded">
                                COMPLETED
                              </span>
                            </div>
                            <div className="space-y-3">
                              <div className="p-3 bg-dark-300/50 rounded-xl border border-dark-400/30">
                                <p className="text-xs text-gray-500 uppercase mb-1">Final Capital</p>
                                <p className="text-xl font-bold text-gray-100">${participant.currentCapital.toLocaleString()}</p>
                              </div>
                              <div className="p-3 bg-dark-300/50 rounded-xl border border-dark-400/30">
                                <p className="text-xs text-gray-500 uppercase mb-1">Total P&L</p>
                                <p className={`text-xl font-bold ${participant.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                                  {participant.pnl >= 0 ? "+" : ""}${participant.pnl?.toFixed(2) || "0.00"}
                                </p>
                              </div>
                              <Link href={`/competitions/${competitionId}/results`} className="block">
                                <button className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-colors">
                                  View Full Results
                                </button>
                              </Link>
                            </div>
                          </div>
                        ) : isDisqualified ? (
                          /* Disqualified Mode */
                          <div className="bg-gradient-to-br from-red-500/10 to-dark-300/50 rounded-2xl p-4 border border-red-500/30 shadow-2xl backdrop-blur-sm h-full">
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-lg font-bold text-light-900 flex items-center gap-2">
                                {participantStatus === "liquidated" ? (
                                  <><GameIcon name="skull" size={20} /> Liquidated</>
                                ) : (
                                  <><GameIcon name="warning" size={20} /> Disqualified</>
                                )}
                              </h2>
                            </div>
                            <div className="space-y-3">
                              <div className={cn("p-3 rounded-xl border", participantStatus === "liquidated" ? "bg-red-500/10 border-red-500/30" : "bg-orange-500/10 border-orange-500/30")}>
                                <p className={cn("text-sm", participantStatus === "liquidated" ? "text-red-300" : "text-orange-300")}>
                                  {participantStatus === "liquidated" ? "Your account was liquidated." : "You have been disqualified."}
                                </p>
                              </div>
                              <div className="p-3 bg-dark-300/50 rounded-xl border border-dark-400/30">
                                <p className="text-xs text-gray-500 uppercase mb-1">Final Capital</p>
                                <p className="text-xl font-bold text-gray-100">${participant.currentCapital.toLocaleString()}</p>
                              </div>
                              <Link href={`/competitions/${competitionId}`} className="block">
                                <Button className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold gap-2">
                                  <GameIcon name="trophy" size={16} /> Back to Competition
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ) : (
                          /* Active Trading Interface */
                          <div className="bg-gradient-to-br from-dark-200 to-dark-300/50 rounded-2xl border border-dark-400/30 shadow-2xl backdrop-blur-sm flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between p-3 border-b border-dark-400/30 flex-shrink-0">
                              <h2 className="text-lg font-bold text-light-900">Place Order</h2>
                              <div className="size-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                            </div>

                            {/* Trading Arsenal (collapsed style) */}
                            <div className="px-3 pt-2 flex-shrink-0">
                              <TradingArsenalPanel
                                contestType="competition"
                                contestId={competitionId}
                                participantId={participant._id?.toString() || ""}
                              />
                            </div>

                            {/* Trading Interface */}
                            <div className="flex-1 px-3 pb-3">
                              <TradingInterface
                                competitionId={competitionId}
                                availableCapital={participant.availableCapital}
                                defaultLeverage={defaultLeverage}
                                openPositionsCount={participant.currentOpenPositions}
                                maxPositions={10}
                                currentEquity={equity}
                                existingUsedMargin={participant.usedMargin}
                                currentBalance={participant.currentCapital}
                                startingCapital={competition.startingCapital}
                                marginThresholds={marginThresholds}
                                disabled={isDisqualified || isPaused}
                                disabledReason={
                                  isPaused
                                    ? `Competition paused: ${pauseReason}`
                                    : participantStatus === "liquidated"
                                      ? "Account liquidated"
                                      : "Disqualified"
                                }
                                userId={session.user.id}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Positions Panel - Full Width */}
                    <BottomPositionsPanel
                      positions={positions}
                      pendingOrders={pendingOrders}
                      tradeHistory={tradeHistory}
                      competitionId={competitionId}
                    />
                  </div>
                </div>

                {/* Interactive TP/SL Handler - Manages position refreshing and editing - Only for active trading */}
                {!isViewOnly && (
                  <InteractiveTPSL
                    positions={positions}
                    competitionId={competitionId}
                  />
                )}
              </TradingPageContent>
            </TradingModeProvider>
          </PositionEventsProvider>
        </TradingArsenalProvider>
      </ChartSymbolProvider>
    </PriceProvider>
  );
};

export default TradingPage;
