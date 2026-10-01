import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import TermsAcceptance from "@/database/models/terms-acceptance.model";
import SitePage from "@/database/models/site-page.model";
import { GM_AFFILIATION_TERMS_SLUG } from "@/lib/services/gamemaster/gm-terms-rules";
import {
  recordGmTermsAcceptance,
  toGmConsentSource,
} from "@/lib/services/gamemaster/gm-terms.service";

/**
 * GET /api/terms-acceptance?slug=terms-credit-purchase
 * Checks whether the authenticated user has already accepted a specific terms page.
 * Used by ActionTermsDialog when showEveryTime=false to skip the popup.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Missing slug query parameter" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Reason: We only need to know if at least one acceptance exists.
    // findOne + select is the cheapest possible check.
    const existing = await TermsAcceptance.findOne({
      userId: session.user.id,
      termsSlug: slug,
    })
      .select("_id acceptedAt")
      .lean();

    return NextResponse.json({
      success: true,
      hasAccepted: !!existing,
      acceptedAt: existing?.acceptedAt || null,
    });
  } catch (error) {
    console.error("❌ Error checking terms acceptance:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

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

    // Extract IP and user agent for audit trail
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "";
    const userAgent = request.headers.get("user-agent") || "";

    // Reason: Gamemaster terms are consent to ONE Game Master under ONE wording (`24` s5.2),
    // so they go through the service that fails closed and returns the id the join needs.
    // The generic path below records even a missing page, which is right for a pop-up
    // warning and wrong for consent.
    if (slug === GM_AFFILIATION_TERMS_SLUG) {
      const gameMasterId = body?.context?.gameMasterId;
      if (typeof gameMasterId !== "string" || gameMasterId.trim() === "") {
        return NextResponse.json(
          { success: false, error: "Missing Game Master" },
          { status: 400 },
        );
      }
      const competitionId = body?.context?.competitionId;
      const result = await recordGmTermsAcceptance({
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        },
        gameMasterId,
        competitionId: typeof competitionId === "string" ? competitionId : undefined,
        affiliationSource: toGmConsentSource(body?.context?.affiliationSource),
        ipAddress,
        userAgent,
      });
      if (!result.success) {
        const status =
          result.code === "invalid_input" ? 400
          : result.code === "gm_not_found" ? 404
          : result.code === "terms_unavailable" ? 409
          : 500;
        return NextResponse.json(
          { success: false, code: result.code, error: result.error },
          { status },
        );
      }
      return NextResponse.json({
        success: true,
        acceptanceId: result.acceptanceId,
        termsVersion: result.termsVersion,
      });
    }

    await connectToDatabase();

    // Look up the terms page to record the title and version date
    const termsPage = await SitePage.findOne({
      slug,
      category: "action_terms",
      isActive: true,
    })
      .select("title updatedAt version")
      .lean();

    // Reason: Even if the page is not found in DB (edge case), we still
    // record the acceptance with the slug — the audit trail matters more.
    const termsTitle = termsPage?.title || slug;
    const termsUpdatedAt = termsPage?.updatedAt || undefined;
    const termsVersion =
      typeof termsPage?.version === "string" && termsPage.version ? termsPage.version : undefined;

    const acceptance = await TermsAcceptance.create({
      userId: session.user.id,
      termsSlug: slug,
      termsTitle,
      termsUpdatedAt,
      ...(termsVersion ? { termsVersion } : {}),
      ipAddress,
      userAgent,
      acceptedAt: new Date(),
    });

    return NextResponse.json({ success: true, acceptanceId: String(acceptance._id) });
  } catch (error) {
    console.error("❌ Error recording terms acceptance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record terms acceptance" },
      { status: 500 },
    );
  }
}
