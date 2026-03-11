import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";

// POST - Decline a challenge
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const challenge = await Challenge.findById(id);

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 },
      );
    }

    // Only the challenged user can decline
    if (challenge.challengedId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the challenged user can decline" },
        { status: 403 },
      );
    }

    // Check status
    if (challenge.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot decline challenge with status: ${challenge.status}` },
        { status: 400 },
      );
    }

    // Update status
    challenge.status = "declined";
    challenge.declinedAt = new Date();
    await challenge.save();

    // Reason: Record a €0 informational transaction so the challenger sees
    // the decline in their wallet/transaction history. No credits were taken
    // at challenge creation — the entry fee is only charged when both accept.
    try {
      const challengerWallet = await CreditWallet.findOne({
        userId: challenge.challengerId,
      }).lean();

      if (challengerWallet) {
        await WalletTransaction.create({
          userId: challenge.challengerId,
          transactionType: "challenge_declined",
          amount: 0,
          balanceBefore: challengerWallet.creditBalance,
          balanceAfter: challengerWallet.creditBalance,
          currency: "EUR",
          exchangeRate: 1,
          status: "completed",
          description: `Challenge declined by ${challenge.challengedName} — no charge`,
          metadata: {
            challengeId: challenge._id.toString(),
            challengeSlug: challenge.slug,
            opponentName: challenge.challengedName,
            originalEntryFee: challenge.entryFee,
          },
          processedAt: new Date(),
        });
      }
    } catch (txError) {
      // Reason: Transaction record is informational — don't fail the decline if it errors
      console.warn("⚠️ Failed to create decline transaction record:", txError);
    }

    // Send notification to challenger
    try {
      const { notificationService } =
        await import("@/lib/services/notification.service");
      await notificationService.send({
        userId: challenge.challengerId,
        templateId: "challenge_declined",
        variables: {
          challengeId: challenge._id.toString(),
          challengeSlug: challenge.slug,
          challengedName: challenge.challengedName,
          opponentName: challenge.challengedName,
          entryFee: challenge.entryFee,
        },
      });
    } catch (notifError) {
      console.error("Error sending decline notification:", notifError);
    }

    return NextResponse.json({
      success: true,
      message: "Challenge declined",
    });
  } catch (error) {
    console.error("Error declining challenge:", error);
    return NextResponse.json(
      { error: "Failed to decline challenge" },
      { status: 500 },
    );
  }
}
