import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
// Reason: service lives at repo root to stay shared with the main app.
import { lookupDepositForChargeback } from "../../../../../../lib/services/security/chargeback-lookup.service";

/**
 * GET /api/chargebacks/lookup?providerTransactionId=...&provider=nuvei
 *
 * Returns a preview of the deposit matched to the given PSP transaction ID
 * so the admin UI can pre-fill the "Create chargeback case" form. The only
 * field the admin still has to type is the reason code.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = req.nextUrl.searchParams;
    const providerTransactionId = (
      sp.get("providerTransactionId") || ""
    ).trim();
    const provider = (sp.get("provider") || "").trim() || undefined;

    if (!providerTransactionId) {
      return NextResponse.json(
        { error: "providerTransactionId is required" },
        { status: 400 },
      );
    }

    const preview = await lookupDepositForChargeback(
      providerTransactionId,
      provider,
    );

    return NextResponse.json(preview);
  } catch (err) {
    console.error("❌ [chargebacks] lookup failed:", err);
    return NextResponse.json(
      { error: "Failed to look up deposit" },
      { status: 500 },
    );
  }
}
