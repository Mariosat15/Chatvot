"use client";

import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  getRankingConfig,
  type RankingMethod,
} from "@/lib/utils/ranking-utils";

// Reason: these three were `any`. Typed to exactly the fields the card reads, which is the
// only mechanical guard against a provider branch quietly reaching for a trading field - the
// narrow provider type below caught an unguarded `currentRank > 0` the moment it was added.
interface CardCompetition {
  _id: string;
  name: string;
  description?: string;
  endTime: string | Date;
  rules?: { rankingMethod?: RankingMethod };
  gameMasterId?: string | null;
  gameMasterName?: string | null;
  gameType?: string;
  prizePool?: number;
  prizePoolCredits?: number;
  currentParticipants?: number;
}

interface CardParticipation {
  currentRank?: number;
  currentCapital: number;
  startingCapital: number;
  pnl: number;
  pnlPercentage: number;
  realizedPnl: number;
  unrealizedPnl: number;
  maxDrawdownPercentage: number;
  usedMargin: number;
  winRate: number;
  totalTrades: number;
  // Reason: undefined and 0 are different facts - no round has reported yet, versus the
  // player genuinely scored nothing. Only the provider branch reads it.
  score?: number | null;
}

interface CardTrade {
  symbol: string;
  side: string;
  realizedPnl?: number;
  pnl?: number;
}

interface ActiveCompetitionCardProps {
  competition: CardCompetition;
  participation: CardParticipation;
  openPositionsCount: number;
  recentTrades: CardTrade[];
  participantStats?: {
    active: number;
    liquidated: number;
    completed: number;
    disqualified: number;
    total: number;
  };
}

