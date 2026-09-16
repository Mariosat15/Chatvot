import {
  Swords,
  Users,
  DollarSign,
  Calendar,
  ArrowLeft,
  Clock,
  Target,
  Award,
  User,
  Trophy,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { connectToDatabase } from "@/database/mongoose";
import AppSettings from "@/database/models/app-settings.model";
import Challenge from "@/database/models/trading/challenge.model";
import { formatVolts } from "@/lib/utils/format-volts";
import { getTerms } from "@/lib/services/terminology.service";
import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";
import { showsTradingConfiguration } from "@/lib/admin/contest-result-presentation";
import ChallengeStatRows from "@/components/admin/competitions/ChallengeStatRows";

interface AdminChallengeViewPageProps {
  params: Promise<{ id: string }>;
}

const AdminChallengeViewPage = async ({
  params,
}: AdminChallengeViewPageProps) => {
  // Disable cache to always show fresh challenge data
  noStore();

  const { id } = await params;

  // Get dynamic currency settings
  await connectToDatabase();
  const appSettings = (await AppSettings.findById(
    "app-settings",
  ).lean()) as any;
  // Reason: every amount on this screen - the pot, both entry fees, the winner's prize, the
  // platform fee and each Game Master's earning - is credits. It read `currency.symbol`, so an
  // operator reconciling a challenge saw euros against figures the ledger moves in credits.
  const creditSymbol = appSettings?.credits?.symbol;

  try {
    // Get challenge data
    const challenge = (await Challenge.findById(id).lean()) as any;

    if (!challenge) {
      notFound();
    }

    const isActive = challenge.status === "active";
    const isPending = challenge.status === "pending";
    const isAccepted = challenge.status === "accepted";
    const isCompleted = challenge.status === "completed";
    const isCancelled = challenge.status === "cancelled";

    // Get Game Master earnings for this challenge
    const db = (await connectToDatabase()).connection.db;
    const gmMap = new Map<
      string,
      { gmId: string; gmEmail: string; gmEarning: number }
    >();

    if (db) {
      const gmEarnings = await db
        .collection("gamemasterearnings")
        .find({
          sourceId: id,
          sourceType: "challenge",
        })
        .toArray();

      // Create a map of referredUserId -> GM info
      gmEarnings.forEach((earning: any) => {
        gmMap.set(earning.referredUserId, {
          gmId: earning.gameMasterId,
          gmEmail: earning.gameMasterEmail,
          gmEarning: earning.netEarning || earning.grossEarning || 0,
        });
      });
    }

    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const formatDuration = (minutes: number) => {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    };

    const getTimeRemaining = () => {
      if (!challenge.endTime) return "Not started";
      const now = new Date();
      const end = new Date(challenge.endTime);
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
        case "pending":
          return "bg-yellow-500 text-white";
        case "accepted":
          return "bg-blue-500 text-white";
        case "completed":
          return "bg-gray-500 text-white";
        case "cancelled":
        case "declined":
        case "expired":
          return "bg-red-500 text-white";
        default:
          return "bg-gray-500 text-white";
      }
    };

    // Get final stats
    const challengerStats = challenge.challengerFinalStats;
    const challengedStats = challenge.challengedFinalStats;

    // R92. `hasProviderGameLabel` asks about the LABEL alone, deliberately not the stricter
    // `isProviderContest`: a provider challenge missing its keys cannot launch a round, but
    // it is still not a trading challenge, and reporting it as one is the defect being fixed.
    const isProviderGame = hasProviderGameLabel(challenge);
    const terms = await getTerms();

    // The winning side's settled score, for the winner banner on a provider game. Derived
    // from `winnerId` against the two player ids, never from a separate stored field -
    // there is no `winnerScore` on the model, and adding one would be a second copy of a
    // figure the snapshot already carries.
    const winnerScore = challenge.winnerId
      ? challenge.winnerId === challenge.challengerId
        ? challengerStats?.score
        : challenge.winnerId === challenge.challengedId
          ? challengedStats?.score
          : undefined
      : undefined;
    const challengerGm = gmMap.get(challenge.challengerId);
    const challengedGm = gmMap.get(challenge.challengedId);

    return (
      <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-900 to-gray-800 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard?activeTab=challenges">
              <Button
                variant="ghost"
                className="text-gray-400 hover:text-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin Dashboard
              </Button>
            </Link>
          </div>

          {/* Challenge Header */}
          <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
            <div className="bg-linear-to-r from-orange-500 to-orange-600 p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                    <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                      <Swords className="h-8 w-8 text-orange-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {/* "1v1" stays: it is the format's arity, which an operator does not
                          get to rename - a challenge is exactly two players by hard
                          constraint, so a deployment calling it something else would be
                          describing a format the platform does not offer. The NOUN is
                          theirs. Same split as "GM Referral" below, where the role is fixed
                          and only the contest word moves. */}
                      <h1 className="text-3xl font-bold text-white">
                        1v1 {terms.challenge}
                      </h1>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(challenge.status)}`}
                      >
                        {challenge.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-orange-100">
                      {challenge.challengerName} vs {challenge.challengedName}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{terms.prizePool}</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {formatVolts(challenge.prizePool, { symbol: creditSymbol })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{terms.entryFee}</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatVolts(challenge.entryFee, { symbol: creditSymbol })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Award className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Winner {terms.prize}</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {formatVolts(challenge.winnerPrize, { symbol: creditSymbol })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
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
                          : "Duration"}
                  </p>
                  <p
                    className={`text-2xl font-bold ${isCancelled ? "text-red-400" : "text-purple-400"}`}
                  >
                    {isCancelled
                      ? "Cancelled"
                      : isCompleted
                        ? "Completed"
                        : isActive
                          ? getTimeRemaining()
                          : formatDuration(challenge.duration)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Configuration */}
              <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-400" />
                  {terms.challenge} Configuration
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/*
                    R92, missed by A4 on this very screen. A4 made the ranking method and the
                    player figures game-aware here and left this tile rendering "$" with
                    nothing after it, because `startingCapital` is required for trading only.
                    The symbol stays a dollar deliberately: this is simulated TRADING money in
                    the contest's quote currency, not credits, so `formatVolts` beside it
                    would relabel a trader's capital as the platform's own unit.
                  */}
                  {showsTradingConfiguration(isProviderGame) && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">
                        Starting Capital
                      </p>
                      <p className="text-lg font-semibold text-gray-100">
                        ${challenge.startingCapital?.toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Duration</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {formatDuration(challenge.duration)}
                    </p>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Platform Fee</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {challenge.platformFeePercentage}% ({formatVolts(challenge.platformFeeAmount, { symbol: creditSymbol })})
                    </p>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Ranking Method</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {/* R92. The provider module ignores `rankingMethod` entirely - the six
                          trading methods are six questions you can ask of a trading account
                          and a provider game reports one number - so printing "Highest P&L"
                          here states the rule a contest was decided by and names the wrong
                          one. The direction is deliberately NOT claimed: it lives on the
                          catalogue title, this screen has not read it, and a title that
                          ranks a time trial lowest-first would make "Highest" a lie. */}
                      {isProviderGame ? (
                        `By ${terms.score}`
                      ) : (
                        <>
                          {challenge.rules?.rankingMethod === "pnl" &&
                            "Highest P&L"}
                          {challenge.rules?.rankingMethod === "roi" &&
                            "Highest ROI %"}
                          {challenge.rules?.rankingMethod === "total_capital" &&
                            "Highest Capital"}
                          {!challenge.rules?.rankingMethod && "Highest P&L"}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-400" />
                  Timeline
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <span className="text-sm text-gray-400">Created</span>
                    <span className="text-sm font-semibold text-gray-100">
                      {formatDate(challenge.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <span className="text-sm text-gray-400">
                      Accept Deadline
                    </span>
                    <span className="text-sm font-semibold text-gray-100">
                      {formatDate(challenge.acceptDeadline)}
                    </span>
                  </div>
                  {challenge.startTime && (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                      <span className="text-sm text-gray-400">Started</span>
                      <span className="text-sm font-semibold text-gray-100">
                        {formatDate(challenge.startTime)}
                      </span>
                    </div>
                  )}
                  {challenge.endTime && (
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                      <span className="text-sm text-gray-400">Ended</span>
                      <span className="text-sm font-semibold text-gray-100">
                        {formatDate(challenge.endTime)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Final Results */}
              <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  {isCompleted ? "Final Results" : terms.players}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Challenger */}
                  {(() => {
                    const isDisqualified =
                      challengerStats?.isDisqualified || false;
                    const isWinner =
                      challenge.winnerId === challenge.challengerId;

                    return (
                      <div
                        className={`rounded-xl p-5 ${
                          isDisqualified
                            ? "bg-red-500/10 border-2 border-red-500/30"
                            : isCompleted && isWinner
                              ? "bg-yellow-500/10 border-2 border-yellow-500/30"
                              : "bg-gray-700/50 border border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <span className="text-xs text-gray-500 uppercase font-semibold">
                            Challenger
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {isDisqualified ? (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
                                DISQUALIFIED
                              </span>
                            ) : isCompleted && isWinner ? (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded">
                                🏆 WINNER
                              </span>
                            ) : null}
                            {challengerGm && (
                              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded flex items-center gap-1">
                                <User className="h-3 w-3" />
                                GM Referral
                              </span>
                            )}
                          </div>
                        </div>
                        <p
                          className={`font-bold text-xl ${isDisqualified ? "text-red-300 line-through" : "text-white"}`}
                        >
                          {challenge.challengerName}
                        </p>
                        <p className="text-xs text-gray-400 mb-4">
                          {challenge.challengerEmail}
                        </p>

                        {isCompleted && challengerStats && (
                          <div className="space-y-2 pt-4 border-t border-gray-600">
                            <ChallengeStatRows
                              stats={challengerStats}
                              isProviderGame={isProviderGame}
                              terms={terms}
                            />
                            {isWinner && (
                              <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
                                <span className="text-gray-400">
                                  {terms.prize} Won:
                                </span>
                                <span className="text-yellow-400 font-bold">
                                  {formatVolts(challenge.winnerPrize, { symbol: creditSymbol })}
                                </span>
                              </div>
                            )}
                            {isDisqualified &&
                              challengerStats.disqualificationReason && (
                                <p className="text-xs text-red-400 mt-2">
                                  Reason:{" "}
                                  {challengerStats.disqualificationReason}
                                </p>
                              )}
                          </div>
                        )}

                        {/* GM Info */}
                        {challengerGm && (
                          <div className="mt-4 pt-4 border-t border-purple-500/30 bg-purple-500/10 -mx-5 -mb-5 p-4 rounded-b-xl">
                            <p className="text-xs text-purple-400 font-semibold mb-1">
                              Game Master Referral
                            </p>
                            <p className="text-xs text-purple-300">
                              {challengerGm.gmEmail}
                            </p>
                            <p className="text-xs text-purple-400 mt-1">
                              GM Earned:{" "}
                              <span className="font-bold">
                                {formatVolts(challengerGm.gmEarning, { symbol: creditSymbol })}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Challenged */}
                  {(() => {
                    const isDisqualified =
                      challengedStats?.isDisqualified || false;
                    const isWinner =
                      challenge.winnerId === challenge.challengedId;

                    return (
                      <div
                        className={`rounded-xl p-5 ${
                          isDisqualified
                            ? "bg-red-500/10 border-2 border-red-500/30"
                            : isCompleted && isWinner
                              ? "bg-yellow-500/10 border-2 border-yellow-500/30"
                              : "bg-gray-700/50 border border-gray-600"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <span className="text-xs text-gray-500 uppercase font-semibold">
                            Challenged
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {isDisqualified ? (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
                                DISQUALIFIED
                              </span>
                            ) : isCompleted && isWinner ? (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded">
                                🏆 WINNER
                              </span>
                            ) : null}
                            {challengedGm && (
                              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-semibold rounded flex items-center gap-1">
                                <User className="h-3 w-3" />
                                GM Referral
                              </span>
                            )}
                          </div>
                        </div>
                        <p
                          className={`font-bold text-xl ${isDisqualified ? "text-red-300 line-through" : "text-white"}`}
                        >
                          {challenge.challengedName}
                        </p>
                        <p className="text-xs text-gray-400 mb-4">
                          {challenge.challengedEmail}
                        </p>

                        {isCompleted && challengedStats && (
                          <div className="space-y-2 pt-4 border-t border-gray-600">
                            <ChallengeStatRows
                              stats={challengedStats}
                              isProviderGame={isProviderGame}
                              terms={terms}
                            />
                            {isWinner && (
                              <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
                                <span className="text-gray-400">
                                  {terms.prize} Won:
                                </span>
                                <span className="text-yellow-400 font-bold">
                                  {formatVolts(challenge.winnerPrize, { symbol: creditSymbol })}
                                </span>
                              </div>
                            )}
                            {isDisqualified &&
                              challengedStats.disqualificationReason && (
                                <p className="text-xs text-red-400 mt-2">
                                  Reason:{" "}
                                  {challengedStats.disqualificationReason}
                                </p>
                              )}
                          </div>
                        )}

                        {/* GM Info */}
                        {challengedGm && (
                          <div className="mt-4 pt-4 border-t border-purple-500/30 bg-purple-500/10 -mx-5 -mb-5 p-4 rounded-b-xl">
                            <p className="text-xs text-purple-400 font-semibold mb-1">
                              Game Master Referral
                            </p>
                            <p className="text-xs text-purple-300">
                              {challengedGm.gmEmail}
                            </p>
                            <p className="text-xs text-purple-400 mt-1">
                              GM Earned:{" "}
                              <span className="font-bold">
                                {formatVolts(challengedGm.gmEarning, { symbol: creditSymbol })}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Tie notification */}
                {isCompleted && challenge.isTie && (
                  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                    <p className="text-blue-400 font-semibold">
                      🤝 This {terms.challenge} ended in a TIE
                    </p>
                    {/* Rewritten from "Entry fees were refunded to both participants" rather
                        than tokenised in place. The old wording needed a PLURAL of
                        `entryFee`, and the pack declares that token with no plural on
                        purpose - deriving one with `+ "s"` is us editing a word the operator
                        typed, the same mistake `replace(/s$/, "")` was on the credit symbol.
                        Recasting the sentence so each noun appears in the number the pack
                        actually declares costs nothing and needs no string surgery. */}
                    <p className="text-blue-300/70 text-sm">
                      Both {terms.players} were refunded their {terms.entryFee}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Status */}
              <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  {terms.challenge} Status
                </h3>
                <div
                  className={`p-4 rounded-lg ${
                    isActive
                      ? "bg-green-500/20 border border-green-500/30"
                      : isPending || isAccepted
                        ? "bg-yellow-500/20 border border-yellow-500/30"
                        : isCompleted
                          ? "bg-gray-500/20 border border-gray-500/30"
                          : "bg-red-500/20 border border-red-500/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        isActive
                          ? "bg-green-500 animate-pulse"
                          : isPending || isAccepted
                            ? "bg-yellow-500"
                            : isCompleted
                              ? "bg-gray-500"
                              : "bg-red-500"
                      }`}
                    ></div>
                    <span
                      className={`font-semibold ${
                        isActive
                          ? "text-green-400"
                          : isPending || isAccepted
                            ? "text-yellow-400"
                            : isCompleted
                              ? "text-gray-400"
                              : "text-red-400"
                      }`}
                    >
                      {challenge.status.toUpperCase()}
                    </span>
                  </div>
                  {/* Seven mutually exclusive sentences, each naming the noun. They are
                      written as template literals rather than as one composed sentence
                      because the verb differs per state and an operator's noun may not be a
                      single word - "Head to Head has ended" has to read as written, not as a
                      fragment glued to a fixed suffix. `opponent` is its own token: the other
                      party to a two-player format is a different renameable noun from the
                      generic word for a person in a contest. */}
                  <p className="text-xs text-gray-400 mt-2">
                    {isActive && `${terms.challenge} is currently in progress`}
                    {isPending && `Waiting for ${terms.opponent} to accept`}
                    {isAccepted &&
                      `${terms.challenge} accepted, waiting to start`}
                    {isCompleted && `${terms.challenge} has ended`}
                    {isCancelled && `${terms.challenge} was cancelled`}
                    {challenge.status === "declined" &&
                      `${terms.challenge} was declined`}
                    {challenge.status === "expired" &&
                      `${terms.challenge} expired`}
                  </p>
                </div>
              </div>

              {/* Winner Banner */}
              {isCompleted && challenge.winnerName && !challenge.isTie && (
                <div className="bg-linear-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-6 shadow-xl text-center">
                  <Trophy className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
                  <p className="text-2xl font-bold text-yellow-400 mb-1">
                    🏆 {challenge.winnerName}
                  </p>
                  <p className="text-yellow-300/70 mb-3">
                    {terms.challenge} Winner
                  </p>
                  <div className="bg-yellow-500/20 px-4 py-3 rounded-lg">
                    <p className="text-yellow-400 font-bold text-xl">
                      Earned {formatVolts(challenge.winnerPrize, { symbol: creditSymbol })}
                    </p>
                  </div>
                  {/* R92. `winnerPnL` is stored on every settled challenge of every game,
                      and on a provider game it is the participant's `pnl`, which is zero
                      because nothing trades - so the banner read "Final P&L: +0.00" under
                      the winner's name. The score is read off the winning side's settled
                      snapshot rather than from a second field, and an absent score renders
                      NOTHING rather than a zero: R45/R50's rule, one screen along. */}
                  {isProviderGame ? (
                    typeof winnerScore === "number" && (
                      <p className="text-sm text-yellow-300/70 mt-2">
                        {terms.score}: {winnerScore}
                      </p>
                    )
                  ) : (
                    challenge.winnerPnL !== undefined && (
                      <p className="text-sm text-yellow-300/70 mt-2">
                        Final P&L: {challenge.winnerPnL >= 0 ? "+" : ""}
                        {challenge.winnerPnL?.toFixed(2)}
                      </p>
                    )
                  )}
                </div>
              )}

              {/* Rules. R92: withheld entirely on a provider game rather than reworded.
                  All three rows are trading rules - a ranking method the provider module
                  ignores, a minimum trade count, and a liquidation disqualification - and
                  the liquidation row is the one that would have shipped a false statement,
                  because its condition is `!== false`, so a provider challenge that has
                  never stored the flag reads "Liquidation: Disqualifies" for a game that
                  has no positions to liquidate. Withholding beats zeroing: there is no
                  honest value to print, and a rule nobody set is worse than a blank. */}
              {challenge.rules && !isProviderGame && (
                <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-400" />
                    Rules
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-800/50 rounded">
                      <span className="text-gray-400">Ranking Method:</span>
                      <span className="text-gray-100 font-semibold">
                        {challenge.rules.rankingMethod === "pnl" &&
                          "Highest P&L"}
                        {challenge.rules.rankingMethod === "roi" &&
                          "Highest ROI %"}
                        {challenge.rules.rankingMethod === "total_capital" &&
                          "Highest Capital"}
                      </span>
                    </div>
                    {challenge.rules.minimumTrades > 0 && (
                      <div className="flex justify-between p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-400">Min Trades:</span>
                        <span className="text-gray-100 font-semibold">
                          {challenge.rules.minimumTrades}
                        </span>
                      </div>
                    )}
                    {challenge.rules.disqualifyOnLiquidation !== false && (
                      <div className="flex justify-between p-2 bg-gray-800/50 rounded">
                        <span className="text-gray-400">Liquidation:</span>
                        <span className="text-red-400 font-semibold">
                          Disqualifies
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Platform Fee Info */}
              <div className="bg-linear-to-br from-blue-500/10 to-gray-900 border border-blue-500/30 rounded-xl p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                  Fee Breakdown
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Pool:</span>
                    <span className="text-white font-semibold">
                      {formatVolts(challenge.prizePool, { symbol: creditSymbol })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Platform Fee ({challenge.platformFeePercentage}%):
                    </span>
                    <span className="text-blue-400 font-semibold">
                      -{formatVolts(challenge.platformFeeAmount, { symbol: creditSymbol })}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700">
                    <span className="text-gray-400">Winner Receives:</span>
                    <span className="text-yellow-400 font-bold">
                      {formatVolts(challenge.winnerPrize, { symbol: creditSymbol })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error loading challenge:", error);
    notFound();
  }
};

export default AdminChallengeViewPage;
