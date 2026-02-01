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
 */
export async function finalizeChallenge(challengeId: string) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectToDatabase();

    const challenge = await Challenge.findById(challengeId).session(session);
    if (!challenge || challenge.status !== "active") {
      console.log(`Challenge ${challengeId} not active, skipping`);
      await session.abortTransaction();
      return null;
    }

    // Check if challenge has ended
    if (challenge.endTime && new Date() < challenge.endTime) {
      console.log(`Challenge ${challengeId} hasn't ended yet`);
      await session.abortTransaction();
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
              closeOrderId: closeOrder[0]._id.toString(),
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
              closeOrderId: closeOrder[0]._id.toString(),
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

      // Refresh participant data
      if (userId === challenger.userId) {
        challenger.currentCapital = stats.currentCapital;
        challenger.pnl = stats.totalPnL;
        challenger.pnlPercentage = pnlPercentage;
        challenger.totalTrades = stats.totalTrades;
        challenger.winRate = winRate;
      } else {
        challenged.currentCapital = stats.currentCapital;
        challenged.pnl = stats.totalPnL;
        challenged.pnlPercentage = pnlPercentage;
        challenged.totalTrades = stats.totalTrades;
        challenged.winRate = winRate;
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

    // Import PlatformFinancialsService for proper tracking
    const { PlatformFinancialsService } =
      await import("@/lib/services/platform-financials.service");

    // Record NET platform fee in financials (after subtracting GM fees)
    if (netPlatformFee > 0) {
      await PlatformFinancialsService.recordPlatformFee({
        amount: netPlatformFee,
        sourceType: "challenge",
        sourceId: challenge._id.toString(),
        sourceName: `${challenge.challengerName} vs ${challenge.challengedName}`,
        description:
          actualGmEarnings > 0
            ? `Platform fee (${challenge.platformFeePercentage}% - ${actualGmEarnings.toFixed(2)} GM fees) from ${challenge.challengerName} vs ${challenge.challengedName}`
            : `Platform fee (${challenge.platformFeePercentage}%) from ${challenge.challengerName} vs ${challenge.challengedName}`,
      });
    }

    // Record retained GM fees for inactive/paused GMs
    if (inactiveGmFees.length > 0) {
      console.log(
        `   📊 Recording ${inactiveGmFees.length} inactive GM fee(s) for reconciliation...`,
      );
      for (const inactiveGm of inactiveGmFees) {
        try {
          await PlatformFinancialsService.recordRetainedGmFee({
            sourceType: "challenge",
            sourceId: challenge._id.toString(),
            sourceName: `${challenge.challengerName} vs ${challenge.challengedName}`,
            gameMasterId: inactiveGm.gmId,
            gameMasterEmail: inactiveGm.gmEmail,
            referredUsersCount: 1,
            amount: inactiveGm.wouldHaveEarned,
            originalFeePercentage: inactiveGm.feePercentage,
            subscriptionStatus: inactiveGm.subscriptionStatus,
            referredUserIds: [inactiveGm.userId],
          });
        } catch (recordError) {
          console.error(
            `   ⚠️ Failed to record retained GM fee for ${inactiveGm.gmId}:`,
            recordError,
          );
        }
      }
    }

    // Pay GM referral fees
    if (gmPayments.length > 0) {
      const db = mongoose.connection.db;
      if (db) {
        for (const payment of gmPayments) {
          try {
            // Get GM subscription for email
            const gmSubscription = await db
              .collection("gamemastersubscriptions")
              .findOne({ userId: payment.gmId });

            // Update GM subscription earnings (add to total, but NOT to pending since we pay immediately)
            await db.collection("gamemastersubscriptions").updateOne(
              { userId: payment.gmId },
              {
                $inc: {
                  totalEarnings: payment.amount,
                  // Don't increment pendingEarnings since we pay immediately
                },
                $set: { updatedAt: new Date() },
              },
            );

            // Add to GM's wallet
            const gmWallet = await db
              .collection("creditwallets")
              .findOne({ userId: payment.gmId });
            if (gmWallet) {
              const balanceBefore = gmWallet.creditBalance || 0;
              await db
                .collection("creditwallets")
                .updateOne(
                  { userId: payment.gmId },
                  { $inc: { creditBalance: payment.amount } },
                );

              // Record transaction - use consistent type 'gamemaster_earning' for all GM earnings
              await db.collection("wallettransactions").insertOne({
                userId: payment.gmId,
                transactionType: "gamemaster_earning",
                amount: payment.amount,
                balanceBefore,
                balanceAfter: balanceBefore + payment.amount,
                currency: "EUR",
                exchangeRate: 1,
                status: "completed",
                description: `🎮 Game Master referral earnings from ${challenge.challengerName} vs ${challenge.challengedName} (1 referred user)`,
                metadata: {
                  challengeId: challenge._id.toString(),
                  challengeName: `${challenge.challengerName} vs ${challenge.challengedName}`,
                  referredUsersCount: 1,
                  referredUserId: payment.userId,
                  referredUserName: payment.userName,
                  feePercentage: (payment.amount / challenge.entryFee) * 100,
                  sourceType: "challenge",
                },
                processedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              console.log(
                `   ✅ Paid ${payment.amount.toFixed(2)} to GM ${payment.gmId} for ${payment.userName}'s referral`,
              );
            }

            // Record GM earning in GameMasterEarning collection - match competition structure exactly
            const feePercentage = (payment.amount / challenge.entryFee) * 100;
            await db.collection("gamemasterearnings").insertOne({
              gameMasterId: payment.gmId,
              gameMasterEmail: gmSubscription?.userEmail || "",
              sourceType: "challenge",
              sourceId: challenge._id.toString(),
              sourceName: `${challenge.challengerName} vs ${challenge.challengedName}`,
              referredUserId: payment.userId,
              referredUserEmail: payment.userEmail || "",
              referredUserName: payment.userName,
              entryFeeAmount: challenge.entryFee,
              earningPercentage: feePercentage,
              originalPercentage: feePercentage,
              grossEarning: payment.amount,
              platformFee: 0,
              netEarning: payment.amount,
              status: "paid",
              paidAt: new Date(),
              eventStartTime: challenge.createdAt,
              eventEndTime: new Date(),
              participantCount: 2,
              wasCapped: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } catch (paymentError) {
            console.error(
              `   ❌ Failed to pay GM ${payment.gmId}:`,
              paymentError,
            );
          }
        }
      }
    }

    console.log(
      `   💰 Platform fee: ${netPlatformFee.toFixed(2)} (after ${actualGmEarnings.toFixed(2)} GM fees)`,
    );

    // Distribute prize based on outcome
    if (winnerId && !isTie) {
      // Winner takes all
      const winnerWallet = await CreditWallet.findOne({
        userId: winnerId,
      }).session(session);
      if (winnerWallet) {
        const balanceBefore = winnerWallet.creditBalance;
        winnerWallet.creditBalance += winnerPrize;
        winnerWallet.totalWonFromChallenges =
          (winnerWallet.totalWonFromChallenges || 0) + winnerPrize;
        await winnerWallet.save({ session });

        await WalletTransaction.create(
          [
            {
              userId: winnerId,
              transactionType: "challenge_win",
              amount: winnerPrize,
              balanceBefore,
              balanceAfter: winnerWallet.creditBalance,
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
        const splitPrize = Math.floor(winnerPrize / 2);

        // Give half to each
        for (const participant of [challenger, challenged]) {
          const wallet = await CreditWallet.findOne({
            userId: participant.userId,
          }).session(session);
          if (wallet) {
            const balanceBefore = wallet.creditBalance;
            wallet.creditBalance += splitPrize;
            wallet.totalWonFromChallenges =
              (wallet.totalWonFromChallenges || 0) + splitPrize;
            await wallet.save({ session });

            await WalletTransaction.create(
              [
                {
                  userId: participant.userId,
                  transactionType: "challenge_win",
                  amount: splitPrize,
                  balanceBefore,
                  balanceAfter: wallet.creditBalance,
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

        const chalWallet = await CreditWallet.findOne({
          userId: challenger.userId,
        }).session(session);
        if (chalWallet) {
          const balanceBefore = chalWallet.creditBalance;
          chalWallet.creditBalance += winnerPrize;
          chalWallet.totalWonFromChallenges =
            (chalWallet.totalWonFromChallenges || 0) + winnerPrize;
          await chalWallet.save({ session });

          await WalletTransaction.create(
            [
              {
                userId: challenger.userId,
                transactionType: "challenge_win",
                amount: winnerPrize,
                balanceBefore,
                balanceAfter: chalWallet.creditBalance,
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

    console.log(
      `✅ Challenge ${challengeId} finalized: Winner: ${winnerName || "TIE"}`,
    );
    return { success: true, winnerId, winnerName, isTie };
  } catch (error) {
    // Only abort if session is still in transaction
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error(`Error finalizing challenge ${challengeId}:`, error);
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
