import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import LandingPage from "@/database/models/landing-page.model";
import LandingPageTemplate from "@/database/models/landing-page-template.model";
import { randomBytes } from "crypto";

/**
 * Generate a unique tracking ID (8 chars, URL-safe).
 * Reason: Short enough for marketing URLs, random enough to avoid collisions.
 */
function generateTrackingId(): string {
  return randomBytes(4).toString("hex"); // 8 hex chars
}

/**
 * GET /api/landing-pages — List all landing pages with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const search = searchParams.get("search") || "";
    const campaign = searchParams.get("campaign") || "";
    const source = searchParams.get("source") || "";
    const isActive = searchParams.get("isActive");

    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { trackingId: { $regex: search, $options: "i" } },
        { assignedTo: { $regex: search, $options: "i" } },
      ];
    }
    if (campaign) filter.campaign = campaign;
    if (source) filter.source = source;
    if (isActive !== null && isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const [pages, total] = await Promise.all([
      LandingPage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LandingPage.countDocuments(filter),
    ]);

    // Get distinct values for filters
    const [campaigns, sources] = await Promise.all([
      LandingPage.distinct("campaign"),
      LandingPage.distinct("source"),
    ]);

    return NextResponse.json({
      pages,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      filters: {
        campaigns: campaigns.filter(Boolean),
        sources: sources.filter(Boolean),
      },
    });
  } catch (error) {
    console.error("❌ Error listing landing pages:", error);
    return NextResponse.json(
      { error: "Failed to list landing pages" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/landing-pages — Create a new landing page from template or scratch
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const { name, templateSlug, campaign, source, assignedTo } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Landing page name is required" },
        { status: 400 },
      );
    }

    // Generate unique tracking ID
    let trackingId = generateTrackingId();
    let exists = await LandingPage.findOne({ trackingId }).lean();
    let attempts = 0;
    while (exists && attempts < 10) {
      trackingId = generateTrackingId();
      exists = await LandingPage.findOne({ trackingId }).lean();
      attempts++;
    }

    // Get template sections if creating from template
    let sections = body.sections || [];
    if (templateSlug && sections.length === 0) {
      const template = await LandingPageTemplate.findOne({
        slug: templateSlug,
      }).lean();
      if (template) {
        sections = template.sections;
      }
    }

    const landingPage = await LandingPage.create({
      name,
      trackingId,
      templateSlug: templateSlug || null,
      sections,
      campaign: campaign || "",
      source: source || "",
      assignedTo: assignedTo || "",
      showRiskDisclaimer: true,
      isActive: true,
      seoTitle: body.seoTitle || name,
      seoDescription: body.seoDescription || "",
      customCss: body.customCss || "",
    });

    return NextResponse.json({
      success: true,
      page: landingPage.toObject(),
      trackingUrl: `/lp/${trackingId}`,
    });
  } catch (error) {
    console.error("❌ Error creating landing page:", error);
    return NextResponse.json(
      { error: "Failed to create landing page" },
      { status: 500 },
    );
  }
}
