"use server";

import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import ChallengeSettings from "@/database/models/trading/challenge-settings.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import { fetchRealForexPrices } from "@/lib/services/real-forex-prices.service";
import { getMultipleSymbolConfigs } from "@/lib/services/symbol-config.service";
import {
  type ForexSymbol,
  calculateUnrealizedPnL,
  getQuoteToUsdRate,
  getConversionPairSymbols,
} from "@/lib/services/pnl-calculator.service";
import { routeToTradingSettlement } from "@/lib/games/settlement";
import { settleChallenge } from "@/lib/services/settlement/challenge-settlement.service";

/**
 * Finalize a single challenge - close positions, determine winner and distribute prizes
 * Retries up to 3 times on transient transaction errors (WriteConflict)
 *
 * X1 seam 3: the game dispatch lives HERE rather than at the call sites. One of this
 * function's five callers is a page component, which is the clearest evidence that a
 * per-call-site dispatch would eventually be missed.
 */
export async function finalizeChallenge(challengeId: string) {
  const MAX_RETRIES = 3;

  // Gate before the retry loop and before any lock is taken, so a refusal leaves the
  // challenge untouched rather than stranded in "finalizing".
  await connectToDatabase();
  const label = await Challenge.findById(challengeId)
    .select("gameType")
    .lean<{ gameType?: string } | null>();

  if (label) {
    const route = routeToTradingSettlement(
      label.gameType,
      `challenge ${challengeId}`,
    );

    if (!route.ok) {
      console.error(`❌ [CHALLENGE] ${route.error}`);
      return { success: false, error: route.error };
    }
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _finalizeChallengeAttempt(challengeId);
    } catch (error: unknown) {
      const mongoErr = error as Record<string, unknown> | null;
      const isTransient =
        (mongoErr?.errorLabelSet as Set<string> | undefined)?.has?.("TransientTransactionError") ||
        (mongoErr?.errorLabels as string[] | undefined)?.includes?.("TransientTransactionError") ||
        mongoErr?.code === 112 || // WriteConflict
        mongoErr?.codeName === "WriteConflict";

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 4000); // 500ms, 1s, 2s
        console.warn(
          `⚠️ [CHALLENGE] TransientTransactionError on attempt ${attempt}/${MAX_RETRIES} for ${challengeId}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Non-transient error or max retries exhausted
      throw error;
    }
  }

  // Reason: This line is only reached if MAX_RETRIES is 0 (impossible with current config).
  // Added to satisfy TypeScript's "not all code paths return a value" check.
  return {
    success: false,
    error: `Challenge finalization failed after ${MAX_RETRIES} retries`,
  };
}

async function _finalizeChallengeAttempt(challengeId: string) {
  await connectToDatabase();

  // OPTIMISTIC LOCK: Atomically claim this challenge for finalization.
  // Only one caller can change "active" → "finalizing". All others get null and exit.
  // Also require endTime to have passed (or not set) to avoid premature finalization.
  const lockResult = await Challenge.findOneAndUpdate(
    {
      _id: challengeId,
      status: "active",
      $or: [
        { endTime: { $exists: false } },
        { endTime: null },
        { endTime: { $lte: new Date() } },
      ],
    },
    { $set: { status: "finalizing" } },
    { new: true },
  );

  if (!lockResult) {
    // Another process already claimed it, or it's not active
    console.log(`Challenge ${challengeId} not active (already claimed or completed), skipping`);
    return null;
  }

  // Defence in depth behind the gate in finalizeChallenge. Private with one caller today,
  // so this should be unreachable - it exists because trading settlement running on a
  // provider contest pays the wrong players without erroring.
  // Reason: the lock must be RELEASED on refusal, or the challenge is stranded in
  // "finalizing" and no later attempt can claim it.
  const settlementRoute = routeToTradingSettlement(
    lockResult.gameType,
    `challenge ${challengeId}`,
  );

  if (!settlementRoute.ok) {
    await Challenge.findOneAndUpdate(
      { _id: challengeId, status: "finalizing" },
      { $set: { status: "active" } },
    );
    console.error(`❌ [CHALLENGE] ${settlementRoute.error}`);
    return { success: false, error: settlementRoute.error };
  }

  // Reason: Use the model's own connection for session creation to avoid
  // "ClientSession must be from the same MongoClient" when this file is
  // imported into the admin bundle (dual mongoose instances).
  const session = await Challenge.db.startSession();
  session.startTransaction();

  try {
    const challenge = await Challenge.findById(challengeId).session(session);
    if (!challenge) {
      console.log(`Challenge ${challengeId} not found, skipping`);
      await session.abortTransaction();
      // Reset status back since we locked it
      await Challenge.updateOne({ _id: challengeId, status: "finalizing" }, { $set: { status: "active" } });
      return null;
    }

    // Check if challenge has ended
    if (challenge.endTime && new Date() < challenge.endTime) {
      console.log(`Challenge ${challengeId} hasn't ended yet`);
      await session.abortTransaction();
      // Reset lock since challenge isn't ready yet
      await Challenge.updateOne({ _id: challengeId, status: "finalizing" }, { $set: { status: "active" } });
      return null;
    }

    console.log(`\n🏁 Finalizing challenge ${challengeId}...`);

    // Get participants
    const participants = await ChallengeParticipant.find({
      challengeId: challengeId,
    }).session(session);

    if (participants.length !== 2) {
      console.error(`Challenge ${challengeId} doesn't have 2 participants`);
      await session.abortTransaction();
      return null;
    }

    const challenger = participants.find((p) => p.role === "challenger");
    const challenged = participants.find((p) => p.role === "challenged");

    if (!challenger || !challenged) {
      console.error(`Challenge ${challengeId} missing participants`);
      await session.abortTransaction();
      return null;
    }

    // Sanitize floating-point artifacts from DB (e.g. usedMargin: -5.68e-14 instead of 0)
    for (const p of [challenger, challenged]) {
      if (p.usedMargin < 0 && p.usedMargin > -1e-6) p.usedMargin = 0;
      if (p.unrealizedPnl !== 0 && Math.abs(p.unrealizedPnl) < 1e-6) p.unrealizedPnl = 0;
    }

    // Import required models
    const TradeHistory = (
      await import("@/database/models/trading/trade-history.model")
    ).default;
    const TradingOrder = (
      await import("@/database/models/trading/trading-order.model")
    ).default;

    // ========== STEP 1: CLOSE ALL OPEN POSITIONS ==========
    // Positions use challengeId as "competitionId"
    const allPositions = await TradingPosition.find({
      competitionId: challengeId,
    }).session(session);

    console.log(`Found ${allPositions.length} total positions for challenge`);

    // Track stats for each participant
    const participantStats = new Map<
      string,
      {
        totalPnL: number;
        currentCapital: number;
        winningTrades: number;
        losingTrades: number;
        totalTrades: number;
      }
    >();

    // Initialize stats
    for (const p of [challenger, challenged]) {
      participantStats.set(p.userId, {
        totalPnL: 0,
        currentCapital: p.startingCapital,
        winningTrades: 0,
        losingTrades: 0,
        totalTrades: 0,
      });
    }

    // Reason: Pre-fetch conversion pair prices for closed-position PnL USD conversion.
    const cfAllPosSymbols = [
      ...new Set(allPositions.map((p) => p.symbol)),
    ] as ForexSymbol[];
    const cfEarlyConv = getConversionPairSymbols(cfAllPosSymbols);
    let cfConvPrices: Map<string, { bid: number; ask: number }> = new Map();
    if (cfEarlyConv.length > 0) {
      const m = await fetchRealForexPrices(cfEarlyConv);
      cfConvPrices = m as Map<string, { bid: number; ask: number }>;
    }

    const symConfigs = await getMultipleSymbolConfigs(cfAllPosSymbols);

    // Reason: Trust the realized P&L recorded in TradeHistory at each close
    // instead of re-deriving with the CURRENT conversion rate (see
    // competition-end.actions.ts for the full rationale). Positions on a
    // challenge store the challengeId in the competitionId field.
    const cfClosedHistory = (await TradeHistory.find(
      { competitionId: challengeId },
      { positionId: 1, realizedPnl: 1 },
    )
      .session(session)
      .lean()) as Array<{ positionId?: string; realizedPnl?: number }>;
    const cfRealizedByPositionId = new Map<string, number>();
    for (const h of cfClosedHistory) {
      const pid = h?.positionId ? String(h.positionId) : "";
      if (!pid) continue;
      const val =
        typeof h.realizedPnl === "number" && Number.isFinite(h.realizedPnl)
          ? h.realizedPnl
          : 0;
      cfRealizedByPositionId.set(
        pid,
        (cfRealizedByPositionId.get(pid) || 0) + val,
      );
    }

    // Process already-closed positions
    for (const position of allPositions) {
      if (position.status === "closed" || position.status === "liquidated") {
        const userId = position.userId.toString();
        const stats = participantStats.get(userId);
        if (stats) {
          // Reason: Prefer the realized P&L recorded in TradeHistory at close
          // time; only re-derive when no history row exists for this position.
          const recorded = cfRealizedByPositionId.get(String(position._id));
          let positionPnL: number;
          if (typeof recorded === "number") {
            positionPnL = recorded;
          } else {
            const exitPrice =
              position.exitPrice ??
              position.currentPrice ??
              position.entryPrice;
            const cfRate = getQuoteToUsdRate(
              position.symbol as ForexSymbol,
              cfConvPrices,
            );
            const sc = symConfigs.get(position.symbol);
            positionPnL = calculateUnrealizedPnL(
              position.side,
              position.entryPrice,
              exitPrice,
              position.quantity,
              position.symbol,
              cfRate > 0 ? cfRate : 1,
              sc ? { pip: sc.pip, contractSize: sc.contractSize } : undefined,
            );
          }

          console.log(
            `  Closed position: ${position.symbol} ${position.side}, P&L: $${positionPnL.toFixed(2)} (${typeof recorded === "number" ? "from history" : "re-derived"})`,
          );

          stats.totalPnL += positionPnL;
          stats.currentCapital += positionPnL;
          stats.totalTrades++;
          if (positionPnL > 0) stats.winningTrades++;
          else if (positionPnL < 0) stats.losingTrades++;
        }
      }
    }

    console.log(
      `Processed ${allPositions.filter((p) => p.status === "closed" || p.status === "liquidated").length} already-closed positions`,
    );

    // Close open positions
    const openPositions = allPositions.filter((p) => p.status === "open");
    console.log(`Closing ${openPositions.length} open positions...`);

    const uniqueSymbols = [
      ...new Set(openPositions.map((p) => p.symbol)),
    ] as ForexSymbol[];
    const cfConvSyms = getConversionPairSymbols(uniqueSymbols);
    const cfAllSyms = [
      ...new Set([...uniqueSymbols, ...cfConvSyms]),
    ] as ForexSymbol[];
    console.log(
      `Fetching prices for ${cfAllSyms.length} symbols (${uniqueSymbols.length} trade + ${cfConvSyms.length} conversion)...`,
    );
    const pricesMap = await fetchRealForexPrices(cfAllSyms);
    console.log(`Got ${pricesMap.size} prices in single batch`);

    for (const position of openPositions) {
      try {
        // Get price from pre-fetched batch (instant!)
        const priceData = pricesMap.get(position.symbol as ForexSymbol);
        // Reason: NEVER leave a position open on a finalized challenge. If the
        // feed returns no price for this symbol, fall back to the position's last
        // known price (currentPrice → entryPrice) so the close loop cannot skip
        // it and orphan an "open" position on a completed contest.
        const exitPrice = priceData
          ? position.side === "long"
            ? priceData.bid
            : priceData.ask
          : (position.currentPrice ?? position.entryPrice);
        if (!priceData) {
          console.warn(
            `  ⚠️ No live price for ${position.symbol}; closing at fallback ${exitPrice} (last known price)`,
          );
        }

        const priceDiff =
          position.side === "long"
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        const cfRate2 = getQuoteToUsdRate(
          position.symbol as ForexSymbol,
          pricesMap as Map<string, { bid: number; ask: number }>,
        );
        const sc2 = symConfigs.get(position.symbol);
        const positionPnL = calculateUnrealizedPnL(
          position.side,
          position.entryPrice,
          exitPrice,
          position.quantity,
          position.symbol,
          cfRate2 > 0 ? cfRate2 : 1,
          sc2 ? { pip: sc2.pip, contractSize: sc2.contractSize } : undefined,
        );

        console.log(
          `  Closing ${position.symbol} ${position.side} for ${position.userId}: P&L $${positionPnL.toFixed(2)}`,
        );

        // Create close order
        const closeOrder = await TradingOrder.create(
          [
            {
              competitionId: challengeId,
              userId: position.userId,
              participantId: position.participantId,
              symbol: position.symbol,
              side: position.side === "long" ? "sell" : "buy",
              orderType: "market",
              quantity: position.quantity,
              executedPrice: exitPrice,
              slippage: 0,
              leverage: position.leverage,
              marginRequired: position.marginUsed,
              status: "filled",
              filledQuantity: position.quantity,
              remainingQuantity: 0,
              placedAt: new Date(),
              executedAt: new Date(),
              orderSource: "system",
            },
          ],
          { session },
        );

        // Reason: Mongoose create() returns array; destructure + guard for safety
        const createdCloseOrder = closeOrder[0];
        if (!createdCloseOrder) {
          throw new Error("Failed to create close order for challenge end");
        }

        // Update position
        await TradingPosition.findByIdAndUpdate(
          position._id,
          {
            $set: {
              status: "closed",
              exitPrice: exitPrice,
              profitLoss: positionPnL,
              closedAt: new Date(),
              closeReason: "challenge_end",
              closeOrderId: createdCloseOrder._id.toString(),
            },
          },
          { session },
        );

        // Create TradeHistory record
        const holdingTime = Math.floor(
          (Date.now() - position.openedAt.getTime()) / 1000,
        );
        await TradeHistory.create(
          [
            {
              competitionId: challengeId,
              userId: position.userId,
              participantId: position.participantId,
              symbol: position.symbol,
              side: position.side,
              quantity: position.quantity,
              orderType: "market",
              entryPrice: position.entryPrice,
              exitPrice: exitPrice,
              priceChange: priceDiff,
              priceChangePercentage: (priceDiff / position.entryPrice) * 100,
              realizedPnl: positionPnL,
              realizedPnlPercentage: (positionPnL / position.marginUsed) * 100,
              openedAt: position.openedAt,
              closedAt: new Date(),
              holdingTimeSeconds: holdingTime,
              closeReason: "challenge_end",
              leverage: position.leverage,
              marginUsed: position.marginUsed,
              hadStopLoss: !!position.stopLoss,
              stopLossPrice: position.stopLoss,
              hadTakeProfit: !!position.takeProfit,
              takeProfitPrice: position.takeProfit,
              openOrderId: position.openOrderId,
              closeOrderId: createdCloseOrder._id.toString(),
              positionId: position._id.toString(),
              isWinner: positionPnL > 0,
            },
          ],
          { session },
        );

        // Update stats
        const userId = position.userId.toString();
        const stats = participantStats.get(userId);
        if (stats) {
          stats.totalPnL += positionPnL;
          stats.currentCapital += positionPnL;
          stats.totalTrades++;
          if (positionPnL > 0) stats.winningTrades++;
          else if (positionPnL < 0) stats.losingTrades++;
        }
      } catch (error) {
        console.error(`  ❌ Error closing position ${position._id}:`, error);
      }
    }

    // ========== STEP 2: UPDATE PARTICIPANT STATS FROM POSITIONS ==========
    for (const [userId, stats] of participantStats.entries()) {
      const participant =
        userId === challenger.userId ? challenger : challenged;
      const pnlPercentage =
        (stats.totalPnL / participant.startingCapital) * 100;
      const winRate =
        stats.totalTrades > 0
          ? (stats.winningTrades / stats.totalTrades) * 100
          : 0;

      await ChallengeParticipant.findByIdAndUpdate(
        participant._id,
        {
          $set: {
            currentCapital: stats.currentCapital,
            availableCapital: stats.currentCapital,
            usedMargin: 0,
            pnl: stats.totalPnL,
            pnlPercentage,
            realizedPnl: stats.totalPnL,
            unrealizedPnl: 0,
            totalTrades: stats.totalTrades,
            winningTrades: stats.winningTrades,
            losingTrades: stats.losingTrades,
            winRate,
            currentOpenPositions: 0,
          },
        },
        { session },
      );

      // Refresh participant data (must sync ALL fields set by findByIdAndUpdate above
      // to prevent stale in-memory values from overwriting DB on subsequent .save() calls,
      // and to prevent validation errors from floating-point artifacts like usedMargin: -5.68e-14)
      if (userId === challenger.userId) {
        challenger.currentCapital = stats.currentCapital;
        challenger.availableCapital = stats.currentCapital;
        challenger.usedMargin = 0;
        challenger.pnl = stats.totalPnL;
        challenger.pnlPercentage = pnlPercentage;
        challenger.realizedPnl = stats.totalPnL;
        challenger.unrealizedPnl = 0;
        challenger.totalTrades = stats.totalTrades;
        challenger.winningTrades = stats.winningTrades;
        challenger.losingTrades = stats.losingTrades;
        challenger.winRate = winRate;
        challenger.currentOpenPositions = 0;
      } else {
        challenged.currentCapital = stats.currentCapital;
        challenged.availableCapital = stats.currentCapital;
        challenged.usedMargin = 0;
        challenged.pnl = stats.totalPnL;
        challenged.pnlPercentage = pnlPercentage;
        challenged.realizedPnl = stats.totalPnL;
        challenged.unrealizedPnl = 0;
        challenged.totalTrades = stats.totalTrades;
        challenged.winningTrades = stats.winningTrades;
        challenged.losingTrades = stats.losingTrades;
        challenged.winRate = winRate;
        challenged.currentOpenPositions = 0;
      }
    }

    // ========== STEP 3: DETERMINE WINNER ==========
    // Get settings for tie resolution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose singleton plugin adds getSingleton() at runtime
    const settings = await (ChallengeSettings as any).getSingleton();

    const {
      winnerId,
      winnerName,
      winnerPnL,
      loserId,
      loserName,
      loserPnL,
      isTie,
    } = await settleChallenge({
      session,
      challenge,
      challenger,
      challenged,
      tiePrizeDistribution: settings?.tiePrizeDistribution || "split_equally",
    });

    // Reason: read off the persisted final stats rather than `.status`, because a single
    // disqualified participant who lost by default has their `.status` moved on to
    // "completed" inside settleChallenge - only `challengerFinalStats.isDisqualified` stays
    // the permanent record of the disqualification.
    const challengerDisqualified =
      challenge.challengerFinalStats?.isDisqualified ?? false;
    const challengedDisqualified =
      challenge.challengedFinalStats?.isDisqualified ?? false;
    const winnerPrize = challenge.winnerPrize;

    // SAFETY NET: guarantee no position survives finalization, regardless of any
    // per-position error in the close loop above. Force-close any straggler still
    // "open" for this challenge at its last known price (currentPrice →
    // entryPrice). Works for both long and short (exit uses the mark price).
    // Reason: the primary loop already closes with a price fallback; this is the
    // last-resort guard so a finished challenge can NEVER leave an open position.
    const cfStrayClose = await TradingPosition.updateMany(
      { competitionId: challengeId, status: "open" },
      [
        {
          $set: {
            status: "closed",
            exitPrice: { $ifNull: ["$currentPrice", "$entryPrice"] },
            currentPrice: { $ifNull: ["$currentPrice", "$entryPrice"] },
            closedAt: "$$NOW",
            closeReason: "challenge_end",
          },
        },
      ],
      { session },
    );
    if (cfStrayClose.modifiedCount > 0) {
      console.warn(
        `⚠️ [SAFETY NET] Force-closed ${cfStrayClose.modifiedCount} straggler open position(s) at challenge end (challenge ${challengeId}). Investigate the close loop for errors.`,
      );
    }

    // Reason: settleChallenge() pays the winner, records the platform fee / unclaimed pool
    // and pays Game Master referral commissions ALL inside this same transaction (moved
    // in-transaction from the pre-unification deferred-after-commit pattern, which existed
    // only to dodge a WriteConflict this function's own retry wrapper already covers). One
    // commit, no post-commit fee-recording block.
    await session.commitTransaction();
    // End session immediately after commit to prevent "abortTransaction after commitTransaction" error
    session.endSession();

    // Send notifications (outside of transaction - fire and forget)
    try {
      const { notificationService } =
        await import("@/lib/services/notification.service");

      if (winnerId && !isTie) {
        // Notify winner
        notificationService
          .send({
            userId: winnerId,
            templateId: "challenge_won",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug, // For actionUrl
              opponentName: loserName || "opponent",
              prize: winnerPrize,
              pnl: winnerPnL?.toFixed(2) || "0",
            },
          })
          .catch((e) =>
            console.error("Failed to send winner notification:", e),
          );

        // Notify loser
        if (loserId) {
          notificationService
            .send({
              userId: loserId,
              templateId: "challenge_lost",
              variables: {
                challengeId: challenge._id.toString(),
                challengeSlug: challenge.slug, // For actionUrl
                opponentName: winnerName || "opponent",
                pnl: loserPnL?.toFixed(2) || "0",
              },
            })
            .catch((e) =>
              console.error("Failed to send loser notification:", e),
            );
        }
      } else if (isTie) {
        // Notify both about tie
        const tieDistribution =
          settings?.tiePrizeDistribution || "split_equally";
        const tieResolution =
          tieDistribution === "split_equally"
            ? "Prize has been split equally."
            : tieDistribution === "challenger_wins"
              ? "Challenger wins by default."
              : "No prize awarded.";

        notificationService
          .send({
            userId: challenger.userId,
            templateId: "challenge_tie",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug, // For actionUrl
              opponentName: challenged.username || "opponent",
              tieResolution,
            },
          })
          .catch((e) => console.error("Failed to send tie notification:", e));

        notificationService
          .send({
            userId: challenged.userId,
            templateId: "challenge_tie",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug, // For actionUrl
              opponentName: challenger.username || "opponent",
              tieResolution,
            },
          })
          .catch((e) => console.error("Failed to send tie notification:", e));
      }

      // Notify disqualified players
      if (challengerDisqualified) {
        notificationService
          .send({
            userId: challenger.userId,
            templateId: "challenge_disqualified",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug, // For actionUrl
              opponentName: challenged.username || "opponent",
              reason:
                challenger.disqualificationReason ||
                "Did not meet minimum trade requirement",
            },
          })
          .catch((e) =>
            console.error("Failed to send disqualification notification:", e),
          );
      }

      if (challengedDisqualified) {
        notificationService
          .send({
            userId: challenged.userId,
            templateId: "challenge_disqualified",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug, // For actionUrl
              opponentName: challenger.username || "opponent",
              reason:
                challenged.disqualificationReason ||
                "Did not meet minimum trade requirement",
            },
          })
          .catch((e) =>
            console.error("Failed to send disqualification notification:", e),
          );
      }
    } catch (notifError) {
      console.error("Error sending challenge notifications:", notifError);
    }

    // Award activity XP + evaluate badges for both participants (fire and forget)
    try {
      const { awardActivityXP } = await import("@/lib/services/xp-level.service");
      const { evaluateUserBadges } = await import("@/lib/services/badge-evaluation.service");

      for (const p of [challenger, challenged]) {
        // Challenge completion XP
        awardActivityXP(p.userId, "challenge_completed").catch(() => {});
        // Winner bonus XP
        if (p.userId === winnerId) {
          awardActivityXP(p.userId, "challenge_won").catch(() => {});
        }
        // Evaluate ALL badge categories (challenges involve trading, profit, risk, etc.)
        evaluateUserBadges(p.userId).catch(() => {});
      }
    } catch (xpError) {
      console.error("Error awarding challenge XP:", xpError);
    }

    // Reason: Leaderboard includes challengesWon — invalidate after finalize.
    try {
      const { clearLeaderboardCache } = await import(
        "@/lib/actions/leaderboard/global-leaderboard.actions"
      );
      await clearLeaderboardCache();
    } catch {
      // Best effort
    }

    console.log(
      `✅ Challenge ${challengeId} finalized: Winner: ${winnerName || "TIE"}`,
    );
    return { success: true, winnerId, winnerName, isTie };
  } catch (error) {
    // Only abort and release lock if the transaction was NOT committed.
    // If the transaction committed (status is "completed" in DB), we must NOT reset to "active"
    // because the prize has already been distributed.
    let aborted = false;
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
        aborted = true;
      }
    } catch (abortErr) {
      // Reason: abortTransaction can throw if MongoDB already auto-aborted the
      // session (e.g. timeout or write conflict). We still need to release the
      // optimistic lock below, so catch and log rather than letting it propagate.
      console.warn("⚠️ session.abortTransaction() failed:", abortErr);
      aborted = true;
    }

    // Release the optimistic lock when the transaction was NOT committed
    if (aborted) {
      try {
        await Challenge.updateOne(
          { _id: challengeId, status: "finalizing" },
          { $set: { status: "active" } },
        );
      } catch {
        // Best effort - if this fails, worker recovery will handle stuck "finalizing" after 5 min
      }
    }

    console.error("Error finalizing challenge", challengeId, ":", error);
    throw error;
  } finally {
    // End session if it hasn't been ended yet (for error cases)
    try {
      session.endSession();
    } catch {
      // Session already ended after successful commit
    }
  }
}

