import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SiteVisit from "@/database/models/site-visit.model";

/**
 * GET /api/visitors/live — Live visitor data (last 5 minutes + last 24h stats)
 * Lightweight endpoint for real-time dashboard polling
 */
export async function GET() {
  try {
    await connectToDatabase();

    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60_000);

    const [liveVisitors, hourlyStats, dailyStats, recentActivity] =
      await Promise.all([
        // Active visitors in last 5 minutes
        SiteVisit.aggregate([
          { $match: { visitedAt: { $gte: fiveMinAgo }, isBot: { $ne: true } } },
          {
            $group: {
              _id: "$visitorId",
              lastPath: { $last: "$path" },
              lastCategory: { $last: "$pageCategory" },
              country: { $last: "$country" },
              device: { $last: "$device" },
              browser: { $last: "$browser" },
              lastSeen: { $max: "$visitedAt" },
              pageViews: { $sum: 1 },
            },
          },
          { $sort: { lastSeen: -1 } },
          { $limit: 50 },
        ]),

        // Last hour stats (by 5-min intervals)
        SiteVisit.aggregate([
          { $match: { visitedAt: { $gte: oneHourAgo } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M",
                  date: {
                    $dateTrunc: {
                      date: "$visitedAt",
                      unit: "minute",
                      binSize: 5,
                    },
                  },
                },
              },
              visits: { $sum: 1 },
              unique: { $addToSet: "$visitorId" },
              bots: { $sum: { $cond: ["$isBot", 1, 0] } },
            },
          },
          {
            $project: {
              _id: 0,
              time: "$_id",
              visits: 1,
              unique: { $size: "$unique" },
              bots: 1,
            },
          },
          { $sort: { time: 1 } },
        ]),

        // 24h overview
        SiteVisit.aggregate([
          { $match: { visitedAt: { $gte: twentyFourHoursAgo } } },
          {
            $group: {
              _id: null,
              totalVisits: { $sum: 1 },
              uniqueVisitors: { $addToSet: "$visitorId" },
              totalBots: { $sum: { $cond: ["$isBot", 1, 0] } },
              totalSuspicious: {
                $sum: { $cond: ["$isSuspicious", 1, 0] },
              },
              totalBlocked: { $sum: { $cond: ["$isBlocked", 1, 0] } },
            },
          },
          {
            $project: {
              _id: 0,
              totalVisits: 1,
              uniqueVisitors: { $size: "$uniqueVisitors" },
              totalBots: 1,
              totalSuspicious: 1,
              totalBlocked: 1,
            },
          },
        ]),

        // Most recent 20 visits (for live feed)
        SiteVisit.find({ visitedAt: { $gte: fiveMinAgo } })
          .sort({ visitedAt: -1 })
          .limit(20)
          .select(
            "path pageCategory ip country device browser os isBot botName isSuspicious visitedAt visitorId",
          )
          .lean(),
      ]);

    return NextResponse.json({
      activeCount: liveVisitors.length,
      liveVisitors,
      hourlyStats,
      dailyStats: dailyStats[0] || {
        totalVisits: 0,
        uniqueVisitors: 0,
        totalBots: 0,
        totalSuspicious: 0,
        totalBlocked: 0,
      },
      recentActivity,
    });
  } catch (error) {
    console.error("❌ Error fetching live visitors:", error);
    return NextResponse.json(
      { error: "Failed to fetch live data" },
      { status: 500 },
    );
  }
}
