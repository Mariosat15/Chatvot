import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { completeChargeback } from "../../../../../../../lib/services/security/chargeback-case.service";
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

    const userWalletAmt = body?.userWallet?.amount;
    const platformBankAmt = body?.platformBank?.amount;

    const userWallet =
      typeof userWalletAmt === "number" && userWalletAmt > 0
        ? { amount: userWalletAmt }
        : undefined;
    const platformBank =
      typeof platformBankAmt === "number" && platformBankAmt > 0
        ? { amount: platformBankAmt }
        : undefined;

    if (!userWallet && !platformBank) {
      return NextResponse.json(
        { error: "At least one of userWallet.amount or platformBank.amount must be > 0" },
        { status: 400 },
      );
    }

    const c = await completeChargeback(
      id,
      { id: session.id, name: session.name, email: session.email },
      {
        userWallet,
        platformBank,
        notes: typeof body?.notes === "string" ? body.notes : undefined,
      },
    );
    await logChargebackAction(
      session,
      "chargeback_completed",
      id,
      `Completed chargeback (lost) — clawback applied`,
      {
        userId: String(c.userId),
        userWalletAmount: userWallet?.amount || 0,
        platformBankAmount: platformBank?.amount || 0,
      },
    );
    return NextResponse.json({ case: c });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to complete";
    console.error("❌ [chargebacks] complete failed:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
