import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { initiateChargeback } from "../../../../../../../lib/services/security/chargeback-case.service";
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
