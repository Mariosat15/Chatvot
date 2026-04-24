import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { getChargebackById } from "../../../../../../../lib/services/security/chargeback-case.service";
import { buildDefensePacket } from "../../../../../../../lib/services/security/chargeback-evidence.service";
import {
  buildMarkdownReport,
  buildRebuttalLetter,
} from "../../../../../../../lib/services/security/chargeback-evidence.markdown";

/** GET — defense packet for copy / download. format=md (default) | json */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const format =
      (req.nextUrl.searchParams.get("format") || "md").toLowerCase() === "json"
        ? "json"
        : "md";

    const c = await getChargebackById(id);
    if (!c) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const cbFacts = {
      id: String(c._id),
      provider: c.provider,
      providerTransactionId: c.providerTransactionId,
      chargebackCaseId: c.chargebackCaseId,
      reasonCode: c.reasonCode,
      amount: c.amount,
      currency: c.currency,
      receivedAt: c.receivedAt,
    };

    // Reason: prefer the frozen snapshot (the exact packet we sent to the
    // acquirer). If absent, build a live preview so admins can download
    // BEFORE initiating.
    let snapshot = c.evidenceSnapshot;
    let rebuttal = c.narrative;

    if (!snapshot || !rebuttal) {
      const built = await buildDefensePacket({
        userId: c.userId,
        walletTransactionId: c.walletTransactionId,
        chargeback: cbFacts,
      });
      snapshot = snapshot || built.snapshot;
      rebuttal = rebuttal || built.rebuttalLetter;
    }

    if (format === "json") {
      return NextResponse.json({
        case: c,
        snapshot,
        rebuttal,
      });
    }

    const rebuttalLetter =
      rebuttal ||
      buildRebuttalLetter(cbFacts, snapshot as Record<string, unknown>);
    const md = buildMarkdownReport(
      cbFacts,
      snapshot as Record<string, unknown>,
      rebuttalLetter,
    );

    const filename = `chargeback-${c.chargebackCaseId || String(c._id)}.md`;
    return new NextResponse(md, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("❌ [chargebacks] report failed:", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
