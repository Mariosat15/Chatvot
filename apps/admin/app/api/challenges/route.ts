import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { guardSection } from "@/lib/admin/section-route-guard";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import mongoose from "mongoose";

/**
 * Return one seat's entry fee and record that it happened.
 *
 * Reason: R79. This refund used to be a bare `$inc` on the wallet with no ledger row at
 * all, which is worse than a wrong number: the balance was correct and the ledger could
 * never explain it, so the two disagreed permanently and the financial reconciliation
 * screen reported the user as having a critical balance mismatch for ever. It surfaced
 * exactly that way - one player's stored balance sat 20 credits above the sum of their
 * transactions, with challenge spending 20 below, which is one cancelled challenge.
 *
 * `challenge_refund` was a declared transaction type that nothing had ever written, and
 * every reader (the financial dashboard, the user history, the export, the reconciliation)
 * already listed it. So the type was not missing - the writer was.
 *
 * Two details are taken from the competition cancel path rather than invented here, so the
 * two kinds of contest cancel agree: `totalRefunded` is incremented, and the refund is
 * the whole entry fee with no platform fee withheld, because the contest never ran.
 */
async function refundChallengeSeat(
  session: mongoose.ClientSession,
  userId: string,
  challengeId: mongoose.Types.ObjectId | unknown,
  challengeName: string,
  entryFee: number,
  reason: string,
): Promise<void> {
  // `new: true` so `balanceAfter` is the real post-credit balance rather than one derived
  // from a read another writer may already have overtaken.
  const wallet = await CreditWallet.findOneAndUpdate(
    { userId },
    {
      $inc: {
        creditBalance: entryFee,
        totalSpentOnChallenges: -entryFee,
        totalRefunded: entryFee,
      },
    },
    { session, new: true },
  );

  const balanceAfter = wallet?.creditBalance ?? entryFee;

  await WalletTransaction.create(
    [
      {
        userId,
        transactionType: "challenge_refund",
        amount: entryFee,
        balanceBefore: balanceAfter - entryFee,
        balanceAfter,
        // Reason: `challengeId` is the declared field and `referenceId` is not. Stage 0
        // found the whole challenge money trail unattributable because nine writers chose
        // the undeclared name and strict mode discarded it while reporting success.
        challengeId,
        status: "completed",
        description: `↩️ Entry fee refunded - ${challengeName} cancelled`,
        metadata: { cancellationReason: reason, cancelledBy: "admin" },
      },
    ],
    { session },
  );
}

/**
 * Tell both seats that an operator cancelled their challenge.
 *
 * Reason: the refund and the status change were both silent. A player whose
 * entry fee came back learned it from their balance, and one whose challenge
 * simply disappeared learned nothing at all.
 *
 * Fire-and-forget by construction: the money has already committed, so a
 * notification that cannot be written must not turn a successful cancellation
 * into an error the operator retries.
 */
async function notifyChallengeCancelled(
  challenge: {
    _id: unknown;
    challengerId: string;
    challengedId?: string | null;
    challengerName?: string | null;
    challengedName?: string | null;
  },
  refunded: boolean,
): Promise<void> {
  try {
    const { notificationService } = await import(
      "@/lib/services/notification.service"
    );

    const refundLine = refunded
      ? "Your entry fee has been returned to your wallet."
      : "No entry fee had been charged.";

    const recipients: Array<{ userId: string; opponent?: string | null }> = [
      { userId: challenge.challengerId, opponent: challenge.challengedName },
    ];
    // Reason: an open challenge nobody claimed has no second seat, and a
    // pending directed one has a named opponent who was never charged and
    // never agreed to anything - only a seat that exists is told.
    if (challenge.challengedId) {
      recipients.push({
        userId: challenge.challengedId,
        opponent: challenge.challengerName,
      });
    }

    for (const recipient of recipients) {
      try {
        await notificationService.send({
          userId: recipient.userId,
          templateId: "challenge_cancelled",
          variables: {
            challengeId: String(challenge._id),
            opponentClause: recipient.opponent
              ? ` against ${recipient.opponent}`
              : "",
            refundLine,
          },
        });
      } catch (error) {
        console.warn(
          `⚠️ Failed to notify ${recipient.userId} of cancellation:`,
          error,
        );
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to send cancellation notifications:", error);
  }
}

/**
 * GET - Fetch all challenges with filters
 *
 * Reason both handlers are guarded: neither had any authorization of any kind. The
 * comment said "Admin only" and nothing checked - the same class as Prerequisite A, the
 * internal-secret fallbacks, the unprotected suspicion-score route and the Image
 * Optimizer. `requireAdminAuth` would not be enough either: it asks only whether the
 * caller is an admin at all, so an employee granted one unrelated section passes it.
 */
export async function GET(request: NextRequest) {
  const guard = await guardSection("challenges");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'active', 'pending', 'completed', etc.
    const search = searchParams.get("search"); // User name/email search
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build query
    const query: Record<string, unknown> = {};

    // Status filter
    if (status) {
      if (status === "active_all") {
        // Active tab: pending, accepted, active
        query.status = { $in: ["pending", "accepted", "active"] };
      } else if (status === "history") {
        // History tab: completed, declined, expired, cancelled
        query.status = {
          $in: ["completed", "declined", "expired", "cancelled"],
        };
      } else {
        query.status = status;
      }
    }

    // User search (name or email)
    if (search) {
      query.$or = [
        { challengerName: { $regex: search, $options: "i" } },
        { challengerEmail: { $regex: search, $options: "i" } },
        { challengedName: { $regex: search, $options: "i" } },
        { challengedEmail: { $regex: search, $options: "i" } },
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        (query.createdAt as Record<string, Date>).$gte = new Date(dateFrom);
      }
      if (dateTo) {
        (query.createdAt as Record<string, Date>).$lte = new Date(dateTo);
      }
    }

    // Get total count for pagination
    const totalCount = await Challenge.countDocuments(query);

    // Fetch challenges with pagination
    const challenges = await Challenge.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get stats for all statuses
    const stats = await Challenge.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalPrizePool: { $sum: "$prizePool" },
          totalFees: { $sum: "$platformFeeAmount" },
        },
      },
    ]);

    // Format stats
    const formattedStats = {
      total: 0,
      pending: 0,
      accepted: 0,
      active: 0,
      completed: 0,
      declined: 0,
      expired: 0,
      cancelled: 0,
      totalPrizePool: 0,
      totalFees: 0,
    };

    for (const stat of stats) {
      formattedStats[stat._id as keyof typeof formattedStats] = stat.count;
      formattedStats.total += stat.count;
      formattedStats.totalPrizePool += stat.totalPrizePool || 0;
      formattedStats.totalFees += stat.totalFees || 0;
    }

    return NextResponse.json({
      success: true,
      challenges,
      stats: formattedStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching challenges:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenges" },
      { status: 500 },
    );
  }
}

