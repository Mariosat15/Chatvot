import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";
import { DEFAULT_ACTION_TERMS } from "@/lib/constants/default-pages";

/**
 * GET /api/action-terms/:slug — Public endpoint to fetch action terms by slug.
 * No auth required — terms must be visible to any user about to perform an action.
 * Only returns pages with category "action_terms" and isActive = true.
 *
 * Reason: Falls back to hardcoded defaults if the DB page doesn't exist yet
 * (e.g., seed hasn't run after a fresh deploy). This ensures the terms dialog
 * is never blocked by missing DB data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // Try DB first
    let page = null;
    try {
      await connectToDatabase();
      page = await SitePage.findOne({
        slug,
        category: "action_terms",
        isActive: true,
      }).lean();
    } catch (dbError) {
      console.warn("⚠️ [action-terms] DB lookup failed, will try fallback:", dbError);
    }

    // Reason: Fall back to hardcoded defaults if the DB page doesn't exist.
    // This covers the gap between deploy and first seed run.
    if (!page) {
      const fallback = DEFAULT_ACTION_TERMS.find((p) => p.slug === slug);
      if (fallback) {
        return NextResponse.json({
          success: true,
          terms: {
            slug: fallback.slug,
            title: fallback.title,
            subtitle: fallback.subtitle,
            sections: fallback.sections,
            updatedAt: new Date().toISOString(),
          },
        });
      }

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
    console.error("❌ Error fetching action terms:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
