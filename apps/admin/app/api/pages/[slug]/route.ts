import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";

/**
 * GET /api/pages/:slug — Fetch a single site page by slug (admin).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    await connectToDatabase();

    const page = await SitePage.findOne({ slug }).lean();
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

/**
 * PUT /api/pages/:slug — Update a site page (admin only).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await req.json();

    await connectToDatabase();

    const page = await SitePage.findOne({ slug });
    if (!page) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 },
      );
    }

    // Update allowed fields
    if (body.title !== undefined) page.title = body.title;
    if (body.subtitle !== undefined) page.subtitle = body.subtitle;
    if (body.sections !== undefined) page.sections = body.sections;
    if (body.isActive !== undefined) page.isActive = body.isActive;
    if (body.seoTitle !== undefined) page.seoTitle = body.seoTitle;
    if (body.seoDescription !== undefined)
      page.seoDescription = body.seoDescription;
    if (body.lastUpdatedBy !== undefined)
      page.lastUpdatedBy = body.lastUpdatedBy;

    await page.save();

    return NextResponse.json({
      success: true,
      message: "Page updated successfully",
      page: page.toObject(),
    });
  } catch (error) {
    console.error("❌ Error updating site page:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/pages/:slug — Delete a site page (admin only).
 * System pages (isSystem=true) cannot be deleted.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    await connectToDatabase();

    const page = await SitePage.findOne({ slug });
    if (!page) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 },
      );
    }

    if (page.isSystem) {
      return NextResponse.json(
        {
          success: false,
          error:
            "System pages cannot be deleted. You can deactivate them instead.",
        },
        { status: 403 },
      );
    }

    await SitePage.deleteOne({ slug });

    return NextResponse.json({
      success: true,
      message: `Page "${slug}" deleted successfully`,
    });
  } catch (error) {
    console.error("❌ Error deleting site page:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