/**
 * POST - Admin actions on challenges (cancel, refund)
 */
export async function POST(request: NextRequest) {
  const guard = await guardSection("challenges");
  if (!guard.ok) return guard.response;

  try {
    await connectToDatabase();

    const body = await request.json();
    const { action, challengeId, reason } = body;

    if (!challengeId) {
      return NextResponse.json(
        { error: "Challenge ID is required" },
        { status: 400 },
      );
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 },
      );
    }

    switch (action) {
      case "cancel": {
        // Only allow cancelling pending, accepted, or active challenges
        if (!["pending", "accepted", "active"].includes(challenge.status)) {
          return NextResponse.json(
            {
              error: `Cannot cancel challenge with status: ${challenge.status}`,
            },
            { status: 400 },
          );
        }

        // Start a session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          let refundedCount = 0;

          // Refund both participants if challenge was accepted or active
          // Reason: Credits are only deducted when the challenged user ACCEPTS.
          // Pending challenges have zero financial impact — no refund needed.
          if (["accepted", "active"].includes(challenge.status)) {
            const cancellationReason = reason || "Cancelled by admin";
            // Reason: a challenge has no name field. This is the exact wording
            // `challenge-settlement.service.ts` gives the same contest, so a refund row
            // and a win row for one challenge read as the same contest on the ledger.
            const challengeName = `${challenge.challengerName} vs ${challenge.challengedName}`;

            // Reason: both seats go through one function rather than two near-identical
            // blocks. The duplicated version is how the challenger got a ledger row and
            // the challenged user did not, in the first draft of this fix.
            for (const userId of [
              challenge.challengerId,
              challenge.challengedId,
            ]) {
              // An accepted challenge has both seats filled, so a missing id here means
              // the document is malformed - refunding nobody is the safe answer.
              if (!userId) continue;
              await refundChallengeSeat(
                session,
                userId,
                challenge._id,
                challengeName,
                challenge.entryFee,
                cancellationReason,
              );
              refundedCount++;
            }
          }
          // Pending challenges: no refund needed — entry fee was never charged

          // Update challenge status
          await Challenge.updateOne(
            { _id: challengeId },
            {
              $set: {
                status: "cancelled",
                cancelledAt: new Date(),
                cancellationReason: reason || "Cancelled by admin",
              },
            },
            { session },
          );

          // Delete participants if they exist
          await ChallengeParticipant.deleteMany(
            { challengeId: challenge._id },
            { session },
          );

          await session.commitTransaction();

          // Reason: after the commit, so nobody is told a challenge was
          // cancelled by a transaction that then aborted. Both seats are told
          // rather than only the creator - the other player had entered and,
          // on an accepted challenge, had been charged.
          await notifyChallengeCancelled(challenge, refundedCount > 0);

          return NextResponse.json({
            success: true,
            message: `Challenge cancelled. ${refundedCount} participant(s) refunded.`,
            refundedCount,
          });
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          session.endSession();
        }
      }

      // Reason: R80. `force_complete` used to live here and was DELETED rather than
      // repaired. It credited `winnerPrize` straight onto the winner's wallet with no
      // ledger row, no `totalWonFromChallenges`, no platform fee, no Game Master
      // referral share and no lock - a second money writer beside `settleChallenge`,
      // on a route that had no authorization of any kind. Nothing in the admin UI
      // called it, so it was reachable only over HTTP.
      //
      // Deleted on the `shouldBlockEntry` precedent: a dead helper that does the thing
      // just removed makes reintroducing the defect a one-line change that reads like
      // using an existing API. Ending a challenge EARLY is a genuine operational gap
      // and is recorded as one - it belongs with the lifecycle controls in X6.5, beside
      // `adjust-results` and `emergency_ended`, and must go through `settleChallenge`.
      // The reversible operation, cancel-with-refund, is above and now writes a ledger.

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Error performing challenge action:", error);
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 },
    );
  }
}
