import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import LandingPageTemplate from "@/database/models/landing-page-template.model";

/**
 * GET /api/landing-pages/templates — List all landing page templates
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";
    const activeOnly = searchParams.get("activeOnly") !== "false";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (activeOnly) filter.isActive = true;
    if (category) filter.category = category;

    const templates = await LandingPageTemplate.find(filter)
      .sort({ category: 1, name: 1 })
      .lean();

    // Get distinct categories for filter dropdown
    const categories = await LandingPageTemplate.distinct("category", {
      isActive: true,
    });

    return NextResponse.json({
      templates,
      categories: categories.filter(Boolean),
    });
  } catch (error) {
    console.error("❌ Error listing templates:", error);
    return NextResponse.json(
      { error: "Failed to list templates" },
      { status: 500 },
    );
  }
}
