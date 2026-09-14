import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import Incident from "@/database/models/incident.model";
import { notificationService } from "@/lib/services/notification.service";
import mongoose from "mongoose";
// Reason: every figure this route moves is a competition prize, which is credits. Both the
// player notifications and the operator's audit line quoted euros.
import { formatVolts } from "@/lib/utils/format-volts";

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
    // Guarded per-section. `verifyAdminAuth` is token validity, so an employee granted one
    // unrelated section could rewrite finalised ranks and pay prizes out of the platform's
    // pocket. Sixth instance of that class; see `finalize-old-competitions/route.ts`.
    const guard = await guardSection("competitions");
    if (!guard.ok) {
      await mongoSession.abortTransaction();
      return guard.response;
    }

    const { id: competitionId } = await params;
    const body = await request.json();
    const { incidentId, adjustments, globalReason } = body;

    /*
      Both of these used to return without aborting, leaving the transaction open until the
      `finally` ended the session under it. Every other refusal in this route aborts first, so
      it read as correct; the two validation arms simply predate the transaction.
    */
    if (!incidentId) {
      await mongoSession.abortTransaction();
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
      await mongoSession.abortTransaction();
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

    /*
      Only a COMPLETED competition can have its results adjusted.

      This used to admit `emergency_ended` as well, and the comment here used to say that
      excluding an emergency end was the defect - that an operator was refused at exactly the
      moment they most needed to correct a result. THAT WAS WRONG IN BOTH HALVES and is
      corrected in place rather than deleted, because it was believed for a week.

      The first half: `emergency_ended` is written by nothing. `emergencyCancelActiveCompetition`
      stores `"cancelled"` and records the emergency in `emergencyEndedAt` /
      `emergencyEndReason` / `emergencyEndedBy` alongside, so this arm of the gate had never
      once been reachable and its presence made the refusal message name a state no contest can
      be in.

      The second half, which matters more: an emergency end is a cancellation, and a
      cancellation REFUNDS every entry fee and zeroes the prize pool. There is no result to
      adjust, because nobody was ranked and nobody was paid - so admitting it would have let an
      operator credit a prize out of a pool that no longer exists, on top of the refund. The
      right refusal for an emergency-ended contest is the one that fires today.
    */
    if (competition.status !== "completed") {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        {
          error: `Cannot adjust results for a ${competition.status} competition. Only a completed competition has results to adjust - a cancelled one has already refunded every entry fee.`,
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

    /** userId -> what the participant ended up holding, for the stored snapshot below. */
    const snapshotUpdates = new Map<
      string,
      {
        rank?: number;
        prizeAmount: number;
        disqualified: boolean;
        disqualificationReason?: string;
      }
    >();

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

        /*
          WHAT THIS PLAYER WAS RECORDED AS HOLDING.

          This used to read `participant.finalRank` and `participant.prizeWon`. NEITHER FIELD IS
          DECLARED ON `CompetitionParticipant`, in either app - Mongoose defines getters only for
          declared paths, so both reads returned `undefined` however much money had been paid, and
          both writes below were discarded by strict mode while `save()` reported success.

          What that cost, in order of severity. A disqualification could never reclaim anything,
          because `previousPrize` was always 0 and the whole clawback block was skipped - the
          player kept the credits and the operator was told they had come back. A prize
          correction priced every change against 0, so "set this winner to 40" CREDITED 40 to a
          player already paid 100 instead of taking 60 back. And a rank change wrote a field the
          schema does not have, so it moved nothing at all, including the win and podium counts
          that read `currentRank`.

          Rank now reads and writes `currentRank`, which is what `completeContest` stores and
          what every win statistic on the platform counts. The prize comes from the stored
          `finalLeaderboard` row, which is what finalization recorded and what the operator's own
          settled-results panel renders - deliberately NOT a new `prizeWon` field, which would be
          a second source for a figure nothing else maintains.
        */
        const snapshotRow = competition.finalLeaderboard?.find(
          (row) => String(row.userId) === participant.userId.toString(),
        );

        /*
          No recorded result means no basis for moving money. Refused rather than treated as a
          zero prize, because a zero is indistinguishable from "we do not know" and the wrong
          reading here either lets a paid prize stand after a disqualification or credits a
          player twice. A contest finalized before X5 stored no leaderboard at all, which is
          exactly the case this catches.
        */
        if (
          !snapshotRow &&
          (adj.disqualify || adj.newPrize !== undefined)
        ) {
          results.push({
            participantId: adj.participantId,
            userId: participant.userId.toString(),
            username: participant.username,
            adjustment: "validation_failed",
            success: false,
            error: `This competition has no recorded result for ${participant.username}, so there is no prize on record to reclaim or correct. Nothing was changed.`,
          });
          continue;
        }

        const previousRank = participant.currentRank;
        const previousPrize = snapshotRow?.prizeAmount || 0;
        /** What the player holds as the adjustment proceeds. Zero after a reclaim. */
        let heldPrize = previousPrize;
        let adjustmentType = "";
        /*
          What actually moved, which is not the same as what was asked for. The result rows used
          to report `adj.newPrize - previousPrize` regardless of whether any credit changed
          hands, so an adjustment that moved nothing was reported as having moved the lot.
        */
        let appliedPrizeChange = 0;

        /*
          DISQUALIFICATION, WHICH MUST REFUSE RATHER THAN HALF-APPLY.

          This block used to set the status first and then attempt the clawback under
          `if (wallet && wallet.creditBalance >= previousPrize)`. When that condition was false -
          no wallet, or the player had already spent the prize, which is the overwhelmingly
          likely case for any disqualification found days later - the whole reclaim was skipped
          silently. The status was still saved, the stored leaderboard still showed the prize as
          paid, no ledger row was written, the player was never told, and the route reported
          `success: true, adjustment: "disqualified"`. The operator read that the money had come
          back. It had not.

          So the clawback is attempted BEFORE the status is touched, and an impossible one
          refuses the whole adjustment with the shortfall named. The alternative - letting the
          balance go negative - was rejected: it creates a debt the player cannot see, and the
          operator has other instruments (a restriction, or the incident compensation path) that
          are visible and reversible.
        */
        if (adj.disqualify && participant.status !== "disqualified") {
          if (previousPrize > 0) {
            const wallet = await CreditWallet.findOne({
              userId: participant.userId,
            }).session(mongoSession);

            if (!wallet) {
              results.push({
                participantId: adj.participantId,
                userId: participant.userId.toString(),
                username: participant.username,
                adjustment: "disqualify_failed",
                success: false,
                error: `Cannot reclaim the ${formatVolts(previousPrize)} prize: this player has no credit wallet. Nothing was changed.`,
              });
              continue;
            }

            if (wallet.creditBalance < previousPrize) {
              results.push({
                participantId: adj.participantId,
                userId: participant.userId.toString(),
                username: participant.username,
                adjustment: "disqualify_failed",
                success: false,
                error: `Cannot reclaim the ${formatVolts(previousPrize)} prize: the balance is ${formatVolts(wallet.creditBalance)}. Nothing was changed.`,
              });
              continue;
            }

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
                    adjustedBy: guard.admin.id,
                  },
                },
              ],
              { session: mongoSession },
            );

            totalPrizeAdjustment -= previousPrize;
            appliedPrizeChange -= previousPrize;
            heldPrize = 0;

            // Notify user
            await notificationService.createCustom({
              userId: participant.userId.toString(),
              type: "disqualification_adjustment",
              title: "⚠️ Competition Result Adjusted",
              message: `You have been disqualified from ${competition.name}. Your prize of ${formatVolts(previousPrize)} has been reclaimed. Reason: ${adj.reason}`,
              icon: "alert-triangle",
              category: "trading",
              priority: "urgent",
              color: "red",
            });
          }

          participant.status = "disqualified";
          participant.disqualificationReason = adj.reason;
          adjustmentType = "disqualified";
        }

        // Handle reinstatement
        if (adj.reinstate && participant.status === "disqualified") {
          participant.status = "completed";
          participant.disqualificationReason = undefined;
          adjustmentType = "reinstated";
        }

        // Handle rank change
        if (adj.newRank !== undefined && adj.newRank !== previousRank) {
          participant.currentRank = adj.newRank;
          adjustmentType += adjustmentType ? ", rank_changed" : "rank_changed";
        }

        /*
          PRIZE CHANGE. Two defects lived here and both reported success.

          THE BASELINE. `prizeDiff` was computed against `previousPrize`, captured before the
          disqualification block ran. Disqualifying and setting a prize in one adjustment
          therefore reclaimed the old prize AND then credited `newPrize - previousPrize` on top,
          leaving the player `newPrize - 2 x previousPrize` and the audit line wrong by the same
          amount. The baseline has to be what the participant holds NOW, which is zero after a
          reclaim and unchanged otherwise.

          THE MISSING WALLET. The whole block sat inside `if (wallet)`, so a player with no
          wallet had no credit moved, no ledger row and no notification - and was then reported
          as `success: true` with the full prize change, which went into
          the incident's permanent audit trail as fact. The refusal three lines below for an
          insufficient balance shows the file already knew this should refuse; it simply missed
          the branch. An INCREASE now creates the wallet, which is what settlement itself does
          in `prize-payout.service.ts`; a DECREASE refuses, because there is nothing to take.
        */
        if (adj.newPrize !== undefined) {
          const basePrize = heldPrize;
          const prizeDiff = adj.newPrize - basePrize;

          if (prizeDiff !== 0) {
            let wallet = await CreditWallet.findOne({
              userId: participant.userId,
            }).session(mongoSession);

            if (!wallet && prizeDiff < 0) {
              results.push({
                participantId: adj.participantId,
                userId: participant.userId.toString(),
                username: participant.username,
                adjustment: "prize_change_failed",
                success: false,
                error: `Cannot reduce the prize by ${formatVolts(-prizeDiff)}: this player has no credit wallet.`,
              });
              continue;
            }

            if (!wallet) {
              const created = await CreditWallet.create(
                [
                  {
                    userId: participant.userId,
                    creditBalance: 0,
                    totalDeposited: 0,
                    totalWithdrawn: 0,
                    totalSpentOnCompetitions: 0,
                    totalWonFromCompetitions: 0,
                    isActive: true,
                    kycVerified: false,
                    withdrawalEnabled: false,
                  },
                ],
                { session: mongoSession },
              );
              wallet = created[0];
            }

            // Check if reducing prize is possible
            if (prizeDiff < 0 && wallet.creditBalance < Math.abs(prizeDiff)) {
              results.push({
                participantId: adj.participantId,
                userId: participant.userId.toString(),
                username: participant.username,
                adjustment: "prize_change_failed",
                success: false,
                error: `Insufficient balance to reduce prize: the balance is ${formatVolts(wallet.creditBalance)} and ${formatVolts(-prizeDiff)} would be deducted.`,
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
                    previousPrize: basePrize,
                    newPrize: adj.newPrize,
                    reason: adj.reason,
                    adjustedBy: guard.admin.id,
                  },
                },
              ],
              { session: mongoSession },
            );

            heldPrize = adj.newPrize;
            totalPrizeAdjustment += prizeDiff;
            appliedPrizeChange += prizeDiff;
            adjustmentType += adjustmentType
              ? ", prize_changed"
              : "prize_changed";

            // Notify user
            await notificationService.createCustom({
              userId: participant.userId.toString(),
              type: "prize_adjustment",
              title:
                prizeDiff > 0 ? "💰 Prize Adjustment" : "⚠️ Prize Adjustment",
              message: `Your prize for ${competition.name} has been adjusted by ${formatVolts(prizeDiff)}. New prize: ${formatVolts(adj.newPrize)}. Reason: ${adj.reason}`,
              icon: "gift",
              category: "trading",
              priority: "high",
              color: prizeDiff > 0 ? "green" : "yellow",
            });
          }
        }

        await participant.save({ session: mongoSession });

        /*
          The stored snapshot has to move with the participant, or the two disagree for ever and
          the snapshot is the one an operator reads. `SettledResultPanel` renders
          `competition.finalLeaderboard` and captions it as the amounts paid, so a rank or prize
          corrected here was invisible there and the corrected figure appeared nowhere.

          Keyed on `userId`, because `finalLeaderboard` rows carry no participant id. An absent
          snapshot is left absent rather than invented: a contest settled before X5 may have
          none, and a row fabricated now would claim to be what finalization recorded.
        */
        snapshotUpdates.set(participant.userId.toString(), {
          rank: participant.currentRank,
          prizeAmount: heldPrize,
          disqualified: participant.status === "disqualified",
          disqualificationReason: participant.disqualificationReason,
        });

        resultAdjustments.push({
          participantId: adj.participantId,
          userId: participant.userId.toString(),
          username: participant.username,
          previousRank,
          newRank: adj.newRank,
          previousPrize,
          // Reason: what the participant now holds, which is 0 after a disqualification even
          // when the caller asked for something else. `adj.newPrize` is a request, not an
          // outcome, and this row is the permanent audit trail.
          newPrize: heldPrize,
          adjustmentReason: adj.reason,
        });

        results.push({
          participantId: adj.participantId,
          userId: participant.userId.toString(),
          username: participant.username,
          adjustment: adjustmentType || "no_change",
          success: true,
          prizeChange: appliedPrizeChange,
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

    /*
      Carry the adjustments into the stored leaderboard snapshot. See `snapshotUpdates` above
      for why this exists; the count is reported so an operator can tell an adjustment that
      reached the snapshot from one on a contest that has none.
    */
    let snapshotRowsUpdated = 0;
    if (snapshotUpdates.size > 0 && competition.finalLeaderboard?.length) {
      for (const row of competition.finalLeaderboard) {
        const update = snapshotUpdates.get(String(row.userId));
        if (!update) continue;

        if (update.rank !== undefined) row.rank = update.rank;
        row.prizeAmount = update.prizeAmount;
        if (update.disqualified) {
          row.qualificationStatus = "disqualified";
          row.disqualificationReason = update.disqualificationReason;
        }
        snapshotRowsUpdated += 1;
      }

      if (snapshotRowsUpdated > 0) {
        competition.markModified("finalLeaderboard");
        await competition.save({ session: mongoSession });
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
      by: guard.admin.id,
      byEmail: guard.admin.email,
      details: `Adjusted ${resultAdjustments.length} participant results. Total prize adjustment: ${formatVolts(totalPrizeAdjustment)}. Snapshot rows updated: ${snapshotRowsUpdated}`,
      metadata: { competitionId, results },
    });

    await incident.save({ session: mongoSession });

    await mongoSession.commitTransaction();

    console.log(
      `🔧 [ResultAdjustment] Complete: ${resultAdjustments.length} adjustments, ${formatVolts(totalPrizeAdjustment)} prize change`,
    );

    return NextResponse.json({
      success: true,
      message: `Adjusted ${resultAdjustments.length} results. Total prize adjustment: ${formatVolts(totalPrizeAdjustment)}`,
      results,
      totalPrizeAdjustment,
      snapshotRowsUpdated,
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
