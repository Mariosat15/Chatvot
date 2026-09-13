import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { updateNarrative } from "../../../../../../../lib/services/security/chargeback-case.service";
import { logChargebackAction } from "../../_audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (typeof body?.narrative !== "string") {
      return NextResponse.json(
        { error: "narrative is required" },
        { status: 400 },
      );
    }
    const c = await updateNarrative(
      id,
      { id: session.id, name: session.name, email: session.email },
      body.narrative,
    );
    await logChargebackAction(
      session,
      "chargeback_narrative_updated",
      id,
      `Updated chargeback rebuttal narrative`,
      { userId: String(c.userId), narrativeLength: body.narrative.length },
    );
    return NextResponse.json({ case: c });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    console.error("❌ [chargebacks] narrative update failed:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
