import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { markWithdrawn } from "../../../../../../../lib/services/security/chargeback-case.service";
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
    const c = await markWithdrawn(
      id,
      { id: session.id, name: session.name, email: session.email },
      { notes: typeof body?.notes === "string" ? body.notes : undefined },
    );
    await logChargebackAction(
      session,
      "chargeback_withdrawn",
      id,
      `Chargeback withdrawn by issuer`,
      { userId: String(c.userId) },
    );
    return NextResponse.json({ case: c });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    console.error("❌ [chargebacks] mark withdrawn failed:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
