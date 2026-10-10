import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";

/**
 * GET /api/pages/:slug — Public endpoint to fetch a single site page by slug.
 * No auth required — these are public pages (terms, privacy, etc.).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    await connectToDatabase();

    const page = await SitePage.findOne({ slug, isActive: true }).lean();

    if (!page) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, page });
  } catch (error) {
    console.error("❌ Error fetching site page:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
