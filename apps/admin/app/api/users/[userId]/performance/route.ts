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
import { verifyAdminAuth } from "@/lib/admin/auth";

/**
 * GET /api/users/[userId]/performance
 *
 * Returns the SAME trading-performance metrics the customer sees on their
 * dashboard "Performance" rings, so an admin can review any client's numbers:
 * Win Rate, Net ROI (wallet: prizes vs entry fees), Trade ROI (trading PnL vs
 * starting capital), Profit Factor, Average Win/Loss, Best/Worst trade.
 *
 * Reason: uses the shared trading-metrics helpers + the financial-summary
 * service so admin and customer can never disagree on the same user's stats.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const [tradeAgg, capAgg, challengeCapAgg, financialSummary] =
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
