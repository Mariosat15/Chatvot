import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import TermsAcceptance from "@/database/models/terms-acceptance.model";
import SitePage from "@/database/models/site-page.model";

/**
 * POST /api/terms-acceptance
 * Records that the authenticated user accepted a specific action terms page.
 * Called by ActionTermsDialog on acceptance.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { slug } = body;

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid slug" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Look up the terms page to record the title and version date
    const termsPage = await SitePage.findOne({
      slug,
      category: "action_terms",
      isActive: true,
    })
      .select("title updatedAt")
      .lean();

    // Reason: Even if the page is not found in DB (edge case), we still
    // record the acceptance with the slug — the audit trail matters more.
    const termsTitle = termsPage?.title || slug;
    const termsUpdatedAt = termsPage?.updatedAt || undefined;

    // Extract IP and user agent for audit trail
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "";
    const userAgent = request.headers.get("user-agent") || "";

    await TermsAcceptance.create({
      userId: session.user.id,
      termsSlug: slug,
      termsTitle,
      termsUpdatedAt,
      ipAddress,
      userAgent,
      acceptedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error recording terms acceptance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record terms acceptance" },
      { status: 500 },
    );
  }
}
