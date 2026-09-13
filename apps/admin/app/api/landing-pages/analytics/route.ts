import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import LandingPageVisit from "@/database/models/landing-page-visit.model";
import LandingPage from "@/database/models/landing-page.model";
import mongoose from "mongoose";

/**
 * GET /api/landing-pages/analytics — Comprehensive LP analytics
 * Supports filtering by date range, trackingId, landingPageId, campaign, source
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const trackingId = searchParams.get("trackingId");
    const landingPageId = searchParams.get("landingPageId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const groupBy = searchParams.get("groupBy") || "day";

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

    const [
      overview,
      visitsByTime,
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      topCountries,
      topCities,
      topReferrers,
      utmSourceBreakdown,
      utmMediumBreakdown,
      utmCampaignBreakdown,
      conversionData,
      recentVisits,
    ] = await Promise.all([
      // ─── Overview with bounce & conversion rate ─────────────────
      LandingPageVisit.aggregate([
        { $match: match },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalVisits: { $sum: 1 },
                  uniqueVisitors: { $addToSet: "$visitorId" },
                  totalConversions: {
                    $sum: { $cond: ["$converted", 1, 0] },
                  },
                  avgDuration: { $avg: "$duration" },
                  bounced: {
                    $sum: {
                      $cond: [
                        { $or: [{ $eq: ["$exitPath", null] }, { $lt: ["$duration", 5] }] },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      ]),

      // ─── Visits over time with conversions ──────────────────────
      LandingPageVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: getGroupByExpression(groupBy),
            visits: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$visitorId" },
            conversions: { $sum: { $cond: ["$converted", 1, 0] } },
            avgDuration: { $avg: "$duration" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            visits: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
            conversions: 1,
            avgDuration: { $round: ["$avgDuration", 1] },
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
        { $sort: { date: 1 } },
        { $limit: 90 },
      ]),

      // ─── Device breakdown ───────────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: match },
        { $group: { _id: "$device", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // ─── Browser breakdown ──────────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: { ...match, browser: { $ne: "" } } },
        { $group: { _id: "$browser", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── OS breakdown ───────────────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: { ...match, os: { $ne: "" } } },
        { $group: { _id: "$os", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── Top countries ──────────────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: { ...match, country: { $ne: "" } } },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // ─── Top cities ─────────────────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: { ...match, city: { $ne: "" } } },
        {
          $group: {
            _id: { city: "$city", country: "$country" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── Top referrers ──────────────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: { ...match, referrer: { $ne: "" } } },
        { $group: { _id: "$referrer", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      // ─── UTM Source breakdown ───────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: { ...match, utmSource: { $ne: "" } } },
        { $group: { _id: "$utmSource", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── UTM Medium breakdown ──────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: { ...match, utmMedium: { $ne: "" } } },
        { $group: { _id: "$utmMedium", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // ─── UTM Campaign breakdown ────────────────────────────────
      LandingPageVisit.aggregate([
        { $match: { ...match, utmCampaign: { $ne: "" } } },
        {
          $group: {
            _id: {
              campaign: "$utmCampaign",
              source: "$utmSource",
              medium: "$utmMedium",
            },
            visits: { $sum: 1 },
            conversions: { $sum: { $cond: ["$converted", 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            campaign: "$_id.campaign",
            source: "$_id.source",
            medium: "$_id.medium",
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
        { $limit: 20 },
      ]),

      // ─── Conversion data per page ──────────────────────────────
      LandingPageVisit.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$trackingId",
            visits: { $sum: 1 },
            conversions: { $sum: { $cond: ["$converted", 1, 0] } },
            avgDuration: { $avg: "$duration" },
          },
        },
        {
          $project: {
            trackingId: "$_id",
            visits: 1,
            conversions: 1,
            avgDuration: { $round: ["$avgDuration", 1] },
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

      // ─── Recent visits ──────────────────────────────────────────
      LandingPageVisit.find(match)
        .sort({ enteredAt: -1 })
        .limit(100)
        .select(
          "trackingId visitorId ip country city device browser os referrer " +
          "enteredAt exitPath duration converted utmSource utmMedium utmCampaign",
        )
        .lean(),
    ]);

    // ─── Process overview ────────────────────────────────────────
    const totals = overview[0]?.totals?.[0] || {};
    const totalVisits = totals.totalVisits || 0;
    const uniqueCount = totals.uniqueVisitors?.length || 0;
    const totalConversions = totals.totalConversions || 0;
    const bounced = totals.bounced || 0;

    const processedOverview = {
      totalVisits,
      uniqueVisitors: uniqueCount,
      totalConversions,
      conversionRate:
        totalVisits > 0
          ? Math.round((totalConversions / totalVisits) * 1000) / 10
          : 0,
      avgDuration: Math.round((totals.avgDuration || 0) * 10) / 10,
      bounceRate:
        totalVisits > 0
          ? Math.round((bounced / totalVisits) * 1000) / 10
          : 0,
    };

    // ─── Enrich conversion data with page names ──────────────────
    const trackingIds = conversionData.map(
      (d: { trackingId: string }) => d.trackingId,
    );
    const landingPages = await LandingPage.find(
      { trackingId: { $in: trackingIds } },
      { trackingId: 1, name: 1, campaign: 1, source: 1 },
    ).lean();

    const pageMap = new Map(
      landingPages.map((p) => [
        p.trackingId,
        { name: p.name, campaign: p.campaign, source: p.source },
      ]),
    );

    const enrichedConversionData = conversionData.map(
      (d: {
        trackingId: string;
        visits: number;
        conversions: number;
        conversionRate: number;
        avgDuration: number;
      }) => ({
        ...d,
        pageName: pageMap.get(d.trackingId)?.name || "Unknown",
        campaign: pageMap.get(d.trackingId)?.campaign || "",
        source: pageMap.get(d.trackingId)?.source || "",
      }),
    );

    // ─── Add percentages to breakdowns ───────────────────────────
    const addPct = <T extends { count: number }>(arr: T[]) => {
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
      topReferrers: topReferrers.map(
        (d: { _id: string; count: number }) => ({
          referrer: d._id,
          count: d.count,
        }),
      ),
      utmSourceBreakdown: utmSourceBreakdown.map(
        (d: { _id: string; count: number }) => ({
          source: d._id,
          count: d.count,
        }),
      ),
      utmMediumBreakdown: utmMediumBreakdown.map(
        (d: { _id: string; count: number }) => ({
          medium: d._id,
          count: d.count,
        }),
      ),
      utmCampaignBreakdown,
      conversionData: enrichedConversionData,
      recentVisits,
    });
  } catch (error) {
    console.error("❌ Error fetching LP analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}

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
