import { NextRequest, NextResponse } from "next/server";
import { guardAnySection } from "@/lib/admin/section-route-guard";
import { initiateChargeback } from "../../../../../../../lib/services/security/chargeback-case.service";
import { logChargebackAction } from "../../_audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardAnySection(["financial", "users"]);
    if (!guard.ok) return guard.response;
    const session = guard.admin;
    const { id } = await params;
    const c = await initiateChargeback(id, {
      id: session.id,
      name: session.name,
      email: session.email,
    });
    await logChargebackAction(
      session,
      "chargeback_initiated",
      id,
      `Initiated chargeback case — user restricted, evidence frozen`,
      { userId: String(c.userId) },
    );
    return NextResponse.json({ case: c });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to initiate";
    console.error("❌ [chargebacks] initiate failed:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
