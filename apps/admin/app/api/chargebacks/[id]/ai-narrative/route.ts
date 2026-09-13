/**
 * POST /api/chargebacks/[id]/ai-narrative
 *
 * Generates (or regenerates) the AI-backed defense narrative for a case.
 * The result is persisted into `Chargeback.narrative` so subsequent
 * downloads (.md / .docx) and the frozen snapshot on `initiate` stay
 * consistent with what the admin reviewed on screen.
 *
 * If the OpenAI integration is disabled or fails, the service returns a
 * deterministic fallback narrative — callers never see a hard error on
 * this path.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import {
  getChargebackById,
  updateNarrative,
} from "../../../../../../../lib/services/security/chargeback-case.service";
import { buildDefensePacket } from "../../../../../../../lib/services/security/chargeback-evidence.service";
import {
  buildAINarrative,
  renderNarrativeMarkdown,
} from "../../../../../../../lib/services/security/chargeback-ai-narrative.service";
import { logChargebackAction } from "../../_audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

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

    // Reason: prefer the frozen snapshot (if the case has been initiated)
    // so the AI writes about the exact evidence that will be sent. If the
    // case is still pending, build a live snapshot.
    let snapshot = c.evidenceSnapshot;
    if (!snapshot) {
      const built = await buildDefensePacket({
        userId: c.userId,
        walletTransactionId: c.walletTransactionId,
        chargeback: cbFacts,
      });
      snapshot = built.snapshot;
    }

    const ai = await buildAINarrative(cbFacts, snapshot);
    const markdown = renderNarrativeMarkdown(cbFacts, ai.sections);

    const updated = await updateNarrative(
      id,
      { id: session.id, name: session.name, email: session.email },
      markdown,
    );

    await logChargebackAction(
      session,
      "chargeback_narrative_updated",
      id,
      `AI-generated chargeback rebuttal (${ai.source})`,
      {
        userId: String(updated.userId),
        source: ai.source,
        model: ai.model,
        inputTokens: ai.usage?.inputTokens ?? 0,
        outputTokens: ai.usage?.outputTokens ?? 0,
      },
    );

    return NextResponse.json({
      case: updated,
      narrative: markdown,
      sections: ai.sections,
      source: ai.source,
      model: ai.model,
      usage: ai.usage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    console.error("❌ [chargebacks] ai-narrative failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
