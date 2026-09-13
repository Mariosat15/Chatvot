/**
 * POST /api/atlas/refund/clawback
 * Remove (claw back) the credits tied to a deposit that was refunded to the
 * customer's card, so the user doesn't keep spending power they were already
 * paid back for.
 *
 * This is the "fix" side of the refund flow: the refund itself returns the
 * money via Atlas; this endpoint reverses the matching wallet credits as a
 * proper `admin_adjustment` transaction so reconciliation stays balanced
 * (wallet balance drops by exactly the same amount as the transaction sum).
 *
 * Safety: never forces a negative balance. If the user already spent the
 * credits, the clawback is rejected and the admin must handle it as a loss.
 */

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";
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

    const deposit = await WalletTransaction.findById(transactionId);
    if (!deposit) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    if (deposit.transactionType !== "deposit") {
      return NextResponse.json(
        { error: "Clawback only applies to deposits" },
        { status: 400 },
      );
    }

    const provider = deposit.provider || deposit.metadata?.paymentProvider;
    if (provider !== "atlas") {
      return NextResponse.json(
        { error: "This transaction is not an Atlas payment" },
        { status: 400 },
      );
    }

    // A refund must have completed before we claw back credits.
    if (deposit.metadata?.refundStatus !== "completed") {
      return NextResponse.json(
        {
          error:
            "No completed refund on this deposit — refund the payment first, then claw back the credits.",
        },
        { status: 400 },
      );
    }

    if (deposit.metadata?.creditsClawedBack) {
      return NextResponse.json(
        { error: "Credits for this refund have already been clawed back" },
        { status: 409 },
      );
    }

    // Credits to remove: default to the credits originally granted by the deposit
    // (its positive `amount`). Allow an explicit override for partial refunds.
    const grantedCredits = Math.abs(deposit.amount || 0);
    const amount =
      requestedAmount !== undefined ? Math.abs(requestedAmount) : grantedCredits;

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid clawback amount" },
        { status: 400 },
      );
    }
    if (amount > grantedCredits + 0.01) {
      return NextResponse.json(
        { error: `Clawback exceeds the credits originally granted (${grantedCredits})` },
        { status: 400 },
      );
    }

    const wallet = await CreditWallet.findOne({ userId: deposit.userId });
    if (!wallet) {
      return NextResponse.json(
        { error: "User wallet not found" },
        { status: 404 },
      );
    }

    const previousBalance = wallet.creditBalance;
    const newBalance = previousBalance - amount;
    if (newBalance < 0) {
      // Reason: the user has already spent the refunded credits — clawing back
      // would force a negative balance. This is now a loss/fraud decision.
      return NextResponse.json(
        {
          error: `Cannot claw back ${amount} credits — user only has ${previousBalance.toFixed(2)}. They likely already spent the refunded credits; handle as a loss or open a fraud case.`,
        },
        { status: 400 },
      );
    }

    // Apply the debit using the dedicated admin-debit tracking field so we don't
    // pollute totalDeposited/totalWithdrawn (avoids false reconciliation warnings).
    wallet.creditBalance = Math.round(newBalance * 100) / 100;
    wallet.totalAdminDebits = (wallet.totalAdminDebits || 0) + amount;
    await wallet.save();

    const clawbackTx = await WalletTransaction.create({
      userId: deposit.userId,
      transactionType: "admin_adjustment",
      amount: -amount,
      balanceBefore: previousBalance,
      balanceAfter: wallet.creditBalance,
      currency: "EUR",
      exchangeRate: 1,
      description: `Refund clawback: removed ${amount} credits for refunded Atlas deposit ${deposit._id}`,
      status: "completed",
      processedAt: new Date(),
      metadata: {
        source: "admin",
        adminAdjustment: true,
        adjustmentType: "debit",
        adjustmentAmount: -amount,
        reason: "atlas_refund_clawback",
        refundClawback: true,
        atlasRefundId: deposit.metadata?.atlasRefundId,
        originalDepositTxId: deposit._id.toString(),
      },
    });

    deposit.metadata = {
      ...deposit.metadata,
      creditsClawedBack: true,
      clawbackTxId: clawbackTx._id.toString(),
      clawedBackAmount: amount,
      clawedBackAt: new Date().toISOString(),
    };
    await deposit.save();

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
          action: "refund_clawback",
          category: "financial",
          description: `Clawed back ${amount} credits from user ${deposit.userId} for refunded Atlas deposit ${deposit._id}`,
          targetType: "transaction",
          targetId: deposit._id.toString(),
          metadata: {
            clawbackTxId: clawbackTx._id.toString(),
            amount,
            previousBalance,
            newBalance: wallet.creditBalance,
            atlasRefundId: deposit.metadata?.atlasRefundId,
          },
        });
      }
    } catch (auditError) {
      console.error("Failed to log clawback audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Clawed back ${amount} credits. Wallet: ${previousBalance.toFixed(2)} → ${wallet.creditBalance.toFixed(2)}`,
      previousBalance,
      newBalance: wallet.creditBalance,
      clawedBackAmount: amount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("❌ Error clawing back refund credits:", error);
    return NextResponse.json(
      { error: "Failed to claw back credits" },
      { status: 500 },
    );
  }
}
