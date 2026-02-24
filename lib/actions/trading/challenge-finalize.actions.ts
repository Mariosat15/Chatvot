"use server";

import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import ChallengeSettings from "@/database/models/trading/challenge-settings.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import { fetchRealForexPrices } from "@/lib/services/real-forex-prices.service";
import type { ForexSymbol } from "@/lib/services/pnl-calculator.service";
import mongoose from "mongoose";

/**
 * Finalize a single challenge - close positions, determine winner and distribute prizes
 * Retries up to 3 times on transient transaction errors (WriteConflict)
 */
export async function finalizeChallenge(challengeId: string) {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await _finalizeChallengeAttempt(challengeId);
    } catch (error: any) {
      const isTransient =
        error?.errorLabelSet?.has?.("TransientTransactionError") ||
        error?.errorLabels?.includes?.("TransientTransactionError") ||
        error?.code === 112 || // WriteConflict
        error?.codeName === "WriteConflict";

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

  const session = await mongoose.startSession();
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

    // Process already-closed positions
    // NOTE: TradingPosition doesn't have 'profitLoss' field - calculate from entry/exit prices
    for (const position of allPositions) {
      if (position.status === "closed" || position.status === "liquidated") {
        const userId = position.userId.toString();
        const stats = participantStats.get(userId);
        if (stats) {
          // Calculate P&L from entry/exit prices
          // Use exitPrice if available (set when position was closed), otherwise use currentPrice
          // FOREX: contractSize = 100,000 units per standard lot
          const exitPrice =
            position.exitPrice ?? position.currentPrice ?? position.entryPrice;
          const priceDiff =
            position.side === "long"
              ? exitPrice - position.entryPrice
              : position.entryPrice - exitPrice;
          const positionPnL = priceDiff * position.quantity * 100000; // Fixed: was 10000

          console.log(
            `  Closed position: ${position.symbol} ${position.side}, Entry: ${position.entryPrice}, Exit: ${exitPrice}, P&L: $${positionPnL.toFixed(2)}`,
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

    // OPTIMIZATION: Fetch all prices at once (instead of one by one in loop!)
    const uniqueSymbols = [
      ...new Set(openPositions.map((p) => p.symbol)),
    ] as ForexSymbol[];
    console.log(
      `Fetching prices for ${uniqueSymbols.length} unique symbols...`,
    );
    const pricesMap = await fetchRealForexPrices(uniqueSymbols);
    console.log(`Got ${pricesMap.size} prices in single batch`);

    for (const position of openPositions) {
      try {
        // Get price from pre-fetched batch (instant!)
        const priceData = pricesMap.get(position.symbol as ForexSymbol);
        if (!priceData) {
          console.error(
            `  ❌ Could not get price for ${position.symbol}, skipping`,
          );
          continue;
        }
        const exitPrice =
          position.side === "long" ? priceData.bid : priceData.ask;

        // Calculate P&L (FOREX: contractSize = 100,000 units per lot)
        const priceDiff =
          position.side === "long"
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        const positionPnL = priceDiff * position.quantity * 100000; // Fixed: was 10000

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
    const settings = await (ChallengeSettings as any).getSingleton();

    // Check for disqualification (minimum trades OR liquidation if flag is set)
    const minTrades = challenge.rules.minimumTrades || 1;
    const disqualifyOnLiquidation =
      challenge.rules.disqualifyOnLiquidation !== false; // Default true

    // Minimum trades check
    const challengerMinTradesFail = challenger.totalTrades < minTrades;
    const challengedMinTradesFail = challenged.totalTrades < minTrades;

    // Liquidation check (only if flag is enabled)
    const challengerLiquidated =
      disqualifyOnLiquidation && challenger.status === "liquidated";
    const challengedLiquidated =
      disqualifyOnLiquidation && challenged.status === "liquidated";

    // Combined disqualification check
    const challengerDisqualified =
      challengerMinTradesFail || challengerLiquidated;
    const challengedDisqualified =
      challengedMinTradesFail || challengedLiquidated;

    // Update participant statuses
    if (challengerDisqualified && challenger.status !== "disqualified") {
      challenger.status = "disqualified";
      if (challengerLiquidated) {
        challenger.disqualificationReason = "Account liquidated";
      } else if (challengerMinTradesFail) {
        challenger.disqualificationReason = `Did not make minimum ${minTrades} trade(s)`;
      }
      await challenger.save({ session });
    }

    if (challengedDisqualified && challenged.status !== "disqualified") {
      challenged.status = "disqualified";
      if (challengedLiquidated) {
        challenged.disqualificationReason = "Account liquidated";
      } else if (challengedMinTradesFail) {
        challenged.disqualificationReason = `Did not make minimum ${minTrades} trade(s)`;
      }
      await challenged.save({ session });
    }

    let winnerId: string | null = null;
    let winnerName: string | null = null;
    let loserId: string | null = null;
    let loserName: string | null = null;
    let isTie = false;
    let winnerPnL = 0;
    let loserPnL = 0;

    // Determine winner based on ranking method (supports all 6 competition ranking methods)
    const getRankingValue = (participant: any) => {
      switch (challenge.rules.rankingMethod) {
        case "pnl":
          return participant.pnl || 0;
        case "roi":
          return participant.pnlPercentage || 0;
        case "total_capital":
          return participant.currentCapital || 0;
        case "win_rate":
          return participant.winRate || 0;
        case "total_wins":
          return participant.winningTrades || 0;
        case "profit_factor":
          // Profit Factor = Total Wins / Total Losses
          const totalWins = participant.winningTrades || 0;
          const totalLosses = participant.losingTrades || 0;
          if (totalLosses === 0) return totalWins > 0 ? 9999 : 0;
          return totalWins / totalLosses;
        default:
          return participant.pnl || 0;
      }
    };

    // Get tiebreaker value (same as competitions)
    const getTieBreakerValue = (participant: any, tieBreaker: string) => {
      switch (tieBreaker) {
        case "trades_count":
          return -(participant.totalTrades || 0); // Negative because fewer is better
        case "win_rate":
          return participant.winRate || 0;
        case "total_capital":
          return participant.currentCapital || 0;
        case "roi":
          return participant.pnlPercentage || 0;
        case "join_time":
          return -new Date(participant.enteredAt || Date.now()).getTime();
        default:
          return 0;
      }
    };

    const challengerValue = getRankingValue(challenger);
    const challengedValue = getRankingValue(challenged);

    // Get prize amounts early for use in disqualification handling
    const prizePool = challenge.prizePool;
    const calculatedWinnerPrize = challenge.winnerPrize;

    // Handle disqualification cases
    if (challengerDisqualified && challengedDisqualified) {
      // Both disqualified - Platform keeps the entire prize pool
      console.log(
        `⚠️ Both players disqualified in challenge ${challengeId}, platform keeps pool`,
      );

      // Record unclaimed pool for platform
      await PlatformTransaction.create(
        [
          {
            transactionType: "unclaimed_pool",
            amount: calculatedWinnerPrize,
            amountEUR: calculatedWinnerPrize,
            sourceType: "challenge",
            sourceId: challenge._id.toString(),
            sourceName: `${challenge.challengerName} vs ${challenge.challengedName}`,
            unclaimedReason: "all_disqualified",
            originalPoolAmount: prizePool,
            winnersCount: 0,
            expectedWinnersCount: 1,
            description: `Both players disqualified in challenge - pool goes to platform`,
          },
        ],
        { session },
      );

      // No winner, no prize distributed
      winnerId = null;
      winnerName = null;
      isTie = false;
    } else if (challengerDisqualified) {
      // Challenged wins by default
      winnerId = challenged.userId;
      winnerName = challenged.username;
      loserId = challenger.userId;
      loserName = challenger.username;
      winnerPnL = challengedValue;
      loserPnL = challengerValue;
    } else if (challengedDisqualified) {
      // Challenger wins by default
      winnerId = challenger.userId;
      winnerName = challenger.username;
      loserId = challenged.userId;
      loserName = challenged.username;
      winnerPnL = challengerValue;
      loserPnL = challengedValue;
    } else {
      // Both qualified - compare values with tie-breaking logic
      const epsilon = 0.001; // For floating point comparison

      if (Math.abs(challengerValue - challengedValue) < epsilon) {
        // Primary values are equal - apply tiebreakers
        let resolved = false;

        // Try tiebreaker 1
        if (
          challenge.rules.tieBreaker1 &&
          challenge.rules.tieBreaker1 !== "split_prize"
        ) {
          const challengerTie1 = getTieBreakerValue(
            challenger,
            challenge.rules.tieBreaker1,
          );
          const challengedTie1 = getTieBreakerValue(
            challenged,
            challenge.rules.tieBreaker1,
          );

          if (Math.abs(challengerTie1 - challengedTie1) >= epsilon) {
            if (challengerTie1 > challengedTie1) {
              winnerId = challenger.userId;
              winnerName = challenger.username;
              loserId = challenged.userId;
              loserName = challenged.username;
              winnerPnL = challengerValue;
              loserPnL = challengedValue;
            } else {
              winnerId = challenged.userId;
              winnerName = challenged.username;
              loserId = challenger.userId;
              loserName = challenger.username;
              winnerPnL = challengedValue;
              loserPnL = challengerValue;
            }
            resolved = true;
            console.log(
              `  Winner determined by tiebreaker 1: ${challenge.rules.tieBreaker1}`,
            );
          }
        }

        // Try tiebreaker 2 if tiebreaker 1 didn't resolve
        if (
          !resolved &&
          challenge.rules.tieBreaker2 &&
          challenge.rules.tieBreaker2 !== "split_prize"
        ) {
          const challengerTie2 = getTieBreakerValue(
            challenger,
            challenge.rules.tieBreaker2,
          );
          const challengedTie2 = getTieBreakerValue(
            challenged,
            challenge.rules.tieBreaker2,
          );

          if (Math.abs(challengerTie2 - challengedTie2) >= epsilon) {
            if (challengerTie2 > challengedTie2) {
              winnerId = challenger.userId;
              winnerName = challenger.username;
              loserId = challenged.userId;
              loserName = challenged.username;
              winnerPnL = challengerValue;
              loserPnL = challengedValue;
            } else {
              winnerId = challenged.userId;
              winnerName = challenged.username;
              loserId = challenger.userId;
              loserName = challenger.username;
              winnerPnL = challengedValue;
              loserPnL = challengerValue;
            }
            resolved = true;
            console.log(
              `  Winner determined by tiebreaker 2: ${challenge.rules.tieBreaker2}`,
            );
          }
        }

        // Still not resolved - it's a true tie
        if (!resolved) {
          isTie = true;
          console.log(`  Challenge is a TRUE tie - all criteria matched`);
        }
      } else if (challengerValue > challengedValue) {
        winnerId = challenger.userId;
        winnerName = challenger.username;
        loserId = challenged.userId;
        loserName = challenged.username;
        winnerPnL = challengerValue;
        loserPnL = challengedValue;
      } else {
        winnerId = challenged.userId;
        winnerName = challenged.username;
        loserId = challenger.userId;
        loserName = challenger.username;
        winnerPnL = challengedValue;
        loserPnL = challengerValue;
      }
    }

    // Update challenge with results
    challenge.status = "completed";
    challenge.winnerId = winnerId || undefined;
    challenge.winnerName = winnerName || undefined;
    challenge.winnerPnL = winnerPnL;
    challenge.loserId = loserId || undefined;
    challenge.loserName = loserName || undefined;
    challenge.loserPnL = loserPnL;
    challenge.isTie = isTie;
    // Mark as no-winner when both are disqualified (neither winner nor tie)
    challenge.noWinner = !winnerId && !isTie ? true : undefined;

    // Store final stats
    challenge.challengerFinalStats = {
      finalCapital: challenger.currentCapital,
      pnl: challenger.pnl,
      pnlPercentage: challenger.pnlPercentage,
      totalTrades: challenger.totalTrades,
      winRate: challenger.winRate,
      isDisqualified: challengerDisqualified,
      disqualificationReason: challenger.disqualificationReason,
    };

    challenge.challengedFinalStats = {
      finalCapital: challenged.currentCapital,
      pnl: challenged.pnl,
      pnlPercentage: challenged.pnlPercentage,
      totalTrades: challenged.totalTrades,
      winRate: challenged.winRate,
      isDisqualified: challengedDisqualified,
      disqualificationReason: challenged.disqualificationReason,
    };

    await challenge.save({ session });

    // Distribute prize
    const platformFee = challenge.platformFeeAmount;
    const winnerPrize = challenge.winnerPrize;

    // ========== STEP 4: CALCULATE GM REFERRAL FEES ==========
    // Check if either participant was referred by a Game Master who can earn from challenges
    let totalGmEarnings = 0;
    const gmPayments: {
      gmId: string;
      amount: number;
      userId: string;
      userName: string;
      userEmail: string;
      feePercentage: number;
    }[] = [];
    const inactiveGmFees: {
      gmId: string;
      gmEmail?: string;
      userId: string;
      userName: string;
      wouldHaveEarned: number;
      feePercentage: number;
      subscriptionStatus: string;
    }[] = [];

    try {
      const db = mongoose.connection.db;
      if (db) {
        // Get user records to check for referrals
        const userIds = [challenger.userId, challenged.userId];

        // DEBUG: Log user IDs being searched
        console.log(
          `   🔍 Searching for referrals with userIds: ${userIds.join(", ")}`,
        );

        // Use UserReferral collection as source of truth
        const userReferrals = await db
          .collection("userreferrals")
          .find({
            userId: { $in: userIds },
            isActive: true,
            gameMasterId: { $exists: true, $ne: null },
          })
          .toArray();

        // DEBUG: Log each found referral
        for (const ref of userReferrals) {
          console.log(
            `   📋 UserReferral: userId=${ref.userId}, gameMasterId=${ref.gameMasterId}, isActive=${ref.isActive}`,
          );
        }

        // Also check user.referredByGameMasterId as fallback
        const usersWithReferral = await db
          .collection("user")
          .find({
            id: { $in: userIds },
            referredByGameMasterId: { $exists: true, $ne: null },
          })
          .toArray();

        // Create a map: userId -> { gmId, userName, userEmail }
        const referralMap = new Map<
          string,
          { gmId: string; userName: string; userEmail: string }
        >();

        // Add from user collection (fallback)
        for (const user of usersWithReferral) {
          const isChallenger = user.id === challenger.userId;
          referralMap.set(user.id, {
            gmId: user.referredByGameMasterId,
            userName: isChallenger
              ? challenge.challengerName
              : challenge.challengedName,
            userEmail: user.email || "",
          });
        }

        // Add/override from UserReferral collection (source of truth)
        for (const ref of userReferrals) {
          const isChallenger = ref.userId === challenger.userId;
          // Get user email if not already available
          const existingData = referralMap.get(ref.userId);
          const userEmail =
            existingData?.userEmail ||
            usersWithReferral.find((u) => u.id === ref.userId)?.email ||
            "";
          referralMap.set(ref.userId, {
            gmId: ref.gameMasterId,
            userName: isChallenger
              ? challenge.challengerName
              : challenge.challengedName,
            userEmail,
          });
        }

        console.log(
          `   🎮 Found ${referralMap.size} referred participant(s) in challenge`,
        );

        for (const [userId, refData] of referralMap) {
          const gmId = refData.gmId;
          if (!gmId) continue;

          // Get the participant's entry fee
          const participantEntryFee = challenge.entryFee;
          const userName = refData.userName;

          // Look up GM subscription (must be active, not paused, and have canEarnFromChallenges)
          const gmSubscription = await db
            .collection("gamemastersubscriptions")
            .findOne({
              userId: gmId,
              status: "active",
              isPaused: { $ne: true },
              "limits.canEarnFromChallenges": true,
            });

          // IMPORTANT: Get CURRENT package settings (not cached subscription limits)
          // This ensures if admin changes package settings, all GMs with that package see the update
          let currentFeePercentage = 5; // Default fallback
          let currentChallengeEarningsEnabled = false;
          const subscriptionToCheck =
            gmSubscription ||
            (await db
              .collection("gamemastersubscriptions")
              .findOne({ userId: gmId }));

          if (subscriptionToCheck?.packageId) {
            try {
              const currentPackage = await db
                .collection("marketplaceitems")
                .findOne({
                  _id: new mongoose.Types.ObjectId(
                    subscriptionToCheck.packageId,
                  ),
                });
              if (currentPackage?.gameMasterConfig) {
                // Use challenge-specific fee or fall back to competition fee from current package
                currentFeePercentage =
                  currentPackage.gameMasterConfig
                    .challengeReferralFeePercentage ??
                  currentPackage.gameMasterConfig.referralFeePercentage ??
                  5;
                currentChallengeEarningsEnabled =
                  currentPackage.gameMasterConfig.canEarnFromChallenges ===
                  true;
                console.log(
                  `   📦 Using current package: ${currentFeePercentage}% challenge fee, enabled: ${currentChallengeEarningsEnabled}`,
                );
              }
            } catch {
              // Fallback to cached subscription limits
              currentFeePercentage =
                subscriptionToCheck?.limits?.challengeReferralFeePercentage ??
                subscriptionToCheck?.limits?.referralFeePercentage ??
                5;
            }
          } else if (subscriptionToCheck) {
            currentFeePercentage =
              subscriptionToCheck.limits?.challengeReferralFeePercentage ??
              subscriptionToCheck.limits?.referralFeePercentage ??
              5;
          }

          if (!gmSubscription) {
            // Check if they have ANY subscription to determine status
            const anySubscription = subscriptionToCheck;
            let subscriptionStatus =
              anySubscription?.status || "no_subscription";

            // Determine specific reason for ineligibility
            if (
              anySubscription?.status === "active" &&
              anySubscription?.isPaused
            ) {
              subscriptionStatus = "paused";
            } else if (
              anySubscription?.status === "active" &&
              !currentChallengeEarningsEnabled
            ) {
              subscriptionStatus = "challenge_earnings_disabled";
            }

            const wouldHaveEarned =
              participantEntryFee * (currentFeePercentage / 100);

            console.log(
              `   ⚠️ GM ${gmId} not eligible for challenge earnings (${subscriptionStatus})`,
            );
            console.log(
              `   💰 Would have earned: €${wouldHaveEarned.toFixed(2)} from ${userName}'s entry`,
            );

            inactiveGmFees.push({
              gmId,
              gmEmail: anySubscription?.userEmail,
              userId,
              userName,
              wouldHaveEarned,
              feePercentage: currentFeePercentage,
              subscriptionStatus,
            });
            continue;
          }

          // Use current package fee percentage
          const feePercentage = currentFeePercentage;
          const gmEarning = participantEntryFee * (feePercentage / 100);

          console.log(
            `   📊 GM ${gmId}: ${userName}'s entry ${participantEntryFee} × ${feePercentage}% = ${gmEarning.toFixed(2)}`,
          );

          totalGmEarnings += gmEarning;
          gmPayments.push({
            gmId,
            amount: gmEarning,
            userId,
            userName,
            userEmail: refData.userEmail,
            feePercentage,
          });
        }
      }
    } catch (gmError) {
      console.error("   ⚠️ Error calculating GM challenge fees:", gmError);
      // Continue without GM fees if there's an error
    }

    // SAFEGUARD: Cap GM earnings at platform fee
    let actualGmEarnings = totalGmEarnings;
    if (totalGmEarnings > platformFee) {
      console.warn(
        `   ⚠️ GM earnings (${totalGmEarnings}) exceed platform fee (${platformFee}), capping`,
      );
      actualGmEarnings = platformFee;
      // Scale down proportionally
      const scale = platformFee / totalGmEarnings;
      for (const payment of gmPayments) {
        payment.amount *= scale;
      }
    }

    // Calculate net platform fee after GM earnings
    const netPlatformFee = platformFee - actualGmEarnings;

    // NOTE: Platform fee recording and GM payments are deferred to AFTER transaction commit
    // to avoid WriteConflict errors (these operations don't use the transaction session).
    // Data is captured now and executed after commit below.
    const deferredFeeData = {
      netPlatformFee,
      actualGmEarnings,
      challengeId: challenge._id.toString(),
      challengerName: challenge.challengerName,
      challengedName: challenge.challengedName,
      platformFeePercentage: challenge.platformFeePercentage,
      entryFee: challenge.entryFee,
      createdAt: challenge.createdAt,
      inactiveGmFees: [...inactiveGmFees],
      gmPayments: [...gmPayments],
    };

    // Distribute prize based on outcome
    // IMPORTANT: All wallet updates use atomic $inc to prevent race conditions.
    // balanceBefore/balanceAfter are calculated from the atomic update result for accuracy.
    if (winnerId && !isTie) {
      // Winner takes all — atomic $inc for safe concurrent access
      const updatedWallet = await CreditWallet.findOneAndUpdate(
        { userId: winnerId },
        {
          $inc: {
            creditBalance: winnerPrize,
            totalWonFromChallenges: winnerPrize,
          },
        },
        { session, new: true },
      );

      if (updatedWallet) {
        const balanceAfter = updatedWallet.creditBalance;
        const balanceBefore = balanceAfter - winnerPrize;

        await WalletTransaction.create(
          [
            {
              userId: winnerId,
              transactionType: "challenge_win",
              amount: winnerPrize,
              balanceBefore,
              balanceAfter,
              currency: "EUR",
              exchangeRate: 1,
              status: "completed",
              challengeId: challenge._id.toString(),
              description: `Won challenge vs ${loserName}`,
              processedAt: new Date(),
            },
          ],
          { session },
        );

        // Update winner participant
        const winnerParticipant =
          winnerId === challenger.userId ? challenger : challenged;
        winnerParticipant.isWinner = true;
        winnerParticipant.prizeReceived = winnerPrize;
        winnerParticipant.status = "completed";
        await winnerParticipant.save({ session });
      }

      // Update loser participant
      const loserParticipant =
        loserId === challenger.userId ? challenger : challenged;
      loserParticipant.status = "completed";
      await loserParticipant.save({ session });
    } else if (isTie) {
      // Handle tie based on admin settings (default to split_equally for fairness)
      const tiePrizeDistribution =
        settings?.tiePrizeDistribution || "split_equally";

      if (tiePrizeDistribution === "split_equally") {
        // Split prize: first participant gets ceiling, second gets floor (no credits lost)
        const halfPrize = winnerPrize / 2;
        const prizes = [Math.ceil(halfPrize), Math.floor(halfPrize)];

        // Give half to each — atomic $inc for safe concurrent access
        const participants = [challenger, challenged];
        for (let i = 0; i < participants.length; i++) {
          const participant = participants[i];
          const splitPrize = prizes[i];

          const updatedWallet = await CreditWallet.findOneAndUpdate(
            { userId: participant.userId },
            {
              $inc: {
                creditBalance: splitPrize,
                totalWonFromChallenges: splitPrize,
              },
            },
            { session, new: true },
          );

          if (updatedWallet) {
            const balanceAfter = updatedWallet.creditBalance;
            const balanceBefore = balanceAfter - splitPrize;

            await WalletTransaction.create(
              [
                {
                  userId: participant.userId,
                  transactionType: "challenge_win",
                  amount: splitPrize,
                  balanceBefore,
                  balanceAfter,
                  currency: "EUR",
                  exchangeRate: 1,
                  status: "completed",
                  challengeId: challenge._id.toString(),
                  description: `Tie - split prize in challenge`,
                  processedAt: new Date(),
                },
              ],
              { session },
            );

            participant.prizeReceived = splitPrize;
            participant.status = "completed";
            await participant.save({ session });
          }
        }
      } else if (tiePrizeDistribution === "challenger_wins") {
        // Challenger gets the prize (challenger advantage on ties)
        winnerId = challenger.userId;
        winnerName = challenger.username;
        loserId = challenged.userId;
        loserName = challenged.username;

        const updatedChalWallet = await CreditWallet.findOneAndUpdate(
          { userId: challenger.userId },
          {
            $inc: {
              creditBalance: winnerPrize,
              totalWonFromChallenges: winnerPrize,
            },
          },
          { session, new: true },
        );

        if (updatedChalWallet) {
          const balanceAfter = updatedChalWallet.creditBalance;
          const balanceBefore = balanceAfter - winnerPrize;

          await WalletTransaction.create(
            [
              {
                userId: challenger.userId,
                transactionType: "challenge_win",
                amount: winnerPrize,
                balanceBefore,
                balanceAfter,
                currency: "EUR",
                exchangeRate: 1,
                status: "completed",
                challengeId: challenge._id.toString(),
                description: `Won challenge (tie - challenger advantage) vs ${challenged.username}`,
                processedAt: new Date(),
              },
            ],
            { session },
          );

          challenger.isWinner = true;
          challenger.prizeReceived = winnerPrize;
        }

        challenger.status = "completed";
        challenged.status = "completed";
        await challenger.save({ session });
        await challenged.save({ session });
      }
      // 'both_lose' - platform keeps prize, already recorded above
    }

    await session.commitTransaction();
    // End session immediately after commit to prevent "abortTransaction after commitTransaction" error
    session.endSession();

    // === DEFERRED: Record platform fees and GM payments AFTER transaction commit ===
    // These were previously inside the transaction but without a session, causing WriteConflict errors.
    // IMPORTANT: All inserts below have idempotency guards to prevent duplicates from retries or concurrent calls.
    try {
      const { PlatformFinancialsService } =
        await import("@/lib/services/platform-financials.service");

      // Record NET platform fee (with idempotency check)
      if (deferredFeeData.netPlatformFee > 0) {
        const { PlatformTransaction } = await import("@/database/models/platform-financials.model");
        const existingPlatformFee = await PlatformTransaction.findOne({
          sourceType: "challenge",
          sourceId: deferredFeeData.challengeId,
          transactionType: "challenge_platform_fee",
        });
        if (!existingPlatformFee) {
          await PlatformFinancialsService.recordPlatformFee({
            amount: deferredFeeData.netPlatformFee,
            sourceType: "challenge",
            sourceId: deferredFeeData.challengeId,
            sourceName: `${deferredFeeData.challengerName} vs ${deferredFeeData.challengedName}`,
            description:
              deferredFeeData.actualGmEarnings > 0
                ? `Platform fee (${deferredFeeData.platformFeePercentage}% - ${deferredFeeData.actualGmEarnings.toFixed(2)} GM fees) from ${deferredFeeData.challengerName} vs ${deferredFeeData.challengedName}`
                : `Platform fee (${deferredFeeData.platformFeePercentage}%) from ${deferredFeeData.challengerName} vs ${deferredFeeData.challengedName}`,
          });
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/cdeeb214-56c4-42f5-af3d-c63a29f02716',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'challenge-finalize.actions.ts:PLATFORM_FEE_SKIP',message:'Skipped duplicate platform fee',data:{challengeId:deferredFeeData.challengeId},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          console.log(`   ⏩ Platform fee already recorded for challenge ${deferredFeeData.challengeId}, skipping duplicate`);
        }
      }

      // Record retained GM fees for inactive/paused GMs
      if (deferredFeeData.inactiveGmFees.length > 0) {
        for (const inactiveGm of deferredFeeData.inactiveGmFees) {
          try {
            await PlatformFinancialsService.recordRetainedGmFee({
              sourceType: "challenge",
              sourceId: deferredFeeData.challengeId,
              sourceName: `${deferredFeeData.challengerName} vs ${deferredFeeData.challengedName}`,
              gameMasterId: inactiveGm.gmId,
              gameMasterEmail: inactiveGm.gmEmail,
              referredUsersCount: 1,
              amount: inactiveGm.wouldHaveEarned,
              originalFeePercentage: inactiveGm.feePercentage,
              subscriptionStatus: inactiveGm.subscriptionStatus,
              referredUserIds: [inactiveGm.userId],
            });
          } catch (recordError) {
            console.error(`   ⚠️ Failed to record retained GM fee for ${inactiveGm.gmId}:`, recordError);
          }
        }
      }

      // Pay GM referral fees (with idempotency guards)
      if (deferredFeeData.gmPayments.length > 0) {
        const db = mongoose.connection.db;
        if (db) {
          const allGmIds = deferredFeeData.gmPayments.map((p: any) => p.gmId);
          const [allGmSubs, allGmWallets] = await Promise.all([
            db.collection("gamemastersubscriptions").find({ userId: { $in: allGmIds } }).toArray(),
            db.collection("creditwallets").find({ userId: { $in: allGmIds } }).toArray(),
          ]);
          const gmSubMap = new Map(allGmSubs.map((s) => [s.userId, s]));
          const gmWalletMap = new Map(allGmWallets.map((w) => [w.userId, w]));

          for (const payment of deferredFeeData.gmPayments) {
            try {
              // IDEMPOTENCY: Check if GM earnings already exist for this challenge + GM + referred user
              const existingEarning = await db.collection("gamemasterearnings").findOne({
                sourceType: "challenge",
                sourceId: deferredFeeData.challengeId,
                gameMasterId: payment.gmId,
                referredUserId: payment.userId,
              });

              if (existingEarning) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/cdeeb214-56c4-42f5-af3d-c63a29f02716',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'challenge-finalize.actions.ts:GM_EARNING_SKIP',message:'Skipped duplicate GM earning',data:{challengeId:deferredFeeData.challengeId,gmId:payment.gmId,userId:payment.userId},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                console.log(`   ⏩ GM earning already recorded for ${payment.userName} in challenge ${deferredFeeData.challengeId}, skipping duplicate`);
                continue;
              }

              const gmSubscription = gmSubMap.get(payment.gmId) || null;
              await db.collection("gamemastersubscriptions").updateOne(
                { userId: payment.gmId },
                { $inc: { totalEarnings: payment.amount }, $set: { updatedAt: new Date() } },
              );

              const gmWallet = gmWalletMap.get(payment.gmId) || null;
              if (gmWallet) {
                // IDEMPOTENCY: Check if wallet transaction already exists for this challenge
                const existingWalletTx = await db.collection("wallettransactions").findOne({
                  userId: payment.gmId,
                  transactionType: "gamemaster_earning",
                  "metadata.challengeId": deferredFeeData.challengeId,
                  "metadata.referredUserId": payment.userId,
                });

                if (!existingWalletTx) {
                  // Use findOneAndUpdate for accurate balance tracking:
                  // returnDocument:"after" gives us the NEW balance, so balanceBefore = newBalance - amount
                  const updatedGmWallet = await db.collection("creditwallets").findOneAndUpdate(
                    { userId: payment.gmId },
                    { $inc: { creditBalance: payment.amount } },
                    { returnDocument: "after" },
                  );
                  const balanceAfterGm = updatedGmWallet?.creditBalance || payment.amount;
                  const balanceBeforeGm = balanceAfterGm - payment.amount;

                  await db.collection("wallettransactions").insertOne({
                    userId: payment.gmId,
                    transactionType: "gamemaster_earning",
                    amount: payment.amount,
                    balanceBefore: balanceBeforeGm,
                    balanceAfter: balanceAfterGm,
                    currency: "EUR",
                    exchangeRate: 1,
                    status: "completed",
                    description: `🎮 Game Master referral earnings from ${deferredFeeData.challengerName} vs ${deferredFeeData.challengedName} (1 referred user)`,
                    metadata: {
                      challengeId: deferredFeeData.challengeId,
                      challengeName: `${deferredFeeData.challengerName} vs ${deferredFeeData.challengedName}`,
                      referredUsersCount: 1,
                      referredUserId: payment.userId,
                      referredUserName: payment.userName,
                      feePercentage: (payment.amount / deferredFeeData.entryFee) * 100,
                      sourceType: "challenge",
                    },
                    processedAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  });
                  console.log(`   ✅ Paid ${payment.amount.toFixed(2)} to GM ${payment.gmId} for ${payment.userName}'s referral`);
                } else {
                  console.log(`   ⏩ Wallet transaction already exists for GM ${payment.gmId} in challenge ${deferredFeeData.challengeId}, skipping`);
                }
              }

              const feePercentage = (payment.amount / deferredFeeData.entryFee) * 100;
              await db.collection("gamemasterearnings").insertOne({
                gameMasterId: payment.gmId,
                gameMasterEmail: (gmSubscription as any)?.userEmail || "",
                sourceType: "challenge",
                sourceId: deferredFeeData.challengeId,
                sourceName: `${deferredFeeData.challengerName} vs ${deferredFeeData.challengedName}`,
                referredUserId: payment.userId,
                referredUserEmail: payment.userEmail || "",
                referredUserName: payment.userName,
                entryFeeAmount: deferredFeeData.entryFee,
                earningPercentage: feePercentage,
                originalPercentage: feePercentage,
                grossEarning: payment.amount,
                platformFee: 0,
                netEarning: payment.amount,
                status: "paid",
                paidAt: new Date(),
                eventStartTime: deferredFeeData.createdAt,
                eventEndTime: new Date(),
                participantCount: 2,
                wasCapped: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            } catch (paymentError) {
              console.error(`   ❌ Failed to pay GM ${payment.gmId}:`, paymentError);
            }
          }
        }
      }

      console.log(`   💰 Platform fee: ${deferredFeeData.netPlatformFee.toFixed(2)} (after ${deferredFeeData.actualGmEarnings.toFixed(2)} GM fees)`);
    } catch (feeError) {
      // Fee recording failures should not affect the finalization result
      console.error("   ⚠️ Error recording platform fees (challenge already finalized):", feeError);
    }

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

    console.log(
      `✅ Challenge ${challengeId} finalized: Winner: ${winnerName || "TIE"}`,
    );
    return { success: true, winnerId, winnerName, isTie };
  } catch (error) {
    // Only abort and release lock if the transaction was NOT committed.
    // If the transaction committed (status is "completed" in DB), we must NOT reset to "active"
    // because the prize has already been distributed.
    if (session.inTransaction()) {
      await session.abortTransaction();
      // Release the optimistic lock ONLY when the transaction was aborted (not committed)
      try {
        await Challenge.updateOne(
          { _id: challengeId, status: "finalizing" },
          { $set: { status: "active" } },
        );
      } catch {
        // Best effort - if this fails, worker recovery will handle stuck "finalizing" after 5 min
      }
    }
    // If session is NOT in transaction, the transaction was either committed or already aborted.
    // Don't reset to "active" — the challenge is already "completed" (committed) or will be retried.
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
 * Expire pending challenges that have passed their deadline
 */
export async function expirePendingChallenges() {
  try {
    await connectToDatabase();

    const now = new Date();

    const result = await Challenge.updateMany(
      {
        status: "pending",
        acceptDeadline: { $lte: now },
      },
      {
        $set: { status: "expired" },
      },
    );

    console.log(`Expired ${result.modifiedCount} pending challenges`);

    return { expired: result.modifiedCount };
  } catch (error) {
    console.error("Error expiring challenges:", error);
    throw error;
  }
}
