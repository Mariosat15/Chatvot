import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SiteVisit from "@/database/models/site-visit.model";

/**
 * GET /api/visitors/live — Live visitor data with enhanced metrics.
 * Provides: active visitors, hourly sparkline, 24h overview,
 * top active countries, top active pages, and recent activity feed.
 */
export async function GET() {
  try {
    await connectToDatabase();

    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60_000);

    const [
      liveVisitors,
      hourlyStats,
      dailyStats,
      recentActivity,
      topActiveCountries,
      topActivePages,
    ] = await Promise.all([
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

      // Most recent 30 visits (for live feed)
      SiteVisit.find({ visitedAt: { $gte: fiveMinAgo } })
        .sort({ visitedAt: -1 })
        .limit(30)
        .select(
          "path pageCategory ip country city device browser os isBot botName " +
          "isSuspicious visitedAt visitorId duration scrollDepth trafficSource " +
          "isNewVisitor language screenResolution utmSource utmMedium utmCampaign",
        )
        .lean(),

      // Top active countries (last 5 min)
      SiteVisit.aggregate([
        {
          $match: {
            visitedAt: { $gte: fiveMinAgo },
            isBot: { $ne: true },
            country: { $ne: "" },
          },
        },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Top active pages (last 5 min)
      SiteVisit.aggregate([
        {
          $match: {
            visitedAt: { $gte: fiveMinAgo },
            isBot: { $ne: true },
          },
        },
        { $group: { _id: "$path", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
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
      topActiveCountries: topActiveCountries.map(
        (d: { _id: string; count: number }) => ({
          country: d._id,
          count: d.count,
          percentage: 0,
        }),
      ),
      topActivePages: topActivePages.map(
        (d: { _id: string; count: number }) => ({
          path: d._id,
          count: d.count,
        }),
      ),
    });
  } catch (error) {
    console.error("❌ Error fetching live visitors:", error);
    return NextResponse.json(
      { error: "Failed to fetch live data" },
      { status: 500 },
    );
  }
}
