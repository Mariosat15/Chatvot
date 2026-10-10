/**
 * Atlas Cancel-Pending API
 *
 * Called when a user returns from the Atlas hosted page via the fail/cancel
 * redirect (`/wallet?status=failed&provider=atlas`). Atlas uses a full-page
 * redirect (not an in-app popup), so there is no client "close" event to hook —
 * this endpoint lets the wallet page proactively cancel the deposit the user
 * just abandoned instead of leaving it pending in the admin queue.
 *
 * Safety:
 * - Auth-scoped: only cancels the caller's OWN pending Atlas deposit.
 * - Atomic pending→cancelled flip: if the Atlas webhook already claimed the
 *   transaction (moved it to processing/completed), this is a no-op so a real
 *   payment is never clobbered.
 * - Deposits do not grant credits until completion, so cancelling a pending
 *   deposit has no wallet-balance impact.
 *
 * POST /api/atlas/cancel-pending
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const userId = session.user.id;

    // The user's most recent still-pending Atlas deposit (created recently, so
    // we only ever touch the one they just abandoned).
    const pending = await WalletTransaction.findOne({
      userId,
      transactionType: "deposit",
      status: "pending",
      $or: [{ provider: "atlas" }, { "metadata.paymentProvider": "atlas" }],
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    }).sort({ createdAt: -1 });

    if (!pending) {
      return NextResponse.json({ success: true, cancelled: false });
    }

    // Atomic guard: only flip if it's STILL pending (webhook hasn't claimed it).
    const updated = await WalletTransaction.findOneAndUpdate(
      { _id: pending._id, status: "pending" },
      {
        $set: {
          status: "cancelled",
          failureReason: "User closed the Atlas payment without completing",
          processedAt: new Date(),
          "metadata.cancelReason": "user_abandoned_atlas_checkout",
        },
      },
      { new: true },
    );

    return NextResponse.json({
      success: true,
      cancelled: Boolean(updated),
      transactionId: updated ? pending._id.toString() : undefined,
    });
  } catch (error) {
    console.error("❌ Atlas cancel-pending error:", error);
    // Non-fatal for the client — return 200 so the wallet page doesn't error.
    return NextResponse.json({ success: false, cancelled: false });
  }
}
