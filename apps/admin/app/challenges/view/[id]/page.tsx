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
  const _creditName = appSettings?.credits?.name || "Credits";
  const _creditSymbol = appSettings?.credits?.symbol || "⚡";
  const currencySymbol = appSettings?.currency?.symbol || "€";
  const _currencyCode = appSettings?.currency?.code || "EUR";

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
                      <h1 className="text-3xl font-bold text-white">
                        1v1 Challenge
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
                  <p className="text-xs text-gray-500">Prize Pool</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {currencySymbol}
                    {challenge.prizePool?.toLocaleString()}
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
                  <p className="text-xs text-gray-500">Entry Fee</p>
                  <p className="text-2xl font-bold text-green-400">
                    {currencySymbol}
                    {challenge.entryFee?.toLocaleString()}
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
                  <p className="text-xs text-gray-500">Winner Prize</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {currencySymbol}
                    {challenge.winnerPrize?.toLocaleString()}
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
              {/* Challenge Configuration */}
              <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-400" />
                  Challenge Configuration
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">
                      Starting Capital
                    </p>
                    <p className="text-lg font-semibold text-gray-100">
                      ${challenge.startingCapital?.toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Duration</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {formatDuration(challenge.duration)}
                    </p>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Platform Fee</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {challenge.platformFeePercentage}% ({currencySymbol}
                      {challenge.platformFeeAmount})
                    </p>
                  </div>

                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Ranking Method</p>
                    <p className="text-lg font-semibold text-gray-100">
                      {challenge.rules?.rankingMethod === "pnl" &&
                        "Highest P&L"}
                      {challenge.rules?.rankingMethod === "roi" &&
                        "Highest ROI %"}
                      {challenge.rules?.rankingMethod === "total_capital" &&
                        "Highest Capital"}
                      {!challenge.rules?.rankingMethod && "Highest P&L"}
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
                  {isCompleted ? "Final Results" : "Participants"}
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
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">P&L:</span>
                              <span
                                className={`font-bold ${challengerStats.pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {challengerStats.pnl >= 0 ? "+" : ""}
                                {challengerStats.pnl?.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">ROI:</span>
                              <span
                                className={`${challengerStats.pnlPercentage >= 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {challengerStats.pnlPercentage >= 0 ? "+" : ""}
                                {challengerStats.pnlPercentage?.toFixed(2)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Trades:</span>
                              <span className="text-white">
                                {challengerStats.totalTrades}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Win Rate:</span>
                              <span className="text-white">
                                {challengerStats.winRate?.toFixed(1)}%
                              </span>
                            </div>
                            {isWinner && (
                              <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
                                <span className="text-gray-400">
                                  Prize Won:
                                </span>
                                <span className="text-yellow-400 font-bold">
                                  {currencySymbol}
                                  {challenge.winnerPrize}
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
                                {currencySymbol}
                                {challengerGm.gmEarning.toFixed(2)}
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
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">P&L:</span>
                              <span
                                className={`font-bold ${challengedStats.pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {challengedStats.pnl >= 0 ? "+" : ""}
                                {challengedStats.pnl?.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">ROI:</span>
                              <span
                                className={`${challengedStats.pnlPercentage >= 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {challengedStats.pnlPercentage >= 0 ? "+" : ""}
                                {challengedStats.pnlPercentage?.toFixed(2)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Trades:</span>
                              <span className="text-white">
                                {challengedStats.totalTrades}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Win Rate:</span>
                              <span className="text-white">
                                {challengedStats.winRate?.toFixed(1)}%
                              </span>
                            </div>
                            {isWinner && (
                              <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
                                <span className="text-gray-400">
                                  Prize Won:
                                </span>
                                <span className="text-yellow-400 font-bold">
                                  {currencySymbol}
                                  {challenge.winnerPrize}
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
                                {currencySymbol}
                                {challengedGm.gmEarning.toFixed(2)}
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
                      🤝 This challenge ended in a TIE
                    </p>
                    <p className="text-blue-300/70 text-sm">
                      Entry fees were refunded to both participants
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Challenge Status */}
              <div className="bg-linear-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  Challenge Status
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
                  <p className="text-xs text-gray-400 mt-2">
                    {isActive && "Challenge is currently in progress"}
                    {isPending && "Waiting for opponent to accept"}
                    {isAccepted && "Challenge accepted, waiting to start"}
                    {isCompleted && "Challenge has ended"}
                    {isCancelled && "Challenge was cancelled"}
                    {challenge.status === "declined" &&
                      "Challenge was declined"}
                    {challenge.status === "expired" && "Challenge expired"}
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
                  <p className="text-yellow-300/70 mb-3">Challenge Winner</p>
                  <div className="bg-yellow-500/20 px-4 py-3 rounded-lg">
                    <p className="text-yellow-400 font-bold text-xl">
                      Earned {currencySymbol}
                      {challenge.winnerPrize}
                    </p>
                  </div>
                  {challenge.winnerPnL !== undefined && (
                    <p className="text-sm text-yellow-300/70 mt-2">
                      Final P&L: {challenge.winnerPnL >= 0 ? "+" : ""}
                      {challenge.winnerPnL?.toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Rules */}
              {challenge.rules && (
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
                      {currencySymbol}
                      {challenge.prizePool}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Platform Fee ({challenge.platformFeePercentage}%):
                    </span>
                    <span className="text-blue-400 font-semibold">
                      -{currencySymbol}
                      {challenge.platformFeeAmount}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700">
                    <span className="text-gray-400">Winner Receives:</span>
                    <span className="text-yellow-400 font-bold">
                      {currencySymbol}
                      {challenge.winnerPrize}
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
