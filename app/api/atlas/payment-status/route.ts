/**
 * Atlas Payment Status (poll fallback)
 * Read-only endpoint the return page / deposit modal can poll to display the
 * outcome while waiting for the authoritative Atlas callback to credit the
 * wallet. It NEVER credits — crediting happens only in /api/atlas/webhook.
 *
 * GET /api/atlas/payment-status?transactionId=<id>
 *   or ?paymentId=<atlasPaymentId>
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { isValidObjectId } from "@/lib/utils/url-validator";
import { atlasService } from "@/lib/services/atlas.service";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transactionId");
    const paymentId = searchParams.get("paymentId");

    await connectToDatabase();

    // Locate the transaction, scoped to the authenticated user.
    let transaction = null;
    if (transactionId && isValidObjectId(transactionId)) {
      transaction = await WalletTransaction.findOne({
        _id: transactionId,
        userId,
        provider: "atlas",
      });
    }
    if (!transaction && paymentId) {
      transaction = await WalletTransaction.findOne({
        userId,
        provider: "atlas",
        providerTransactionId: paymentId,
      });
    }

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Surface a live Atlas status only while still pending (informational).
    let liveStatusCode: number | undefined;
    if (
      transaction.status === "pending" &&
      transaction.providerTransactionId
    ) {
      const live = await atlasService.getPaymentStatus(
        transaction.providerTransactionId,
      );
      if (!("error" in live)) {
        liveStatusCode = Number(live.transaction_status_code);
      }
    }

    return NextResponse.json({
      success: true,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      paymentId: transaction.providerTransactionId,
      liveStatusCode,
    });
  } catch (error) {
    console.error("Atlas payment-status error:", error);
    return NextResponse.json(
      { error: "Failed to get payment status" },
      { status: 500 },
    );
  }
}
