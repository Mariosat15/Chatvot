import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { getChargebackById } from "../../../../../../../lib/services/security/chargeback-case.service";
import { buildDefensePacket } from "../../../../../../../lib/services/security/chargeback-evidence.service";
import {
  buildMarkdownReport,
  buildRebuttalLetter,
} from "../../../../../../../lib/services/security/chargeback-evidence.markdown";
import {
  buildAINarrative,
  renderNarrativeMarkdown,
  type AINarrativeSections,
} from "../../../../../../../lib/services/security/chargeback-ai-narrative.service";
import { buildDefensePacketDocx } from "../../../../../../../lib/services/security/chargeback-docx.service";

/**
 * GET /api/chargebacks/[id]/report
 *
 * Query params:
 *   format = docx (default) | md | json
 *   ai     = 1 (force fresh AI narrative) | 0 (use stored narrative)
 *
 * DOCX is the primary admin download format: a Word-compatible defense
 * packet with AI-written prose plus raw evidence tables. Markdown and
 * JSON remain available for clipboard / programmatic consumption.
 */
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
    const formatParam =
      (req.nextUrl.searchParams.get("format") || "docx").toLowerCase();
    const format: "docx" | "md" | "json" =
      formatParam === "json"
        ? "json"
        : formatParam === "md"
          ? "md"
          : "docx";
    const forceAI = req.nextUrl.searchParams.get("ai") === "1";

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

    // Reason: prefer the frozen snapshot (the exact evidence we sent).
    // If the case is still pending_review there will be no snapshot yet,
    // so we generate a live preview so admins can review before
    // initiating.
    let snapshot = c.evidenceSnapshot;
    if (!snapshot) {
      const built = await buildDefensePacket({
        userId: c.userId,
        walletTransactionId: c.walletTransactionId,
        chargeback: cbFacts,
      });
      snapshot = built.snapshot;
    }

    if (format === "json") {
      // Reason: JSON consumers (programmatic integrations) still want the
      // full structured snapshot + stored narrative. No AI call here —
      // that is an explicit, logged admin action.
      return NextResponse.json({
        case: c,
        snapshot,
        rebuttal: c.narrative,
      });
    }

    // For md and docx we need a narrative. Decision tree:
    //   1. If `?ai=1`  → always regenerate (transient, NOT saved).
    //   2. Else if `c.narrative` exists → use it.
    //   3. Else → regenerate once (transient, NOT saved).
    let narrativeSections: AINarrativeSections | null = null;
    let narrativeMarkdown: string;
    let source: "ai" | "fallback" = "fallback";

    if (forceAI || !c.narrative) {
      const ai = await buildAINarrative(cbFacts, snapshot);
      narrativeSections = ai.sections;
      narrativeMarkdown = renderNarrativeMarkdown(cbFacts, ai.sections);
      source = ai.source;
    } else {
      narrativeMarkdown = c.narrative;
    }

    if (format === "md") {
      // If the stored narrative is already a full AI-rendered markdown,
      // download it as-is. Otherwise fall through to the legacy template
      // renderer so admins on older cases still get a consistent packet.
      const looksFullReport =
        /^#\s+Chargeback Defense/m.test(narrativeMarkdown);
      const md = looksFullReport
        ? narrativeMarkdown
        : buildMarkdownReport(
            cbFacts,
            snapshot as Record<string, unknown>,
            narrativeMarkdown ||
              buildRebuttalLetter(
                cbFacts,
                snapshot as Record<string, unknown>,
              ),
          );
      const filename = `chargeback-${c.chargebackCaseId || String(c._id)}.md`;
      return new NextResponse(md, {
        status: 200,
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // DOCX — always needs structured sections.
    if (!narrativeSections) {
      // Reason: we have a stored narrative markdown but no section split.
      // Run the AI once more to get structured sections for the DOCX. If
      // the AI is disabled this still returns the fallback sections.
      const ai = await buildAINarrative(cbFacts, snapshot);
      narrativeSections = ai.sections;
      source = ai.source;
    }

    const docxBuffer = await buildDefensePacketDocx({
      cb: cbFacts,
      snapshot,
      narrative: narrativeSections,
      source,
    });

    const filename = `chargeback-${c.chargebackCaseId || String(c._id)}.docx`;
    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
