import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import TradeHistory from "@/database/models/trading/trade-history.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import { getUserFinancialSummary } from "@/lib/services/user-financial-summary.service";
import {
  computeProfitFactor,
  computeWinRate,
} from "@/lib/services/trading-metrics";
import { guardSection } from "@/lib/admin/section-route-guard";
import { getPlayerGamePerformance } from "@/lib/services/games/player-game-performance.service";

/**
 * GET /api/users/[userId]/performance
 *
 * TWO BLOCKS, EACH LABELLED, and the second one is why this file changed on 10 September 2026.
 *
 * `performance` is the trading block, unchanged character for character: Win Rate, Net ROI
 * (wallet: prizes vs entry fees), Trade ROI (trading PnL vs starting capital), Profit Factor,
 * Average Win/Loss, Best/Worst trade - the same figures the customer sees on their dashboard
 * rings, computed through the shared trading-metrics helpers and the financial-summary service
 * so admin and customer can never disagree about one user.
 *
 * `games` is every provider game the player has actually played. It was added because the
 * trading block was the WHOLE answer: an operator opening a player who only plays games was
 * told "This client has no closed trades yet", with every round, score and prize invisible.
 * `05` s10 forbids exactly that - no performance figure may silently mean "trading only".
 *
 * The two are returned as separate keys rather than merged, deliberately. A win rate and a best
 * lap time are not two values of one metric, and a merged shape would need a common denominator
 * that does not exist - which is how a trading-shaped aggregate gets built by accident.
 *
 * GRANT: `users`, the section that owns the calling screen. It authenticated with
 * `verifyAdminAuth` until 10 September 2026, which asks whether the caller is an admin at all
 * and not whether they hold the grant - so an employee granted one unrelated section could read
 * any client's full financial performance. That is the tenth instance of that class here, after
 * Prerequisite A, the internal-secret fallbacks, the suspicion-score route, the provider admin
 * routes, the contest-edit route, R40's seven lifecycle routes, R47's sync-referrals, R51's five
 * AI routes and R57's image optimizer. It is found by counting handlers against guards, never by
 * reading routes - every neighbour having something is what carries a reader past the one that
 * has the wrong thing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing user id" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // TradeHistory is the SINGLE SOURCE OF TRUTH for trade stats (matches the
    // customer dashboard, profile and leaderboard).
    const [tradeAgg, capAgg, challengeCapAgg, financialSummary, games] =
      await Promise.all([
        TradeHistory.aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: null,
              totalTrades: { $sum: 1 },
              winningTrades: {
                $sum: { $cond: [{ $gt: ["$realizedPnl", 0] }, 1, 0] },
              },
              // Reason: only genuine losses (PnL < 0); breakeven excluded.
              losingTrades: {
                $sum: { $cond: [{ $lt: ["$realizedPnl", 0] }, 1, 0] },
              },
              totalPnL: { $sum: "$realizedPnl" },
              grossWins: {
                $sum: {
                  $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0],
                },
              },
              grossLosses: {
                $sum: {
                  $cond: [
                    { $lt: ["$realizedPnl", 0] },
                    { $abs: "$realizedPnl" },
                    0,
                  ],
                },
              },
              largestWin: {
                $max: {
                  $cond: [{ $gt: ["$realizedPnl", 0] }, "$realizedPnl", 0],
                },
              },
              largestLoss: {
                $min: {
                  $cond: [{ $lt: ["$realizedPnl", 0] }, "$realizedPnl", 0],
                },
              },
            },
          },
        ]),
        CompetitionParticipant.aggregate([
          { $match: { userId } },
          { $group: { _id: null, capital: { $sum: "$startingCapital" } } },
        ]),
        ChallengeParticipant.aggregate([
          { $match: { userId } },
          { $group: { _id: null, capital: { $sum: "$startingCapital" } } },
        ]),
        getUserFinancialSummary(userId),
        getPlayerGamePerformance(userId),
      ]);

    const stats = tradeAgg[0] || {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      grossWins: 0,
      grossLosses: 0,
      largestWin: 0,
      largestLoss: 0,
    };

    // Trade ROI denominator = total virtual starting capital across all
    // contests (competitions + challenges), matching the customer dashboard.
    const totalStartingCapital =
      (capAgg[0]?.capital || 0) + (challengeCapAgg[0]?.capital || 0);

    const winRate = computeWinRate(stats.winningTrades, stats.losingTrades);
    const profitFactor = computeProfitFactor(stats.grossWins, stats.grossLosses);
    const averageWin =
      stats.winningTrades > 0 ? stats.grossWins / stats.winningTrades : 0;
    const averageLoss =
      stats.losingTrades > 0 ? stats.grossLosses / stats.losingTrades : 0;
    const tradeRoi =
      totalStartingCapital > 0
        ? (stats.totalPnL / totalStartingCapital) * 100
        : 0;

    return NextResponse.json({
      success: true,
      performance: {
        totalTrades: stats.totalTrades,
        winningTrades: stats.winningTrades,
        losingTrades: stats.losingTrades,
        winRate,
        // Net ROI = wallet money return (prizes won vs entry fees), excludes
        // marketplace / GM / admin adjustments.
        netRoi: financialSummary.roi,
        // Trade ROI = trading performance (PnL vs starting capital).
        tradeRoi,
        profitFactor,
        averageWin,
        averageLoss,
        largestWin: stats.largestWin || 0,
        largestLoss: stats.largestLoss || 0,
        totalPnL: stats.totalPnL,
        totalPrizesWon: financialSummary.totalPrizesWon,
      },
      games,
    });
  } catch (error) {
    console.error("❌ Error fetching user performance:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please contact support.",
      },
      { status: 500 },
    );
  }
}
