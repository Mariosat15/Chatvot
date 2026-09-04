"use server";

import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import { fetchRealForexPrices } from "@/lib/services/real-forex-prices.service";
import { getMultipleSymbolConfigs } from "@/lib/services/symbol-config.service";
import {
  type ForexSymbol,
  calculateUnrealizedPnL,
  getQuoteToUsdRate,
  getConversionPairSymbols,
} from "@/lib/services/pnl-calculator.service";
import {
  resolveSettlementPath,
  routeToTradingSettlement,
} from "@/lib/games/settlement";
import { payContestPrizes } from "@/lib/services/settlement/prize-payout.service";
import { settleFeesAndGameMasters } from "@/lib/services/settlement/fees.service";
import { completeContest } from "@/lib/services/settlement/contest-completion.service";

/**
 * End a competition and distribute prizes
 * This is called automatically by Inngest when endTime is reached
 * Retries up to 3 times on transient transaction errors (WriteConflict)
 *
 * X1 seam 3: the game dispatch lives HERE rather than at the call sites, because there
 * are ten of them in this app and the list keeps growing - one is even a page component.
 * Every caller is therefore correct by construction, including future ones.
 */
export async function finalizeCompetition(competitionId: string) {
  const MAX_RETRIES = 3;

  // Gate before the retry loop and before any lock is taken. Reason: refusing here
  // leaves the competition completely untouched, whereas a check after the optimistic
  // lock would strand it in "finalizing" with no one able to claim it again.
  await connectToDatabase();
  const label = await Competition.findById(competitionId)
    .select("gameType")
    .lean<{ gameType?: string } | null>();

  if (label) {
    const route = resolveSettlementPath(
      label.gameType,
      `competition ${competitionId}`,
    );

    // X5: a provider contest settles through its own path, which reuses this one's
    // ranking, prize, fee and completion stages and skips only the two that are about
    // trades. Dispatching HERE rather than at the call sites is the whole point of seam 3
    // - there are ten callers of this function in this app and one of them is a page
    // component, so every one of them, including the ones nobody has written yet, gets
    // the right path by construction.
    if (route.path === "provider") {
      const { finalizeProviderCompetition } = await import(
        "@/lib/services/settlement/provider-finalize"
      );
      return await finalizeProviderCompetition(competitionId);
    }

    if (route.path === "none") {
      console.error(`❌ [COMPETITION] ${route.error}`);
      return { success: false, error: route.error };
    }
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _finalizeCompetitionAttempt(competitionId);
    } catch (error: unknown) {
      const mongoErr = error as Record<string, unknown> | null;
      const isTransient =
        (mongoErr?.errorLabelSet as Set<string> | undefined)?.has?.("TransientTransactionError") ||
        (mongoErr?.errorLabels as string[] | undefined)?.includes?.("TransientTransactionError") ||
        mongoErr?.code === 112 || // WriteConflict
        mongoErr?.codeName === "WriteConflict";

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 4000);
        console.warn(
          `⚠️ [COMPETITION] TransientTransactionError on attempt ${attempt}/${MAX_RETRIES} for ${competitionId}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw error;
    }
  }

  // Reason: This line is only reached if MAX_RETRIES is 0 (impossible with current config).
  // Added to satisfy TypeScript's "not all code paths return a value" check.
  return {
    success: false,
    error: `Competition finalization failed after ${MAX_RETRIES} retries`,
  };
}

async function _finalizeCompetitionAttempt(competitionId: string) {
  await connectToDatabase();

  // OPTIMISTIC LOCK: Atomically claim this competition for finalization.
  // Only one caller can change "active" → "finalizing". All others get null and exit.
  const lockResult = await Competition.findOneAndUpdate(
    { _id: competitionId, status: "active" },
    { $set: { status: "finalizing" } },
    { new: true },
  );

  if (!lockResult) {
    const existing = await Competition.findById(competitionId).select("status").lean() as { status?: string } | null;
    console.log(
      `⚠️ Competition ${competitionId} is not active (status: ${existing?.status ?? "not found"}), skipping`,
    );
    return { success: false, message: "Competition is not active" };
  }

  // Defence in depth behind the gate in finalizeCompetition. This function is private
  // and has one caller today, so this should be unreachable - it is here because the
  // next exported finalize variant might call it directly, and trading settlement
  // running on a provider contest pays the wrong players without erroring.
  // Reason: the lock must be RELEASED on refusal, or the competition is stranded in
  // "finalizing" and no later attempt can claim it.
  const settlementRoute = routeToTradingSettlement(
    lockResult.gameType,
    `competition ${competitionId}`,
  );

  if (!settlementRoute.ok) {
    await Competition.findOneAndUpdate(
      { _id: competitionId, status: "finalizing" },
      { $set: { status: "active" } },
    );
    console.error(`❌ [COMPETITION] ${settlementRoute.error}`);
    return { success: false, error: settlementRoute.error };
  }

  console.log(`🏁 Starting competition finalization for: ${competitionId}`);

  // Reason: Use the model's own connection to create the session, not the
  // top-level `mongoose` import. In the admin bundle, `mongoose` may resolve
  // to a different instance than the one models are registered on (dual
  // node_modules), causing "ClientSession must be from the same MongoClient".
  const session = await Competition.db.startSession();
  session.startTransaction();

  try {
    // Get competition within transaction
    const competition =
      await Competition.findById(competitionId).session(session);
    if (!competition) {
      await session.abortTransaction();
      await Competition.updateOne({ _id: competitionId, status: "finalizing" }, { $set: { status: "active" } });
      throw new Error("Competition not found");
    }

    // STEP 1: Close all open positions AND calculate P&L in memory
    console.log(`📊 Closing all open positions and calculating P&L...`);

    // First, get all participants to track their stats
    // NOTE: competitionId in schema is String, so we must convert ObjectId to string
    const allParticipants = await CompetitionParticipant.find({
      competitionId: competition._id.toString(),
    }).session(session);

    // Create a map to track participant stats in memory
    const participantStats = new Map();
    for (const participant of allParticipants) {
      participantStats.set(participant.userId.toString(), {
        participant,
        totalPnL: 0,
        winningTrades: 0,
        losingTrades: 0,
        currentCapital: participant.startingCapital,
        closedPositionsCount: 0,
        totalWinAmount: 0,
        totalLossAmount: 0,
        largestWin: 0,
        largestLoss: 0,
      });
    }

    // Get all positions (both open and closed) for recalculation
    // NOTE: competitionId in schema is String, so we must convert ObjectId to string
    const allPositions = await TradingPosition.find({
      competitionId: competition._id.toString(),
    }).session(session);

    console.log(
      `Found ${allPositions.length} total positions (open and closed)`,
    );

    // Reason: Pre-fetch conversion pair prices so closed-position PnL can convert to USD.
    const allPosSymbols = [
      ...new Set(allPositions.map((p) => p.symbol)),
    ] as ForexSymbol[];
    const earlyConvSyms = getConversionPairSymbols(allPosSymbols);
    let convPricesMap: Map<string, { bid: number; ask: number }> = new Map();
    if (earlyConvSyms.length > 0) {
      const m = await fetchRealForexPrices(earlyConvSyms);
      convPricesMap = m as Map<string, { bid: number; ask: number }>;
    }

    const symConfigs = await getMultipleSymbolConfigs(allPosSymbols);

    // Import required models (needed for both the closed-position reconciliation
    // below and the open-position close loop further down).
    const TradeHistory = (
      await import("@/database/models/trading/trade-history.model")
    ).default;
    const TradingOrder = (
      await import("@/database/models/trading/trading-order.model")
    ).default;

    // Reason: Trust the realized P&L recorded in TradeHistory at each close
    // (immutable, correct conversion rate) instead of re-deriving it here with
    // the CURRENT rate. Re-deriving overwrote participant.realizedPnl with a
    // value that no longer equaled Σ TradeHistory.realizedPnl for non-USD-quote
    // pairs (and could be badly distorted when a conversion price was momentarily
    // missing and the rate fell back to 1). Map positionId → realized P&L.
    const ceClosedHistory = (await TradeHistory.find(
      { competitionId: competition._id.toString() },
      { positionId: 1, realizedPnl: 1 },
    )
      .session(session)
      .lean()) as Array<{ positionId?: string; realizedPnl?: number }>;
    const ceRealizedByPositionId = new Map<string, number>();
    for (const h of ceClosedHistory) {
      const pid = h?.positionId ? String(h.positionId) : "";
      if (!pid) continue;
      const val =
        typeof h.realizedPnl === "number" && Number.isFinite(h.realizedPnl)
          ? h.realizedPnl
          : 0;
      ceRealizedByPositionId.set(
        pid,
        (ceRealizedByPositionId.get(pid) || 0) + val,
      );
    }

    // First, process already-closed positions
    for (const position of allPositions) {
      if (position.status === "closed" || position.status === "liquidated") {
        const userId = position.userId.toString();
        const stats = participantStats.get(userId);
        if (stats) {
          // Reason: Prefer the realized P&L recorded in TradeHistory at close
          // time; only re-derive (legacy/edge data with no history row) so the
          // participant total always reconciles with Σ TradeHistory.realizedPnl.
          const recorded = ceRealizedByPositionId.get(String(position._id));
          let positionPnL: number;
          if (typeof recorded === "number") {
            positionPnL = recorded;
          } else {
            const exitPrice =
              position.exitPrice ??
              position.currentPrice ??
              position.entryPrice;
            const ceRate = getQuoteToUsdRate(
              position.symbol as ForexSymbol,
              convPricesMap,
            );
            const sc = symConfigs.get(position.symbol);
            positionPnL = calculateUnrealizedPnL(
              position.side,
              position.entryPrice,
              exitPrice,
              position.quantity,
              position.symbol,
              ceRate > 0 ? ceRate : 1,
              sc ? { pip: sc.pip, contractSize: sc.contractSize } : undefined,
            );
          }

          console.log(
            `    📈 Position ${position._id}: PNL=$${positionPnL.toFixed(2)} (${typeof recorded === "number" ? "from history" : "re-derived"})`,
          );

          stats.totalPnL += positionPnL;
          stats.currentCapital += positionPnL;
          stats.closedPositionsCount++;

          if (positionPnL > 0) {
            stats.winningTrades++;
          } else if (positionPnL < 0) {
            stats.losingTrades++;
          }
        }
      }
    }

    console.log(
      `Processed ${allPositions.filter((p) => p.status === "closed" || p.status === "liquidated").length} already-closed positions`,
    );

    // Now, close open positions and calculate their P&L
    const openPositions = allPositions.filter((p) => p.status === "open");
    console.log(`Closing ${openPositions.length} open positions...`);

    const uniqueSymbols = [
      ...new Set(openPositions.map((p) => p.symbol)),
    ] as ForexSymbol[];
    const ceConvSyms = getConversionPairSymbols(uniqueSymbols);
    const ceAllSyms = [
      ...new Set([...uniqueSymbols, ...ceConvSyms]),
    ] as ForexSymbol[];
    console.log(
      `Fetching prices for ${uniqueSymbols.length} unique symbols: ${uniqueSymbols.join(", ")}`,
    );

    // 🏥 PRE-FINALIZATION HEALTH CHECK
    // Verify price feed is healthy before finalizing
    let pricesMap: Map<
      ForexSymbol,
      {
        bid: number;
        ask: number;
        mid: number;
        spread: number;
        timestamp: number;
      }
    > = new Map();
    let usedSnapshotPrices = false;

    // Price health check - only runs in main app context
    // Uses dynamic path to prevent Turbopack from analyzing imports in admin app build
    const PRICE_HEALTH_SERVICE = "@/lib/services/price-health-monitor.service";
    const PRICE_SNAPSHOT_SERVICE = "@/lib/services/price-snapshot.service";
    const INCIDENT_MODEL = "@/database/models/incident.model";

    try {
      // Dynamic import that prevents static analysis
      const priceHealthModule = await import(
        /* webpackIgnore: true */ PRICE_HEALTH_SERVICE
      ).catch(() => null);
      if (!priceHealthModule) {
        // Reason: Price health service is only available when the WS price streamer is running
        // in the same process. In server actions (Next.js), it's not initialized — this is expected.
        // We silently fall through to fetch live prices instead.
        throw new Error("not_available");
      }

      const { priceHealthMonitor } = priceHealthModule;
      const healthCheck =
        priceHealthMonitor.arePricesSafeForFinalization(uniqueSymbols);

      if (!healthCheck.safe) {
        console.warn(`⚠️ [FINALIZATION] Price health check FAILED!`);
        for (const issue of healthCheck.issues) {
          console.warn(`   ${issue.symbol}: ${issue.issue}`);
        }

        // Try to use last healthy snapshot instead
        console.log(
          `📸 Attempting to use last healthy snapshot for finalization...`,
        );
        const snapshotModule = await import(
          /* webpackIgnore: true */ PRICE_SNAPSHOT_SERVICE
        ).catch(() => null);

        if (snapshotModule) {
          const { priceSnapshotService } = snapshotModule;
          const lastHealthy =
            await priceSnapshotService.getLastHealthySnapshot(competitionId);

          if (lastHealthy && lastHealthy.prices.size > 0) {
            console.log(
              `✅ Using snapshot from ${lastHealthy.timestamp.toISOString()}`,
            );

            // Convert snapshot prices to the expected format
            pricesMap = new Map();
            for (const symbol of uniqueSymbols) {
              const snapshotPrice = lastHealthy.prices.get(symbol);
              if (snapshotPrice) {
                pricesMap.set(symbol, {
                  bid: snapshotPrice.bid,
                  ask: snapshotPrice.ask,
                  mid: (snapshotPrice.bid + snapshotPrice.ask) / 2,
                  spread: snapshotPrice.ask - snapshotPrice.bid,
                  timestamp: lastHealthy.timestamp.getTime(),
                });
              }
            }

            // Mark snapshot as used
            await priceSnapshotService.markSnapshotAsUsed(
              lastHealthy.snapshotId,
              competitionId,
            );

            // Update competition with snapshot info
            competition.usedSnapshotId = lastHealthy.snapshotId;
            usedSnapshotPrices = true;

            console.log(`📸 Loaded ${pricesMap.size} prices from snapshot`);
          } else {
            // No healthy snapshot - log critical warning but try to proceed with current prices
            console.error(
              `❌ [FINALIZATION] No healthy snapshot available! Proceeding with potentially stale prices.`,
            );
            console.error(
              `   This may result in unfair finalization. Consider manual intervention.`,
            );

            // Log incident - try to import dynamically
            try {
              const incidentModule = await import(
                /* webpackIgnore: true */ INCIDENT_MODEL
              ).catch(() => null);
              if (incidentModule) {
                const Incident = incidentModule.default;
                await Incident.create({
                  competitionId,
                  type: "price_feed_failure",
                  severity: "critical",
                  status: "open",
                  title: "Price Feed Failure During Finalization",
                  description: `Price health check failed during finalization. No healthy snapshot available. Proceeded with potentially stale prices.`,
                  affectedUsers: allParticipants.map((p) =>
                    p.userId.toString(),
                  ),
                  evidence: {
                    healthIssues: healthCheck.issues,
                  },
                  createdBy: "system",
                });
              }
            } catch {
              // Incident model may not exist in this context
            }
          }
        }
      }
    } catch (healthError: unknown) {
      // Reason: Only log a warning for actual health check failures, not for expected
      // "not available" cases (which happen on every server action call).
      const healthErrMsg = (healthError as Error | undefined)?.message;
      if (healthErrMsg !== "not_available") {
        console.warn(`⚠️ [FINALIZATION] Health check failed:`, healthErrMsg || healthError);
      }
      // Continue with normal price fetch
    }

    // Fetch current prices if not using snapshot
    if (!pricesMap || pricesMap.size === 0) {
      pricesMap = await fetchRealForexPrices(ceAllSyms);
    }

    console.log(
      `Got ${pricesMap.size} prices ${usedSnapshotPrices ? "(from snapshot)" : "(live)"} in single batch`,
    );

    // Log which prices we have
    if (pricesMap.size > 0) {
      for (const [symbol, price] of pricesMap.entries()) {
        console.log(`  ✅ ${symbol}: bid=${price.bid}, ask=${price.ask}`);
      }
    } else {
      console.error(
        `  ❌ WARNING: No prices available! This will prevent position closing.`,
      );
    }

    for (const position of openPositions) {
      try {
        // Get price from pre-fetched batch (instant!)
        const priceData = pricesMap.get(position.symbol as ForexSymbol);
        // Reason: NEVER leave a position open on a finalized competition. If the
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

        console.log(
          `  Closing ${position.symbol} ${position.side} for user ${position.userId} at ${exitPrice}`,
        );

        const priceDiff =
          position.side === "long"
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        const ceRate2 = getQuoteToUsdRate(
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
          ceRate2 > 0 ? ceRate2 : 1,
          sc2 ? { pip: sc2.pip, contractSize: sc2.contractSize } : undefined,
        );

        console.log(
          `    Entry: ${position.entryPrice}, Exit: ${exitPrice}, P&L: $${positionPnL.toFixed(2)}`,
        );

        // Create a close order for this position
        const closeOrder = await TradingOrder.create(
          [
            {
              competitionId: position.competitionId,
              userId: position.userId,
              participantId: position.participantId,
              symbol: position.symbol,
              side: position.side === "long" ? "sell" : "buy", // Opposite of position
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
          throw new Error("Failed to create close order for competition end");
        }

        // Update position in database
        await TradingPosition.findByIdAndUpdate(
          position._id,
          {
            $set: {
              status: "closed",
              exitPrice: exitPrice,
              profitLoss: positionPnL,
              closedAt: new Date(),
              closeReason: "competition_end",
              closeOrderId: createdCloseOrder._id.toString(),
            },
          },
          { session },
        );

        // Create TradeHistory record (CRITICAL: This was missing!)
        const holdingTime = Math.floor(
          (Date.now() - position.openedAt.getTime()) / 1000,
        );
        await TradeHistory.create(
          [
            {
              competitionId: position.competitionId,
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
              closeReason: "competition_end",
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

        // Update participant stats in memory
        const userId = position.userId.toString();
        const stats = participantStats.get(userId);
        if (stats) {
          stats.totalPnL += positionPnL;
          stats.currentCapital += positionPnL;
          stats.closedPositionsCount++;

          if (positionPnL > 0) {
            stats.winningTrades++;
            stats.totalWinAmount = (stats.totalWinAmount || 0) + positionPnL;
            stats.largestWin = Math.max(stats.largestWin || 0, positionPnL);
          } else if (positionPnL < 0) {
            stats.losingTrades++;
            stats.totalLossAmount =
              (stats.totalLossAmount || 0) + Math.abs(positionPnL);
            stats.largestLoss = Math.min(stats.largestLoss || 0, positionPnL);
          }
        }

        console.log(
          `  ✅ Position closed & TradeHistory created: P&L = $${positionPnL.toFixed(2)}`,
        );
      } catch (error) {
        console.error(`  ❌ Error closing position ${position._id}:`, error);
        // Continue with other positions even if one fails
      }
    }

    // STEP 1.5: Update all participant records with calculated stats
    console.log(`🔄 Updating participant statistics...`);
    for (const [_userId, stats] of participantStats.entries()) {
      const pnlPercentage =
        stats.participant.startingCapital > 0
          ? (stats.totalPnL / stats.participant.startingCapital) * 100
          : 0;

      const winRate =
        stats.closedPositionsCount > 0
          ? (stats.winningTrades / stats.closedPositionsCount) * 100
          : 0;

      const averageWin =
        stats.winningTrades > 0
          ? (stats.totalWinAmount || 0) / stats.winningTrades
          : 0;

      const averageLoss =
        stats.losingTrades > 0
          ? (stats.totalLossAmount || 0) / stats.losingTrades
          : 0;

      await CompetitionParticipant.findByIdAndUpdate(
        stats.participant._id,
        {
          $set: {
            currentCapital: stats.currentCapital,
            availableCapital: stats.currentCapital, // All margin released at competition end
            usedMargin: 0, // All positions closed
            pnl: stats.totalPnL,
            pnlPercentage,
            realizedPnl: stats.totalPnL,
            unrealizedPnl: 0,
            winningTrades: stats.winningTrades,
            losingTrades: stats.losingTrades,
            totalTrades: stats.closedPositionsCount,
            winRate: winRate,
            averageWin: averageWin,
            averageLoss: averageLoss,
            largestWin: stats.largestWin || 0,
            largestLoss: stats.largestLoss || 0,
            currentOpenPositions: 0, // CRITICAL: Set to 0!
          },
        },
        { session },
      );

      console.log(
        `  ✅ ${stats.participant.username}: Capital=$${stats.currentCapital.toFixed(2)}, P&L=$${stats.totalPnL.toFixed(2)}, Win Rate=${winRate.toFixed(2)}% (${stats.closedPositionsCount} trades)`,
      );
    }

    // STEP 2: Calculate final rankings using new rules system
    console.log(`📈 Calculating final rankings...`);
    const participants = await CompetitionParticipant.find({
      competitionId: competition._id.toString(),
    })
      .session(session)
      .lean();

    console.log(`Found ${participants.length} participants`);

    // Import ranking service
    const { calculateRankings, distributePrizesWithTies } =
      await import("@/lib/services/competition-ranking.service");

    // Prepare participant data for ranking
    const participantData = participants.map((p) => ({
      userId: p.userId,
      username: p.username || "Anonymous",
      currentCapital: p.currentCapital,
      pnl: p.pnl,
      pnlPercentage: p.pnlPercentage,
      totalTrades: p.totalTrades,
      winningTrades: p.winningTrades,
      losingTrades: p.losingTrades,
      winRate: p.totalTrades > 0 ? (p.winningTrades / p.totalTrades) * 100 : 0,
      status: p.status,
      enteredAt: p.enteredAt,
      startingCapital: p.startingCapital,
    }));

    // Use competition rules merged with defaults (ensure all required fields exist)
    const defaultRules = {
      rankingMethod: "pnl" as const,
      tieBreaker1: "win_rate" as const,
      tieBreaker2: "join_time" as const, // Secondary tiebreaker to ensure ranking
      minimumTrades: 0,
      tiePrizeDistribution: "split_equally" as const,
      disqualifyOnLiquidation: true,
    };
    const rules = {
      ...defaultRules,
      ...(competition.rules || {}),
    };

    // Calculate rankings with tie-breaking
    // IMPORTANT: Pass 'completed' status to check minimum trades for final ranking
    const rankedParticipants = calculateRankings(participantData, rules, {
      competitionStatus: "completed",
      // Reason: passed explicitly even though the gate above guarantees trading here.
      // It states the intent at the point of use, so this line stays correct if the
      // gate is ever relaxed to let another game reuse the shared ranking step.
      gameType: competition.gameType,
    });

    console.log(`📊 Rankings calculated with rules:`, {
      method: rules.rankingMethod,
      tieBreaker: rules.tieBreaker1,
      minimumTrades: rules.minimumTrades,
    });

    // Build leaderboard with qualification status
    const leaderboard = rankedParticipants.map((p) => ({
      rank: p.rank,
      userId: p.userId,
      username: p.username,
      finalCapital: p.currentCapital,
      pnl: p.pnl,
      pnlPercentage: p.pnlPercentage,
      totalTrades: p.totalTrades,
      winRate: p.winRate,
      prizeAmount: 0, // Will be calculated next
      isTied: p.isTied,
      qualificationStatus: p.qualificationStatus,
      disqualificationReason: p.disqualificationReason,
    }));

    // STEP 3: Distribute prizes with tie handling
    console.log(`💰 Distributing prizes...`);

    // Reason: SAFEGUARD against distributing more credits than were actually collected.
    // The actual collected fees = currentParticipants × entryFee.
    // If competition.prizePool is somehow inflated (e.g. from a bug where it was
    // pre-set to an estimated value AND then incremented per entry), cap it.
    const actualCollectedFees =
      (competition.currentParticipants || 0) * (competition.entryFee || 0);
    let prizePool = competition.prizePool || 0;

    if (prizePool > actualCollectedFees && actualCollectedFees > 0) {
      console.error(
        `🚨 [COMPETITION] PRIZE POOL INTEGRITY VIOLATION for ${competitionId}!`,
      );
      console.error(
        `   Stored prizePool: ${prizePool}, actual collected (${competition.currentParticipants} × ${competition.entryFee}): ${actualCollectedFees}`,
      );
      console.error(
        `   Capping prizePool to actual collected fees to prevent phantom credit distribution.`,
      );
      prizePool = actualCollectedFees;

      // Also fix the stored value so the DB is consistent
      await Competition.findByIdAndUpdate(competitionId, {
        $set: { prizePool: actualCollectedFees },
      });
    }

    // Reason: named a fraction, not a percentage. The stored field is a percentage
    // (0-50); distributePrizesWithTies needs it divided by 100 and rejects anything
    // above 1. Keeping the old name here was half of risk R30 - a local variable called
    // `platformFeePercentage` that holds 0.2 invites the next reader to "fix" it.
    const platformFeeFraction = competition.platformFeePercentage / 100;

    console.log(`  Gross Prize Pool: ${prizePool} credits`);
    console.log(`  Actual Collected: ${actualCollectedFees} credits`);
    console.log(`  Platform Fee: ${competition.platformFeePercentage}%`);

    // FIXED: Calculate prizes from GROSS pool, then deduct platform fee from each winner
    // This ensures prize percentages are calculated from the total pool as advertised
    const prizeDistributions = distributePrizesWithTies(
      rankedParticipants,
      competition.prizeDistribution || [],
      prizePool, // Pass GROSS prize pool, not net
      rules,
      platformFeeFraction, // Pass platform fee to deduct from each prize
    );

    console.log(
      `💎 Calculated ${prizeDistributions.length} prize distributions (including ties)`,
    );

    // Pay the winners. Extracted by X5 into `payContestPrizes` so that a provider contest
    // is paid by this exact code rather than a second copy of it - Stage 0's lesson that
    // one bug duplicated is not drift, and that no guard catches it.
    const {
      totalDistributed,
      winnersPaid,
      walletMap,
    } = await payContestPrizes({
      session,
      contest: competition,
      distributions: prizeDistributions,
      leaderboard,
    });

    // STEP 4: the platform fee, the unclaimed pool and the Game Masters' share.
    //
    // Extracted by X5 into `settleFeesAndGameMasters` so a provider contest takes its fee
    // and pays its referrers through the same code. The four stages are one call because
    // the order between them is load-bearing - see the service for why.
    const qualifiedWinners = rankedParticipants.filter(
      (p) => p.qualificationStatus === "qualified",
    );
    const expectedWinners = competition.prizeDistribution?.length || 0;
    const actualWinners = prizeDistributions.length;

    const { grossPlatformFee: actualPlatformFee, gmEarnings: actualGmEarnings } =
      await settleFeesAndGameMasters({
        session,
        contest: competition,
        prizePool,
        totalDistributed,
        prizeWinnerCount: actualWinners,
        expectedWinners,
        qualifiedWinnersCount: qualifiedWinners.length,
        participants: participants.map((p) => ({ userId: p.userId })),
        walletMap,
        platformFeeFraction,
      });

    // STEP 5: Update competition and participant statuses
    console.log(`ðŸŽ¯ Updating competition status...`);
    await completeContest({
      session,
      contest: competition,
      leaderboard,
      prizeWinnerCount: actualWinners,
    });

    // SAFETY NET: guarantee no position survives finalization, regardless of any
    // per-position error in the close loop above. Force-close any straggler still
    // "open" for this competition at its last known price (currentPrice →
    // entryPrice). Works for both long and short (exit uses the mark price).
    // Reason: the primary loop already closes with a price fallback; this is the
    // last-resort guard so a completed contest can NEVER leave an open position.
    const ceStrayClose = await TradingPosition.updateMany(
      { competitionId: competition._id.toString(), status: "open" },
      [
        {
          $set: {
            status: "closed",
            exitPrice: { $ifNull: ["$currentPrice", "$entryPrice"] },
            currentPrice: { $ifNull: ["$currentPrice", "$entryPrice"] },
            closedAt: "$$NOW",
            closeReason: "competition_end",
          },
        },
      ],
      { session },
    );
    if (ceStrayClose.modifiedCount > 0) {
      console.warn(
        `⚠️ [SAFETY NET] Force-closed ${ceStrayClose.modifiedCount} straggler open position(s) at competition end (competition ${competition._id.toString()}). Investigate the close loop for errors.`,
      );
    }

    await session.commitTransaction();
    // End session immediately after commit to prevent "abortTransaction after commitTransaction" error
    session.endSession();

    // Reason: Leaderboard includes competitionsWon/podiumFinishes — invalidate after end.
    try {
      const { clearLeaderboardCache } = await import(
        "@/lib/actions/leaderboard/global-leaderboard.actions"
      );
      await clearLeaderboardCache();
    } catch {
      // Best effort
    }

    console.log(`✅ Competition ${competition.name} finalized successfully!`);
    console.log(`   Winners: ${winnersPaid}`);
    console.log(`   Total Distributed: ${totalDistributed} credits`);
    console.log(
      `   Gross Platform Fee: ${actualPlatformFee.toFixed(2)} credits (${competition.platformFeePercentage}%)`,
    );
    console.log(
      `   GM Referral Fees: ${actualGmEarnings.toFixed(2)} credits (paid to Game Masters)`,
    );
    console.log(
      `   Platform Net Earned: ${(prizePool - totalDistributed - actualGmEarnings).toFixed(2)} credits`,
    );

    // Award activity XP + evaluate badges for ALL participants (fire and forget)
    try {
      const { evaluateUserBadges } =
        await import("@/lib/services/badge-evaluation.service");
      const { awardActivityXP } =
        await import("@/lib/services/xp-level.service");
      const uniqueUserIds = [
        ...new Set(participants.map((p) => p.userId.toString())),
      ];

      console.log(
        `🏅 Evaluating badges + awarding XP for ${uniqueUserIds.length} participants...`,
      );

      // Award competition XP and evaluate badges for each participant
      uniqueUserIds.forEach((userId) => {
        // Award competition completion XP
        awardActivityXP(userId, "competition_completed").catch(() => {});

        // Award podium XP if applicable
        const userEntry = leaderboard.find((l) => l.userId === userId);
        if (userEntry?.rank === 1) awardActivityXP(userId, "competition_podium_1").catch(() => {});
        else if (userEntry?.rank === 2) awardActivityXP(userId, "competition_podium_2").catch(() => {});
        else if (userEntry?.rank === 3) awardActivityXP(userId, "competition_podium_3").catch(() => {});

        // Evaluate ALL badge categories (competitions involve trading, profit, risk, etc.)
        evaluateUserBadges(userId)
          .then((result) => {
            if (result.newBadges.length > 0) {
              console.log(
                `🏅 User ${userId} earned ${result.newBadges.length} new badges after competition ended`,
              );
            }
          })
          .catch((err) =>
            console.error(`Error evaluating badges for user ${userId}:`, err),
          );
      });
    } catch (error) {
      console.error("Error importing badge/XP service:", error);
    }

    // Send notifications to all participants about competition end (fire and forget - non-blocking)
    try {
      // Import the module and get the default export (the notificationService instance)
      const notificationModule =
        await import("@/lib/services/notification.service");
      const notificationService =
        notificationModule.notificationService || notificationModule.default;

      if (
        !notificationService ||
        typeof notificationService.notifyCompetitionWon !== "function"
      ) {
        console.error(
          "❌ notificationService not properly loaded, skipping notifications",
        );
        throw new Error("notificationService methods not available");
      }

      console.log(`🔔 Sending competition end notifications...`);

      // Notify winners (rank 1 gets special notification) - non-blocking
      for (const dist of prizeDistributions) {
        const winner = leaderboard.find((l) => l.userId === dist.userId);
        if (winner) {
          if (dist.rank === 1) {
            // Winner notification - signature: (userId, competitionName, prize, position)
            notificationService
              .notifyCompetitionWon(
                winner.userId,
                competition.name,
                dist.prizeAmount,
                dist.rank,
              )
              .catch((e: Error) =>
                console.error("Failed to send winner notification:", e),
              );
          } else if (dist.rank <= 3) {
            // Podium notification - signature: (userId, competitionName, prize, position)
            notificationService
              .notifyPodiumFinish(
                winner.userId,
                competition.name,
                dist.prizeAmount,
                dist.rank,
              )
              .catch((e: Error) =>
                console.error("Failed to send podium notification:", e),
              );
          }

          // Send prize received notification to all winners - signature: (userId, competitionName, prize)
          notificationService
            .notifyPrizeReceived(
              winner.userId,
              competition.name,
              dist.prizeAmount,
            )
            .catch((e: Error) =>
              console.error("Failed to send prize notification:", e),
            );
        }
      }

      // Notify disqualified participants - non-blocking
      const disqualifiedParticipants = leaderboard.filter(
        (p) => p.qualificationStatus === "disqualified",
      );
      const sendNotification = notificationModule.sendNotification;
      if (typeof sendNotification === "function") {
        for (const participant of disqualifiedParticipants) {
          sendNotification({
            userId: participant.userId,
            type: "competition_disqualified",
            metadata: {
              competitionId: competition._id.toString(),
              competitionName: competition.name,
              reason:
                participant.disqualificationReason ||
                "Did not meet competition requirements",
            },
          }).catch((e: Error) =>
            console.error("Failed to send disqualification notification:", e),
          );
        }
        if (disqualifiedParticipants.length > 0) {
          console.log(
            `🔔 Sent ${disqualifiedParticipants.length} disqualification notifications`,
          );
        }
      }

      // Notify all participants about competition end - non-blocking
      // Signature: (userId, competitionName, finalPosition)
      for (const participant of leaderboard) {
        notificationService
          .notifyCompetitionEnded(
            participant.userId,
            competition.name,
            participant.rank || 0,
          )
          .catch((e: Error) =>
            console.error("Failed to send competition end notification:", e),
          );
      }

      console.log(
        `🔔 Queued ${leaderboard.length} competition end notifications`,
      );
    } catch (error) {
      console.error("Error sending competition end notifications:", error);
    }

    const finalPlatformFee2 = prizePool - totalDistributed;
    return {
      success: true,
      message: `Competition finalized`,
      data: {
        competitionId: competition._id.toString(),
        competitionName: competition.name,
        totalParticipants: participants.length,
        winnersCount: winnersPaid,
        prizePool,
        platformFee: finalPlatformFee2,
        totalDistributed,
        leaderboard: leaderboard.slice(0, 10), // Top 10
      },
    };
  } catch (error) {
    // Only abort and release lock if the transaction was NOT committed.
    // If the transaction committed (prizes already distributed), we must NOT reset to "active".
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
        await Competition.updateOne(
          { _id: competitionId, status: "finalizing" },
          { $set: { status: "active" } },
        );
      } catch {
        // Best effort
      }
    }

    console.error("❌ Error finalizing competition:", error);
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
 * Check and finalize all competitions that have ended
 * Called by Inngest cron job
 */
export async function checkAndFinalizeCompetitions() {
  try {
    await connectToDatabase();

    const now = new Date();
    console.log(
      `🔍 Checking for competitions to finalize at ${now.toISOString()}`,
    );

    // Find all active competitions that have ended
    const competitionsToEnd = await Competition.find({
      status: "active",
      endTime: { $lte: now },
    });

    console.log(`Found ${competitionsToEnd.length} competition(s) to finalize`);

    const results = [];

    for (const competition of competitionsToEnd) {
      console.log(`\n🏁 Finalizing: ${competition.name} (${competition._id})`);

      try {
        const result = await finalizeCompetition(competition._id.toString());
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to finalize ${competition.name}:`, error);
        results.push({
          success: false,
          competitionId: competition._id.toString(),
          competitionName: competition.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      success: true,
      message: `Checked and finalized ${competitionsToEnd.length} competition(s)`,
      results,
    };
  } catch (error) {
    console.error("❌ Error in checkAndFinalizeCompetitions:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
