import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
// Reason: services live at repo root to stay shared with the main app.
import {
  ensureChargebackCase,
  listChargebacksForUser,
} from "../../../../../../../lib/services/security/chargeback-case.service";
import { logChargebackAction } from "../../../chargebacks/_audit";

/** GET — list chargeback cases for a user. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId } = await params;
    const cases = await listChargebacksForUser(userId);
    return NextResponse.json({ cases });
  } catch (err) {
    console.error("❌ [chargebacks] list failed:", err);
    return NextResponse.json(
      { error: "Failed to list chargebacks" },
      { status: 500 },
    );
  }
}

/** POST — manually create a chargeback case (status pending_review). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId } = await params;
    const body = await req.json();

    if (typeof body?.amount !== "number" || body.amount <= 0) {
      return NextResponse.json(
        { error: "amount is required and must be > 0" },
        { status: 400 },
      );
    }
    if (!body?.provider || typeof body.provider !== "string") {
      return NextResponse.json(
        { error: "provider is required" },
        { status: 400 },
      );
    }

    const created = await ensureChargebackCase({
      provider: String(body.provider),
      userId,
      userEmail: body.userEmail,
      userName: body.userName,
      walletTransactionId: body.walletTransactionId,
      providerTransactionId: body.providerTransactionId,
      chargebackCaseId: body.chargebackCaseId,
      reasonCode: body.reasonCode,
      amount: body.amount,
      currency: body.currency || "EUR",
      metadata: { createdByAdmin: session.id, manualEntry: true },
    });

    await logChargebackAction(
      session,
      "chargeback_created",
      String(created._id),
      `Manually created chargeback case for user ${userId}`,
      {
        userId,
        amount: body.amount,
        provider: String(body.provider),
        reasonCode: body.reasonCode,
      },
    );

    return NextResponse.json({ case: created });
  } catch (err) {
    console.error("❌ [chargebacks] create failed:", err);
    return NextResponse.json(
      { error: "Failed to create chargeback case" },
      { status: 500 },
    );
  }
}
