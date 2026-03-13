import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import mongoose from "mongoose";
import { canJoinChallenge } from "@/lib/services/market-hours.service";

// POST - Accept a challenge
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    // Check if market is open for challenges
    const marketCheck = await canJoinChallenge();
    if (!marketCheck.canJoin) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        {
          error:
            marketCheck.reason ||
            "Cannot accept challenge: Market is currently closed.",
        },
        { status: 400 },
      );
    }

    const challenge = await Challenge.findById(id).session(dbSession);

    if (!challenge) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 },
      );
    }

    // Only the challenged user can accept
    if (challenge.challengedId !== session.user.id) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Only the challenged user can accept" },
        { status: 403 },
      );
    }

    // Check status
    if (challenge.status !== "pending") {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: `Cannot accept challenge with status: ${challenge.status}` },
        { status: 400 },
      );
    }

    // Check if expired
    if (new Date() > challenge.acceptDeadline) {
      challenge.status = "expired";
      await challenge.save({ session: dbSession });
      await dbSession.commitTransaction();
      return NextResponse.json(
        { error: "Challenge has expired" },
        { status: 400 },
      );
    }

    // Check challenged user's wallet balance
    const challengedWallet = await CreditWallet.findOne({
      userId: session.user.id,
    }).session(dbSession);

    if (
      !challengedWallet ||
      challengedWallet.creditBalance < challenge.entryFee
    ) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 400 },
      );
    }

    // Also check challenger still has balance
    const challengerWallet = await CreditWallet.findOne({
      userId: challenge.challengerId,
    }).session(dbSession);

    if (
      !challengerWallet ||
      challengerWallet.creditBalance < challenge.entryFee
    ) {
      await dbSession.abortTransaction();
      return NextResponse.json(
        { error: "Challenger no longer has sufficient credits" },
        { status: 400 },
      );
    }

    // Deduct credits from both users using atomic $inc
    // Reason: .save() does full document replacement which is less resilient to
    // concurrency issues. $inc is atomic at the MongoDB level and prevents
    // lost-update bugs where the transaction record is committed but the wallet
    // balance isn't properly decremented. This was the root cause of a 5-credit
    // reconciliation discrepancy discovered on 2026-03-13.

    // Challenger — atomic debit
    const challengerBalanceBefore = challengerWallet.creditBalance;
    const updatedChallengerWallet = await CreditWallet.findOneAndUpdate(
      { userId: challenge.challengerId },
      {
        $inc: {
          creditBalance: -challenge.entryFee,
          totalSpentOnChallenges: challenge.entryFee,
        },
      },
      { session: dbSession, new: true },
    );
    if (!updatedChallengerWallet) {
      throw new Error("Failed to update challenger wallet");
    }

    await WalletTransaction.create(
      [
        {
          userId: challenge.challengerId,
          transactionType: "challenge_entry",
          amount: -challenge.entryFee,
          balanceBefore: challengerBalanceBefore,
          balanceAfter: updatedChallengerWallet.creditBalance,
          currency: "EUR",
          exchangeRate: 1,
          status: "completed",
          challengeId: challenge._id.toString(),
          description: `Challenge entry vs ${challenge.challengedName}`,
          processedAt: new Date(),
        },
      ],
      { session: dbSession },
    );

    // Challenged — atomic debit
    const challengedBalanceBefore = challengedWallet.creditBalance;
    const updatedChallengedWallet = await CreditWallet.findOneAndUpdate(
      { userId: challenge.challengedId },
      {
        $inc: {
          creditBalance: -challenge.entryFee,
          totalSpentOnChallenges: challenge.entryFee,
        },
      },
      { session: dbSession, new: true },
    );
    if (!updatedChallengedWallet) {
      throw new Error("Failed to update challenged wallet");
    }

    await WalletTransaction.create(
      [
        {
          userId: challenge.challengedId,
          transactionType: "challenge_entry",
          amount: -challenge.entryFee,
          balanceBefore: challengedBalanceBefore,
          balanceAfter: updatedChallengedWallet.creditBalance,
          currency: "EUR",
          exchangeRate: 1,
          status: "completed",
          challengeId: challenge._id.toString(),
          description: `Challenge entry vs ${challenge.challengerName}`,
          processedAt: new Date(),
        },
      ],
      { session: dbSession },
    );

    // Set challenge times - starts NOW
    const now = new Date();
    const endTime = new Date(now.getTime() + challenge.duration * 60 * 1000);

    challenge.status = "active";
    challenge.acceptedAt = now;
    challenge.startTime = now;
    challenge.endTime = endTime;
    await challenge.save({ session: dbSession });

    // Create participants (ordered: true required for session with multiple docs)
    await ChallengeParticipant.create(
      [
        {
          challengeId: challenge._id.toString(),
          userId: challenge.challengerId,
          username: challenge.challengerName,
          email: challenge.challengerEmail,
          role: "challenger",
          startingCapital: challenge.startingCapital,
          currentCapital: challenge.startingCapital,
          availableCapital: challenge.startingCapital,
          joinedAt: now,
        },
        {
          challengeId: challenge._id.toString(),
          userId: challenge.challengedId,
          username: challenge.challengedName,
          email: challenge.challengedEmail,
          role: "challenged",
          startingCapital: challenge.startingCapital,
          currentCapital: challenge.startingCapital,
          availableCapital: challenge.startingCapital,
          joinedAt: now,
        },
      ],
      { session: dbSession, ordered: true },
    );

    await dbSession.commitTransaction();

    // Send notifications
    try {
      const { notificationService } =
        await import("@/lib/services/notification.service");

      // Notify challenger that their challenge was accepted
      await notificationService.send({
        userId: challenge.challengerId,
        templateId: "challenge_accepted",
        variables: {
          // Changed from 'metadata' to 'variables'
          challengeId: challenge._id.toString(),
          challengeSlug: challenge.slug, // Added for actionUrl
          challengedName: challenge.challengedName,
          opponentName: challenge.challengedName, // Alias for template compatibility
          entryFee: challenge.entryFee,
          duration: challenge.duration,
          winnerPrize: challenge.winnerPrize,
          endTime: endTime.toISOString(),
        },
      });

      // Notify challenged (confirmation) that the challenge started
      await notificationService.send({
        userId: challenge.challengedId,
        templateId: "challenge_started",
        variables: {
          // Changed from 'metadata' to 'variables'
          challengeId: challenge._id.toString(),
          challengeSlug: challenge.slug, // Added for actionUrl
          challengerName: challenge.challengerName,
          opponentName: challenge.challengerName, // Alias for template compatibility
          duration: challenge.duration,
          winnerPrize: challenge.winnerPrize,
          endTime: endTime.toISOString(),
        },
      });
    } catch (notifError) {
      console.error("Error sending challenge notifications:", notifError);
    }

    return NextResponse.json({
      success: true,
      message: "Challenge accepted! The battle begins now!",
      challenge: {
        _id: challenge._id,
        slug: challenge.slug,
        status: challenge.status,
        startTime: challenge.startTime,
        endTime: challenge.endTime,
        winnerPrize: challenge.winnerPrize,
      },
    });
  } catch (error) {
    await dbSession.abortTransaction();
    console.error("Error accepting challenge:", error);
    return NextResponse.json(
      { error: "Failed to accept challenge" },
      { status: 500 },
    );
  } finally {
    dbSession.endSession();
  }
}
