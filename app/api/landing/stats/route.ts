import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

/**
 * GET /api/landing/stats
 * Returns real-time platform statistics for the landing page
 * No auth required - public endpoint
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    // Get current time for calculations
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeCompetitions,
      completedAgg,
      activeChallenges,
      completedChallenges,
      totalTrades,
      tradesToday,
      platformFinancials,
    ] = await Promise.all([
      db.collection("user").countDocuments({}),
      db.collection("competitions").countDocuments({ status: "active" }),
      db
        .collection("competitions")
        .aggregate([
          { $match: { status: "completed" } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalPrizePool: { $sum: "$prizePool" },
            },
          },
        ])
        .toArray(),
      db.collection("challenges").countDocuments({
        status: { $in: ["pending", "accepted", "active"] },
      }),
      db.collection("challenges").countDocuments({ status: "completed" }),
      db.collection("positions").countDocuments({}),
      db.collection("positions").countDocuments({
        createdAt: { $gte: today },
      }),
      db.collection("platformfinancials").findOne({ type: "aggregate" }),
    ]);

    const completedCount = completedAgg[0]?.count ?? 0;
    const totalPrizesFromCompetitions = completedAgg[0]?.totalPrizePool ?? 0;

    // Calculate total prizes from platform financials (more accurate)
    const totalPrizesPaid =
      platformFinancials?.totalPrizesPaid || totalPrizesFromCompetitions;

    // Calculate active traders (users who traded in last 30 days)
    const activeTraders = await db
      .collection("positions")
      .aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$userId" } },
        { $count: "count" },
      ])
      .toArray();

    // Get total prize pool for active competitions
    const activePrizePool = await db
      .collection("competitions")
      .aggregate([
        { $match: { status: { $in: ["active", "upcoming"] } } },
        { $group: { _id: null, total: { $sum: "$prizePool" } } },
      ])
      .toArray();

    const stats = {
      // User stats
      totalUsers,
      activeTraders: activeTraders[0]?.count || 0,

      // Competition stats
      activeCompetitions,
      totalCompetitions: completedCount + activeCompetitions,
      activePrizePool: activePrizePool[0]?.total || 0,

      // Challenge stats
      activeChallenges,
      totalChallenges: completedChallenges + activeChallenges,

      // Trading stats
      totalTrades,
      tradesToday,

      // Financial stats
      totalPrizesPaid: Math.round(totalPrizesPaid),

      // Formatted display values
      formatted: {
        totalUsers: formatNumber(totalUsers),
        activeTraders: formatNumber(activeTraders[0]?.count || 0),
        activeCompetitions: activeCompetitions.toString(),
        totalCompetitions: formatNumber(
          completedCount + activeCompetitions,
        ),
        activePrizePool: formatCurrency(activePrizePool[0]?.total || 0),
        totalPrizesPaid: formatCurrency(totalPrizesPaid),
        totalTrades: formatNumber(totalTrades),
        tradesToday: formatNumber(tradesToday),
      },

      // Last updated timestamp
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Error fetching landing stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}

// Helper functions
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return "$" + (amount / 1000000).toFixed(1) + "M";
  }
  if (amount >= 1000) {
    return "$" + (amount / 1000).toFixed(0) + "K";
  }
  return "$" + amount.toLocaleString();
}
