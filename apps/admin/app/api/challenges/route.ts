import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import mongoose from "mongoose";

/**
 * GET - Fetch all challenges with filters (Admin only)
 */
export async function GET(request: NextRequest) {
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
          if (["accepted", "active"].includes(challenge.status)) {
            // Refund challenger
            await CreditWallet.updateOne(
              { userId: challenge.challengerId },
              { $inc: { creditBalance: challenge.entryFee } },
              { session },
            );
            refundedCount++;

            // Refund challenged user
            await CreditWallet.updateOne(
              { userId: challenge.challengedId },
              { $inc: { creditBalance: challenge.entryFee } },
              { session },
            );
            refundedCount++;
          } else if (challenge.status === "pending") {
            // Refund only challenger for pending challenges
            await CreditWallet.updateOne(
              { userId: challenge.challengerId },
              { $inc: { creditBalance: challenge.entryFee } },
              { session },
            );
            refundedCount++;
          }

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

      case "force_complete": {
        // Force complete an active challenge (for testing or stuck challenges)
        if (challenge.status !== "active") {
          return NextResponse.json(
            { error: "Can only force complete active challenges" },
            { status: 400 },
          );
        }

        // Get participants
        const participants = await ChallengeParticipant.find({
          challengeId: challenge._id,
        }).lean();

        if (participants.length !== 2) {
          return NextResponse.json(
            { error: "Challenge does not have exactly 2 participants" },
            { status: 400 },
          );
        }

        // Determine winner based on P&L
        const challenger = participants.find(
          (p) => p.userId === challenge.challengerId,
        );
        const challenged = participants.find(
          (p) => p.userId === challenge.challengedId,
        );

        if (!challenger || !challenged) {
          return NextResponse.json(
            { error: "Could not find both participants" },
            { status: 400 },
          );
        }

        const challengerPnL =
          challenger.currentCapital - challenge.startingCapital;
        const challengedPnL =
          challenged.currentCapital - challenge.startingCapital;

        let winnerId: string | undefined;
        let winnerName: string | undefined;
        let winnerPnL: number | undefined;
        let loserId: string | undefined;
        let loserName: string | undefined;
        let loserPnL: number | undefined;
        let isTie = false;

        if (challengerPnL > challengedPnL) {
          winnerId = challenge.challengerId;
          winnerName = challenge.challengerName;
          winnerPnL = challengerPnL;
          loserId = challenge.challengedId;
          loserName = challenge.challengedName;
          loserPnL = challengedPnL;
        } else if (challengedPnL > challengerPnL) {
          winnerId = challenge.challengedId;
          winnerName = challenge.challengedName;
          winnerPnL = challengedPnL;
          loserId = challenge.challengerId;
          loserName = challenge.challengerName;
          loserPnL = challengerPnL;
        } else {
          isTie = true;
        }

        // Award prize to winner
        if (winnerId) {
          await CreditWallet.updateOne(
            { userId: winnerId },
            { $inc: { creditBalance: challenge.winnerPrize } },
          );
        }

        // Update challenge
        await Challenge.updateOne(
          { _id: challengeId },
          {
            $set: {
              status: "completed",
              winnerId,
              winnerName,
              winnerPnL,
              loserId,
              loserName,
              loserPnL,
              isTie,
              endTime: new Date(),
              challengerFinalStats: {
                finalCapital: challenger.currentCapital,
                pnl: challengerPnL,
                pnlPercentage:
                  (challengerPnL / challenge.startingCapital) * 100,
                totalTrades: challenger.totalTrades || 0,
                winRate: challenger.winRate || 0,
                isDisqualified: challenger.isDisqualified || false,
              },
              challengedFinalStats: {
                finalCapital: challenged.currentCapital,
                pnl: challengedPnL,
                pnlPercentage:
                  (challengedPnL / challenge.startingCapital) * 100,
                totalTrades: challenged.totalTrades || 0,
                winRate: challenged.winRate || 0,
                isDisqualified: challenged.isDisqualified || false,
              },
            },
          },
        );

        return NextResponse.json({
          success: true,
          message: isTie
            ? "Challenge completed as a tie."
            : `Challenge completed. Winner: ${winnerName}`,
          winnerId,
          winnerName,
          isTie,
        });
      }

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