export default function ActiveCompetitionCard({
  competition,
  participation,
  openPositionsCount,
  recentTrades,
  participantStats,
}: ActiveCompetitionCardProps) {
  // Reason: everything below this point is trading. Capital, P&L, ROI, margin, open
  // positions, win rate and the recent-trades feed have no meaning in a puzzle or a time
  // trial, and the card's call to action opens the forex workspace. A provider contest
  // therefore gets its own compact card rather than a guard on each of the nine blocks -
  // the same branch-not-guards shape as the contest lobby.
  //
  // Reason for `gameType` rather than the stricter `isProviderContest`: this is a display
  // decision, and a provider contest missing its catalogue keys still has no P&L to show.
  // The Play link is the part that needs the strict question, and the play route asks it.
  if (competition?.gameType === "provider") {
    return (
      <ProviderActiveCompetitionCard
        competition={competition}
        participation={participation}
        participantStats={participantStats}
      />
    );
  }

  const isProfitable = participation.pnl >= 0;
  const capitalPercentage =
    (participation.currentCapital / participation.startingCapital) * 100;
  const isAtRisk = capitalPercentage < 60;

  // Reason: Use competition's ranking method to show the correct metric label
  const rankingMethod: RankingMethod =
    competition?.rules?.rankingMethod || "pnl";
  const rankingConfig = getRankingConfig(rankingMethod);

  const timeRemaining = new Date(competition.endTime).getTime() - Date.now();
  const hoursRemaining = Math.max(
    0,
    Math.floor(timeRemaining / (1000 * 60 * 60)),
  );
  const daysRemaining = Math.floor(hoursRemaining / 24);

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden hover:border-yellow-500/70 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/20 hover:scale-[1.02]">
      {/* Header with Gradient */}
      <div className="relative bg-gradient-to-r from-yellow-500/20 via-yellow-500/10 to-transparent p-6 border-b border-gray-700/50">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex-1">
              <Link
                href={`/competitions/${competition._id}/trade`}
                className="text-2xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent hover:from-yellow-500 hover:to-yellow-400 transition-all duration-300 inline-block"
              >
                {competition.name}
              </Link>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <p className="text-sm text-gray-400 line-clamp-1 flex-1">
                  {competition.description}
                </p>
                {/* Ranking Method Badge */}
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                  🏆 {rankingConfig.label}
                </span>
                {/* Creator Badge */}
                <span
                  className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    competition.gameMasterId
                      ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                      : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                  }`}
                >
                  {competition.gameMasterId ? "🎮" : "🛡️"}{" "}
                  {competition.gameMasterId
                    ? `GM: ${competition.gameMasterName || "Game Master"}`
                    : "Admin"}
                </span>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 backdrop-blur-sm rounded-full border border-yellow-500/30 shadow-lg shadow-yellow-500/10">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <div className="text-center">
                  <p className="text-xs text-yellow-400/80">Rank</p>
                  <p className="text-lg font-bold text-yellow-500">
                    #{participation.currentRank || "—"}
                  </p>
                </div>
              </div>
              {isAtRisk && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 backdrop-blur-sm rounded-full border border-red-500/30 animate-pulse">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-bold text-red-500">
                    At Risk
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Time Remaining with Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">
                {daysRemaining > 0
                  ? `${daysRemaining} days ${hoursRemaining % 24}h remaining`
                  : `${hoursRemaining}h remaining`}
              </span>
            </div>
            {participantStats && (
              <div className="flex items-center gap-2 text-xs text-gray-500 sm:ml-auto">
                <Users className="h-3 w-3" />
                <span>
                  {participantStats.active}/{participantStats.total} Active
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid - Responsive */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Capital */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-blue-500/50 transition-colors">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 block" />
            <span>Current Capital</span>
          </div>
          <p className="text-xl font-bold text-gray-100 mb-3">
            {formatCurrency(participation.currentCapital)}
          </p>
          <div className="mt-2">
            <Progress value={capitalPercentage} className="h-2" />
            <p className="text-xs text-gray-500 mt-2">
              {capitalPercentage.toFixed(1)}% of starting capital
            </p>
          </div>
        </div>

        {/* P&L */}
        <div
          className={`rounded-xl p-4 border transition-colors ${
            isProfitable
              ? "bg-green-500/10 border-green-500/30 hover:border-green-500/50"
              : "bg-red-500/10 border-red-500/30 hover:border-red-500/50"
          }`}
        >
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full block ${isProfitable ? "bg-green-500" : "bg-red-500"}`}
            />
            <span>Total P&L</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            {isProfitable ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <p
              className={`text-xl font-bold ${
                isProfitable ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatCurrency(participation.pnl)}
            </p>
          </div>
          <p
            className={`text-xs font-semibold ${isProfitable ? "text-green-400" : "text-red-400"}`}
          >
            {participation.pnlPercentage >= 0 ? "+" : ""}
            {participation.pnlPercentage.toFixed(2)}% ROI
          </p>
          {/* Reason: Show which metric determines this competition's ranking */}
          {rankingMethod !== "pnl" && rankingMethod !== "roi" && (
            <p className="text-[10px] text-yellow-400/70 mt-0.5">
              Ranked by: {rankingConfig.label}
            </p>
          )}
        </div>

        {/* Positions */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-purple-500/50 transition-colors">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 block" />
            <span>Open Positions</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5 text-purple-500" />
            <p className="text-xl font-bold text-gray-100">
              {openPositionsCount}
            </p>
          </div>
          <p className="text-xs text-gray-500">
            {formatCurrency(participation.usedMargin)} margin
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-yellow-500/50 transition-colors">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 block" />
            <span>Win Rate</span>
          </div>
          <p className="text-xl font-bold text-yellow-500 mb-1">
            {participation.winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500">
            {participation.totalTrades} total trades
          </p>
        </div>
      </div>

      {/* Performance Metrics - Responsive Grid */}
      <div className="px-6 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-gray-700/50 pt-4">
        <div className="bg-gray-900/30 rounded-lg p-3 text-center border border-gray-700/30">
          <p className="text-xs text-gray-400 mb-1">Realized P&L</p>
          <p
            className={`text-base font-bold ${
              participation.realizedPnl >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {formatCurrency(participation.realizedPnl)}
          </p>
        </div>
        <div className="bg-gray-900/30 rounded-lg p-3 text-center border border-gray-700/30">
          <p className="text-xs text-gray-400 mb-1">Unrealized P&L</p>
          <p
            className={`text-base font-bold ${
              participation.unrealizedPnl >= 0
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {formatCurrency(participation.unrealizedPnl)}
          </p>
        </div>
        <div className="bg-gray-900/30 rounded-lg p-3 text-center border border-gray-700/30 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400 mb-1">Max Drawdown</p>
          <p className="text-base font-bold text-red-500">
            {participation.maxDrawdownPercentage.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Recent Trades - No Scrollbar Visible */}
      {recentTrades.length > 0 && (
        <div className="px-6 pb-4 border-t border-gray-700/50 pt-4">
          <div className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 block" />
            <span>Recent Trades</span>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
            {recentTrades.slice(0, 5).map((trade: CardTrade, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between text-xs bg-gray-900/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-200">
                    {trade.symbol}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      trade.side === "long"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {trade.side.toUpperCase()}
                  </span>
                </div>
                <span
                  className={`font-bold ${
                    (trade.realizedPnl || trade.pnl || 0) >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {formatCurrency(trade.realizedPnl || trade.pnl || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="p-4 bg-gradient-to-r from-gray-900/80 to-gray-900/50 border-t border-gray-700/50">
        <Link
          href={`/competitions/${competition._id}/trade`}
          className="block w-full py-3 px-6 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-gray-900 font-bold rounded-xl text-center transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-500/50"
        >
          <span className="flex items-center justify-center gap-2">
            Trade Now
            <TrendingUp className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * The same card for a contest played through a game provider.
 *
 * It shows the four facts that exist for every game - rank, score, prize pool and time
 * left - and nothing that only exists for trading. There is deliberately no capital bar,
 * no ROI and no recent-trades feed, because a provider game reports one number.
 *
 * The call to action sends the player to the contest page rather than straight to
 * `/play`. Reason: launching a round CONSUMES AN ATTEMPT, and a paid attempt must never be
 * one hover away - Next.js prefetches `<Link>` targets, so a direct link to a route that
 * launches would spend a player's only attempt without them clicking. The play screen
 * itself is a state machine for exactly this reason; the contest page is the safe landing.
 */
function ProviderActiveCompetitionCard({
  competition,
  participation,
  participantStats,
}: {
  // Reason: narrowed to the fields a provider contest genuinely has, so this card cannot
  // start reading a trading field without failing to compile. `Pick` rather than a fresh
  // shape, so it stays assignable from what the outer component is handed.
  competition: Pick<
    CardCompetition,
    | "_id"
    | "name"
    | "description"
    | "endTime"
    | "prizePool"
    | "prizePoolCredits"
    | "currentParticipants"
  >;
  participation: Pick<CardParticipation, "score" | "currentRank">;
  participantStats?: { active: number; total: number };
}) {
  const timeRemaining = new Date(competition.endTime).getTime() - Date.now();
  const hoursRemaining = Math.max(
    0,
    Math.floor(timeRemaining / (1000 * 60 * 60)),
  );
  const daysRemaining = Math.floor(hoursRemaining / 24);

  // Reason: undefined and 0 are different facts - no round has reported yet, versus the
  // player genuinely scored nothing. The first must not render as a score of zero.
  const hasScore =
    participation?.score !== undefined && participation?.score !== null;

  return (
    <div className="bg-gradient-to-br from-gray-800 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden hover:border-yellow-500/70 transition-all duration-300">
      <div className="relative bg-gradient-to-r from-yellow-500/20 via-yellow-500/10 to-transparent p-6 border-b border-gray-700/50">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <Link
              href={`/competitions/${competition._id}`}
              className="text-2xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent hover:from-yellow-500 hover:to-yellow-400 transition-all duration-300 inline-block"
            >
              {competition.name}
            </Link>
            <p className="text-sm text-gray-400 line-clamp-1 mt-1.5">
              {competition.description}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(participation?.currentRank ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                <Trophy className="h-3.5 w-3.5" />
                Rank #{participation.currentRank}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
              <Target className="h-3.5 w-3.5" />
              Game
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-xs text-gray-400 mb-2">Your score</div>
          <p className="text-xl font-bold text-gray-100">
            {hasScore ? Number(participation.score).toLocaleString() : "–"}
          </p>
          {!hasScore && (
            <p className="text-[11px] text-gray-500 mt-1">No round yet</p>
          )}
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-xs text-gray-400 mb-2">Prize pool</div>
          <p className="text-xl font-bold text-gray-100">
            {formatCurrency(
              competition.prizePool || competition.prizePoolCredits || 0,
            )}
          </p>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>Players</span>
          </div>
          <p className="text-xl font-bold text-gray-100">
            {participantStats?.active ??
              competition.currentParticipants ??
              0}
          </p>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Time left</span>
          </div>
          <p className="text-xl font-bold text-gray-100">
            {timeRemaining <= 0
              ? "Ended"
              : daysRemaining > 0
                ? `${daysRemaining}d`
                : `${hoursRemaining}h`}
          </p>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-gray-900/80 to-gray-900/50 border-t border-gray-700/50">
        <Link
          href={`/competitions/${competition._id}`}
          className="block w-full py-3 px-6 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-gray-900 font-bold rounded-xl text-center transition-all duration-300"
        >
          <span className="flex items-center justify-center gap-2">
            View contest
            <Target className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
