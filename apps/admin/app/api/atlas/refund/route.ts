/**
 * POST /api/atlas/refund
 * Admin-initiated Atlas refund against a completed Atlas deposit.
 *
 * Flow: validate admin + the target deposit → call Atlas createRefund →
 * record a pending refund marker on the deposit + audit log. The authoritative
 * outcome arrives asynchronously via /api/atlas/refund-callback, which flags it
 * for review (no automatic wallet deduction — see that handler).
 */

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";
import { atlasService } from "@/lib/services/atlas.service";
import { isValidObjectId } from "@/lib/utils/url-validator";

export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const transactionId =
      typeof body.transactionId === "string" ? body.transactionId : "";
    const requestedAmount =
      typeof body.amount === "number" ? body.amount : undefined;

    if (!isValidObjectId(transactionId)) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 },
      );
    }

    const transaction = await WalletTransaction.findById(transactionId);
    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    const provider =
      transaction.provider || transaction.metadata?.paymentProvider;
    if (provider !== "atlas") {
      return NextResponse.json(
        { error: "This transaction is not an Atlas payment" },
        { status: 400 },
      );
    }

    if (transaction.transactionType !== "deposit") {
      return NextResponse.json(
        { error: "Only deposits can be refunded" },
        { status: 400 },
      );
    }

    if (transaction.status !== "completed") {
      return NextResponse.json(
        { error: `Only completed deposits can be refunded (status: ${transaction.status})` },
        { status: 400 },
      );
    }

    // Resolve the Atlas payment id. open-order persists it on the top-level
    // `providerTransactionId` AND in `metadata.atlasPaymentId`; the webhook
    // also sets `paymentId`. Fall back across all three so deposits created by
    // older flows (or seeded fixtures) that only populated metadata can still
    // be refunded.
    const paymentId =
      transaction.providerTransactionId ||
      (transaction.metadata?.atlasPaymentId as string | undefined) ||
      (transaction.paymentId as string | undefined) ||
      "";
    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing Atlas payment id on this transaction" },
        { status: 400 },
      );
    }

    // Guard against re-refunding an already completed/in-flight refund.
    const existingRefundStatus = transaction.metadata?.refundStatus as
      | string
      | undefined;
    if (
      existingRefundStatus === "completed" ||
      existingRefundStatus === "processing"
    ) {
      return NextResponse.json(
        { error: `A refund is already ${existingRefundStatus} for this deposit` },
        { status: 409 },
      );
    }

    // Refund amount: default to the full amount Atlas originally charged.
    const originalCharged =
      Number(transaction.metadata?.totalCharged) ||
      Number(transaction.metadata?.eurAmount) ||
      0;
    const amount =
      requestedAmount !== undefined ? requestedAmount : originalCharged;

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid refund amount" },
        { status: 400 },
      );
    }
    if (originalCharged > 0 && amount > originalCharged + 0.01) {
      return NextResponse.json(
        { error: `Refund amount exceeds the original charge (${originalCharged})` },
        { status: 400 },
      );
    }

    const result = await atlasService.createRefund({
      paymentId,
      amount,
      additionalData: `txn_${transaction._id.toString()}`,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // Record a pending refund marker; the callback finalizes it.
    transaction.metadata = {
      ...transaction.metadata,
      atlasRefundId: result.refundId,
      refundStatus: "processing",
      refundRequestedAmount: amount,
      refundInitiatedAt: new Date().toISOString(),
    };
    await transaction.save();

    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.log({
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name || admin.email.split("@")[0],
            role: admin.role || "admin",
          },
          action: "payment_refunded",
          category: "financial",
          description: `Initiated Atlas refund of ${amount} for deposit ${transaction._id} (user ${transaction.userId})`,
          targetType: "transaction",
          targetId: transaction._id.toString(),
          metadata: {
            refundId: result.refundId,
            paymentId,
            amount,
            userId: transaction.userId,
          },
        });
      }
    } catch (auditError) {
      console.error("Failed to log Atlas refund audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Atlas refund initiated. Final status will arrive via callback.",
      refundId: result.refundId,
      amount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("❌ Error initiating Atlas refund:", error);
    return NextResponse.json(
      { error: "Failed to initiate refund" },
      { status: 500 },
    );
  }
}
