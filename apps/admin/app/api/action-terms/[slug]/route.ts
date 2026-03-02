import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";

/**
 * GET /api/action-terms/:slug — Admin-local proxy for fetching action terms.
 * Reason: The UserFullDetailPanel "View Terms" button needs to fetch terms.
 * If NEXT_PUBLIC_APP_URL is empty, the fetch would hit the admin app's own
 * routes, so we need a local copy that reads from the shared DB.
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
        updatedAt: page.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ [Admin] Error fetching action terms:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
