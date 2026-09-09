import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import {
  isCompetitionIdShaped,
  logMalformedCompetitionId,
} from "@/lib/utils/competition-id";
import { competitionDetailsHref } from "@/lib/utils/competition-details-view";
import { formatVolts } from "@/lib/utils/format-volts";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { getCompetitionById } from "@/lib/actions/trading/competition.actions";
import { getCompetitionTradeHistory } from "@/lib/actions/trading/trade-history.actions";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import { connectToDatabase } from "@/database/mongoose";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  LayoutDashboard,
} from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";
import { hasProviderGameLabel } from "@/lib/services/games/contest-config";
import { getProviderContestResults } from "@/lib/services/games/contest-results.service";
import { ProviderResultsScreen } from "@/components/games/ProviderResultsScreen";
import { findUnscoredRefund } from "@/lib/services/settlement/unscored-refund";
import AppSettingsModel from "@/database/models/app-settings.model";

/*
  The two row shapes this page reduces over, named rather than annotated `any` at each call
  site. They are deliberately minimal - only the fields the statistics below read - because a
  parameter type narrower than the array's element type is still assignable, and widening it
  to the full document would tie this page to two schemas it only aggregates.

  Reason they exist at all: there were six `eslint-disable-next-line` comments here that
  silenced nothing. Each arrow function had been wrapped onto its own line by the formatter,
  which left the comment covering the line above the `any` it was written for, so the file
  could not pass `--max-warnings=0` and the suppressions read as though it did.
*/
type ClosedTradeRow = { realizedPnl: number };
type FinalLeaderboardRow = { userId: string; prizeAmount?: number };

const CompetitionResultsPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  noStore();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const { id: competitionId } = await params;

  // A junk id is a bad request, not a fault: refuse it here rather than letting the read throw
  // and hand the player a server-error boundary. See `lib/utils/competition-id.ts`.
  if (!isCompetitionIdShaped(competitionId)) {
    logMalformedCompetitionId("/competitions/[id]/results", competitionId);
    notFound();
  }

  // Get competition details
  //
  // THIS NULL CHECK COULD NEVER RUN UNTIL 7 SEP 2026, and that is why a deleted contest showed an
  // error boundary here instead of the redirect its author intended: `getCompetitionById` threw
  // "Competition not found" rather than returning null. It answers `null` now.
  const competition = await getCompetitionById(competitionId);
  if (!competition) {
    redirect("/competitions");
  }

  /*
    THIS PAGE IS THE TRADING POST-MORTEM AND NOTHING ELSE. Everything below is trade history,
    win rate, profit factor and capital - concepts a puzzle does not have. It threw on every
    provider contest, because the participant schema makes the three virtual-capital fields
    conditional on `gameKey === "trading"`, so the reads below found `undefined`.

    The lobby was fixed to stop routing provider players here, but this URL is reachable
    directly - from a bookmark, from history, or from the redirect the trading dashboard
    still issues - so the guard belongs here too. Two gates, because the failure is a
    server-rendered throw that shows the player an error boundary naming nothing.

    UNTIL 7 SEP 2026 THIS BRANCH REDIRECTED TO THE LOBBY, which stopped the crash and left a
    provider player with no record of their own contest at all - the lobby shows the public
    leaderboard and nothing about their rounds. It now renders the provider equivalent, and the
    reads live in a service rather than inline here for the reason the crash existed: this
    page's `.lean()` with a hand-written generic is exactly where a field the schema does not
    store looks real to the compiler.
  */
  if (hasProviderGameLabel(competition)) {
    /*
      Three reads, composed here rather than in one service, and the split is a constraint
      rather than a preference: the refund is a wallet-ledger read, and chapter 11 seam 4 bans
      money imports from `lib/services/games/` where the rest of this comes from. The page is
      the right place for the composition - it is already the layer that knows about currency
      settings, which are nothing to do with a contest either.
    */
    const [providerResults, refundedAmount, appSettings] = await Promise.all([
      getProviderContestResults(competition, session.user.id),
      findUnscoredRefund(competitionId, session.user.id),
      // `credits.name`, not `currency.symbol`: a prize and a refunded entry fee are both
      // credit amounts, so the fiat symbol made a 30-credit prize read `€30`.
      AppSettingsModel.findById("app-settings")
        .lean<{ credits?: { name?: string } } | null>()
        .catch(() => null),
    ]);

    // No seat means there is nothing personal to show. The lobby has the public leaderboard,
    // which is the honest destination for someone who did not enter.
    if (!providerResults) {
      redirect(`/competitions/${competitionId}`);
    }

    return (
      <div className="flex min-h-screen flex-col gap-4 overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900/20 p-3 sm:gap-6 sm:p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <Link href="/competitions">
            <Button
              variant="ghost"
              className="min-h-[44px] w-fit gap-2 text-gray-400 hover:text-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Competitions</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
          {/*
            THE QUERY STRING IS THE WHOLE POINT OF THIS LINK, and it was missing. Without it
            the lobby redirects a participant of a completed contest straight back here, so
            this button navigated to the page it was already on and appeared to be broken.
            Composed by `competitionDetailsHref` so it cannot drift from the gate that reads it.
          */}
          <Link href={competitionDetailsHref(competitionId)}>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">View Competition Details</span>
              <span className="sm:hidden">Details</span>
            </Button>
          </Link>
        </div>

        <ProviderResultsScreen
          results={providerResults}
          contestId={competitionId}
          contestName={competition.name}
          description={competition.description}
          startTime={new Date(competition.startTime).toISOString()}
          endTime={new Date(competition.endTime).toISOString()}
          gameCode={competition.gameCode}
          unit={appSettings?.credits?.name || undefined}
          refundedAmount={refundedAmount}
        />
      </div>
    );
  }

  // PERF: Fetch participant + trade history in parallel (both only need competitionId)
  await connectToDatabase();
  const [participantDoc, tradeHistoryResult] = await Promise.all([
    CompetitionParticipant.findOne({
      competitionId,
      userId: session.user.id,
    }).lean(),
    getCompetitionTradeHistory(competitionId),
  ]);

  if (!participantDoc) {
    redirect(`/competitions/${competitionId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participant = participantDoc as any;

  /*
    Defence in depth behind the provider redirect above, and it earns its place independently:
    an UNLABELLED contest resolves to trading by invariant 5, and a row written before the
    capital fields were required has neither. `?? 0` degrades one figure to zero; the
    unguarded read took the whole page down. Reason it is not a dash: this block is money for
    a trading account, and every other figure beside it is already a number.
  */
  const startingCapital: number = participant.startingCapital ?? 0;
  const currentCapital: number = participant.currentCapital ?? 0;
  // Reason: a contest configured with no starting capital divided by zero here, which renders
  // as "NaN% ROI" or "Infinity% ROI" beside a real money figure. There is no meaningful return
  // on a stake of nothing, so it reports zero rather than a symbol nobody can act on.
  const roiPercent =
    startingCapital > 0
      ? ((currentCapital - startingCapital) / startingCapital) * 100
      : 0;
  const tradeHistory = tradeHistoryResult.success
    ? tradeHistoryResult.trades
    : [];

  // Calculate stats
  const winningTrades = tradeHistory.filter(
    (t: ClosedTradeRow) => t.realizedPnl > 0,
  );
  const losingTrades = tradeHistory.filter(
    (t: ClosedTradeRow) => t.realizedPnl < 0,
  );
  const totalPnl = tradeHistory.reduce(
    (sum: number, t: ClosedTradeRow) => sum + (t.realizedPnl || 0),
    0,
  );
  const winRate =
    tradeHistory.length > 0
      ? (winningTrades.length / tradeHistory.length) * 100
      : 0;
  const avgWin =
    winningTrades.length > 0
      ? winningTrades.reduce(
          (sum: number, t: ClosedTradeRow) => sum + t.realizedPnl,
          0,
        ) / winningTrades.length
      : 0;
  const avgLoss =
    losingTrades.length > 0
      ? Math.abs(
          losingTrades.reduce(
            (sum: number, t: ClosedTradeRow) => sum + t.realizedPnl,
            0,
          ),
        ) / losingTrades.length
      : 0;
  const profitFactor =
    avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const largestWin = Math.max(
    ...winningTrades.map((t: ClosedTradeRow) => t.realizedPnl),
    0,
  );
  const largestLoss = Math.min(
    ...losingTrades.map((t: ClosedTradeRow) => t.realizedPnl),
    0,
  );

  // Check if user won a prize
  const prizeWon =
    competition.finalLeaderboard?.find(
      (l: FinalLeaderboardRow) => l.userId === session.user.id,
    )?.prizeAmount || 0;
  const leaderboardIndex =
    competition.finalLeaderboard?.findIndex(
      (l: FinalLeaderboardRow) => l.userId === session.user.id,
    ) ?? -1;
  const finalRank =
    participant.currentRank ||
    (leaderboardIndex >= 0 ? leaderboardIndex + 1 : null) ||
    "—";

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 sm:gap-6 p-3 sm:p-4 md:p-8 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900/20 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-4">
        <Link href="/competitions">
          <Button
            variant="ghost"
            className="w-fit gap-2 text-gray-400 hover:text-gray-100 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Competitions</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
        <Link href={competitionDetailsHref(competitionId)}>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 min-h-[44px]"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">View Competition Details</span>
            <span className="sm:hidden">Details</span>
          </Button>
        </Link>
      </div>

      {/* Competition Info Header */}
      <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500/20 via-gray-800 to-gray-900 p-4 sm:p-6 md:p-8 border border-purple-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <GameIcon name="trophy" size={24} />
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                COMPLETED
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 truncate">
              {competition.name}
            </h1>
            <p className="text-gray-400 mt-1">{competition.description}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <GameIcon name="timer" size={16} />
              <span className="text-sm text-gray-400">
                {formatDate(competition.startTime)} -{" "}
                {formatDate(competition.endTime)}
              </span>
            </div>
            {prizeWon > 0 && (
              <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-400 font-bold flex items-center gap-2">
                  <GameIcon name="trophy" size={20} />
                  You won {formatVolts(prizeWon)}!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Final Performance Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Final Rank */}
        <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-gray-800/50 border border-yellow-500/30 p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <GameIcon name="crown" size={20} />
            <span className="text-xs sm:text-sm font-medium text-gray-400">
              Final Rank
            </span>
          </div>
          <p className="text-2xl sm:text-4xl font-black text-yellow-500">#{finalRank}</p>
          <p className="text-xs text-gray-500 mt-1">
            Out of {competition.currentParticipants} participants
          </p>
        </div>

        {/* Final P&L */}
        <div
          className={`rounded-xl bg-gradient-to-br ${
            totalPnl >= 0
              ? "from-green-500/10 border-green-500/30"
              : "from-red-500/10 border-red-500/30"
          } to-gray-800/50 border p-3 sm:p-5`}
        >
          <div className="flex items-center gap-2 mb-2">
            <GameIcon name={totalPnl >= 0 ? "profit" : "loss"} size={20} />
            <span className="text-xs sm:text-sm font-medium text-gray-400">Total P&L</span>
          </div>
          <p
            className={`text-2xl sm:text-4xl font-black ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {roiPercent.toFixed(2)}
            % ROI
          </p>
        </div>

        {/* Win Rate */}
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-gray-800/50 border border-blue-500/30 p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <GameIcon name="target" size={20} />
            <span className="text-xs sm:text-sm font-medium text-gray-400">Win Rate</span>
          </div>
          <p className="text-2xl sm:text-4xl font-black text-blue-500">
            {winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {winningTrades.length}W / {losingTrades.length}L
          </p>
        </div>

        {/* Total Trades */}
        <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-gray-800/50 border border-purple-500/30 p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <GameIcon name="sword" size={20} />
            <span className="text-xs sm:text-sm font-medium text-gray-400">
              Total Trades
            </span>
          </div>
          <p className="text-2xl sm:text-4xl font-black text-purple-500">
            {tradeHistory.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Profit Factor:{" "}
            {profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Account Summary */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <GameIcon name="coin" size={20} />
            Account Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <span className="text-gray-400">Starting Capital</span>
              <span className="text-gray-100 font-bold">
                ${startingCapital.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <span className="text-gray-400">Final Capital</span>
              <span className="text-gray-100 font-bold">
                ${currentCapital.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <span className="text-gray-400">Net P&L</span>
              <span
                className={`font-bold ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <span className="text-gray-400">ROI</span>
              <span
                className={`font-bold ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                {roiPercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Trading Stats */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <GameIcon name="target" size={20} />
            Trading Statistics
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Winning Trades</p>
              <p className="text-xl font-bold text-green-500">
                {winningTrades.length}
              </p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Losing Trades</p>
              <p className="text-xl font-bold text-red-500">
                {losingTrades.length}
              </p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Average Win</p>
              <p className="text-xl font-bold text-green-500">
                ${avgWin.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Average Loss</p>
              <p className="text-xl font-bold text-red-500">
                ${avgLoss.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Largest Win</p>
              <p className="text-xl font-bold text-green-500">
                ${largestWin.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Largest Loss</p>
              <p className="text-xl font-bold text-red-500">
                ${Math.abs(largestLoss).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-100 flex items-center gap-2">
            <GameIcon name="timer" size={20} />
            Trade History
          </h3>
          <Link href={`/competitions/${competitionId}/trade?viewOnly=true`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            >
              <Eye className="h-4 w-4" />
              View Charts
            </Button>
          </Link>
        </div>

        {tradeHistory.length === 0 ? (
          <div className="py-12 text-center">
            <div className="flex justify-center mb-3">
              <GameIcon name="sword" size={48} className="opacity-50" />
            </div>
            <p className="text-gray-400">
              No trades were made in this competition
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-3 px-2">Symbol</th>
                  <th className="text-left py-3 px-2">Side</th>
                  <th className="text-right py-3 px-2">Entry</th>
                  <th className="text-right py-3 px-2">Exit</th>
                  <th className="text-right py-3 px-2">P&L</th>
                  <th className="text-right py-3 px-2">Duration</th>
                  <th className="text-right py-3 px-2">Closed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {tradeHistory.slice(0, 50).map((trade: any) => {
                  const duration = trade.holdingTimeSeconds
                    ? trade.holdingTimeSeconds < 60
                      ? `${trade.holdingTimeSeconds}s`
                      : trade.holdingTimeSeconds < 3600
                        ? `${Math.floor(trade.holdingTimeSeconds / 60)}m`
                        : `${Math.floor(trade.holdingTimeSeconds / 3600)}h ${Math.floor((trade.holdingTimeSeconds % 3600) / 60)}m`
                    : "—";

                  return (
                    <tr
                      key={trade._id}
                      className="hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="py-3 px-2">
                        <span className="font-medium text-gray-100">
                          {trade.symbol}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            trade.side === "buy" || trade.side === "long"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {trade.side?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-300 font-mono text-sm">
                        {trade.entryPrice?.toFixed(5)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-300 font-mono text-sm">
                        {trade.exitPrice?.toFixed(5)}
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-bold ${
                          trade.realizedPnl >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {trade.realizedPnl >= 0 ? "+" : ""}$
                        {trade.realizedPnl?.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-400 text-sm">
                        {duration}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-400 text-sm">
                        {trade.closedAt
                          ? new Date(trade.closedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {tradeHistory.length > 50 && (
              <p className="text-center text-gray-500 text-sm mt-4">
                Showing first 50 of {tradeHistory.length} trades
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
        <Link href={competitionDetailsHref(competitionId)}>
          <Button variant="outline" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            View Competition Details
          </Button>
        </Link>
        <Link href={`/competitions/${competitionId}/trade?viewOnly=true`}>
          <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Eye className="h-4 w-4" />
            Review Charts & Trades
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/competitions">
          <Button variant="outline" className="gap-2">
            <GameIcon name="trophy" size={16} />
            Browse More Competitions
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default CompetitionResultsPage;