/**
 * Finalize all ended challenges
 */
export async function finalizeEndedChallenges() {
  try {
    await connectToDatabase();

    const now = new Date();

    // Find all active challenges that have ended
    const endedChallenges = await Challenge.find({
      status: "active",
      endTime: { $lte: now },
    }).select("_id");

    console.log(`Found ${endedChallenges.length} challenges to finalize`);

    const results = [];
    for (const challenge of endedChallenges) {
      try {
        const result = await finalizeChallenge(challenge._id.toString());
        results.push({ id: challenge._id, result });
      } catch (error) {
        console.error(`Failed to finalize challenge ${challenge._id}:`, error);
        results.push({ id: challenge._id, error: (error as Error).message });
      }
    }

    return { finalized: results.length, results };
  } catch (error) {
    console.error("Error finalizing challenges:", error);
    throw error;
  }
}

/**
 * Expire pending challenges that have passed their deadline.
 * Reason: We fetch challenges before bulk-updating so we can create
 * informational €0 transaction records for challengers, giving them
 * visibility that their challenge expired without any charge.
 */
export async function expirePendingChallenges() {
  try {
    await connectToDatabase();

    const now = new Date();

    // Fetch challenges first so we can record transactions for challengers
    const expiredChallenges = await Challenge.find({
      status: "pending",
      acceptDeadline: { $lte: now },
    })
      .select("_id challengerId challengedName slug entryFee")
      .lean();

    if (expiredChallenges.length === 0) {
      return { expired: 0 };
    }

    // Reason: Cast lean() results to typed shapes to avoid `any` in map callbacks.
    interface ExpiredChallengeLean { _id: string; challengerId: string; challengedName: string; slug: string; entryFee: number }
    interface WalletLean { userId: string; creditBalance: number }
    const typedExpired = expiredChallenges as unknown as ExpiredChallengeLean[];

    // Bulk expire
    const result = await Challenge.updateMany(
      {
        _id: { $in: typedExpired.map((c) => c._id) },
        status: "pending",
      },
      { $set: { status: "expired" } },
    );

    console.log(`Expired ${result.modifiedCount} pending challenges`);

    // Record informational €0 transactions for challengers (fire and forget)
    try {
      const challengerIds = [
        ...new Set(typedExpired.map((c) => c.challengerId)),
      ];
      const wallets = await CreditWallet.find({
        userId: { $in: challengerIds },
      })
        .select("userId creditBalance")
        .lean() as unknown as WalletLean[];
      const walletMap = new Map(
        wallets.map((w) => [w.userId, w.creditBalance]),
      );

      const txDocs = typedExpired.map((c) => {
        const balance = walletMap.get(c.challengerId) ?? 0;
        return {
          userId: c.challengerId,
          transactionType: "challenge_expired",
          amount: 0,
          balanceBefore: balance,
          balanceAfter: balance,
          currency: "EUR",
          exchangeRate: 1,
          status: "completed",
          description: `Challenge to ${c.challengedName} expired — no response, no charge`,
          metadata: {
            challengeId: c._id.toString(),
            challengeSlug: c.slug,
            opponentName: c.challengedName,
            originalEntryFee: c.entryFee,
          },
          processedAt: new Date(),
        };
      });

      if (txDocs.length > 0) {
        await WalletTransaction.insertMany(txDocs);
      }
    } catch (txError) {
      // Reason: Transaction records are informational — don't fail expiry if they error
      console.warn(
        "⚠️ Failed to create expire transaction records:",
        txError,
      );
    }

    return { expired: result.modifiedCount };
  } catch (error) {
    console.error("Error expiring challenges:", error);
    throw error;
  }
}
