import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";

/**
 * GET /api/action-terms/:slug — Public endpoint to fetch action terms by slug.
 * No auth required — terms must be visible to any user about to perform an action.
 * Only returns pages with category "action_terms" and isActive = true.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    await connectToDatabase();

    const page = await SitePage.findOne({
      slug,
      category: "action_terms",
      isActive: true,
    }).lean();

    if (!page) {
      return NextResponse.json(
        { success: false, error: "Terms not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      terms: {
        slug: page.slug,
        title: page.title,
        subtitle: page.subtitle,
        sections: page.sections,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching action terms:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
