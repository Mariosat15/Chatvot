import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import LandingPageVisit from "@/database/models/landing-page-visit.model";
import LandingPage from "@/database/models/landing-page.model";
import mongoose from "mongoose";

/**
 * GET /api/landing-pages/analytics/export — Export analytics data as CSV
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const trackingId = searchParams.get("trackingId");
    const landingPageId = searchParams.get("landingPageId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

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

    const visits = await LandingPageVisit.find(match)
      .sort({ enteredAt: -1 })
      .limit(10000) // Safety limit
      .lean();

    // Get landing page names
    const trackingIds = [...new Set(visits.map((v) => v.trackingId))];
    const pages = await LandingPage.find(
      { trackingId: { $in: trackingIds } },
      { trackingId: 1, name: 1, campaign: 1, source: 1 },
    ).lean();
    const pageMap = new Map(
      pages.map((p) => [
        p.trackingId,
        { name: p.name, campaign: p.campaign, source: p.source },
      ]),
    );

    // CSV headers
    const headers = [
      "Date",
      "Landing Page",
      "Tracking ID",
      "Campaign",
      "Source",
      "Device",
      "Browser",
      "OS",
      "Country",
      "City",
      "Referrer",
      "Duration (s)",
      "Converted",
      "Exit Path",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign",
    ];

    // CSV rows
    const rows = visits.map((v) => {
      const page = pageMap.get(v.trackingId);
      return [
        new Date(v.enteredAt).toISOString(),
        page?.name || "Unknown",
        v.trackingId,
        page?.campaign || "",
        page?.source || "",
        v.device || "",
        v.browser || "",
        v.os || "",
        v.country || "",
        v.city || "",
        v.referrer || "",
        v.duration || 0,
        v.converted ? "Yes" : "No",
        v.exitPath || "",
        v.utmSource || "",
        v.utmMedium || "",
        v.utmCampaign || "",
      ];
    });

    // Build CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="landing-page-analytics-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("❌ Error exporting analytics:", error);
    return NextResponse.json(
      { error: "Failed to export analytics" },
      { status: 500 },
    );
  }
}
