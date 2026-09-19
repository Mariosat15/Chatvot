import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { getUserRestrictions } from "@/lib/services/user-restriction.service";
import { toReviewPacket } from "@/lib/services/account-review.service";

/**
 * GET /api/user/restrictions
 *
 * Returns the authenticated user's active restrictions. Each entry includes
 * the legacy shape (type/reason/canTrade/…) consumed by older clients AND
 * an enriched `review` packet (caseId, ETA, documents, blocked actions,
 * privacy-safe reason label) used by the new /account/review page.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restrictions = await getUserRestrictions(session.user.id);

    return NextResponse.json({
      success: true,
      restrictions: restrictions.map((r) => ({
        // Legacy fields (kept for backward compatibility)
        type: r.restrictionType,
        reason: r.reason,
        customReason: r.customReason,
        expiresAt: r.expiresAt,
        canTrade: r.canTrade,
        canEnterCompetitions: r.canEnterCompetitions,
        canDeposit: r.canDeposit,
        canWithdraw: r.canWithdraw,
        // New enriched review packet
        review: toReviewPacket(r),
      })),
    });
  } catch (error) {
    console.error("❌ [Restrictions API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch restrictions" },
      { status: 500 },
    );
  }
}
