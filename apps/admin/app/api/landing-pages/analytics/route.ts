import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import LandingPageVisit from "@/database/models/landing-page-visit.model";
import LandingPage from "@/database/models/landing-page.model";
import mongoose from "mongoose";

/**
 * GET /api/landing-pages/analytics — Get analytics data for landing pages
 * Supports filtering by date range, trackingId, campaign, source
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const trackingId = searchParams.get("trackingId");
    const landingPageId = searchParams.get("landingPageId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const groupBy = searchParams.get("groupBy") || "day"; // day, week, month

    // Build match filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match: Record<string, any> = {};
    if (trackingId) match.trackingId = trackingId;
    if (landingPageId) {
      match.landingPageId = new mongoose.Types.ObjectId(landingPageId);
    }
    if (dateFrom || dateTo) {
      match.enteredAt = {};
      if (dateFrom) match.enteredAt.$gte = new Date(dateFrom);
      if (dateTo) match.enteredAt.$lte = new Date(dateTo);
    }

    // Run aggregation pipelines in parallel
    const [
      overview,
      visitsByTime,
      deviceBreakdown,
      topCountries,
      topReferrers,
      conversionData,
      recentVisits,
    ] = await Promise.all([
      // Overview summary
      LandingPageVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$visitorId" },
            totalConversions: {
              $sum: { $cond: ["$converted", 1, 0] },
            },
            avgDuration: { $avg: "$duration" },
          },
        },
        {
          $project: {
            _id: 0,
            totalVisits: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
            totalConversions: 1,
            avgDuration: { $round: ["$avgDuration", 1] },
          },
        },
      ]),

      // Visits over time (grouped by day/week/month)
      LandingPageVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: getGroupByExpression(groupBy),
            visits: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$visitorId" },
            conversions: { $sum: { $cond: ["$converted", 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            visits: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
            conversions: 1,
          },
        },
        { $sort: { date: 1 } },
        { $limit: 90 },
      ]),

      // Device breakdown
      LandingPageVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$device",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Top countries
      LandingPageVisit.aggregate([
        { $match: { ...match, country: { $ne: "" } } },
        {
          $group: {
            _id: "$country",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // Top referrers
      LandingPageVisit.aggregate([
        { $match: { ...match, referrer: { $ne: "" } } },
        {
          $group: {
            _id: "$referrer",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // Conversion data per page
      LandingPageVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$trackingId",
            visits: { $sum: 1 },
            conversions: { $sum: { $cond: ["$converted", 1, 0] } },
          },
        },
        {
          $project: {
            trackingId: "$_id",
            visits: 1,
            conversions: 1,
            conversionRate: {
              $cond: [
                { $gt: ["$visits", 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: ["$conversions", "$visits"] }, 100] },
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { visits: -1 } },
        { $limit: 50 },
      ]),

      // Recent visits (for the table)
      LandingPageVisit.find(match)
        .sort({ enteredAt: -1 })
        .limit(100)
        .lean(),
    ]);

    // Get landing page names for trackingIds in conversion data
    const trackingIds = conversionData.map(
      (d: { trackingId: string }) => d.trackingId,
    );
    const landingPages = await LandingPage.find(
      { trackingId: { $in: trackingIds } },
      { trackingId: 1, name: 1, campaign: 1, source: 1 },
    ).lean();

    // Build a map for quick lookup
    const pageMap = new Map(
      landingPages.map((p) => [
        p.trackingId,
        { name: p.name, campaign: p.campaign, source: p.source },
      ]),
    );

    // Enrich conversion data with page names
    const enrichedConversionData = conversionData.map(
      (d: { trackingId: string; visits: number; conversions: number; conversionRate: number }) => ({
        ...d,
        pageName: pageMap.get(d.trackingId)?.name || "Unknown",
        campaign: pageMap.get(d.trackingId)?.campaign || "",
        source: pageMap.get(d.trackingId)?.source || "",
      }),
    );

    return NextResponse.json({
      overview: overview[0] || {
        totalVisits: 0,
        uniqueVisitors: 0,
        totalConversions: 0,
        avgDuration: 0,
      },
      visitsByTime,
      deviceBreakdown: deviceBreakdown.map(
        (d: { _id: string; count: number }) => ({
          device: d._id || "unknown",
          count: d.count,
        }),
      ),
      topCountries: topCountries.map(
        (d: { _id: string; count: number }) => ({
          country: d._id,
          count: d.count,
        }),
      ),
      topReferrers: topReferrers.map(
        (d: { _id: string; count: number }) => ({
          referrer: d._id,
          count: d.count,
        }),
      ),
      conversionData: enrichedConversionData,
      recentVisits,
    });
  } catch (error) {
    console.error("❌ Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}

/**
 * Build the $group _id expression based on groupBy parameter
 */
function getGroupByExpression(groupBy: string) {
  switch (groupBy) {
    case "week":
      return {
        $dateToString: { format: "%Y-W%V", date: "$enteredAt" },
      };
    case "month":
      return {
        $dateToString: { format: "%Y-%m", date: "$enteredAt" },
      };
    case "day":
    default:
      return {
        $dateToString: { format: "%Y-%m-%d", date: "$enteredAt" },
      };
  }
}
