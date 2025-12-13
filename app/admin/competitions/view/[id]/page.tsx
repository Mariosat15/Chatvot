import { Trophy, Users, DollarSign, Calendar, ArrowLeft, Edit, Clock, Target, Award } from 'lucide-react';
import { getCompetitionById, getCompetitionLeaderboard } from '@/lib/actions/trading/competition.actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import AppSettings from '@/database/models/app-settings.model';
import CompetitionAdminActions from '@/components/admin/CompetitionAdminActions';

interface AdminCompetitionViewPageProps {
  params: Promise<{ id: string }>;
}

const AdminCompetitionViewPage = async ({ params }: AdminCompetitionViewPageProps) => {
  // Disable cache to always show fresh competition data
  noStore();
  
  const { id } = await params;

  // Get dynamic currency settings
  await connectToDatabase();
  const appSettings = await AppSettings.findById('app-settings').lean() as any;
  const creditName = appSettings?.credits?.name || 'Credits';
  const _creditSymbol = appSettings?.credits?.symbol || '⚡';
  const currencySymbol = appSettings?.currency?.symbol || '€';
  const _currencyCode = appSettings?.currency?.code || 'EUR';

  try {
    // Get competition data
    const competition = await getCompetitionById(id);
    const leaderboard = await getCompetitionLeaderboard(id, 100);

    const isActive = competition.status === 'active';
    const _isUpcoming = competition.status === 'upcoming';
    const isCompleted = competition.status === 'completed';
    const isCancelled = competition.status === 'cancelled';

    const formatUTCDate = (date: Date) => {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
    };

    const getTimeRemaining = () => {
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

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active':
          return 'bg-green-500 text-white';
        case 'upcoming':
          return 'bg-blue-500 text-white';
        case 'completed':
          return 'bg-gray-500 text-white';
        case 'cancelled':
          return 'bg-red-500 text-white';
        default:
          return 'bg-gray-500 text-white';
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin/dashboard?activeTab=competitions">
              <Button variant="ghost" className="text-gray-400 hover:text-gray-100">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin Dashboard
              </Button>
            </Link>
            <div className="flex gap-2">
              <Link href={`/admin/competitions/edit/${id}`}>
                <Button className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Competition
                </Button>
              </Link>
            </div>
          </div>

          {/* Competition Header */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                    <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                      <Trophy className="h-8 w-8 text-orange-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-white">{competition.name}</h1>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(competition.status)}`}>
                        {competition.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-orange-100">{competition.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Prize Pool</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {currencySymbol}{(competition.prizePool || competition.prizePoolCredits || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Entry Fee</p>
                  <p className="text-2xl font-bold text-green-400">
                    {currencySymbol}{(competition.entryFee || competition.entryFeeCredits || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Participants</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {competition.currentParticipants}/{competition.maxParticipants}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  isCancelled ? 'bg-red-500/20' : 'bg-purple-500/20'
                }`}>
                  <Clock className={`h-5 w-5 ${isCancelled ? 'text-red-400' : 'text-purple-400'}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">
                    {isCancelled ? 'Status' : isActive ? 'Time Remaining' : isCompleted ? 'Status' : 'Starts In'}
                  </p>
                  <p className={`text-2xl font-bold ${isCancelled ? 'text-red-400' : 'text-purple-400'}`}>
                    {isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : getTimeRemaining()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Competition Details */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-400" />
                  Competition Configuration
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Starting Capital</p>
                    <p className="text-lg font-semibold text-gray-100">
                      ${(competition.startingCapital || competition.startingTradingPoints || 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Max Leverage</p>
                    <p className="text-lg font-semibold text-gray-100">
                      1:{competition.leverageAllowed || 1}
                    </p>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Platform Fee</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {competition.platformFeePercentage}%
                    </p>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Asset Classes</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {competition.assetClasses?.map((asset: string) => (
                        <span
                          key={asset}
                          className="px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-300 uppercase"
                        >
                          {asset}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-400" />
                  Schedule
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <span className="text-sm text-gray-400">Start Time (UTC)</span>
                    <span className="text-sm font-semibold text-gray-100">
                      {formatUTCDate(new Date(competition.startTime))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <span className="text-sm text-gray-400">End Time (UTC)</span>
                    <span className="text-sm font-semibold text-gray-100">
                      {formatUTCDate(new Date(competition.endTime))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  Current Leaderboard
                  <span className="text-sm font-normal text-gray-500">
                    ({leaderboard.length} participants)
                  </span>
                </h2>

                {leaderboard.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {leaderboard.slice(0, 20).map((participant: any, index: number) => (
                      <div
                        key={participant._id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index < 3
                            ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/30'
                            : 'bg-gray-800/50 border border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-500 text-gray-900' :
                            index === 1 ? 'bg-gray-400 text-gray-900' :
                            index === 2 ? 'bg-orange-600 text-white' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-100">
                              {participant.username || participant.userId}
                            </p>
                            <p className="text-xs text-gray-500">
                              {participant.totalTrades} trades
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            participant.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {participant.pnl >= 0 ? '+' : ''}{participant.pnl?.toFixed(2) || '0.00'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {participant.pnlPercentage >= 0 ? '+' : ''}{participant.pnlPercentage?.toFixed(2) || '0.00'}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No participants yet
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Admin Actions - Countdown and Cancel */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  Competition Status
                </h3>
                <CompetitionAdminActions
                  competitionId={id}
                  competitionName={competition.name}
                  status={competition.status}
                  startTime={competition.startTime}
                  endTime={competition.endTime}
                  participantCount={competition.currentParticipants || 0}
                />
              </div>

              {/* Prize Distribution */}
              <div className="bg-gradient-to-br from-yellow-500/10 to-gray-900 border border-yellow-500/30 rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-400" />
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

                <div className="space-y-2">
                  {competition.prizeDistribution?.map((prize: any, index: number) => {
                    const prizePool = competition.prizePool || competition.prizePoolCredits || 0;
                    const grossAmount = (prizePool * prize.percentage) / 100;
                    const platformFeePercentage = (competition.platformFeePercentage || 0) / 100;
                    const netAmount = grossAmount * (1 - platformFeePercentage);
                    const feeAmount = grossAmount - netAmount;
                    
                    return (
                      <div
                        key={index}
                        className="p-4 rounded-xl bg-gray-800/50 border border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Trophy className="h-5 w-5 text-yellow-500" />}
                            {index === 1 && <Trophy className="h-5 w-5 text-gray-400" />}
                            {index === 2 && <Trophy className="h-5 w-5 text-orange-600" />}
                            {index > 2 && <Trophy className="h-5 w-5 text-gray-600" />}
                            <span className="text-sm font-bold text-gray-300">Rank #{prize.rank}</span>
                            <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-semibold">
                              {prize.percentage}%
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-yellow-500">
                              {netAmount.toFixed(2)} <span className="text-xs text-yellow-400">{creditName}</span>
                            </p>
                          </div>
                        </div>
                        
                        {competition.platformFeePercentage > 0 && (
                          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700/50">
                            <span>From pool: {grossAmount.toFixed(2)}</span>
                            <span className="text-red-400">Fee: -{feeAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {competition.platformFeePercentage > 0 && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-300 flex items-start gap-2">
                      <span className="text-blue-400 font-bold">ℹ️</span>
                      <span>
                        Winners receive net amounts after {competition.platformFeePercentage}% platform fee. 
                        Total pool: {(competition.prizePool || competition.prizePoolCredits || 0).toFixed(2)} {creditName}.
                      </span>
                    </p>
                  </div>
                )}

                {competition.platformFeePercentage > 0 && (
                  <p className="text-xs text-gray-500 mt-4 hidden">
                    * Platform fee: {competition.platformFeePercentage}% deducted
                  </p>
                )}
              </div>

              {/* Rules */}
              {competition.rules && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Rules</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-800/50 rounded">
                      <span className="text-gray-400">Ranking Method:</span>
                      <span className="text-gray-100 font-semibold">
                        {competition.rules.rankingMethod === 'pnl' && 'Highest P&L'}
                        {competition.rules.rankingMethod === 'roi' && 'Highest ROI %'}
                        {competition.rules.rankingMethod === 'total_capital' && 'Highest Capital'}
                        {competition.rules.rankingMethod === 'win_rate' && 'Highest Win Rate'}
                        {competition.rules.rankingMethod === 'total_wins' && 'Most Wins'}
                        {competition.rules.rankingMethod === 'profit_factor' && 'Best Profit Factor'}
                      </span>
                    </div>
                    {competition.rules.minimumTrades > 0 && (
                      <div className="flex justify-between p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-400">Min Trades:</span>
                        <span className="text-gray-100 font-semibold">
                          {competition.rules.minimumTrades}
                        </span>
                      </div>
                    )}
                    {competition.rules.minimumWinRate && (
                      <div className="flex justify-between p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-400">Min Win Rate:</span>
                        <span className="text-gray-100 font-semibold">
                          {competition.rules.minimumWinRate}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

export default AdminCompetitionViewPage;

