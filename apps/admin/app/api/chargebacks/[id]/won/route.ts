import { NextRequest, NextResponse } from "next/server";
import { guardAnySection } from "@/lib/admin/section-route-guard";
import { markWon } from "../../../../../../../lib/services/security/chargeback-case.service";
import { logChargebackAction } from "../../_audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardAnySection(["financial", "users"]);
    if (!guard.ok) return guard.response;
    const session = guard.admin;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const c = await markWon(
      id,
      { id: session.id, name: session.name, email: session.email },
      { notes: typeof body?.notes === "string" ? body.notes : undefined },
    );
    await logChargebackAction(
      session,
      "chargeback_won",
      id,
      `Chargeback resolved in platform favor (won)`,
      { userId: String(c.userId) },
    );
    return NextResponse.json({ case: c });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    console.error("❌ [chargebacks] mark won failed:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
