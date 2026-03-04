import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import LandingPageVisit from "@/database/models/landing-page-visit.model";
import LandingPage from "@/database/models/landing-page.model";

/**
 * POST /api/lp/track — Record a landing page visit.
 * Called by the client-side tracker when a user visits a landing page.
 * Non-blocking, best-effort tracking — failures return 200 to not affect UX.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { trackingId, referrer, userAgent, screenWidth } = body;

    if (!trackingId) {
      return NextResponse.json({ ok: true }); // Silent fail for invalid requests
    }

    // Find the landing page
    const page = await LandingPage.findOne({ trackingId }).lean();
    if (!page) {
      return NextResponse.json({ ok: true });
    }

    // Parse device type from screen width
    let device: "desktop" | "mobile" | "tablet" | "unknown" = "unknown";
    if (screenWidth) {
      if (screenWidth < 768) device = "mobile";
      else if (screenWidth < 1024) device = "tablet";
      else device = "desktop";
    }

    // Parse browser from user agent (basic parsing)
    let browser = "";
    let os = "";
    if (userAgent) {
      if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
      else if (userAgent.includes("Firefox")) browser = "Firefox";
      else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
      else if (userAgent.includes("Edg")) browser = "Edge";
      else browser = "Other";

      if (userAgent.includes("Windows")) os = "Windows";
      else if (userAgent.includes("Mac")) os = "macOS";
      else if (userAgent.includes("Linux")) os = "Linux";
      else if (userAgent.includes("Android")) os = "Android";
      else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";
    }

    // Get IP from headers (best-effort)
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : req.headers.get("x-real-ip") || "";

    // Generate a simple visitor ID from IP + UA (for unique visitor counting)
    const visitorId = `${ip}-${(userAgent || "").slice(0, 50)}`;

    // Create visit record
    await LandingPageVisit.create({
      landingPageId: page._id,
      trackingId,
      visitorId,
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      ip,
      userAgent: (userAgent || "").slice(0, 500), // Limit UA string length
      referrer: (referrer || "").slice(0, 500),
      device,
      browser,
      os,
      utmSource: body.utmSource || "",
      utmMedium: body.utmMedium || "",
      utmCampaign: body.utmCampaign || "",
      utmTerm: body.utmTerm || "",
      utmContent: body.utmContent || "",
      enteredAt: new Date(),
    });

    // Increment unique visitors if this is a new visitor
    const existingVisitor = await LandingPageVisit.countDocuments({
      trackingId,
      visitorId,
    });
    if (existingVisitor <= 1) {
      await LandingPage.updateOne(
        { _id: page._id },
        { $inc: { uniqueVisitors: 1 } },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Reason: Tracking should never break the user experience
    console.error("⚠️ [LP Track] Error recording visit:", error);
    return NextResponse.json({ ok: true });
  }
}
