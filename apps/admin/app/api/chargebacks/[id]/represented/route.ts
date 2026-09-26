import { NextRequest, NextResponse } from "next/server";
import { guardAnySection } from "@/lib/admin/section-route-guard";
import { markRepresented } from "../../../../../../../lib/services/security/chargeback-case.service";
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
    const body = await safeJson(req);
    const c = await markRepresented(
      id,
      { id: session.id, name: session.name, email: session.email },
      { notes: typeof body?.notes === "string" ? body.notes : undefined },
    );
    await logChargebackAction(
      session,
      "chargeback_represented",
      id,
      `Marked chargeback as represented`,
      { userId: String(c.userId) },
    );
    return NextResponse.json({ case: c });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    console.error("❌ [chargebacks] mark represented failed:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- best-effort JSON
async function safeJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
