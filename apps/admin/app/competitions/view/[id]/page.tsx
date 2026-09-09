import {
  Trophy,
  Users,
  DollarSign,
  Calendar,
  ArrowLeft,
  Edit,
  Clock,
  Target,
  User,
} from "lucide-react";
import {
  getCompetitionById,
  getCompetitionLeaderboard,
} from "@/lib/actions/trading/competition.actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import {
  isCompetitionIdShaped,
  logMalformedCompetitionId,
} from "@/lib/utils/competition-id";
import { connectToDatabase } from "@/database/mongoose";
import AppSettings from "@/database/models/app-settings.model";
import CompetitionAdminActions from "@/components/admin/CompetitionAdminActions";
import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";
import {
  resolveResultMetric,
  resolveParticipantSubline,
  showsTradingConfiguration,
  resolveEditHref,
  resolveNoWinnersNotice,
} from "@/lib/admin/contest-result-presentation";
import ContestPrizePanel from "@/components/admin/competitions/ContestPrizePanel";
import SettledResultPanel from "@/components/admin/competitions/SettledResultPanel";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { formatVolts } from "@/lib/utils/format-volts";

// Derived from the actions rather than hand-written. Reason: a hand-written row interface is
// where an invented field survives a typecheck - the compiler checks the annotation, not the
// data - and this page had seven `any`s standing in for exactly these two shapes.
type LeaderboardRow = Awaited<
  ReturnType<typeof getCompetitionLeaderboard>
>[number];
// `PrizeSlice` lived here until the prize sidebar stopped mapping the raw distribution: both
// branches now iterate rows produced by `prize-projection.ts` or
// `resolveSettledPrizeRows`, which carry their own types. Deleted rather than kept unused,
// because an unused local type is where a stale field shape survives a rename.

interface AdminCompetitionViewPageProps {
  params: Promise<{ id: string }>;
}

