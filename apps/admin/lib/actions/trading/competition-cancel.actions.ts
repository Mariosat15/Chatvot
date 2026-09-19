"use server";
/* eslint-disable */

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import TradingOrder from "@/database/models/trading/trading-order.model";
import TradeHistory from "@/database/models/trading/trade-history.model";
import mongoose from "mongoose";
import { formatVolts } from "@/lib/utils/format-volts";
import {
  ForexSymbol,
  calculateUnrealizedPnL,
  getQuoteToUsdRate,
  getConversionPairSymbols,
} from "@/lib/services/pnl-calculator.service";
import { getMultipleSymbolConfigs } from "@/lib/services/symbol-config.service";

/**
 * Cancel a competition and refund ALL participants their FULL entry fee
 * This includes the platform fee portion - users get a complete refund
 */
export async function cancelCompetitionAndRefund(
  competitionId: string,
  reason: string,
): Promise<{ success: boolean; refundedCount: number; totalRefunded: number }> {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;

  try {
    await connectToDatabase();

    console.log(
      `🚫 Starting competition cancellation and refund: ${competitionId}`,
    );
    console.log(`   Reason: ${reason}`);

    // Reason: claim the competition atomically before refunding anything, or a second
    // caller refunds every participant a second time. This is reachable in production, not
    // theoretical: the scheduled Inngest job cancels undersubscribed competitions and the
    // admin cancel route cancels on demand, so a scheduled sweep and an admin click can
    // overlap.
    //
    // The condition is the lock. Setting the final status up front means a second caller
    // matches nothing and leaves with a no-op, and because it happens inside the
    // transaction an abort rolls it back for a retry. Same shape as the lock
    // finalizeCompetition already uses.
    //
    // `new: false` returns the pre-update document, which is what the refund loop needs -
    // the entry fee and the name.
    //
    // Keep this identical to the copy in the main app.
    let competition = await Competition.findOneAndUpdate(
      { _id: competitionId, status: { $ne: "cancelled" } },
      {
        $set: {
          status: "cancelled",
          cancellationReason: reason,
          prizePool: 0, // Refunded in full below, so the pool is empty.
        },
      },
      { new: false, session },
    );

    if (!competition) {
      // Either it does not exist or it is already cancelled.
      const existing =
        await Competition.findById(competitionId).session(session);
      if (!existing) {
        throw new Error("Competition not found");
      }

      // R43, and this branch used to lose real money. It returned success with
      // refundedCount: 0 and logged "refunds were already issued", on the assumption that
      // an already-cancelled competition must have been refunded by whoever cancelled it.
      // The Inngest sweep broke that assumption: it set `status: "cancelled"` itself and
      // then called this action, so the claim above matched nothing and EVERY player's
      // entry fee was silently kept. Cancelled competition, agreeable log line, no refunds.
      //
      // So an already-cancelled competition is now refunded rather than refused, and
      // idempotency comes from the per-player ledger rows gathered below instead of from
      // the status. That is a strictly stronger key - it is what `exclusion-refund.ts`
      // already uses - and it heals whatever the caller did to the status first.
      console.log(
        `↩️ Competition ${competitionId} is already cancelled; checking for unrefunded players`,
      );
      competition = existing;

      // The pre-cancelling caller set a status but not the pool, so it can still be
      // non-zero here. A cancelled competition holding a fundable pot is how a later sweep
      // pays prizes out of money that has just been given back.
      if (existing.prizePool !== 0) {
        await Competition.findByIdAndUpdate(
          competitionId,
          { $set: { prizePool: 0 } },
          { session },
        );
      }
    }

    // Get all participants
    const participants = await CompetitionParticipant.find({
      competitionId: competitionId,
    }).session(session);

    console.log(`👥 Found ${participants.length} participants to refund`);

    const entryFee = competition.entryFee;
    let totalRefunded = 0;
    let refundedCount = 0;

    // IDEMPOTENCY, and it is deliberately not the status claim above that provides it any
    // more. The claim was enough only while every caller left the status alone; R43 proved
    // one did not, and refusing an already-cancelled competition outright is what lost the
    // money. Keying on the ledger row each refund writes is exact: a player who has been
    // paid back has a row, one who has not does not, whatever any caller did to the status.
    const priorRefunds = await WalletTransaction.find({
      competitionId,
      transactionType: "competition_refund",
    })
      .select("userId")
      .session(session)
      .lean<{ userId: string }[]>();

    const alreadyRefunded = new Set(priorRefunds.map((t) => String(t.userId)));

    // Import notification service
    const { notificationService } =
      await import("@/lib/services/notification.service");

    // Refund each participant
    for (const participant of participants) {
      const userId = participant.userId.toString();

      // Reason: already paid back, on an earlier run or by another caller. Skipping keeps a
      // second sweep a no-op for this player while still refunding anyone it missed, which
      // a single competition-wide early return could not do.
      if (alreadyRefunded.has(userId)) {
        continue;
      }

      // Get participant's wallet
      const wallet = await CreditWallet.findOne({ userId }).session(session);
      if (!wallet) {
        console.log(`⚠️ No wallet found for user ${userId}, skipping`);
        continue;
      }

      // Calculate FULL refund (entry fee that was charged)
      //
      // Reason the full fee is the right amount, corrected 4 Sep 2026: the pool holds the
      // WHOLE entry fee. `contest-entry.service.ts` does `$inc: { prizePool: entryFee }`
      // and the platform fee is taken later, out of the pool, not at the door. This comment
      // used to claim the pool arrived here already net of the platform fee, which would
      // have made refunding the whole fee look like an overpayment - and it is the same fact
      // the `exclude` re-split in `lib/services/settlement/provider-settlement.service.ts`
      // depends on, so a reader acting on the old version would under-reduce the pool there.
      const refundAmount = entryFee;
      const newBalance = wallet.creditBalance + refundAmount;

      // Reason: Refunds reverse the original spend — do NOT inflate totalWonFromCompetitions.
      // Track refunds in totalRefunded and reverse totalSpentOnCompetitions.
      await CreditWallet.findByIdAndUpdate(
        wallet._id,
        {
          $inc: {
            creditBalance: refundAmount,
            totalSpentOnCompetitions: -refundAmount,
            totalRefunded: refundAmount,
          },
        },
        { session },
      );

      // Create refund transaction
      await WalletTransaction.create(
        [
          {
            userId,
            transactionType: "competition_refund",
            amount: refundAmount,
            balanceBefore: wallet.creditBalance,
            balanceAfter: newBalance,
            competitionId: competitionId,
            status: "completed",
            description: `Competition cancelled - Full refund for "${competition.name}"`,
            metadata: {
              competitionName: competition.name,
              cancellationReason: reason,
              originalEntryFee: entryFee,
            },
          },
        ],
        { session },
      );

      // Update participant status
      await CompetitionParticipant.findByIdAndUpdate(
        participant._id,
        {
          $set: {
            status: "refunded",
          },
        },
        { session },
      );

      // Send notifications
      try {
        await notificationService.notifyCompetitionCancelled(
          userId,
          competitionId,
          competition.name,
          reason,
          entryFee,
        );
      } catch (notifError) {
        console.error(
          `Error sending cancellation notification to ${userId}:`,
          notifError,
        );
      }

      totalRefunded += refundAmount;
      refundedCount++;

      console.log(
        `   💰 Refunded ${refundAmount} credits to user ${userId} (new balance: ${newBalance})`,
      );
    }

    // A provider contest leaves a ROUND running where a trading contest leaves a position.
    // Nothing was closing it, so a cancellation produced a critical unresolved-round alert
    // for the operator's own deliberate action, and left the player inside a game for a
    // contest that no longer existed. See `contest-round-cleanup.ts` for the full sequence.
    //
    // Inside the transaction on purpose: if the refund rolls back, the rounds must still be
    // live. It is a no-op for a trading contest, which has none.
    const { endLiveRoundsForContest } = await import(
      "@/lib/services/games/contest-round-cleanup"
    );
    const voided = await endLiveRoundsForContest({
      contestId: competitionId,
      reason: `Competition cancelled: ${reason}`,
      session,
    });

    // Reason: the status, reason and prize pool are set by the claiming update at the top of
    // this transaction, or by the healing branch beside it when a caller had already
    // cancelled. Setting them again here would be harmless but misleading.
    //
    // This comment used to say the claim is "the thing preventing a double refund". That was
    // true when it was written and R43 made it false: the claim is now a fast path, and what
    // prevents a double refund is the per-player `competition_refund` ledger check above.
    // Left visible rather than quietly reworded, because a reader who trusts the old
    // sentence will conclude the ledger check is redundant and delete it.

    await session.commitTransaction();
    committed = true;

    console.log(`✅ Competition "${competition.name}" cancelled successfully`);
    console.log(`   Refunded: ${refundedCount} participants`);
    console.log(`   Total refunded: ${totalRefunded} credits`);
    if (voided.ended > 0 || voided.skipped > 0) {
      console.log(
        `   Voided rounds: ${voided.ended} (${voided.skipped} already terminal)`,
      );
    }

    // Revalidate pages to show updated status
    revalidatePath(`/competitions/${competitionId}`);
    revalidatePath(`/competitions/${competitionId}/trade`);
    revalidatePath("/competitions");
    revalidatePath("/competitions");

    return {
      success: true,
      refundedCount,
      totalRefunded,
    };
  } catch (error) {
    if (!committed) {
      await session.abortTransaction();
    }
    console.error("❌ Error cancelling competition:", error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Manually cancel a competition (admin action)
 * Can be used before or after start time
 */
export async function adminCancelCompetition(
  competitionId: string,
  reason: string,
  adminId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    await connectToDatabase();

    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return { success: false, message: "Competition not found" };
    }

    // Can only cancel upcoming or draft competitions manually
    if (!["upcoming", "draft"].includes(competition.status)) {
      return {
        success: false,
        message: `Cannot cancel a ${competition.status} competition. Only draft or upcoming competitions can be cancelled.`,
      };
    }

    // If there are participants, refund them
    const participantCount = competition.currentParticipants || 0;
    if (participantCount > 0) {
      const result = await cancelCompetitionAndRefund(competitionId, reason);
      return {
        success: true,
        message: `Competition cancelled. Refunded ${result.refundedCount} participants (${result.totalRefunded} credits total).`,
      };
    }

    // No participants - just cancel
    await Competition.findByIdAndUpdate(competitionId, {
      $set: {
        status: "cancelled",
        cancellationReason: reason,
      },
    });

    return {
      success: true,
      message: "Competition cancelled (no participants to refund).",
    };
  } catch (error) {
    console.error("Error in adminCancelCompetition:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to cancel competition",
    };
  }
}

/**
 * Emergency cancel an ACTIVE competition
 * - Closes all open positions using last valid prices
 * - Refunds ALL entry fees to ALL participants
 * - Marks competition as cancelled with emergency flag
 *
 * Use this when price feed issues compromise competition fairness
 */
export async function emergencyCancelActiveCompetition(
  competitionId: string,
  reason: string,
  adminId: string,
  snapshotPrices?: Map<string, { bid: number; ask: number }>,
): Promise<{
  success: boolean;
  message: string;
  closedPositions?: number;
  /** Live provider rounds voided by the cancellation. Zero on a trading contest. */
  voidedRounds?: number;
  refundedCount?: number;
  totalRefunded?: number;
}> {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();
  let committed = false;

  try {
    await connectToDatabase();

    console.log(
      `🚨 [EMERGENCY CANCEL] Starting emergency cancellation: ${competitionId}`,
    );
    console.log(`   Reason: ${reason}`);
    console.log(`   Admin: ${adminId}`);

    const competition =
      await Competition.findById(competitionId).session(mongoSession);
    if (!competition) {
      throw new Error("Competition not found");
    }

    // Must be active to emergency cancel
    if (competition.status !== "active") {
      throw new Error(
        `Cannot emergency cancel a ${competition.status} competition. Only active competitions can be emergency cancelled.`,
      );
    }

    // Step 1: Pause the competition immediately to prevent new trades
    competition.isPaused = true;
    competition.pausedAt = new Date();
    competition.pauseReason = `Emergency cancellation in progress: ${reason}`;
    await competition.save({ session: mongoSession });

    console.log(`⏸️ Competition paused for cancellation`);

    // Step 2: Close all open positions
    const openPositions = await TradingPosition.find({
      competitionId: competitionId,
      status: "open",
    }).session(mongoSession);

    console.log(`📊 Found ${openPositions.length} open positions to close`);

    let closedPositions = 0;

    // Get prices - either from snapshot or fetch current
    let pricesMap: Map<string, { bid: number; ask: number }>;

    if (snapshotPrices && snapshotPrices.size > 0) {
      pricesMap = snapshotPrices;
      console.log(`📸 Using snapshot prices for position closing`);
    } else {
      // Fetch current prices
      const { fetchRealForexPrices } =
        await import("@/lib/services/real-forex-prices.service");
      const uniqueSymbols = [
        ...new Set(openPositions.map((p) => p.symbol)),
      ] as ForexSymbol[];
      const fetchedPrices = await fetchRealForexPrices(uniqueSymbols);

      pricesMap = new Map();
      fetchedPrices.forEach((price, symbol) => {
        pricesMap.set(symbol, { bid: price.bid, ask: price.ask });
      });
      console.log(`📈 Using current market prices for position closing`);
    }

    // Fetch conversion pair prices for USD conversion
    const { fetchRealForexPrices: fetchConvPrices } =
      await import("@/lib/services/real-forex-prices.service");
    const cancelUniqueSymbols = [
      ...new Set(openPositions.map((p) => p.symbol)),
    ] as ForexSymbol[];
    const cancelConvSyms = getConversionPairSymbols(cancelUniqueSymbols);
    if (cancelConvSyms.length > 0) {
      const convFetched = await fetchConvPrices(cancelConvSyms);
      convFetched.forEach((price, symbol) => {
        if (!pricesMap.has(symbol)) {
          pricesMap.set(symbol, { bid: price.bid, ask: price.ask });
        }
      });
    }

    const symCfgEmergency = await getMultipleSymbolConfigs(cancelUniqueSymbols);

    // Close each position
    for (const position of openPositions) {
      try {
        const prices = pricesMap.get(position.symbol);
        if (!prices) {
          console.warn(
            `⚠️ No price available for ${position.symbol}, skipping position ${position._id}`,
          );
          continue;
        }

        // Determine exit price based on position side
        const exitPrice = position.side === "long" ? prices.bid : prices.ask;

        const cancelRate = getQuoteToUsdRate(
          position.symbol as ForexSymbol,
          pricesMap as Map<string, { bid: number; ask: number }>,
        );
        const scEm = symCfgEmergency.get(position.symbol);
        const realizedPnl = calculateUnrealizedPnL(
          position.side,
          position.entryPrice,
          exitPrice,
          position.quantity,
          position.symbol,
          cancelRate > 0 ? cancelRate : 1,
          scEm ? { pip: scEm.pip, contractSize: scEm.contractSize } : undefined,
        );

        // Update position
        await TradingPosition.findByIdAndUpdate(
          position._id,
          {
            $set: {
              status: "closed",
              closeReason: "competition_cancelled",
              exitPrice: exitPrice,
              currentPrice: exitPrice,
              pnl: realizedPnl,
              unrealizedPnl: 0,
              closedAt: new Date(),
            },
          },
          { session: mongoSession },
        );

        // Create close order
        await TradingOrder.create(
          [
            {
              competitionId: position.competitionId,
              userId: position.userId,
              participantId: position.participantId,
              symbol: position.symbol,
              side: position.side === "long" ? "sell" : "buy",
              orderType: "market",
              quantity: position.quantity,
              executedPrice: exitPrice,
              leverage: position.leverage,
              marginRequired: 0,
              status: "filled",
              filledQuantity: position.quantity,
              remainingQuantity: 0,
              placedAt: new Date(),
              executedAt: new Date(),
              orderSource: "system",
              positionId: position._id.toString(),
            },
          ],
          { session: mongoSession },
        );

        // Calculate trade metrics
        const priceChange = exitPrice - position.entryPrice;
        const priceChangePercentage = (priceChange / position.entryPrice) * 100;
        const realizedPnlPercentage =
          position.marginUsed > 0
            ? (realizedPnl / position.marginUsed) * 100
            : 0;
        const closedAt = new Date();
        const holdingTimeSeconds = Math.floor(
          (closedAt.getTime() - position.openedAt.getTime()) / 1000,
        );

        // Create trade history with all required fields
        await TradeHistory.create(
          [
            {
              competitionId: position.competitionId,
              challengeId: position.challengeId,
              participantId: position.participantId,
              userId: position.userId,
              positionId: position._id.toString(),
              symbol: position.symbol,
              side: position.side,
              quantity: position.quantity,
              orderType: "market",
              entryPrice: position.entryPrice,
              exitPrice: exitPrice,
              priceChange,
              priceChangePercentage,
              realizedPnl,
              realizedPnlPercentage,
              openedAt: position.openedAt,
              closedAt,
              holdingTimeSeconds,
              closeReason: "emergency_cancel",
              leverage: position.leverage,
              marginUsed: position.marginUsed || 0,
              hadStopLoss: !!position.stopLoss,
              stopLossPrice: position.stopLoss,
              hadTakeProfit: !!position.takeProfit,
              takeProfitPrice: position.takeProfit,
              openOrderId: position.orderId || `emergency_${position._id}`,
              closeOrderId: `emergency_close_${position._id}`,
              isWinner: realizedPnl > 0,
            },
          ],
          { session: mongoSession },
        );

        closedPositions++;
      } catch (posError) {
        console.error(`Error closing position ${position._id}:`, posError);
      }
    }

    console.log(`✅ Closed ${closedPositions} positions`);

    // Step 3: Refund all participants
    const participants = await CompetitionParticipant.find({
      competitionId: competitionId,
    }).session(mongoSession);

    console.log(`👥 Found ${participants.length} participants to refund`);

    const entryFee = competition.entryFee;
    let totalRefunded = 0;
    let refundedCount = 0;

    const { notificationService } =
      await import("@/lib/services/notification.service");

    for (const participant of participants) {
      const userId = participant.userId.toString();

      // Get wallet
      const wallet = await CreditWallet.findOne({ userId }).session(
        mongoSession,
      );
      if (!wallet) {
        console.log(`⚠️ No wallet found for user ${userId}, skipping`);
        continue;
      }

      // Full refund
      const refundAmount = entryFee;
      const newBalance = wallet.creditBalance + refundAmount;

      // Reason: Refunds reverse the original spend — do NOT inflate totalWonFromCompetitions.
      await CreditWallet.findByIdAndUpdate(
        wallet._id,
        {
          $inc: {
            creditBalance: refundAmount,
            totalSpentOnCompetitions: -refundAmount,
            totalRefunded: refundAmount,
          },
        },
        { session: mongoSession },
      );

      // Create refund transaction
      await WalletTransaction.create(
        [
          {
            userId,
            transactionType: "competition_refund",
            amount: refundAmount,
            balanceBefore: wallet.creditBalance,
            balanceAfter: newBalance,
            competitionId: competitionId,
            status: "completed",
            description: `Emergency cancellation - Full refund for "${competition.name}"`,
            metadata: {
              competitionName: competition.name,
              cancellationReason: reason,
              originalEntryFee: entryFee,
              isEmergency: true,
              cancelledBy: adminId,
            },
          },
        ],
        { session: mongoSession },
      );

      // Update participant status
      await CompetitionParticipant.findByIdAndUpdate(
        participant._id,
        { $set: { status: "refunded" } },
        { session: mongoSession },
      );

      // Send notification
      try {
        await notificationService.createCustom({
          userId,
          type: "competition_emergency_cancelled",
          title: "🚨 Competition Emergency Cancelled",
          // Reason: the entry fee was debited in credits and the refund credits them back, so
          // quoting euros here told a player they had been given back something they never paid.
          message: `${competition.name} has been emergency cancelled due to: ${reason}. Your full entry fee of ${formatVolts(entryFee)} has been refunded.`,
          icon: "alert-octagon",
          category: "trading",
          priority: "urgent",
          color: "red",
        });
      } catch (notifError) {
        console.error(`Error sending notification to ${userId}:`, notifError);
      }

      totalRefunded += refundAmount;
      refundedCount++;
    }

    // Step 3b: end the rounds. Step 2 closed trading POSITIONS, which is the whole of what a
    // trading contest leaves running; a provider contest leaves a live ROUND, and nothing was
    // closing it. Without this the operator receives a critical unresolved-round alert as a
    // direct consequence of their own emergency action - the fastest way to teach a team to
    // ignore critical alerts.
    const { endLiveRoundsForContest } = await import(
      "@/lib/services/games/contest-round-cleanup"
    );
    const voided = await endLiveRoundsForContest({
      contestId: competitionId,
      reason: `Emergency cancellation: ${reason}`,
      session: mongoSession,
    });

    // Step 4: Update competition status
    await Competition.findByIdAndUpdate(
      competitionId,
      {
        $set: {
          status: "cancelled",
          cancellationReason: `EMERGENCY: ${reason}`,
          prizePool: 0,
          isPaused: false,
          emergencyEndedAt: new Date(),
          emergencyEndReason: reason,
          emergencyEndedBy: adminId,
        },
      },
      { session: mongoSession },
    );

    await mongoSession.commitTransaction();
    committed = true;

    console.log(
      `✅ [EMERGENCY CANCEL] Competition "${competition.name}" cancelled successfully`,
    );
    console.log(`   Closed positions: ${closedPositions}`);
    console.log(`   Voided rounds: ${voided.ended} (${voided.skipped} already terminal)`);
    console.log(`   Refunded: ${refundedCount} participants`);
    console.log(`   Total refunded: ${totalRefunded} credits`);

    // Revalidate pages
    revalidatePath(`/competitions/${competitionId}`);
    revalidatePath(`/competitions/${competitionId}/trade`);
    revalidatePath("/competitions");

    return {
      success: true,
      message: `Emergency cancellation complete. Closed ${closedPositions} positions, voided ${voided.ended} live round(s), refunded ${refundedCount} participants (${totalRefunded} credits total).`,
      closedPositions,
      voidedRounds: voided.ended,
      refundedCount,
      totalRefunded,
    };
  } catch (error) {
    if (!committed) {
      await mongoSession.abortTransaction();
    }
    console.error("❌ [EMERGENCY CANCEL] Error:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to emergency cancel competition",
    };
  } finally {
    mongoSession.endSession();
  }
}
