import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SiteVisit from "@/database/models/site-visit.model";

/**
 * GET /api/visitors — Comprehensive visitor analytics
 * Supports filtering by date range, page category, country, device, bot status
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const pageCategory = searchParams.get("pageCategory");
    const country = searchParams.get("country");
    const device = searchParams.get("device");
    const botsOnly = searchParams.get("botsOnly") === "true";
    const suspiciousOnly = searchParams.get("suspiciousOnly") === "true";
    const groupBy = searchParams.get("groupBy") || "day";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match: Record<string, any> = {};
    if (dateFrom || dateTo) {
      match.visitedAt = {};
      if (dateFrom) match.visitedAt.$gte = new Date(dateFrom);
      if (dateTo) match.visitedAt.$lte = new Date(dateTo);
    }
    if (pageCategory && pageCategory !== "all") match.pageCategory = pageCategory;
    if (country) match.country = country;
    if (device && device !== "all") match.device = device;
    if (botsOnly) match.isBot = true;
    if (suspiciousOnly) match.isSuspicious = true;

    const [
      overview,
      visitsByTime,
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      topCountries,
      topReferrers,
      topPages,
      topSearchQueries,
      botStats,
      recentVisits,
    ] = await Promise.all([
      // Overview
      SiteVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$visitorId" },
            totalBots: { $sum: { $cond: ["$isBot", 1, 0] } },
            totalSuspicious: { $sum: { $cond: ["$isSuspicious", 1, 0] } },
            totalBlocked: { $sum: { $cond: ["$isBlocked", 1, 0] } },
            avgDuration: { $avg: "$duration" },
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
            avgDuration: { $round: ["$avgDuration", 1] },
          },
        },
      ]),

      // Visits over time
      SiteVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: getGroupByExpr(groupBy),
            visits: { $sum: 1 },
            unique: { $addToSet: "$visitorId" },
            bots: { $sum: { $cond: ["$isBot", 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            visits: 1,
            unique: { $size: "$unique" },
            bots: 1,
          },
        },
        { $sort: { date: 1 } },
        { $limit: 90 },
      ]),

      // Device breakdown
      SiteVisit.aggregate([
        { $match: { ...match, isBot: { $ne: true } } },
        { $group: { _id: "$device", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Browser breakdown
      SiteVisit.aggregate([
        { $match: { ...match, isBot: { $ne: true } } },
        { $group: { _id: "$browser", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // OS breakdown
      SiteVisit.aggregate([
        { $match: { ...match, isBot: { $ne: true } } },
        { $group: { _id: "$os", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // Top countries
      SiteVisit.aggregate([
        { $match: { ...match, country: { $ne: "" } } },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),

      // Top referrers
      SiteVisit.aggregate([
        { $match: { ...match, referrer: { $ne: "" }, isBot: { $ne: true } } },
        { $group: { _id: "$referrer", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // Top pages
      SiteVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$path",
            visits: { $sum: 1 },
            unique: { $addToSet: "$visitorId" },
            category: { $first: "$pageCategory" },
          },
        },
        {
          $project: {
            _id: 0,
            path: "$_id",
            visits: 1,
            unique: { $size: "$unique" },
            category: 1,
          },
        },
        { $sort: { visits: -1 } },
        { $limit: 50 },
      ]),

      // Top search queries
      SiteVisit.aggregate([
        { $match: { ...match, searchQuery: { $ne: "" } } },
        { $group: { _id: "$searchQuery", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // Bot statistics
      SiteVisit.aggregate([
        { $match: { ...match, isBot: true } },
        { $group: { _id: "$botName", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // Recent visits (last 100)
      SiteVisit.find(match)
        .sort({ visitedAt: -1 })
        .limit(100)
        .select("path pageCategory ip country device browser os isBot botName isSuspicious suspiciousReason visitedAt referrer searchQuery visitorId")
        .lean(),
    ]);

    return NextResponse.json({
      overview: overview[0] || {
        totalVisits: 0,
        uniqueVisitors: 0,
        totalBots: 0,
        totalSuspicious: 0,
        totalBlocked: 0,
        avgDuration: 0,
      },
      visitsByTime,
      deviceBreakdown: deviceBreakdown.map((d: { _id: string; count: number }) => ({
        device: d._id || "unknown",
        count: d.count,
      })),
      browserBreakdown: browserBreakdown.map((d: { _id: string; count: number }) => ({
        browser: d._id || "Unknown",
        count: d.count,
      })),
      osBreakdown: osBreakdown.map((d: { _id: string; count: number }) => ({
        os: d._id || "Unknown",
        count: d.count,
      })),
      topCountries: topCountries.map((d: { _id: string; count: number }) => ({
        country: d._id,
        count: d.count,
      })),
      topReferrers: topReferrers.map((d: { _id: string; count: number }) => ({
        referrer: d._id,
        count: d.count,
      })),
      topPages,
      topSearchQueries: topSearchQueries.map((d: { _id: string; count: number }) => ({
        query: d._id,
        count: d.count,
      })),
      botStats: botStats.map((d: { _id: string; count: number }) => ({
        botName: d._id || "Unknown Bot",
        count: d.count,
      })),
      recentVisits,
    });
  } catch (error) {
    console.error("❌ Error fetching visitor analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

function getGroupByExpr(groupBy: string) {
  switch (groupBy) {
    case "hour":
      return { $dateToString: { format: "%Y-%m-%d %H:00", date: "$visitedAt" } };
    case "week":
      return { $dateToString: { format: "%Y-W%V", date: "$visitedAt" } };
    case "month":
      return { $dateToString: { format: "%Y-%m", date: "$visitedAt" } };
    default:
      return { $dateToString: { format: "%Y-%m-%d", date: "$visitedAt" } };
  }
}
