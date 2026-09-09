"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Trophy,
  DollarSign,
  Users,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Award,
  Calendar,
  XCircle,
  Ban,
  AlertTriangle,
  Undo2,
  Wallet,
  CheckCircle,
  Swords,
  Target,
  Clock,
  Slash,
} from "lucide-react";
import { creditsToEUR } from "@/lib/utils/credit-conversion";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import GameRevenueBreakdown from "./competitions/GameRevenueBreakdown";
import { formatVolts } from "@/lib/utils/format-volts";
import {
  ALL_GAMES,
  filterByGame,
  resolveGameBadge,
  resolveGameFilterOptions,
  resolvePlayerMetric,
  resolveScopeNote,
  resolveShareOfPool,
} from "@/lib/admin/contest-analytics-presentation";

interface Winner {
  userId: string;
  displayName: string;
  amount: number;
  rank: number;
  /**
   * Trading's final profit and loss, and a provider game's raw score.
   *
   * Both are optional and neither is defaulted, because `prize-payout.service.ts` writes
   * whichever applies and omits the other on purpose. `resolvePlayerMetric` decides which to
   * render; reading `finalPnl` directly here is what made every game winner show `+0.00`.
   */
  finalPnl?: number;
  finalScore?: number;
}

interface DisqualifiedDetail {
  userId: string;
  displayName: string;
  reason: string;
  finalPnl?: number;
  finalScore?: number;
}

interface RefundDetail {
  userId: string;
  displayName: string;
  amount: number;
  description: string;
  date: string;
}

interface CompetitionAnalytic {
  _id: string;
  name: string;
  status: "completed" | "cancelled";
  cancellationReason?: string;
  startTime: string;
  endTime: string;
  entryFee: number;
  participants: number;
  prizePool: number;
  platformFeePercentage: number;
  // The game label. Absent on contests created before X1, which the presentation module
  // resolves to trading - see `resolveContestGameType` for why `.lean()` makes that necessary.
  gameType?: string | null;
  gameKey?: string | null;
  providerKey?: string | null;
  gameCode?: string | null;
  gameDisplayName?: string | null;
  providerDisplayName?: string | null;
  totalCollected: number;
  platformFeeEarned: number;
  platformFeeEstimated?: boolean;
  expectedPlatformFee: number;
  totalWinnersPaid: number;
  totalRefunds: number;
  unclaimedPool: number;
  winnersCount: number;
  disqualifiedCount: number;
  refundsCount: number;
  winners: Winner[];
  disqualifiedDetails: DisqualifiedDetail[];
  refundDetails: RefundDetail[];
}

interface OverallStats {
  totalCompetitions: number;
  completedCompetitions: number;
  cancelledCompetitions: number;
  totalParticipants: number;
  totalPrizePools: number;
  totalPlatformFees: number;
  totalWinnersPaid: number;
  totalRefunds: number;
  totalUnclaimedPools: number;
  totalDisqualified: number;
  averageParticipantsPerComp: number;
  averagePrizePool: number;
}

interface ChallengeAnalytic {
  _id: string;
  status: string;
  challengerName: string;
  challengedName: string;
  entryFee: number;
  prizePool: number;
  platformFeeAmount: number;
  winnerPrize: number;
  duration: number;
  winnerId?: string;
  winnerName?: string;
  winnerPnL?: number;
  loserId?: string;
  loserName?: string;
  loserPnL?: number;
  isTie?: boolean;
  bothDisqualified?: boolean;
  unclaimedPool: number;
  createdAt: string;
  startTime: string;
  endTime: string;
  challengerStats?: {
    totalTrades: number;
    totalPnL: number;
    isDisqualified?: boolean;
  };
  challengedStats?: {
    totalTrades: number;
    totalPnL: number;
    isDisqualified?: boolean;
  };
}

interface ChallengeStats {
  totalChallenges: number;
  completedChallenges: number;
  declinedChallenges: number;
  expiredChallenges: number;
  tieChallenges: number;
  bothDisqualifiedChallenges: number;
  totalChallengePrizePools: number;
  totalChallengePlatformFees: number;
  totalChallengeWinnersPaid: number;
  totalChallengeUnclaimedPools: number;
  averageChallengeEntryFee: number;
}

