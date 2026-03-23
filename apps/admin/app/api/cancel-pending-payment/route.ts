import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { requireAdminAuth, getAdminSession } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";

/**
 * POST /api/cancel-pending-payment
 * Admin cancels a pending deposit transaction.
 * No credit refund is needed because credits haven't been added yet.
 */
export async function POST(request: Request) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { transactionId, reason } = await request.json();

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 },
      );
    }

    // Find the transaction
    const transaction = await WalletTransaction.findById(transactionId);

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // Only pending deposits can be cancelled
    if (transaction.status !== "pending") {
      return NextResponse.json(
        {
          error: `Cannot cancel a ${transaction.status} transaction`,
          details: `This payment is already ${transaction.status}. Only pending payments can be cancelled.`,
        },
        { status: 400 },
      );
    }

    if (transaction.transactionType !== "deposit") {
      return NextResponse.json(
        {
          error: "This endpoint is only for deposit transactions",
          details: "Use the withdrawal management endpoint to cancel withdrawals.",
        },
        { status: 400 },
      );
    }

    console.log("🚫 Cancelling pending deposit:");
    console.log("   ID:", transaction._id);
    console.log("   User:", transaction.userId);
    console.log("   Amount:", transaction.amount, transaction.currency);
    console.log("   Reason:", reason || "Admin cancelled");

    // Update transaction status to cancelled
    transaction.status = "cancelled";
    transaction.failureReason = reason || "Cancelled by admin";
    transaction.processedAt = new Date();

    // Store cancel metadata
    transaction.metadata = transaction.metadata || {};
    transaction.metadata.cancelledByAdmin = true;
    transaction.metadata.cancelReason = reason || "Cancelled by admin";
    transaction.metadata.cancelledAt = new Date().toISOString();

    await transaction.save();
    console.log("✅ Deposit cancelled successfully");

    // Log audit action
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.log({
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.email.split("@")[0],
            role: "admin",
          },
          action: "payment_cancelled",
          category: "financial",
          description: `Cancelled pending deposit: ${transaction.amount} credits for user ${transaction.userId}. Reason: ${reason || "Admin cancelled"}`,
          targetType: "transaction",
          targetId: transaction._id.toString(),
          metadata: {
            userId: transaction.userId,
            amount: transaction.amount,
            reason: reason || "Admin cancelled",
          },
        });
      }
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
      // Don't fail if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: "Payment cancelled successfully",
      transaction: {
        id: transaction._id,
        userId: transaction.userId,
        amount: transaction.amount,
        status: transaction.status,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("❌ Error cancelling payment:", error);
    return NextResponse.json(
      { error: "Failed to cancel payment" },
      { status: 500 },
    );
  }
}
