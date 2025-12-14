import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getCompetitionById } from '@/lib/actions/trading/competition.actions';
import { getCompetitionTradeHistory } from '@/lib/actions/trading/trade-history.actions';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import { connectToDatabase } from '@/database/mongoose';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Target, 
  Clock,
  DollarSign,
  Activity,
  Award,
  Calendar,
  ChevronRight,
  Eye
} from 'lucide-react';

const CompetitionResultsPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  noStore();
  
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const { id: competitionId } = await params;

  // Get competition details
  const competition = await getCompetitionById(competitionId);
  if (!competition) {
    redirect('/competitions');
  }

  // Check if user was a participant
  await connectToDatabase();
  const participantDoc = await CompetitionParticipant.findOne({
    competitionId,
    userId: session.user.id,
  }).lean();

  if (!participantDoc) {
    redirect(`/competitions/${competitionId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participant = participantDoc as any;

  // Get trade history
  const tradeHistoryResult = await getCompetitionTradeHistory(competitionId);
  const tradeHistory = tradeHistoryResult.success ? tradeHistoryResult.trades : [];

  // Calculate stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const winningTrades = tradeHistory.filter((t: any) => t.realizedPnl > 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const losingTrades = tradeHistory.filter((t: any) => t.realizedPnl < 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPnl = tradeHistory.reduce((sum: number, t: any) => sum + (t.realizedPnl || 0), 0);
  const winRate = tradeHistory.length > 0 ? (winningTrades.length / tradeHistory.length) * 100 : 0;
  const avgWin = winningTrades.length > 0 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? winningTrades.reduce((sum: number, t: any) => sum + t.realizedPnl, 0) / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? Math.abs(losingTrades.reduce((sum: number, t: any) => sum + t.realizedPnl, 0)) / losingTrades.length 
    : 0;
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const largestWin = Math.max(...winningTrades.map((t: any) => t.realizedPnl), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const largestLoss = Math.min(...losingTrades.map((t: any) => t.realizedPnl), 0);

  // Check if user won a prize
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prizeWon = competition.finalLeaderboard?.find((l: any) => l.userId === session.user.id)?.prizeAmount || 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leaderboardIndex = competition.finalLeaderboard?.findIndex((l: any) => l.userId === session.user.id) ?? -1;
  const finalRank = participant.currentRank || (leaderboardIndex >= 0 ? leaderboardIndex + 1 : null) || '—';

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex min-h-screen flex-col gap-6 p-4 md:p-8 bg-gradient-to-br from-gray-900 via-gray-900 to-purple-900/20">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link href={`/competitions/${competitionId}`}>
          <Button variant="ghost" className="w-fit gap-2 text-gray-400 hover:text-gray-100">
            <ArrowLeft className="h-4 w-4" />
            Back to Competition
          </Button>
        </Link>
      </div>

      {/* Competition Info Header */}
      <div className="rounded-2xl bg-gradient-to-br from-purple-500/20 via-gray-800 to-gray-900 p-6 md:p-8 border border-purple-500/30 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-6 w-6 text-purple-400" />
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                COMPLETED
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-100">{competition.name}</h1>
            <p className="text-gray-400 mt-1">{competition.description}</p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-400">
                {formatDate(competition.startTime)} - {formatDate(competition.endTime)}
              </span>
            </div>
            {prizeWon > 0 && (
              <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-400 font-bold flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  You won {prizeWon.toFixed(2)} credits!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Final Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Final Rank */}
        <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-gray-800/50 border border-yellow-500/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="text-sm font-medium text-gray-400">Final Rank</span>
          </div>
          <p className="text-4xl font-black text-yellow-500">#{finalRank}</p>
          <p className="text-xs text-gray-500 mt-1">Out of {competition.currentParticipants} participants</p>
        </div>

        {/* Final P&L */}
        <div className={`rounded-xl bg-gradient-to-br ${
          totalPnl >= 0 ? 'from-green-500/10 border-green-500/30' : 'from-red-500/10 border-red-500/30'
        } to-gray-800/50 border p-5`}>
          <div className="flex items-center gap-2 mb-2">
            {totalPnl >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <span className="text-sm font-medium text-gray-400">Total P&L</span>
          </div>
          <p className={`text-4xl font-black ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {((participant.currentCapital - participant.startingCapital) / participant.startingCapital * 100).toFixed(2)}% ROI
          </p>
        </div>

        {/* Win Rate */}
        <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-gray-800/50 border border-blue-500/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-400">Win Rate</span>
          </div>
          <p className="text-4xl font-black text-blue-500">{winRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">{winningTrades.length}W / {losingTrades.length}L</p>
        </div>

        {/* Total Trades */}
        <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-gray-800/50 border border-purple-500/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-medium text-gray-400">Total Trades</span>
          </div>
          <p className="text-4xl font-black text-purple-500">{tradeHistory.length}</p>
          <p className="text-xs text-gray-500 mt-1">Profit Factor: {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}</p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Summary */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Account Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <span className="text-gray-400">Starting Capital</span>
              <span className="text-gray-100 font-bold">${participant.startingCapital.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <span className="text-gray-400">Final Capital</span>
              <span className="text-gray-100 font-bold">${participant.currentCapital.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <span className="text-gray-400">Net P&L</span>
              <span className={`font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <span className="text-gray-400">ROI</span>
              <span className={`font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {((participant.currentCapital - participant.startingCapital) / participant.startingCapital * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Trading Stats */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Trading Statistics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Winning Trades</p>
              <p className="text-xl font-bold text-green-500">{winningTrades.length}</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Losing Trades</p>
              <p className="text-xl font-bold text-red-500">{losingTrades.length}</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Average Win</p>
              <p className="text-xl font-bold text-green-500">${avgWin.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Average Loss</p>
              <p className="text-xl font-bold text-red-500">${avgLoss.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Largest Win</p>
              <p className="text-xl font-bold text-green-500">${largestWin.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg">
              <p className="text-xs text-gray-500">Largest Loss</p>
              <p className="text-xl font-bold text-red-500">${Math.abs(largestLoss).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />
            Trade History
          </h3>
          <Link href={`/competitions/${competitionId}/trade?viewOnly=true`}>
            <Button variant="outline" size="sm" className="gap-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
              <Eye className="h-4 w-4" />
              View Charts
            </Button>
          </Link>
        </div>

        {tradeHistory.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No trades were made in this competition</p>
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
                    : '—';
                  
                  return (
                    <tr key={trade._id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="py-3 px-2">
                        <span className="font-medium text-gray-100">{trade.symbol}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          trade.side === 'buy' || trade.side === 'long'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-300 font-mono text-sm">
                        {trade.entryPrice?.toFixed(5)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-300 font-mono text-sm">
                        {trade.exitPrice?.toFixed(5)}
                      </td>
                      <td className={`py-3 px-2 text-right font-bold ${
                        trade.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {trade.realizedPnl >= 0 ? '+' : ''}${trade.realizedPnl?.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-400 text-sm">
                        {duration}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-400 text-sm">
                        {trade.closedAt ? new Date(trade.closedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : '—'}
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
      <div className="flex flex-wrap gap-4 justify-center">
        <Link href={`/competitions/${competitionId}`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Competition
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
            <Trophy className="h-4 w-4" />
            Browse More Competitions
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default CompetitionResultsPage;