export default function CompetitionAnalytics() {
  const { settings } = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [competitions, setCompetitions] = useState<CompetitionAnalytic[]>([]);
  const [challenges, setChallenges] = useState<ChallengeAnalytic[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalCompetitions: 0,
    completedCompetitions: 0,
    cancelledCompetitions: 0,
    totalParticipants: 0,
    totalPrizePools: 0,
    totalPlatformFees: 0,
    totalWinnersPaid: 0,
    totalRefunds: 0,
    totalUnclaimedPools: 0,
    totalDisqualified: 0,
    averageParticipantsPerComp: 0,
    averagePrizePool: 0,
  });
  const [challengeStats, setChallengeStats] = useState<ChallengeStats>({
    totalChallenges: 0,
    completedChallenges: 0,
    declinedChallenges: 0,
    expiredChallenges: 0,
    tieChallenges: 0,
    bothDisqualifiedChallenges: 0,
    totalChallengePrizePools: 0,
    totalChallengePlatformFees: 0,
    totalChallengeWinnersPaid: 0,
    totalChallengeUnclaimedPools: 0,
    averageChallengeEntryFee: 0,
  });
  const [conversionRate, setConversionRate] = useState(100);
  const [contestLimit, setContestLimit] = useState(50);
  const [selectedGame, setSelectedGame] = useState<string>(ALL_GAMES);
  const [expandedComp, setExpandedComp] = useState<string | null>(null);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(
    null,
  );

  // Both units are legitimate on this screen and they mean different things. `creditSymbol`
  // prefixes the amounts themselves, which are credits; `currencySymbol` labels the
  // `creditsToEUR` line beneath each one, which is the operator's reconciliation figure and
  // reads the deposit rate. `creditName` is for the one place a full unit reads better than a
  // prefix - see the entry-fee note below.
  const creditSymbol = settings?.credits?.symbol || "⚡";
  const creditName = settings?.credits?.name;
  const currencySymbol = settings?.currency?.symbol || "€";
  const currencyCode = settings?.currency?.code || "EUR";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/competition-analytics");
      if (!response.ok) throw new Error("Failed to fetch data");

      const result = await response.json();
      setCompetitions(result.data.competitions);
      setOverallStats(result.data.overallStats);
      setChallenges(result.data.challenges || []);
      setChallengeStats(
        result.data.challengeStats || {
          totalChallenges: 0,
          completedChallenges: 0,
          declinedChallenges: 0,
          expiredChallenges: 0,
          tieChallenges: 0,
          bothDisqualifiedChallenges: 0,
          totalChallengePrizePools: 0,
          totalChallengePlatformFees: 0,
          totalChallengeWinnersPaid: 0,
          totalChallengeUnclaimedPools: 0,
          averageChallengeEntryFee: 0,
        },
      );
      setConversionRate(result.data.conversionRate);
      if (typeof result.data.contestLimit === "number") {
        setContestLimit(result.data.contestLimit);
      }
    } catch (error) {
      toast.error("Failed to load competition analytics");
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return (
        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Cancelled
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-12">
        <div className="flex items-center justify-center">
          <div className="text-cyan-400 text-lg">
            Loading competition analytics...
          </div>
        </div>
      </div>
    );
  }

  const gameOptions = resolveGameFilterOptions(competitions);
  const visibleCompetitions = filterByGame(competitions, selectedGame);
  const scopeNote = resolveScopeNote(competitions.length, contestLimit);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-cyan-500/50 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <Trophy className="h-8 w-8 text-cyan-600" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  🏆 Competition Analytics
                </h2>
                <p className="text-cyan-100 mt-1">
                  Track earnings, prizes, refunds & disqualifications
                </p>
              </div>
            </div>
            <Button
              onClick={fetchData}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white backdrop-blur-sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
        {/*
          The scope of every figure on this screen, said out loud.

          It reads the most recent competitions only and reduces the headline cards over that
          same list, so "Platform Fees Earned" has always meant "of the last N" while being
          captioned as a total. `12` s5's binding rule is that no operator-facing aggregate may
          silently mean one thing while reading as another - the game axis is the obvious one and
          the time window is the same failure. The arithmetic is deliberately unchanged: see
          `resolveScopeNote` for why labelling and widening must not be the same edit.
        */}
        <div className="border-t border-cyan-500/30 bg-gray-900/60 px-8 py-3 text-xs text-gray-400">
          {scopeNote}
        </div>
      </div>

      {/* Overall Statistics Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/50 shadow-xl shadow-purple-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Trophy className="h-4 w-4 text-purple-400" />
              </div>
              Total Competitions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {overallStats.totalCompetitions}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="text-green-400">
                {overallStats.completedCompetitions} completed
              </span>
              <span className="text-red-400">
                {overallStats.cancelledCompetitions} cancelled
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/50 shadow-xl shadow-green-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-400" />
              </div>
              Total Prize Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tabular-nums">
              {creditSymbol} {overallStats.totalPrizePools.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              ≈ {currencySymbol}
              {creditsToEUR(
                overallStats.totalPrizePools,
                conversionRate,
              ).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/30 to-amber-900/30 border-yellow-500/50 shadow-xl shadow-yellow-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-yellow-400" />
              </div>
              Platform Fees Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-400 tabular-nums">
              {creditSymbol} {overallStats.totalPlatformFees.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              ≈ {currencySymbol}
              {creditsToEUR(
                overallStats.totalPlatformFees,
                conversionRate,
              ).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-500/50 shadow-xl shadow-blue-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Award className="h-4 w-4 text-blue-400" />
              </div>
              Winners Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400 tabular-nums">
              {creditSymbol} {overallStats.totalWinnersPaid.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              ≈ {currencySymbol}
              {creditsToEUR(
                overallStats.totalWinnersPaid,
                conversionRate,
              ).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Statistics Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-500/50 shadow-xl shadow-red-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Undo2 className="h-4 w-4 text-red-400" />
              </div>
              Total Refunds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400 tabular-nums">
              {creditSymbol} {overallStats.totalRefunds.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              From cancelled competitions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-900/30 to-yellow-900/30 border-orange-500/50 shadow-xl shadow-orange-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Wallet className="h-4 w-4 text-orange-400" />
              </div>
              Unclaimed Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-400 tabular-nums">
              {creditSymbol} {overallStats.totalUnclaimedPools.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              From disqualified users
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-900/30 to-pink-900/30 border-rose-500/50 shadow-xl shadow-rose-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-rose-500/20 rounded-lg flex items-center justify-center">
                <Ban className="h-4 w-4 text-rose-400" />
              </div>
              Disqualified Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-400 tabular-nums">
              {overallStats.totalDisqualified}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Did not meet requirements
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900/30 to-gray-900/30 border-slate-500/50 shadow-xl shadow-slate-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-slate-500/20 rounded-lg flex items-center justify-center">
                <Users className="h-4 w-4 text-slate-400" />
              </div>
              Avg Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tabular-nums">
              {overallStats.averageParticipantsPerComp.toFixed(1)}
            </div>
            <p className="text-xs text-gray-400 mt-1">per competition</p>
          </CardContent>
        </Card>
      </div>

      {/* By game and by provider - `12` s5's acceptance criterion */}
      <GameRevenueBreakdown
        contests={competitions}
        creditSymbol={creditSymbol}
      />

      {/* Competitions Table */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center gap-2">
            <div className="h-10 w-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <Trophy className="h-5 w-5 text-cyan-400" />
            </div>
            Competition Financial Details
          </CardTitle>
          <CardDescription className="text-sm">
            Expand each competition to see winner distributions,
            disqualifications, and refunds
          </CardDescription>
          {/*
            The game filter. Built from the contests present rather than from the catalogue, so a
            retired title's settled contests stay reachable - see `resolveGameFilterOptions`.
            Only offered when there is more than one game, because a filter with one option is
            furniture.
          */}
          {gameOptions.length > 2 && (
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <span className="text-xs text-gray-500">Game:</span>
              {gameOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedGame(option.key)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    selectedGame === option.key
                      ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-300"
                      : "border-gray-700 bg-gray-900/60 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {option.label}{" "}
                  <span className="text-gray-500">({option.contests})</span>
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {visibleCompetitions.map((comp) => {
              const isExpanded = expandedComp === comp._id;
              const isCancelled = comp.status === "cancelled";
              const badge = resolveGameBadge(comp);

              return (
                <div
                  key={comp._id}
                  className={`border rounded-lg overflow-hidden ${
                    isCancelled ? "border-red-500/30" : "border-gray-700"
                  }`}
                >
                  {/* Competition Summary Row */}
                  <div
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                      isCancelled
                        ? "bg-red-900/20 hover:bg-red-900/30"
                        : "bg-gray-900/50 hover:bg-gray-900"
                    }`}
                    onClick={() =>
                      setExpandedComp(isExpanded ? null : comp._id)
                    }
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedComp(isExpanded ? null : comp._id);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Trophy
                            className={`h-4 w-4 ${isCancelled ? "text-red-500" : "text-yellow-500"}`}
                          />
                          <span className="font-semibold text-white">
                            {comp.name}
                          </span>
                          {getStatusBadge(comp.status)}
                          {/*
                            Which game this row belongs to. Shown on every row including
                            trading, deliberately: a badge that appears only on the unusual case
                            leaves the reader to assume what the unbadged rows are, and the
                            assumption is exactly the one this screen used to make for them.
                          */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                              badge.isProviderGame
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                            }`}
                            title={
                              badge.provider
                                ? `${badge.label} - supplied by ${badge.provider}`
                                : "Trading"
                            }
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(comp.endTime).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {comp.participants} participants
                          </span>
                          {/*
                            The only figure on this screen that wore the fiat symbol. Every
                            other amount here is prefixed with the credit symbol and then
                            converted underneath with `creditsToEUR`, which is the operator's
                            reconciliation view and is correct. This one was neither: a credit
                            entry fee written as euros, with no conversion applied.
                          */}
                          <span>
                            {formatVolts(comp.entryFee, { unit: creditName })} entry
                            fee
                          </span>
                          {comp.disqualifiedCount > 0 && (
                            <span className="text-red-400 flex items-center gap-1">
                              <Ban className="h-3 w-3" />
                              {comp.disqualifiedCount} disqualified
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Prize Pool or Refund Amount */}
                      <div className="text-right">
                        {isCancelled ? (
                          <>
                            <div className="text-sm font-semibold text-red-400">
                              Refunded: {creditSymbol}{" "}
                              {comp.totalRefunds.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {comp.refundsCount} refunds
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-semibold text-gray-300">
                              Prize Pool: {creditSymbol}{" "}
                              {comp.prizePool.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              ≈ {currencySymbol}
                              {creditsToEUR(
                                comp.prizePool,
                                conversionRate,
                              ).toFixed(2)}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Platform Fee */}
                      <div className="text-right min-w-[140px]">
                        {isCancelled ? (
                          <>
                            <div className="text-sm font-semibold text-gray-500">
                              Platform: {creditSymbol} 0
                            </div>
                            <div className="text-xs text-gray-600">
                              (cancelled - all refunded)
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-semibold text-yellow-400">
                              Platform: +{creditSymbol}{" "}
                              {comp.platformFeeEarned.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              ({comp.platformFeePercentage}% fee)
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div
                      className={`border-t p-4 space-y-4 ${
                        isCancelled
                          ? "border-red-500/30 bg-red-900/10"
                          : "border-gray-700 bg-gray-900/30"
                      }`}
                    >
                      {/* Financial Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">
                            Total Collected
                          </div>
                          <div className="text-lg font-bold text-white">
                            {creditSymbol}{" "}
                            {comp.totalCollected.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">
                            Winners Paid
                          </div>
                          <div className="text-lg font-bold text-green-400">
                            {creditSymbol}{" "}
                            {comp.totalWinnersPaid.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">
                            Platform Earned
                          </div>
                          <div className="text-lg font-bold text-yellow-400">
                            {creditSymbol}{" "}
                            {comp.platformFeeEarned.toLocaleString()}
                          </div>
                        </div>
                        {comp.unclaimedPool > 0 && (
                          <div className="bg-orange-900/20 rounded-lg p-3 border border-orange-500/30">
                            <div className="text-xs text-orange-400">
                              Unclaimed Pool
                            </div>
                            <div className="text-lg font-bold text-orange-400">
                              {creditSymbol}{" "}
                              {comp.unclaimedPool.toLocaleString()}
                            </div>
                          </div>
                        )}
                        {isCancelled && (
                          <div className="bg-red-900/20 rounded-lg p-3 border border-red-500/30">
                            <div className="text-xs text-red-400">
                              Total Refunded
                            </div>
                            <div className="text-lg font-bold text-red-400">
                              {creditSymbol}{" "}
                              {comp.totalRefunds.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cancellation Reason */}
                      {isCancelled && comp.cancellationReason && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            Cancellation Reason
                          </div>
                          <p className="text-gray-300">
                            {comp.cancellationReason}
                          </p>
                        </div>
                      )}

                      {/* Winners Section */}
                      {comp.winners.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Award className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-semibold text-gray-300">
                              Prize Distribution ({comp.winnersCount} winners)
                            </span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="border-gray-700">
                                <TableHead className="text-gray-400">
                                  Rank
                                </TableHead>
                                <TableHead className="text-gray-400">
                                  User
                                </TableHead>
                                {/*
                                  The column heading is per game, not fixed. A provider game has
                                  no profit and loss, and `prize-payout.service.ts` deliberately
                                  writes no `finalPnl` for one - so a fixed "Final P&L" heading
                                  printed `+0.00` in green against every game winner while the
                                  score they were ranked on sat unread in the same ledger row.
                                */}
                                <TableHead className="text-gray-400">
                                  {badge.isProviderGame ? "Score" : "Final P&L"}
                                </TableHead>
                                {/*
                                  "Share of pool" replaces a "Prize %" column that has read 0%
                                  for every winner of every competition ever settled, because
                                  nothing writes `metadata.percentage`. This is derived from the
                                  payment and the pool, and it is the better figure: after ties
                                  and redistribution the share paid at a rank is routinely not
                                  the share configured for it.
                                */}
                                <TableHead className="text-gray-400">
                                  Share of pool
                                </TableHead>
                                <TableHead className="text-gray-400">
                                  Prize Amount
                                </TableHead>
                                <TableHead className="text-gray-400">
                                  {currencyCode} Value
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comp.winners
                                .sort((a, b) => a.rank - b.rank)
                                .map((winner) => {
                                  const metric = resolvePlayerMetric(
                                    winner,
                                    badge.isProviderGame,
                                  );
                                  const share = resolveShareOfPool(
                                    winner.amount,
                                    comp.prizePool,
                                  );
                                  return (
                                  <TableRow
                                    key={winner.userId + winner.rank}
                                    className="border-gray-700"
                                  >
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {winner.rank === 1 && (
                                          <span className="text-2xl">🥇</span>
                                        )}
                                        {winner.rank === 2 && (
                                          <span className="text-2xl">🥈</span>
                                        )}
                                        {winner.rank === 3 && (
                                          <span className="text-2xl">🥉</span>
                                        )}
                                        <span className="font-semibold text-white">
                                          #{winner.rank}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-gray-300">
                                      {winner.displayName}
                                    </TableCell>
                                    <TableCell
                                      className={
                                        metric.tone === "positive"
                                          ? "text-green-400"
                                          : metric.tone === "negative"
                                            ? "text-red-400"
                                            : "text-gray-300"
                                      }
                                      title={metric.label}
                                    >
                                      {/*
                                        A score carries no currency symbol - it is not money -
                                        and an absent one renders `metric.value` of `-` rather
                                        than a zero. Both decisions live in the presentation
                                        module so this screen and the contest view screen cannot
                                        drift into describing a missing result differently.
                                      */}
                                      {metric.tone === "neutral"
                                        ? metric.value
                                        : `${creditSymbol} ${metric.value}`}
                                    </TableCell>
                                    <TableCell className="text-gray-400">
                                      {share === null
                                        ? "-"
                                        : `${share.toFixed(1)}%`}
                                    </TableCell>
                                    <TableCell className="font-semibold text-green-400 tabular-nums">
                                      {creditSymbol}{" "}
                                      {winner.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-gray-500">
                                      {currencySymbol}
                                      {creditsToEUR(
                                        winner.amount,
                                        conversionRate,
                                      ).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Disqualified Users Section */}
                      {comp.disqualifiedDetails.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Ban className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-semibold text-gray-300">
                              Disqualified Participants (
                              {comp.disqualifiedCount})
                            </span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="border-gray-700">
                                <TableHead className="text-gray-400">
                                  User
                                </TableHead>
                                <TableHead className="text-gray-400">
                                  {badge.isProviderGame ? "Score" : "Final P&L"}
                                </TableHead>
                                <TableHead className="text-gray-400">
                                  Reason
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comp.disqualifiedDetails.map((dq) => {
                                const metric = resolvePlayerMetric(
                                  dq,
                                  badge.isProviderGame,
                                );
                                return (
                                <TableRow
                                  key={dq.userId}
                                  className="border-gray-700"
                                >
                                  <TableCell className="text-gray-300">
                                    {dq.displayName}
                                  </TableCell>
                                  <TableCell
                                    className={
                                      metric.tone === "positive"
                                        ? "text-green-400"
                                        : metric.tone === "negative"
                                          ? "text-red-400"
                                          : "text-gray-300"
                                    }
                                    title={metric.label}
                                  >
                                    {metric.tone === "neutral"
                                      ? metric.value
                                      : `${creditSymbol} ${metric.value}`}
                                  </TableCell>
                                  <TableCell className="text-red-400 text-sm">
                                    {dq.reason}
                                  </TableCell>
                                </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>

                          {/* Unclaimed Pool Info */}
                          {comp.unclaimedPool > 0 && (
                            <div className="mt-3 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                              <p className="text-sm text-orange-300">
                                💰{" "}
                                <strong>
                                  {creditSymbol}{" "}
                                  {comp.unclaimedPool.toLocaleString()}
                                </strong>{" "}
                                from disqualified users&rsquo; share went to the
                                platform&rsquo;s unclaimed pool.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Refunds Section (for cancelled competitions) */}
                      {comp.refundDetails.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Undo2 className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-semibold text-gray-300">
                              Refunds Issued ({comp.refundsCount})
                            </span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="border-gray-700">
                                <TableHead className="text-gray-400">
                                  User
                                </TableHead>
                                <TableHead className="text-gray-400">
                                  Amount
                                </TableHead>
                                <TableHead className="text-gray-400">
                                  Date
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comp.refundDetails.map((refund, idx) => (
                                <TableRow
                                  key={refund.userId + idx}
                                  className="border-gray-700"
                                >
                                  <TableCell className="text-gray-300">
                                    {refund.displayName}
                                  </TableCell>
                                  <TableCell className="font-semibold text-red-400 tabular-nums">
                                    {creditSymbol}{" "}
                                    {refund.amount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-gray-500">
                                    {new Date(refund.date).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Summary Footer */}
                      <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap items-center justify-between gap-4 text-sm">
                        <div className="text-gray-400">
                          Total Distributed:{" "}
                          <span className="font-semibold text-green-400">
                            {creditSymbol}{" "}
                            {comp.totalWinnersPaid.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-gray-400">
                          Platform Revenue:{" "}
                          <span className="font-semibold text-yellow-400">
                            {creditSymbol}{" "}
                            {comp.platformFeeEarned.toLocaleString()}
                          </span>
                        </div>
                        {comp.unclaimedPool > 0 && (
                          <div className="text-gray-400">
                            Unclaimed:{" "}
                            <span className="font-semibold text-orange-400">
                              {creditSymbol}{" "}
                              {comp.unclaimedPool.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {comp.totalRefunds > 0 && (
                          <div className="text-gray-400">
                            Refunded:{" "}
                            <span className="font-semibold text-red-400">
                              {creditSymbol}{" "}
                              {comp.totalRefunds.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {competitions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No completed or cancelled competitions yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ========== 1v1 CHALLENGE ANALYTICS ========== */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500/50 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Swords className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                ⚔️ 1v1 Challenge Analytics
              </h2>
              <p className="text-orange-100 mt-1">
                Track challenge fees, wins, ties & disqualifications
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Challenge Statistics Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border-orange-500/50 shadow-xl shadow-orange-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Swords className="h-4 w-4 text-orange-400" />
              </div>
              Total Challenges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {challengeStats.totalChallenges}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="text-green-400">
                {challengeStats.completedChallenges} completed
              </span>
              <span className="text-gray-400">
                {challengeStats.declinedChallenges} declined
              </span>
              <span className="text-red-400">
                {challengeStats.expiredChallenges} expired
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/50 shadow-xl shadow-green-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-400" />
              </div>
              Challenge Prize Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tabular-nums">
              {creditSymbol}{" "}
              {challengeStats.totalChallengePrizePools.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              ≈ {currencySymbol}
              {creditsToEUR(
                challengeStats.totalChallengePrizePools,
                conversionRate,
              ).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/30 to-amber-900/30 border-yellow-500/50 shadow-xl shadow-yellow-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-yellow-400" />
              </div>
              Challenge Platform Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-400 tabular-nums">
              {creditSymbol}{" "}
              {challengeStats.totalChallengePlatformFees.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              ≈ {currencySymbol}
              {creditsToEUR(
                challengeStats.totalChallengePlatformFees,
                conversionRate,
              ).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-500/50 shadow-xl shadow-blue-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Award className="h-4 w-4 text-blue-400" />
              </div>
              Winners Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400 tabular-nums">
              {creditSymbol}{" "}
              {challengeStats.totalChallengeWinnersPaid.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              ≈ {currencySymbol}
              {creditsToEUR(
                challengeStats.totalChallengeWinnersPaid,
                conversionRate,
              ).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Challenge Statistics Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/50 shadow-xl shadow-purple-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Slash className="h-4 w-4 text-purple-400" />
              </div>
              Ties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400 tabular-nums">
              {challengeStats.tieChallenges}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Challenges ending in a tie
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-900/30 to-rose-900/30 border-red-500/50 shadow-xl shadow-red-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Ban className="h-4 w-4 text-red-400" />
              </div>
              Both Disqualified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400 tabular-nums">
              {challengeStats.bothDisqualifiedChallenges}
            </div>
            <p className="text-sm text-gray-400 mt-2">Platform kept the pool</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-900/30 to-yellow-900/30 border-orange-500/50 shadow-xl shadow-orange-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Wallet className="h-4 w-4 text-orange-400" />
              </div>
              Unclaimed Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-400 tabular-nums">
              {creditSymbol}{" "}
              {challengeStats.totalChallengeUnclaimedPools.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-2">From both-disqualified</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900/30 to-gray-900/30 border-slate-500/50 shadow-xl shadow-slate-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <div className="h-8 w-8 bg-slate-500/20 rounded-lg flex items-center justify-center">
                <Target className="h-4 w-4 text-slate-400" />
              </div>
              Avg Entry Fee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tabular-nums">
              {creditSymbol}{" "}
              {challengeStats.averageChallengeEntryFee.toFixed(0)}
            </div>
            <p className="text-xs text-gray-400 mt-1">per player</p>
          </CardContent>
        </Card>
      </div>

      {/* Challenge Details Table */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center gap-2">
            <div className="h-10 w-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Swords className="h-5 w-5 text-orange-400" />
            </div>
            Challenge Details
          </CardTitle>
          <CardDescription className="text-sm">
            Expand each challenge to see player stats and outcomes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {challenges.map((challenge) => {
              const isExpanded = expandedChallenge === challenge._id;
              const isCompleted = challenge.status === "completed";
              const isTie = challenge.isTie;
              const bothDisqualified = challenge.bothDisqualified;

              return (
                <div
                  key={challenge._id}
                  className={`border rounded-lg overflow-hidden ${
                    bothDisqualified
                      ? "border-red-500/30"
                      : isTie
                        ? "border-purple-500/30"
                        : "border-gray-700"
                  }`}
                >
                  {/* Challenge Summary Row */}
                  <div
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                      bothDisqualified
                        ? "bg-red-900/20 hover:bg-red-900/30"
                        : isTie
                          ? "bg-purple-900/20 hover:bg-purple-900/30"
                          : "bg-gray-900/50 hover:bg-gray-900"
                    }`}
                    onClick={() =>
                      setExpandedChallenge(isExpanded ? null : challenge._id)
                    }
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedChallenge(
                            isExpanded ? null : challenge._id,
                          );
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Swords
                            className={`h-4 w-4 ${bothDisqualified ? "text-red-500" : isTie ? "text-purple-500" : "text-orange-500"}`}
                          />
                          <span className="font-semibold text-white">
                            {challenge.challengerName || "Player 1"} vs{" "}
                            {challenge.challengedName || "Player 2"}
                          </span>
                          {/* Status Badge */}
                          {isCompleted && !isTie && !bothDisqualified && (
                            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Winner: {challenge.winnerName}
                            </span>
                          )}
                          {isTie && !bothDisqualified && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-medium flex items-center gap-1">
                              <Slash className="h-3 w-3" />
                              Tie
                            </span>
                          )}
                          {bothDisqualified && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium flex items-center gap-1">
                              <Ban className="h-3 w-3" />
                              Both Disqualified
                            </span>
                          )}
                          {challenge.status === "declined" && (
                            <span className="px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 text-xs font-medium">
                              Declined
                            </span>
                          )}
                          {challenge.status === "expired" && (
                            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(
                              challenge.endTime || challenge.createdAt,
                            ).toLocaleDateString()}
                          </span>
                          <span>
                            {creditSymbol}
                            {challenge.entryFee} entry (each)
                          </span>
                          <span>{challenge.duration} min</span>
                        </div>
                      </div>

                      {/* Prize Pool */}
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-300">
                          Prize: {creditSymbol}{" "}
                          {challenge.prizePool?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs text-gray-500">
                          ≈ {currencySymbol}
                          {creditsToEUR(
                            challenge.prizePool || 0,
                            conversionRate,
                          ).toFixed(2)}
                        </div>
                      </div>

                      {/* Platform Fee */}
                      <div className="text-right min-w-[140px]">
                        {isCompleted ? (
                          <>
                            <div className="text-sm font-semibold text-yellow-400">
                              Platform: +{creditSymbol}{" "}
                              {challenge.platformFeeAmount?.toLocaleString() ||
                                0}
                            </div>
                            {bothDisqualified &&
                              challenge.unclaimedPool > 0 && (
                                <div className="text-xs text-orange-400">
                                  +{creditSymbol}{" "}
                                  {challenge.unclaimedPool?.toLocaleString()}{" "}
                                  unclaimed
                                </div>
                              )}
                          </>
                        ) : (
                          <div className="text-sm font-semibold text-gray-500">
                            No fees (not completed)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div
                      className={`border-t p-4 space-y-4 ${
                        bothDisqualified
                          ? "border-red-500/30 bg-red-900/10"
                          : isTie
                            ? "border-purple-500/30 bg-purple-900/10"
                            : "border-gray-700 bg-gray-900/30"
                      }`}
                    >
                      {/* Financial Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">
                            Total Entry Fees
                          </div>
                          <div className="text-lg font-bold text-white">
                            {creditSymbol}{" "}
                            {((challenge.entryFee || 0) * 2).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">
                            Winner Prize
                          </div>
                          <div className="text-lg font-bold text-green-400">
                            {creditSymbol}{" "}
                            {challenge.winnerPrize?.toLocaleString() || 0}
                          </div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">
                            Platform Earned
                          </div>
                          <div className="text-lg font-bold text-yellow-400">
                            {creditSymbol}{" "}
                            {challenge.platformFeeAmount?.toLocaleString() || 0}
                          </div>
                        </div>
                        {challenge.unclaimedPool > 0 && (
                          <div className="bg-orange-900/20 rounded-lg p-3 border border-orange-500/30">
                            <div className="text-xs text-orange-400">
                              Unclaimed Pool
                            </div>
                            <div className="text-lg font-bold text-orange-400">
                              {creditSymbol}{" "}
                              {challenge.unclaimedPool?.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Player Stats */}
                      {isCompleted && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Challenger */}
                          <div
                            className={`rounded-lg p-4 ${
                              challenge.winnerId ===
                              challenge.challengerStats?.toString()
                                ? "bg-green-900/20 border border-green-500/30"
                                : challenge.challengerStats?.isDisqualified
                                  ? "bg-red-900/20 border border-red-500/30"
                                  : "bg-gray-800/50"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-white">
                                {challenge.challengerName || "Challenger"}
                              </span>
                              {challenge.challengerStats?.isDisqualified && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                                  Disqualified
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Trades:</span>
                                <span className="text-white">
                                  {challenge.challengerStats?.totalTrades || 0}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">P&L:</span>
                                <span
                                  className={
                                    challenge.challengerStats?.totalPnL &&
                                    challenge.challengerStats.totalPnL >= 0
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }
                                >
                                  {challenge.challengerStats?.totalPnL &&
                                  challenge.challengerStats.totalPnL >= 0
                                    ? "+"
                                    : ""}
                                  {creditSymbol}{" "}
                                  {(
                                    challenge.challengerStats?.totalPnL || 0
                                  ).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Challenged */}
                          <div
                            className={`rounded-lg p-4 ${
                              challenge.winnerId ===
                              challenge.challengedStats?.toString()
                                ? "bg-green-900/20 border border-green-500/30"
                                : challenge.challengedStats?.isDisqualified
                                  ? "bg-red-900/20 border border-red-500/30"
                                  : "bg-gray-800/50"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-white">
                                {challenge.challengedName || "Challenged"}
                              </span>
                              {challenge.challengedStats?.isDisqualified && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                                  Disqualified
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Trades:</span>
                                <span className="text-white">
                                  {challenge.challengedStats?.totalTrades || 0}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">P&L:</span>
                                <span
                                  className={
                                    challenge.challengedStats?.totalPnL &&
                                    challenge.challengedStats.totalPnL >= 0
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }
                                >
                                  {challenge.challengedStats?.totalPnL &&
                                  challenge.challengedStats.totalPnL >= 0
                                    ? "+"
                                    : ""}
                                  {creditSymbol}{" "}
                                  {(
                                    challenge.challengedStats?.totalPnL || 0
                                  ).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Both Disqualified Warning */}
                      {bothDisqualified && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            Both Players Disqualified
                          </div>
                          <p className="text-gray-300">
                            Neither player met the minimum trade requirements.
                            The prize pool of{" "}
                            <strong>
                              {creditSymbol}{" "}
                              {challenge.unclaimedPool?.toLocaleString()}
                            </strong>{" "}
                            was added to the platform&rsquo;s unclaimed pool.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {challenges.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Swords className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No completed or processed challenges yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
