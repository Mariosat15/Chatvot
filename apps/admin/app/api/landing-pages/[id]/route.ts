import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import LandingPage from "@/database/models/landing-page.model";

/**
 * GET /api/landing-pages/[id] — Get a single landing page by ID
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const page = await LandingPage.findById(id).lean();
    if (!page) {
      return NextResponse.json(
        { error: "Landing page not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ page });
  } catch (error) {
    console.error("❌ Error fetching landing page:", error);
    return NextResponse.json(
      { error: "Failed to fetch landing page" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/landing-pages/[id] — Update a landing page
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json();

    // Only allow updating specific fields
    const allowedFields = [
      "name",
      "sections",
      "campaign",
      "source",
      "assignedTo",
      "isActive",
      "showRiskDisclaimer",
      "seoTitle",
      "seoDescription",
    ];

    const bodyMap = new Map(Object.entries(body));
    const updateMap = new Map<string, unknown>();
    for (const field of allowedFields) {
      if (bodyMap.has(field)) {
        updateMap.set(field, bodyMap.get(field));
      }
    }

    const page = await LandingPage.findByIdAndUpdate(
      id,
      { $set: Object.fromEntries(updateMap) },
      { new: true },
    ).lean();

    if (!page) {
      return NextResponse.json(
        { error: "Landing page not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, page });
  } catch (error) {
    console.error("❌ Error updating landing page:", error);
    return NextResponse.json(
      { error: "Failed to update landing page" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/landing-pages/[id] — Soft-delete a landing page (set isActive=false)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const page = await LandingPage.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    ).lean();

    if (!page) {
      return NextResponse.json(
        { error: "Landing page not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Landing page deactivated" });
  } catch (error) {
    console.error("❌ Error deleting landing page:", error);
    return NextResponse.json(
      { error: "Failed to delete landing page" },
      { status: 500 },
    );
  }
}
