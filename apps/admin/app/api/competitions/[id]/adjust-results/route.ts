import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/auth";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import Incident from "@/database/models/incident.model";
import { notificationService } from "@/lib/services/notification.service";
import mongoose from "mongoose";

/**
 * POST /api/competitions/[id]/adjust-results
 * Adjust competition results after finalization
 *
 * Requires an incident ID for audit trail
 *
 * Body: {
 *   incidentId: string (required),
 *   adjustments: [{
 *     participantId: string,
 *     newRank?: number,
 *     newPrize?: number,
 *     disqualify?: boolean,
 *     reinstate?: boolean,
 *     reason: string
 *   }]
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: competitionId } = await params;
    const body = await request.json();
    const { incidentId, adjustments, globalReason } = body;

    // Require incident ID for audit trail
    if (!incidentId) {
      return NextResponse.json(
        {
          error: "incidentId is required for result adjustments (audit trail)",
        },
        { status: 400 },
      );
    }

    if (
      !adjustments ||
      !Array.isArray(adjustments) ||
      adjustments.length === 0
    ) {
      return NextResponse.json(
        { error: "adjustments array is required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Verify incident exists
    const incident = await Incident.findById(incidentId).session(mongoSession);
    if (!incident) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 },
      );
    }

    // Get competition
    const competition =
      await Competition.findById(competitionId).session(mongoSession);
    if (!competition) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 },
      );
    }

    // Only completed or emergency_ended competitions can have results adjusted
    if (!["completed", "emergency_ended"].includes(competition.status)) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        {
          error: `Cannot adjust results for a ${competition.status} competition. Must be completed or emergency_ended.`,
        },
        { status: 400 },
      );
    }

    console.log(
      `🔧 [ResultAdjustment] Processing ${adjustments.length} adjustments for competition ${competitionId}`,
    );

    const results: Array<{
      participantId: string;
      userId?: string;
      username?: string;
      adjustment: string;
      success: boolean;
      error?: string;
      prizeChange?: number;
    }> = [];

    let totalPrizeAdjustment = 0;
    const resultAdjustments: Array<{
      participantId: string;
      userId: string;
      username?: string;
      previousRank?: number;
      newRank?: number;
      previousPrize?: number;
      newPrize?: number;
      adjustmentReason: string;
    }> = [];

    for (const adj of adjustments) {
      try {
        if (!adj.participantId || !adj.reason) {
          results.push({
            participantId: adj.participantId || "unknown",
            adjustment: "validation_failed",
            success: false,
            error: "participantId and reason are required",
          });
          continue;
        }

        // Get participant
        const participant = await CompetitionParticipant.findById(
          adj.participantId,
        ).session(mongoSession);
        if (!participant) {
          results.push({
            participantId: adj.participantId,
            adjustment: "not_found",
            success: false,
            error: "Participant not found",
          });
          continue;
        }

        const previousRank = participant.finalRank;
        const previousPrize = participant.prizeWon || 0;
        let adjustmentType = "";

        // Handle disqualification
        if (adj.disqualify && participant.status !== "disqualified") {
          participant.status = "disqualified";
          participant.disqualificationReason = adj.reason;
          adjustmentType = "disqualified";

          // If they had a prize, we need to reclaim it
          if (previousPrize > 0) {
            const wallet = await CreditWallet.findOne({
              userId: participant.userId,
            }).session(mongoSession);
            if (wallet && wallet.creditBalance >= previousPrize) {
              await CreditWallet.findByIdAndUpdate(
                wallet._id,
                { $inc: { creditBalance: -previousPrize } },
                { session: mongoSession },
              );

              await WalletTransaction.create(
                [
                  {
                    userId: participant.userId.toString(),
                    transactionType: "prize_reclaim",
                    amount: -previousPrize,
                    balanceBefore: wallet.creditBalance,
                    balanceAfter: wallet.creditBalance - previousPrize,
                    competitionId,
                    status: "completed",
                    description: `Prize reclaimed due to disqualification: ${adj.reason}`,
                    metadata: {
                      incidentId,
                      reason: adj.reason,
                      adjustedBy: auth.adminId,
                    },
                  },
                ],
                { session: mongoSession },
              );

              totalPrizeAdjustment -= previousPrize;
              participant.prizeWon = 0;

              // Notify user
              await notificationService.createCustom({
                userId: participant.userId.toString(),
                type: "disqualification_adjustment",
                title: "⚠️ Competition Result Adjusted",
                message: `You have been disqualified from ${competition.name}. Your prize of €${previousPrize.toFixed(2)} has been reclaimed. Reason: ${adj.reason}`,
                icon: "alert-triangle",
                category: "trading",
                priority: "urgent",
                color: "red",
              });
            }
          }
        }

        // Handle reinstatement
        if (adj.reinstate && participant.status === "disqualified") {
          participant.status = "completed";
          participant.disqualificationReason = undefined;
          adjustmentType = "reinstated";
        }

        // Handle rank change
        if (adj.newRank !== undefined && adj.newRank !== previousRank) {
          participant.finalRank = adj.newRank;
          adjustmentType += adjustmentType ? ", rank_changed" : "rank_changed";
        }

        // Handle prize change
        if (adj.newPrize !== undefined && adj.newPrize !== previousPrize) {
          const prizeDiff = adj.newPrize - previousPrize;

          const wallet = await CreditWallet.findOne({
            userId: participant.userId,
          }).session(mongoSession);
          if (wallet) {
            // Check if reducing prize is possible
            if (prizeDiff < 0 && wallet.creditBalance < Math.abs(prizeDiff)) {
              results.push({
                participantId: adj.participantId,
                userId: participant.userId.toString(),
                username: participant.username,
                adjustment: "prize_change_failed",
                success: false,
                error: "Insufficient balance to reduce prize",
              });
              continue;
            }

            await CreditWallet.findByIdAndUpdate(
              wallet._id,
              { $inc: { creditBalance: prizeDiff } },
              { session: mongoSession },
            );

            await WalletTransaction.create(
              [
                {
                  userId: participant.userId.toString(),
                  transactionType:
                    prizeDiff > 0
                      ? "prize_adjustment_add"
                      : "prize_adjustment_deduct",
                  amount: prizeDiff,
                  balanceBefore: wallet.creditBalance,
                  balanceAfter: wallet.creditBalance + prizeDiff,
                  competitionId,
                  status: "completed",
                  description: `Prize adjustment for ${competition.name}: ${adj.reason}`,
                  metadata: {
                    incidentId,
                    previousPrize,
                    newPrize: adj.newPrize,
                    reason: adj.reason,
                    adjustedBy: auth.adminId,
                  },
                },
              ],
              { session: mongoSession },
            );

            participant.prizeWon = adj.newPrize;
            totalPrizeAdjustment += prizeDiff;
            adjustmentType += adjustmentType
              ? ", prize_changed"
              : "prize_changed";

            // Notify user
            await notificationService.createCustom({
              userId: participant.userId.toString(),
              type: "prize_adjustment",
              title:
                prizeDiff > 0 ? "💰 Prize Adjustment" : "⚠️ Prize Adjustment",
              message: `Your prize for ${competition.name} has been adjusted by €${prizeDiff.toFixed(2)}. New prize: €${adj.newPrize.toFixed(2)}. Reason: ${adj.reason}`,
              icon: "gift",
              category: "trading",
              priority: "high",
              color: prizeDiff > 0 ? "green" : "yellow",
            });
          }
        }

        await participant.save({ session: mongoSession });

        resultAdjustments.push({
          participantId: adj.participantId,
          userId: participant.userId.toString(),
          username: participant.username,
          previousRank,
          newRank: adj.newRank,
          previousPrize,
          newPrize: adj.newPrize,
          adjustmentReason: adj.reason,
        });

        results.push({
          participantId: adj.participantId,
          userId: participant.userId.toString(),
          username: participant.username,
          adjustment: adjustmentType || "no_change",
          success: true,
          prizeChange:
            adj.newPrize !== undefined ? adj.newPrize - previousPrize : 0,
        });

        console.log(`   ✅ ${participant.username}: ${adjustmentType}`);
      } catch (error) {
        results.push({
          participantId: adj.participantId,
          adjustment: "error",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Update incident with result adjustments
    if (!incident.resolution) {
      incident.resolution = {
        summary: "",
        action: "",
        compensations: [],
        resultAdjustments: [],
        resolvedAt: new Date(),
      };
    }

    incident.resolution.resultAdjustments = [
      ...incident.resolution.resultAdjustments,
      ...resultAdjustments,
    ];

    incident.resolution.action =
      globalReason || `Result adjustments for ${competition.name}`;

    incident.auditLog.push({
      timestamp: new Date(),
      action: "results_adjusted",
      by: auth.adminId || "admin",
      byEmail: auth.email,
      details: `Adjusted ${resultAdjustments.length} participant results. Total prize adjustment: €${totalPrizeAdjustment.toFixed(2)}`,
      metadata: { competitionId, results },
    });

    await incident.save({ session: mongoSession });

    await mongoSession.commitTransaction();

    console.log(
      `🔧 [ResultAdjustment] Complete: ${resultAdjustments.length} adjustments, €${totalPrizeAdjustment.toFixed(2)} prize change`,
    );

    return NextResponse.json({
      success: true,
      message: `Adjusted ${resultAdjustments.length} results. Total prize adjustment: €${totalPrizeAdjustment.toFixed(2)}`,
      results,
      totalPrizeAdjustment,
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error("Error adjusting results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    mongoSession.endSession();
  }
}
