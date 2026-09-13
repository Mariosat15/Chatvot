/**
 * GET /api/atlas/refunds/pending
 *
 * Admin "refunds needing attention" queue for the Finance dashboard. Surfaces
 * Atlas deposits that have a refund recorded so the admin can see — in one
 * place — which ones still need a credit clawback, instead of opening each user
 * transaction individually.
 *
 * Query params:
 *   - status: "pending" (default) | "all"
 *       pending → completed refunds whose credits have NOT been clawed back yet.
 *       all     → every Atlas deposit that has any refund status recorded.
 *
 * Rows are shaped like the dashboard's Transaction items so clicking one can
 * open the existing refund/clawback dialog directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "pending";

    // All Atlas deposits that have a refund recorded (any status).
    const baseQuery: Record<string, unknown> = {
      transactionType: "deposit",
      $and: [
        {
          $or: [{ provider: "atlas" }, { "metadata.paymentProvider": "atlas" }],
        },
        { "metadata.refundStatus": { $exists: true } },
      ],
    };

    const deposits = await WalletTransaction.find(baseQuery)
      .sort({ updatedAt: -1 })
      .lean();

    // Enrich with user info (single batched lookup).
    const userIds = deposits
      .map((d) => d.userId)
      .filter((id): id is string => typeof id === "string" && id !== "platform");
    const usersMap = await getUsersByIds(userIds);

    const rows = deposits.map((d) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (d.metadata || {}) as Record<string, any>;
      const refundStatus = meta.refundStatus as string | undefined;
      const creditsClawedBack = Boolean(meta.creditsClawedBack);
      const grantedCredits = Math.abs(d.amount || 0);
      const clawbackPending =
        refundStatus === "completed" && !creditsClawedBack;

      const userInfo = usersMap.get(d.userId) || {
        id: d.userId,
        name: "Unknown",
        email: "Unknown",
      };

      return {
        _id: d._id.toString(),
        userId: d.userId,
        userName: userInfo.name,
        userInfo: {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
        },
        transactionType: d.transactionType,
        amount: d.amount,
        status: d.status,
        createdAt: d.createdAt,
        description: d.description,
        provider: "atlas",
        source: "wallet" as const,
        metadata: meta,
        // Derived convenience fields for the queue UI:
        refundStatus,
        refundAmount:
          typeof meta.refundAmount === "number"
            ? meta.refundAmount
            : undefined,
        refundCurrency: (meta.refundCurrency as string) || "EUR",
        refundedAt: meta.refundedAt as string | undefined,
        atlasRefundId: meta.atlasRefundId as string | undefined,
        grantedCredits,
        creditsClawedBack,
        clawedBackAmount: meta.clawedBackAmount as number | undefined,
        clawbackPending,
        reconciledBy: meta.refundReconciledBy as string | undefined,
      };
    });

    const filtered =
      statusFilter === "all" ? rows : rows.filter((r) => r.clawbackPending);

    const counts = {
      pendingClawback: rows.filter((r) => r.clawbackPending).length,
      completed: rows.filter(
        (r) => r.refundStatus === "completed" && r.creditsClawedBack,
      ).length,
      processing: rows.filter((r) => r.refundStatus === "processing").length,
      declined: rows.filter((r) => r.refundStatus === "declined").length,
      total: rows.length,
    };

    return NextResponse.json({ success: true, data: filtered, counts });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("❌ Error fetching pending Atlas refunds:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending refunds" },
      { status: 500 },
    );
  }
}
