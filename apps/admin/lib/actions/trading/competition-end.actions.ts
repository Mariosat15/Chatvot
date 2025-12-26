'use server';

import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { getRealPrice, fetchRealForexPrices } from '@/lib/services/real-forex-prices.service';
import type { ForexSymbol } from '@/lib/services/pnl-calculator.service';
import mongoose from 'mongoose';

/**
 * End a competition and distribute prizes
 * This is called automatically by Inngest when endTime is reached
 */
export async function finalizeCompetition(competitionId: string) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectToDatabase();

    console.log(`🏁 Starting competition finalization for: ${competitionId}`);

    // Get competition
    const competition = await Competition.findById(competitionId).session(session);
    if (!competition) {
      throw new Error('Competition not found');
    }

    if (competition.status !== 'active') {
      console.log(`⚠️ Competition ${competitionId} is not active (status: ${competition.status}), skipping`);
      await session.abortTransaction();
      return { success: false, message: 'Competition is not active' };
    }

    // STEP 1: Close all open positions AND calculate P&L in memory
    console.log(`📊 Closing all open positions and calculating P&L...`);
    
    // First, get all participants to track their stats
    const allParticipants = await CompetitionParticipant.find({
      competitionId: competition._id,
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
    const allPositions = await TradingPosition.find({
      competitionId: competition._id,
    }).session(session);

    console.log(`Found ${allPositions.length} total positions (open and closed)`);

    // First, process already-closed positions
    // NOTE: TradingPosition doesn't have 'profitLoss' field - calculate from entry/exit prices
    for (const position of allPositions) {
      if (position.status === 'closed' || position.status === 'liquidated') {
        const userId = position.userId.toString();
        const stats = participantStats.get(userId);
        if (stats) {
          // Calculate P&L from entry/exit prices (currentPrice = exitPrice for closed positions)
          // FOREX: contractSize = 100,000 units per standard lot
          const priceDiff = position.side === 'long'
            ? position.currentPrice - position.entryPrice
            : position.entryPrice - position.currentPrice;
          const positionPnL = priceDiff * position.quantity * 100000; // Fixed: was 10000
          
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
    
    console.log(`Processed ${allPositions.filter(p => p.status === 'closed' || p.status === 'liquidated').length} already-closed positions`);

    // Import required models
    const TradeHistory = (await import('@/database/models/trading/trade-history.model')).default;
    const TradingOrder = (await import('@/database/models/trading/trading-order.model')).default;

    // Now, close open positions and calculate their P&L
    const openPositions = allPositions.filter(p => p.status === 'open');
    console.log(`Closing ${openPositions.length} open positions...`);

    // OPTIMIZATION: Fetch all prices at once (instead of one by one in loop!)
    // This reduces price fetch from 15+ seconds to <1 second
    const uniqueSymbols = [...new Set(openPositions.map(p => p.symbol))] as ForexSymbol[];
    console.log(`Fetching prices for ${uniqueSymbols.length} unique symbols...`);
    const pricesMap = await fetchRealForexPrices(uniqueSymbols);
    console.log(`Got ${pricesMap.size} prices in single batch`);

    for (const position of openPositions) {
      try {
        // Get price from pre-fetched batch (instant!)
        const priceData = pricesMap.get(position.symbol as ForexSymbol);
        if (!priceData) {
          console.error(`  ❌ Could not get price for ${position.symbol}, skipping`);
          continue;
        }
        const exitPrice = position.side === 'long' ? priceData.bid : priceData.ask;

        console.log(`  Closing ${position.symbol} ${position.side} for user ${position.userId} at ${exitPrice}`);

        // Calculate P&L for this position (FOREX: contractSize = 100,000 units per lot)
        const priceDiff = position.side === 'long'
          ? exitPrice - position.entryPrice
          : position.entryPrice - exitPrice;
        const positionPnL = priceDiff * position.quantity * 100000; // Fixed: was 10000

        console.log(`    Entry: ${position.entryPrice}, Exit: ${exitPrice}, P&L: $${positionPnL.toFixed(2)}`);

        // Create a close order for this position
        const closeOrder = await TradingOrder.create(
          [
            {
              competitionId: position.competitionId,
              userId: position.userId,
              participantId: position.participantId,
              symbol: position.symbol,
              side: position.side === 'long' ? 'sell' : 'buy', // Opposite of position
              orderType: 'market',
              quantity: position.quantity,
              executedPrice: exitPrice,
              slippage: 0,
              leverage: position.leverage,
              marginRequired: position.marginUsed,
              status: 'filled',
              filledQuantity: position.quantity,
              remainingQuantity: 0,
              placedAt: new Date(),
              executedAt: new Date(),
              orderSource: 'system',
            },
          ],
          { session }
        );

        // Update position in database
        await TradingPosition.findByIdAndUpdate(
          position._id,
          {
            $set: {
              status: 'closed',
              exitPrice: exitPrice,
              profitLoss: positionPnL,
              closedAt: new Date(),
              closeReason: 'competition_end',
              closeOrderId: closeOrder[0]._id.toString(),
            },
          },
          { session }
        );

        // Create TradeHistory record (CRITICAL: This was missing!)
        const holdingTime = Math.floor((Date.now() - position.openedAt.getTime()) / 1000);
        await TradeHistory.create(
          [
            {
              competitionId: position.competitionId,
              userId: position.userId,
              participantId: position.participantId,
              symbol: position.symbol,
              side: position.side,
              quantity: position.quantity,
              orderType: 'market',
              entryPrice: position.entryPrice,
              exitPrice: exitPrice,
              priceChange: priceDiff,
              priceChangePercentage: (priceDiff / position.entryPrice) * 100,
              realizedPnl: positionPnL,
              realizedPnlPercentage: (positionPnL / position.marginUsed) * 100,
              openedAt: position.openedAt,
              closedAt: new Date(),
              holdingTimeSeconds: holdingTime,
              closeReason: 'competition_end',
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
          { session }
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
            stats.totalLossAmount = (stats.totalLossAmount || 0) + Math.abs(positionPnL);
            stats.largestLoss = Math.min(stats.largestLoss || 0, positionPnL);
          }
        }

        console.log(`  ✅ Position closed & TradeHistory created: P&L = $${positionPnL.toFixed(2)}`);
      } catch (error) {
        console.error(`  ❌ Error closing position ${position._id}:`, error);
        // Continue with other positions even if one fails
      }
    }

    // STEP 1.5: Update all participant records with calculated stats
    console.log(`🔄 Updating participant statistics...`);
    for (const [userId, stats] of participantStats.entries()) {
      const pnlPercentage = stats.participant.startingCapital > 0 
        ? (stats.totalPnL / stats.participant.startingCapital) * 100 
        : 0;

      const winRate = stats.closedPositionsCount > 0 
        ? (stats.winningTrades / stats.closedPositionsCount) * 100 
        : 0;

      const averageWin = stats.winningTrades > 0 
        ? (stats.totalWinAmount || 0) / stats.winningTrades 
        : 0;

      const averageLoss = stats.losingTrades > 0 
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
        { session }
      );

      console.log(`  ✅ ${stats.participant.username}: Capital=$${stats.currentCapital.toFixed(2)}, P&L=$${stats.totalPnL.toFixed(2)}, Win Rate=${winRate.toFixed(2)}% (${stats.closedPositionsCount} trades)`);
    }

    // STEP 2: Calculate final rankings using new rules system
    console.log(`📈 Calculating final rankings...`);
    const participants = await CompetitionParticipant.find({
      competitionId: competition._id,
    })
      .session(session)
      .lean();

    console.log(`Found ${participants.length} participants`);

    // Import ranking service
    const { calculateRankings, distributePrizesWithTies } = await import(
      '@/lib/services/competition-ranking.service'
    );

    // Prepare participant data for ranking
    const participantData = participants.map((p) => ({
      userId: p.userId,
      username: p.username || 'Anonymous',
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

    // Use competition rules or defaults
    const rules = competition.rules || {
      rankingMethod: 'pnl' as const,
      tieBreaker1: 'win_rate' as const,
      tieBreaker2: 'join_time' as const, // Secondary tiebreaker to ensure ranking
      minimumTrades: 0,
      tiePrizeDistribution: 'split_equally' as const,
      disqualifyOnLiquidation: true,
    };

    // Calculate rankings with tie-breaking
    // IMPORTANT: Pass 'completed' status to check minimum trades for final ranking
    const rankedParticipants = calculateRankings(participantData, rules, {
      competitionStatus: 'completed',
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
    const prizePool = competition.prizePool || 0;
    const platformFeePercentage = competition.platformFeePercentage / 100;

    console.log(`  Gross Prize Pool: ${prizePool} credits`);
    console.log(`  Platform Fee: ${competition.platformFeePercentage}%`);

    // FIXED: Calculate prizes from GROSS pool, then deduct platform fee from each winner
    // This ensures prize percentages are calculated from the total pool as advertised
    const prizeDistributions = distributePrizesWithTies(
      rankedParticipants,
      competition.prizeDistribution || [],
      prizePool, // Pass GROSS prize pool, not net
      rules,
      platformFeePercentage // Pass platform fee to deduct from each prize
    );

    console.log(`💎 Calculated ${prizeDistributions.length} prize distributions (including ties)`);

    let totalDistributed = 0;
    const winnerTransactions = [];

    // Distribute to each winner
    for (const dist of prizeDistributions) {
      const winner = leaderboard.find((l) => l.userId === dist.userId);
      
      if (winner) {
        const prizeAmount = dist.prizeAmount;
        winner.prizeAmount = prizeAmount;
        totalDistributed += prizeAmount;

        console.log(`  🏆 Rank ${dist.rank}${dist.isTied ? ' (TIED)' : ''}: ${winner.username} wins ${prizeAmount} credits`);

        // Get winner's wallet (or create if doesn't exist)
        let winnerWallet = await CreditWallet.findOne({ userId: winner.userId }).session(session);
        if (!winnerWallet) {
          winnerWallet = await CreditWallet.create(
            [
              {
                userId: winner.userId,
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
            { session }
          );
          winnerWallet = winnerWallet[0];
        }

        const balanceBefore = winnerWallet.creditBalance || 0;
        const balanceAfter = balanceBefore + prizeAmount;

        // Add credits to winner's wallet
        await CreditWallet.findOneAndUpdate(
          { userId: winner.userId },
          {
            $inc: {
              creditBalance: prizeAmount,
              totalWonFromCompetitions: prizeAmount,
            },
          },
          { session }
        );

        // Create transaction record
        const transaction = await WalletTransaction.create(
          [
            {
              userId: winner.userId,
              transactionType: 'competition_win',
              amount: prizeAmount,
              balanceBefore,
              balanceAfter,
              competitionId: competition._id,
              status: 'completed',
              description: dist.isTied
                ? `🏆 Prize for Rank ${winner.rank} (Tied) in ${competition.name}`
                : `🏆 Prize for Rank ${winner.rank} in ${competition.name}`,
              metadata: {
                rank: winner.rank,
                isTied: dist.isTied,
                finalPnl: winner.pnl,
                finalCapital: winner.finalCapital,
                qualificationStatus: winner.qualificationStatus,
                disqualificationReason: winner.disqualificationReason,
              },
            },
          ],
          { session }
        );

        winnerTransactions.push(transaction[0]);

        // TODO: Send email notification
        console.log(`  📧 Email notification queued for ${winner.username}`);
      }
    }

    // STEP 4: Calculate platform fee
    // IMPORTANT: Platform fee is ONLY the % taken, NOT the entire pool when no winners
    const qualifiedWinners = rankedParticipants.filter(p => p.qualificationStatus === 'qualified');
    const expectedWinners = competition.prizeDistribution?.length || 0;
    const actualWinners = prizeDistributions.length;
    
    // Calculate the ACTUAL platform fee (only the percentage portion)
    // When winners exist: fee = prizePool - totalDistributed (the % taken from each winner)
    // When NO winners: fee = prizePool * feePercentage (still only the % portion, not the entire pool)
    let actualPlatformFee: number;
    if (actualWinners > 0) {
      // Normal case: fee is what wasn't distributed to winners
      actualPlatformFee = prizePool - totalDistributed;
    } else {
      // No winners case: fee is still only the fee percentage, NOT the entire pool
      // The remaining goes to unclaimed pools, not to platform fee
      actualPlatformFee = prizePool * platformFeePercentage;
    }
    
    console.log(`💼 Platform fee calculated: ${actualPlatformFee.toFixed(2)} credits (${competition.platformFeePercentage}% of pool)`);
    
    // NOTE: Platform fee is recorded ONLY in PlatformTransaction (via PlatformFinancialsService)
    // We do NOT create a WalletTransaction for platform fees to avoid duplicate records

    // STEP 4.5: Record unclaimed pool funds and platform earnings in financials
    const { PlatformFinancialsService } = await import('@/lib/services/platform-financials.service');
    
    // ONLY record unclaimed pool when NO winners at all received prizes
    // When actualWinners > 0, all funds are distributed/redistributed - nothing is unclaimed
    if (actualWinners === 0 && prizePool > 0) {
      // All funds (minus platform fee) are unclaimed because no one got any prizes
      const unclaimedNet = prizePool * (1 - platformFeePercentage); // Pool minus the fee portion
      
      // Determine reason for unclaimed
      let unclaimedReason: 'no_participants' | 'all_disqualified' | 'no_qualified_winners';
      if (participants.length === 0) {
        unclaimedReason = 'no_participants';
      } else if (qualifiedWinners.length === 0) {
        unclaimedReason = 'all_disqualified';
      } else {
        unclaimedReason = 'no_qualified_winners';
      }
      
      console.log(`💰 Recording unclaimed pool: ${unclaimedNet.toFixed(2)} credits (${unclaimedReason})`);
      console.log(`   Platform fee: ${actualPlatformFee.toFixed(2)} + Unclaimed: ${unclaimedNet.toFixed(2)} = ${prizePool.toFixed(2)} (total pool)`);
      
      await PlatformFinancialsService.recordUnclaimedPool({
        competitionId: competition._id.toString(),
        competitionName: competition.name,
        poolAmount: unclaimedNet,
        reason: unclaimedReason,
        winnersCount: 0,
        expectedWinnersCount: expectedWinners,
        description: `Unclaimed pool from ${competition.name}: ${unclaimedReason.replace(/_/g, ' ')} - No prizes awarded`,
      });
    } else if (actualWinners > 0 && actualWinners < expectedWinners) {
      // Log that prizes were redistributed (not unclaimed)
      console.log(`📊 Prize redistribution: ${actualWinners} winners received ${expectedWinners} prize positions worth of prizes`);
      console.log(`   Extra prize %s were redistributed as bonus to existing winners - no unclaimed funds`);
    }
    
    // Record platform fee in financials
    if (actualPlatformFee > 0) {
      await PlatformFinancialsService.recordPlatformFee({
        amount: actualPlatformFee,
        sourceType: 'competition',
        sourceId: competition._id.toString(),
        sourceName: competition.name,
        description: `Platform fee (${competition.platformFeePercentage}%) from ${competition.name}`,
      });
    }

    // STEP 5: Update competition status
    console.log(`🎯 Updating competition status...`);
    competition.status = 'completed';
    competition.winnerId = leaderboard[0]?.userId;
    competition.winnerPnL = leaderboard[0]?.pnl;
    competition.finalLeaderboard = leaderboard;
    await competition.save({ session });

    await session.commitTransaction();
    // End session immediately after commit to prevent "abortTransaction after commitTransaction" error
    session.endSession();

    console.log(`✅ Competition ${competition.name} finalized successfully!`);
    console.log(`   Winners: ${winnerTransactions.length}`);
    console.log(`   Total Distributed: ${totalDistributed} credits`);
    console.log(`   Platform Fee: ${actualPlatformFee.toFixed(2)} credits`);
    console.log(`   Platform Earned: ${(prizePool - totalDistributed).toFixed(2)} credits`);

    // Evaluate badges for ALL participants after competition ends (fire and forget - non-blocking)
    try {
      const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
      const uniqueUserIds = [...new Set(participants.map(p => p.userId.toString()))];
      
      console.log(`🏅 Evaluating badges for ${uniqueUserIds.length} participants...`);
      
      // Evaluate badges for each participant (don't wait for all to complete)
      uniqueUserIds.forEach(userId => {
        evaluateUserBadges(userId).then(result => {
          if (result.newBadges.length > 0) {
            console.log(`🏅 User ${userId} earned ${result.newBadges.length} new badges after competition ended`);
          }
        }).catch(err => console.error(`Error evaluating badges for user ${userId}:`, err));
      });
    } catch (error) {
      console.error('Error importing badge service:', error);
    }

    // Send notifications to all participants about competition end (fire and forget - non-blocking)
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      
      console.log(`🔔 Sending competition end notifications...`);
      
      // Notify winners (rank 1 gets special notification) - non-blocking
      for (const dist of prizeDistributions) {
        const winner = leaderboard.find((l) => l.userId === dist.userId);
        if (winner) {
          if (dist.rank === 1) {
            // Winner notification
            notificationService.notifyCompetitionWon(
              winner.userId,
              competition.name,
              dist.prizeAmount
            ).catch(e => console.error('Failed to send winner notification:', e));
          } else if (dist.rank <= 3) {
            // Podium notification
            notificationService.notifyPodiumFinish(
              winner.userId,
              competition.name,
              dist.rank,
              dist.prizeAmount
            ).catch(e => console.error('Failed to send podium notification:', e));
          }
          
          // Send prize received notification to all winners
          notificationService.notifyPrizeReceived(
            winner.userId,
            competition.name,
            dist.prizeAmount,
            dist.rank
          ).catch(e => console.error('Failed to send prize notification:', e));
        }
      }
      
      // Notify disqualified participants - non-blocking
      const disqualifiedParticipants = leaderboard.filter(p => p.qualificationStatus === 'disqualified');
      for (const participant of disqualifiedParticipants) {
        notificationService.notifyDisqualified(
          participant.userId,
          competition._id.toString(),
          competition.name,
          participant.disqualificationReason || 'Did not meet competition requirements'
        ).catch(e => console.error('Failed to send disqualification notification:', e));
      }
      if (disqualifiedParticipants.length > 0) {
        console.log(`🔔 Sent ${disqualifiedParticipants.length} disqualification notifications`);
      }

      // Notify all participants about competition end - non-blocking
      for (const participant of leaderboard) {
        const pnl = participant.pnl || 0;
        notificationService.notifyCompetitionEnded(
          participant.userId,
          competition._id.toString(),
          competition.name,
          participant.rank || 0,
          pnl
        ).catch(e => console.error('Failed to send competition end notification:', e));
      }
      
      console.log(`🔔 Queued ${leaderboard.length} competition end notifications`);
    } catch (error) {
      console.error('Error sending competition end notifications:', error);
    }

    const finalPlatformFee2 = prizePool - totalDistributed;
    return {
      success: true,
      message: `Competition finalized`,
      data: {
        competitionId: competition._id.toString(),
        competitionName: competition.name,
        totalParticipants: participants.length,
        winnersCount: winnerTransactions.length,
        prizePool,
        platformFee: finalPlatformFee2,
        totalDistributed,
        leaderboard: leaderboard.slice(0, 10), // Top 10
      },
    };
  } catch (error) {
    // Only abort if session is still in transaction
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('❌ Error finalizing competition:', error);
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
    console.log(`🔍 Checking for competitions to finalize at ${now.toISOString()}`);

    // Find all active competitions that have ended
    const competitionsToEnd = await Competition.find({
      status: 'active',
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
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      message: `Checked and finalized ${competitionsToEnd.length} competition(s)`,
      results,
    };
  } catch (error) {
    console.error('❌ Error in checkAndFinalizeCompetitions:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

