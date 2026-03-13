import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SiteVisit from "@/database/models/site-visit.model";

/**
 * GET /api/visitors — Comprehensive visitor analytics (Google Analytics-level)
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

    // Exclude bots from human-centric metrics
    const humanMatch = { ...match, isBot: { $ne: true } };

    const [
      overview,
      visitsByTime,
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      topCountries,
      topCities,
      topReferrers,
      topPages,
      topSearchQueries,
      botStats,
      trafficSources,
      utmCampaigns,
      languages,
      resolutions,
      hourlyHeatmap,
      recentVisits,
    ] = await Promise.all([
      // ─── Overview with bounce rate, new/returning, engagement ─────
      SiteVisit.aggregate([
        { $match: match },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalVisits: { $sum: 1 },
                  uniqueVisitors: { $addToSet: "$visitorId" },
                  totalBots: { $sum: { $cond: ["$isBot", 1, 0] } },
                  totalSuspicious: { $sum: { $cond: ["$isSuspicious", 1, 0] } },
                  totalBlocked: { $sum: { $cond: ["$isBlocked", 1, 0] } },
                  avgDuration: { $avg: "$duration" },
                  avgScrollDepth: { $avg: "$scrollDepth" },
                  newVisitors: { $sum: { $cond: ["$isNewVisitor", 1, 0] } },
                },
              },
            ],
            // Reason: Bounce rate = sessions with only 1 page view / total sessions
            sessions: [
              { $match: { isBot: { $ne: true } } },
              {
                $group: {
                  _id: "$sessionId",
                  pageCount: { $sum: 1 },
                },
              },
              {
                $group: {
                  _id: null,
                  totalSessions: { $sum: 1 },
                  bouncedSessions: {
                    $sum: { $cond: [{ $eq: ["$pageCount", 1] }, 1, 0] },
                  },
                  avgPages: { $avg: "$pageCount" },
                },
              },
            ],
          },
        },
      ]),

      // ─── Visits over time with bounce rate ────────────────────────
      SiteVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: getGroupByExpr(groupBy),
            visits: { $sum: 1 },
            unique: { $addToSet: "$visitorId" },
            bots: { $sum: { $cond: ["$isBot", 1, 0] } },
            totalDuration: { $sum: "$duration" },
            humanVisits: { $sum: { $cond: [{ $ne: ["$isBot", true] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            visits: 1,
            unique: { $size: "$unique" },
            bots: 1,
            avgDuration: {
              $cond: [
                { $gt: ["$humanVisits", 0] },
                { $round: [{ $divide: ["$totalDuration", "$humanVisits"] }, 1] },
                0,
              ],
            },
          },
        },
        { $sort: { date: 1 } },
        { $limit: 90 },
      ]),

      // ─── Device breakdown ──────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: humanMatch },
        { $group: { _id: "$device", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // ─── Browser breakdown ─────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: humanMatch },
        { $group: { _id: "$browser", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── OS breakdown ──────────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: humanMatch },
        { $group: { _id: "$os", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── Top countries ─────────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: { ...match, country: { $ne: "" } } },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),

      // ─── Top cities ────────────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: { ...match, city: { $ne: "" } } },
        {
          $group: {
            _id: { city: "$city", country: "$country" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // ─── Top referrers ─────────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: { ...humanMatch, referrer: { $ne: "" } } },
        { $group: { _id: "$referrer", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // ─── Top pages with engagement metrics ─────────────────────────
      SiteVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$path",
            visits: { $sum: 1 },
            unique: { $addToSet: "$visitorId" },
            category: { $first: "$pageCategory" },
            avgDuration: { $avg: "$duration" },
          },
        },
        {
          $project: {
            _id: 0,
            path: "$_id",
            visits: 1,
            unique: { $size: "$unique" },
            category: 1,
            avgDuration: { $round: ["$avgDuration", 1] },
          },
        },
        { $sort: { visits: -1 } },
        { $limit: 50 },
      ]),

      // ─── Top search queries ────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: { ...match, searchQuery: { $ne: "" } } },
        { $group: { _id: "$searchQuery", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // ─── Bot statistics ────────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: { ...match, isBot: true } },
        { $group: { _id: "$botName", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // ─── Traffic sources ───────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: humanMatch },
        { $group: { _id: "$trafficSource", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // ─── UTM campaigns ─────────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: { ...humanMatch, utmCampaign: { $ne: "" } } },
        {
          $group: {
            _id: {
              campaign: "$utmCampaign",
              source: "$utmSource",
              medium: "$utmMedium",
            },
            visits: { $sum: 1 },
            unique: { $addToSet: "$visitorId" },
          },
        },
        {
          $project: {
            _id: 0,
            campaign: "$_id.campaign",
            source: "$_id.source",
            medium: "$_id.medium",
            visits: 1,
            unique: { $size: "$unique" },
          },
        },
        { $sort: { visits: -1 } },
        { $limit: 20 },
      ]),

      // ─── Languages ─────────────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: { ...humanMatch, language: { $ne: "" } } },
        { $group: { _id: "$language", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── Screen resolutions ────────────────────────────────────────
      SiteVisit.aggregate([
        { $match: { ...humanMatch, screenResolution: { $ne: "" } } },
        { $group: { _id: "$screenResolution", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── Hourly heatmap (day of week × hour) ──────────────────────
      SiteVisit.aggregate([
        { $match: humanMatch },
        {
          $group: {
            _id: {
              day: { $dayOfWeek: "$visitedAt" }, // 1=Sun, 7=Sat
              hour: { $hour: "$visitedAt" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            day: { $subtract: ["$_id.day", 1] }, // 0=Sun, 6=Sat
            hour: "$_id.hour",
            count: 1,
          },
        },
      ]),

      // ─── Recent visits (last 200) ─────────────────────────────────
      SiteVisit.find(match)
        .sort({ visitedAt: -1 })
        .limit(200)
        .select(
          "path pageCategory ip country city device browser os isBot botName " +
          "isSuspicious suspiciousReason visitedAt referrer searchQuery visitorId " +
          "duration scrollDepth trafficSource isNewVisitor language screenResolution " +
          "utmSource utmMedium utmCampaign",
        )
        .lean(),
    ]);

    // ─── Process overview ────────────────────────────────────────────
    const totals = overview[0]?.totals?.[0] || {};
    const sessions = overview[0]?.sessions?.[0] || {};
    const totalVisits = totals.totalVisits || 0;
    const uniqueCount = totals.uniqueVisitors?.length || 0;

    const processedOverview = {
      totalVisits,
      uniqueVisitors: uniqueCount,
      totalBots: totals.totalBots || 0,
      totalSuspicious: totals.totalSuspicious || 0,
      totalBlocked: totals.totalBlocked || 0,
      avgDuration: Math.round((totals.avgDuration || 0) * 10) / 10,
      bounceRate: sessions.totalSessions
        ? Math.round((sessions.bouncedSessions / sessions.totalSessions) * 1000) / 10
        : 0,
      avgPagesPerSession: Math.round((sessions.avgPages || 0) * 10) / 10,
      newVisitors: totals.newVisitors || 0,
      returningVisitors: Math.max(0, uniqueCount - (totals.newVisitors || 0)),
      avgScrollDepth: Math.round(totals.avgScrollDepth || 0),
    };

    // ─── Add percentages to breakdowns ───────────────────────────────
    const addPct = <T extends { count: number }>(arr: T[]): (T & { percentage: number })[] => {
      const total = arr.reduce((s, x) => s + x.count, 0);
      return arr.map((x) => ({
        ...x,
        percentage: total > 0 ? Math.round((x.count / total) * 1000) / 10 : 0,
      }));
    };

    return NextResponse.json({
      overview: processedOverview,
      visitsByTime,
      deviceBreakdown: addPct(
        deviceBreakdown.map((d: { _id: string; count: number }) => ({
          device: d._id || "unknown",
          count: d.count,
        })),
      ),
      browserBreakdown: addPct(
        browserBreakdown.map((d: { _id: string; count: number }) => ({
          browser: d._id || "Unknown",
          count: d.count,
        })),
      ),
      osBreakdown: addPct(
        osBreakdown.map((d: { _id: string; count: number }) => ({
          os: d._id || "Unknown",
          count: d.count,
        })),
      ),
      topCountries: addPct(
        topCountries.map((d: { _id: string; count: number }) => ({
          country: d._id,
          count: d.count,
        })),
      ),
      topCities: topCities.map(
        (d: { _id: { city: string; country: string }; count: number }) => ({
          city: d._id.city,
          country: d._id.country,
          count: d.count,
        }),
      ),
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
      trafficSources: addPct(
        trafficSources.map((d: { _id: string; count: number }) => ({
          source: d._id || "direct",
          count: d.count,
        })),
      ),
      utmCampaigns,
      languages: addPct(
        languages.map((d: { _id: string; count: number }) => ({
          language: d._id,
          count: d.count,
        })),
      ),
      resolutions: addPct(
        resolutions.map((d: { _id: string; count: number }) => ({
          resolution: d._id,
          count: d.count,
        })),
      ),
      hourlyHeatmap,
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
