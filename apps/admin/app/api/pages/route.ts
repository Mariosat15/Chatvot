import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";
import { RESERVED_SLUGS } from "@root/lib/constants/default-pages";

/**
 * GET /api/pages — List all site pages (admin only).
 */
export async function GET() {
  try {
    await connectToDatabase();
    const pages = await SitePage.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, pages });
  } catch (error) {
    console.error("❌ Error listing site pages:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/pages — Create a new site page (admin only).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, title, subtitle, sections, seoTitle, seoDescription } = body;

    if (!slug || !title) {
      return NextResponse.json(
        { success: false, error: "Slug and title are required." },
        { status: 400 },
      );
    }

    // Sanitize slug: lowercase, trim, replace spaces with hyphens
    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (!cleanSlug) {
      return NextResponse.json(
        { success: false, error: "Invalid slug. Use only letters, numbers, and hyphens." },
        { status: 400 },
      );
    }

    // Check reserved slugs
    if (RESERVED_SLUGS.has(cleanSlug)) {
      return NextResponse.json(
        {
          success: false,
          error: `The slug "${cleanSlug}" is reserved and cannot be used for a site page.`,
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Check if slug already exists
    const existing = await SitePage.findOne({ slug: cleanSlug });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `A page with slug "${cleanSlug}" already exists.` },
        { status: 409 },
      );
    }

    const page = await SitePage.create({
      slug: cleanSlug,
      title,
      subtitle: subtitle || "",
      sections: sections || [],
      isActive: true,
      isSystem: false,
      seoTitle: seoTitle || title,
      seoDescription: seoDescription || "",
    });

    return NextResponse.json({ success: true, page }, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating site page:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
