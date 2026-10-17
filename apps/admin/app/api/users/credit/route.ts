import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";

/**
 * POST /api/admin/users/credit
 * Credit a user with specified amount of credits
 */
export async function POST(request: Request) {
  try {
    // Reason: R101b. This route adjusted a wallet balance and wrote a WalletTransaction
    // before reading any session at all - the session was fetched only inside the audit
    // block below, which ran after the money had already moved and did nothing when it
    // came back null. So an unauthenticated caller could credit or debit any wallet and
    // the ledger row recorded no operator. The guard must precede every read and write.
    const guard = await guardSection("users");
    if (!guard.ok) return guard.response;

    const body = await request.json();

    const { userId, amount, reason } = body;

    // Validation
    // Reason: userId reaches CreditWallet.findOne({ userId }) directly, so an object such
    // as { $ne: null } would match somebody else's wallet. A truthiness check admits it.
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 },
      );
    }

    // Reason: amount is added to the stored balance. `!amount` rejects 0 and NaN but
    // admits Infinity, which would write a non-finite balance that every later figure
    // derives from. Test for a finite number rather than for truthiness (the R31 rule).
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be a non-zero number" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Find or create wallet
    let wallet = await CreditWallet.findOne({ userId });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await CreditWallet.create({
        userId,
        creditBalance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSpentOnCompetitions: 0,
        totalWonFromCompetitions: 0,
        isActive: true,
        kycVerified: false,
        withdrawalEnabled: false,
      });
    }

    // Check if removing credits would result in negative balance
    const previousBalance = wallet.creditBalance;
    const newBalance = previousBalance + amount;

    if (newBalance < 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot remove ${Math.abs(amount)} credits. User only has ${previousBalance.toFixed(2)} credits available.`,
        },
        { status: 400 },
      );
    }

    // Update wallet balance and tracking fields
    // Reason: Use dedicated admin tracking fields instead of polluting
    // totalDeposited/totalWithdrawn (which are for real deposits/withdrawals only).
    // This prevents false-positive reconciliation deposit/withdrawal mismatch warnings.
    wallet.creditBalance = newBalance;

    if (amount > 0) {
      wallet.totalAdminCredits = (wallet.totalAdminCredits || 0) + amount;
    } else {
      wallet.totalAdminDebits = (wallet.totalAdminDebits || 0) + Math.abs(amount);
    }

    await wallet.save();

    // Create transaction record
    await WalletTransaction.create({
      userId,
      transactionType: "admin_adjustment",
      amount,
      balanceBefore: previousBalance,
      balanceAfter: wallet.creditBalance,
      currency: "EUR",
      exchangeRate: 1,
      description:
        reason ||
        `Admin ${amount > 0 ? "added" : "removed"} ${Math.abs(amount)} credits`,
      status: "completed",
      processedAt: new Date(),
      metadata: {
        source: "admin",
        adminAdjustment: true,
        adjustmentAmount: amount,
        adjustmentType: amount > 0 ? "credit" : "debit",
      },
    });

    const actionText = amount > 0 ? "added" : "removed";
    console.log(
      `✅ Admin ${actionText} ${Math.abs(amount)} credits ${amount > 0 ? "to" : "from"} user ${userId}`,
    );

    // Log audit action
    // Reason: the actor comes from the guard rather than a second session read. The old
    // code re-fetched the session and skipped logging entirely when it was null, so the
    // one path that moved money without an operator was also the one that recorded no
    // audit row - the absence of evidence was caused by the defect it would have proved.
    try {
      await auditLogService.logCreditsAdjusted(
        {
          id: guard.admin.id,
          email: guard.admin.email,
          name: guard.admin.name ?? guard.admin.email.split("@")[0],
          role: guard.admin.role ?? "admin",
        },
        userId,
        userId,
        previousBalance,
        newBalance,
        reason || `Admin ${actionText} ${Math.abs(amount)} credits`,
      );
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ${actionText} ${Math.abs(amount)} credits`,
      wallet: {
        userId: wallet.userId,
        balance: wallet.creditBalance,
        previousBalance,
        adjustedAmount: amount,
      },
    });
  } catch (error) {
    console.error("❌ Error crediting user:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to credit user",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
