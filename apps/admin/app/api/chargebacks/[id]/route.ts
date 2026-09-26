import { NextRequest, NextResponse } from "next/server";
import { guardAnySection } from "@/lib/admin/section-route-guard";
import { getChargebackById } from "../../../../../../lib/services/security/chargeback-case.service";
import { buildDefensePacket } from "../../../../../../lib/services/security/chargeback-evidence.service";

/** GET — single case + live defense packet render (snapshot preferred). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardAnySection(["financial", "users"]);
    if (!guard.ok) return guard.response;
    const session = guard.admin;
    const { id } = await params;
    const c = await getChargebackById(id);
    if (!c) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Reason: pre-initiate cases have no frozen snapshot yet. Render a live
    // preview so the admin can see the defense packet before clicking
    // Initiate. Frozen snapshots on initiated/terminal cases are returned
    // as-is and NOT recomputed.
    let packet:
      | Awaited<ReturnType<typeof buildDefensePacket>>
      | { snapshot: unknown; markdown: string; rebuttalLetter: string }
      | null = null;

    if (c.evidenceSnapshot && c.narrative) {
      packet = {
        snapshot: c.evidenceSnapshot,
        rebuttalLetter: c.narrative,
        markdown: "", // rebuilt client-side on demand via /report
      };
    } else {
      try {
        packet = await buildDefensePacket({
          userId: c.userId,
          walletTransactionId: c.walletTransactionId,
          chargeback: {
            id: String(c._id),
            provider: c.provider,
            providerTransactionId: c.providerTransactionId,
            chargebackCaseId: c.chargebackCaseId,
            reasonCode: c.reasonCode,
            amount: c.amount,
            currency: c.currency,
            receivedAt: c.receivedAt,
          },
        });
      } catch (err) {
        console.warn(
          "⚠️ [chargebacks] buildDefensePacket failed during GET:",
          err,
        );
        packet = null;
      }
    }

    return NextResponse.json({ case: c, packet });
  } catch (err) {
    console.error("❌ [chargebacks] get failed:", err);
    return NextResponse.json(
      { error: "Failed to load chargeback" },
      { status: 500 },
    );
  }
}