const AdminCompetitionViewPage = async ({
  params,
}: AdminCompetitionViewPageProps) => {
  // Disable cache to always show fresh competition data
  noStore();

  const { id } = await params;

  // A junk id is refused before any read. Reason it is stated here rather than left to the reads:
  // `getCompetitionById` answers `null` for it now, and an operator following a stale bookmark
  // should get a 404 rather than the generic error boundary the catch below produces.
  if (!isCompetitionIdShaped(id)) {
    logMalformedCompetitionId("/competitions/view/[id]", id);
    notFound();
  }

  // Get dynamic currency settings
  await connectToDatabase();
  const appSettings = await AppSettings.findById("app-settings").lean<{
    credits?: { name?: string; symbol?: string };
    currency?: { symbol?: string; code?: string };
  } | null>();
  // Every money figure on this screen - the pool, the entry fee, a Game Master's earning, a
  // player's prize - is credits. It read `currency.symbol`, which is the fiat symbol configured
  // for deposits and invoices, so an operator reconciling a contest was shown euros against
  // amounts the ledger moved in credits. `credits.name` is the unit; the fiat settings are not
  // read here at all any more.
  const unit = appSettings?.credits?.name;

  try {
    // Get competition data
    const competition = await getCompetitionById(id);
    const leaderboard = await getCompetitionLeaderboard(id, 100);

    // A well-formed id for a contest that is not there - deleted, or from another environment.
    // `getCompetitionById` returns `null` rather than throwing since 7 Sep 2026, so the 404 is
    // stated here instead of arriving as a `TypeError` on the first field read below and being
    // logged as though the screen had failed.
    if (!competition) {
      notFound();
    }

    // The LABEL alone, deliberately not the stricter `isProviderContest`. A provider contest
    // with no resolvable keys cannot launch a round, but it is still not a trading contest -
    // and the strict helper would hand its operator the emergency-cancel dialog promising to
    // close positions it does not have. A test pins the two helpers to disagree on that case.
    const isProviderGame = hasProviderGameLabel(competition);

    const isActive = competition.status === "active";
    const _isUpcoming = competition.status === "upcoming";
    const isCompleted = competition.status === "completed";
    const isCancelled = competition.status === "cancelled";

    const noWinnersNotice = resolveNoWinnersNotice({
      isCompleted,
      noWinners: competition.noWinners,
      participantCount: competition.currentParticipants ?? 0,
    });

    // Get actual prizes won from database (WalletTransaction)
    const prizeTransactions = await WalletTransaction.find({
      competitionId: id,
      transactionType: "competition_win",
      status: "completed",
    }).lean<{ userId: string; amount: number }[]>();

    // Create a map of userId -> prize amount
    const prizeMap = new Map<string, number>();
    prizeTransactions.forEach((tx) => {
      prizeMap.set(tx.userId, tx.amount);
    });

    // Get Game Master earnings for this competition
    const db = (await connectToDatabase()).connection.db;
    const gmEarnings = await db
      .collection("gamemasterearnings")
      .find({
        sourceId: id,
        sourceType: "competition",
      })
      .toArray();

    // Create a map of referredUserId -> GM info
    const gmMap = new Map<
      string,
      { gmId: string; gmEmail: string; gmEarning: number }
    >();
    gmEarnings.forEach((earning) => {
      gmMap.set(earning.referredUserId as string, {
        gmId: earning.gameMasterId as string,
        gmEmail: earning.gameMasterEmail as string,
        gmEarning: (earning.netEarning ??
          earning.grossEarning ??
          0) as number,
      });
    });

    const formatUTCDate = (date: Date) => {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
      const day = date.getUTCDate().toString().padStart(2, "0");
      const hours = date.getUTCHours().toString().padStart(2, "0");
      const minutes = date.getUTCMinutes().toString().padStart(2, "0");
      return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
    };

    const getTimeRemaining = () => {
      const now = new Date();
      const end = new Date(competition.endTime);
      const diff = end.getTime() - now.getTime();

      if (diff < 0) return "Ended";

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
        case "active":
          return "bg-green-500 text-white";
        case "upcoming":
          return "bg-blue-500 text-white";
        case "completed":
          return "bg-gray-500 text-white";
        case "cancelled":
          return "bg-red-500 text-white";
        default:
          return "bg-gray-500 text-white";
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard?activeTab=competitions">
              <Button
                variant="ghost"
                className="text-gray-400 hover:text-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin Dashboard
              </Button>
            </Link>
            <div className="flex gap-2">
              {/*
                ROUTED BY GAME. The competitions list learned this on 7 Sep 2026 (`12` s2.2)
                and this page was missed - the same "count the writers" failure, one call site
                along. The API refuses a provider contest, so nothing could be corrupted; what
                it did instead was walk the operator through the entire trading form and refuse
                on submit, which is worse than never offering the button.
              */}
              <Link href={resolveEditHref(id, isProviderGame)}>
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
                      <h1 className="text-3xl font-bold text-white">
                        {competition.name}
                      </h1>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(competition.status)}`}
                      >
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
                    {formatVolts(
                      competition.prizePool || competition.prizePoolCredits || 0,
                      { unit },
                    )}
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
                    {formatVolts(
                      competition.entryFee || competition.entryFeeCredits || 0,
                      { unit },
                    )}
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
                    {competition.currentParticipants}/
                    {competition.maxParticipants}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    isCancelled ? "bg-red-500/20" : "bg-purple-500/20"
                  }`}
                >
                  <Clock
                    className={`h-5 w-5 ${isCancelled ? "text-red-400" : "text-purple-400"}`}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500">
                    {isCancelled
                      ? "Status"
                      : isActive
                        ? "Time Remaining"
                        : isCompleted
                          ? "Status"
                          : "Starts In"}
                  </p>
                  <p
                    className={`text-2xl font-bold ${isCancelled ? "text-red-400" : "text-purple-400"}`}
                  >
                    {isCancelled
                      ? "Cancelled"
                      : isCompleted
                        ? "Completed"
                        : getTimeRemaining()}
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

                {/*
                  THE TRADING-ONLY CARDS ARE WITHHELD, NOT ZEROED. Starting Capital, Max
                  Leverage and Asset Classes are not "zero" on a game competition, they are
                  inapplicable - and `$0` / `1:1` / an empty list make a claim about the
                  contest rather than declining to. An operator reasonably reads `$0` starting
                  capital as a misconfiguration they have to go and fix.

                  Platform Fee stays: it applies to every game and is the number that decides
                  what winners are actually paid.
                */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {showsTradingConfiguration(isProviderGame) && (
                    <>
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">
                          Starting Capital
                        </p>
                        <p className="text-lg font-semibold text-gray-100">
                          $
                          {(
                            competition.startingCapital ||
                            competition.startingTradingPoints ||
                            0
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">
                          Max Leverage
                        </p>
                        <p className="text-lg font-semibold text-gray-100">
                          1:{competition.leverageAllowed || 1}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Platform Fee</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {competition.platformFeePercentage}%
                    </p>
                  </div>

                  {showsTradingConfiguration(isProviderGame) && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">
                        Asset Classes
                      </p>
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
                  )}
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
                    <span className="text-sm text-gray-400">
                      Start Time (UTC)
                    </span>
                    <span className="text-sm font-semibold text-gray-100">
                      {formatUTCDate(new Date(competition.startTime))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <span className="text-sm text-gray-400">
                      End Time (UTC)
                    </span>
                    <span className="text-sm font-semibold text-gray-100">
                      {formatUTCDate(new Date(competition.endTime))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leaderboard / Results */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  {isCompleted ? "Final Results" : "Current Leaderboard"}
                  <span className="text-sm font-normal text-gray-500">
                    ({leaderboard.length} participants)
                  </span>
                </h2>

                {/*
                  "NOBODY WAS PAID" HAD TO BE INFERRED FROM AN EMPTY TABLE, which is
                  indistinguishable from a page that failed to load. `noWinners` is written at
                  settlement and was read by no admin screen anywhere. It matters more on a
                  game competition, where nobody scoring is a real and expected outcome rather
                  than an anomaly - so the notice says where the money went, because that is
                  the operator's actual next question.
                */}
                {noWinnersNotice && (
                  <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-300">{noWinnersNotice}</p>
                  </div>
                )}

                {(() => {
                  // Count qualified participants
                  const qualifiedParticipants = leaderboard.filter(
                    (p: LeaderboardRow) => p.qualificationStatus === "qualified",
                  );
                  const qualifiedCount = qualifiedParticipants.length;
                  const disqualifiedCount = leaderboard.length - qualifiedCount;
                  const prizeDistribution = competition.prizeDistribution || [];

                  return (
                    <>
                      {leaderboard.length > 0 ? (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                          {leaderboard.map((participant: LeaderboardRow) => {
                            // Use qualificationStatus from ranking service
                            const isDisqualified =
                              participant.qualificationStatus ===
                              "disqualified";
                            const qualifiedRank = participant.currentRank || 0;
                            const isWinner =
                              isCompleted &&
                              !isDisqualified &&
                              qualifiedRank <= prizeDistribution.length;

                            // Get ACTUAL prize from database (not calculated)
                            const actualPrize =
                              prizeMap.get(participant.userId) || 0;

                            // Get GM info for this participant
                            const gmInfo = gmMap.get(participant.userId);

                            // Display rank
                            const displayRank = qualifiedRank;

                            // The metric and sub-line this GAME reports. Resolved here rather
                            // than inline so a provider row and a trading row can be compared
                            // in a test - a structural assertion over JSX can prove the file
                            // mentions `score` and cannot prove which branch renders it.
                            const metric = resolveResultMetric(
                              participant,
                              isProviderGame,
                            );
                            const subline = resolveParticipantSubline(
                              participant,
                              isProviderGame,
                            );

                            return (
                              <div
                                key={participant._id}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  isDisqualified
                                    ? "bg-red-500/10 border border-red-500/30 opacity-75"
                                    : isWinner
                                      ? "bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/30"
                                      : "bg-gray-800/50 border border-gray-700"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                      isDisqualified
                                        ? "bg-red-500/50 text-red-200"
                                        : displayRank === 1
                                          ? "bg-yellow-500 text-gray-900"
                                          : displayRank === 2
                                            ? "bg-gray-400 text-gray-900"
                                            : displayRank === 3
                                              ? "bg-orange-600 text-white"
                                              : "bg-gray-700 text-gray-300"
                                    }`}
                                  >
                                    {isDisqualified ? "âœ—" : displayRank}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p
                                        className={`text-sm font-semibold ${isDisqualified ? "text-red-300 line-through" : "text-gray-100"}`}
                                      >
                                        {participant.username ||
                                          participant.userId}
                                      </p>
                                      {isDisqualified && (
                                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
                                          DISQUALIFIED
                                        </span>
                                      )}
                                      {isWinner && (
                                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded">
                                          ðŸ† WINNER
                                        </span>
                                      )}
                                      {gmInfo && (
                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          GM Referral
                                        </span>
                                      )}
                                    </div>
                                    {/*
                                      The trade count is trading's, and on a provider contest
                                      it is always 0 - so it was printing "0 trades" against
                                      every player of a game that has no trades. The
                                      disqualification reason still has to render for both,
                                      which is why the sub-line can be absent while the row
                                      below it is not.
                                    */}
                                    {(subline ||
                                      participant.disqualificationReason) && (
                                      <p className="text-xs text-gray-500">
                                        {subline}
                                        {participant.disqualificationReason && (
                                          <span
                                            className={`text-red-400 ${subline ? "ml-2" : ""}`}
                                          >
                                            {subline ? "â€¢ " : ""}
                                            {
                                              participant.disqualificationReason
                                            }
                                          </span>
                                        )}
                                      </p>
                                    )}
                                    {gmInfo && (
                                      <p className="text-xs text-purple-400 mt-1">
                                        GM: {gmInfo.gmEmail} â€¢ Earned:{" "}
                                        {formatVolts(gmInfo.gmEarning, { unit })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  {/*
                                    THIS COLUMN IS THE OWNER'S "the distribution is a mess".
                                    It read `pnl` and `pnlPercentage` unconditionally, and both
                                    default to 0 on EVERY seat regardless of game - so a
                                    provider contest showed "+0.00 / +0.00%" for every player
                                    while `score`, the number it actually ranked on, sat on the
                                    row unrendered. Rows in an unexplainable order, identical
                                    metrics, winner badges against them: it reads as a broken
                                    payout, and the payout was fine.
                                  */}
                                  <p
                                    className={`text-sm font-bold ${
                                      isDisqualified
                                        ? "text-red-400"
                                        : metric.tone === "positive"
                                          ? "text-green-400"
                                          : metric.tone === "negative"
                                            ? "text-red-400"
                                            : "text-gray-100"
                                    }`}
                                  >
                                    {metric.value}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {metric.sub ?? metric.label}
                                  </p>
                                  {actualPrize > 0 && (
                                    <p className="text-xs text-yellow-400 font-semibold mt-1">
                                      Won: {formatVolts(actualPrize, { unit })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No participants yet
                        </div>
                      )}

                      {/* Summary for completed competitions */}
                      {isCompleted && leaderboard.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <div className="grid grid-cols-3 gap-4 text-center text-sm">
                            <div>
                              <p className="text-gray-500">
                                Total Participants
                              </p>
                              <p className="text-xl font-bold text-white">
                                {leaderboard.length}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Qualified</p>
                              <p className="text-xl font-bold text-green-400">
                                {qualifiedCount}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Disqualified</p>
                              <p className="text-xl font-bold text-red-400">
                                {disqualifiedCount}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/*
                THE SETTLED SNAPSHOT, WHICH WAS RENDERED BY NO ADMIN SCREEN AT ALL, and
                the panel explains why it is a second table rather than columns on the
                board above. It renders nothing when there is no settled record.
              */}
              <SettledResultPanel
                finalLeaderboard={competition.finalLeaderboard}
                isProviderGame={isProviderGame}
                unit={unit}
              />
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
                  isPaused={competition.isPaused}
                  pauseReason={competition.pauseReason}
                  isProviderGame={isProviderGame}
                />
              </div>

              {/*
                THE PRIZE PANEL REPORTS ONE OF TWO DIFFERENT THINGS - a projection while
                the outcome is unknown, the recorded amounts once settlement has run -
                and the component owns that choice. It shared no arithmetic with the
                player-facing table before, which is why the two screens quoted different
                amounts for the same rank.
              */}
              <ContestPrizePanel
                distribution={competition.prizeDistribution || []}
                finalLeaderboard={competition.finalLeaderboard}
                competition={competition}
                unit={unit}
                platformFeePercentage={competition.platformFeePercentage || 0}
              />

              {/* Rules */}
              {competition.rules && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">
                    Rules
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-800/50 rounded">
                      <span className="text-gray-400">Ranking Method:</span>
                      <span className="text-gray-100 font-semibold">
                        {competition.rules.rankingMethod === "pnl" &&
                          "Highest P&L"}
                        {competition.rules.rankingMethod === "roi" &&
                          "Highest ROI %"}
                        {competition.rules.rankingMethod === "total_capital" &&
                          "Highest Capital"}
                        {competition.rules.rankingMethod === "win_rate" &&
                          "Highest Win Rate"}
                        {competition.rules.rankingMethod === "total_wins" &&
                          "Most Wins"}
                        {competition.rules.rankingMethod === "profit_factor" &&
                          "Best Profit Factor"}
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
    /*
      Next.js implements notFound() and redirect() by throwing, and marks both with a `digest`
      beginning `NEXT_`. Without this re-throw the 404 above is caught here, logged as though the
      screen had failed, and then re-issued by the line below - the right answer, reported as a
      fault, with a stack trace nobody can act on.
    */
    if (error && typeof error === "object" && "digest" in error) {
      const digest = (error as { digest?: string }).digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;
    }
    console.error("Error loading competition:", error);
    notFound();
  }
};

export default AdminCompetitionViewPage;
