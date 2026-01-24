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

    console.log(`Found ${allPositions.length} total positions (open and closed)`);

    // First, process already-closed positions
    // NOTE: TradingPosition doesn't have 'profitLoss' field - calculate from entry/exit prices
    for (const position of allPositions) {
      if (position.status === 'closed' || position.status === 'liquidated') {
        const userId = position.userId.toString();
        const stats = participantStats.get(userId);
        if (stats) {
          // Calculate P&L from entry/exit prices
          // Use exitPrice if available (set when position was closed), otherwise use currentPrice
          // FOREX: contractSize = 100,000 units per standard lot
          const exitPrice = position.exitPrice ?? position.currentPrice ?? position.entryPrice;
          const priceDiff = position.side === 'long'
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
          const positionPnL = priceDiff * position.quantity * 100000; // Fixed: was 10000
          
          // Debug logging for position PNL calculation
          console.log(`    📈 Position ${position._id}: entry=${position.entryPrice}, exit=${exitPrice}, side=${position.side}, qty=${position.quantity}, PNL=$${positionPnL.toFixed(2)}`);
          
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
    console.log(`Fetching prices for ${uniqueSymbols.length} unique symbols: ${uniqueSymbols.join(', ')}`);
    const pricesMap = await fetchRealForexPrices(uniqueSymbols);
    console.log(`Got ${pricesMap.size} prices in single batch`);
    
    // Log which prices we have
    if (pricesMap.size > 0) {
      for (const [symbol, price] of pricesMap.entries()) {
        console.log(`  ✅ ${symbol}: bid=${price.bid}, ask=${price.ask}`);
      }
    } else {
      console.error(`  ❌ WARNING: No prices available! This will prevent position closing.`);
    }

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
      competitionId: competition._id.toString(),
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

    // Use competition rules merged with defaults (ensure all required fields exist)
    const defaultRules = {
      rankingMethod: 'pnl' as const,
      tieBreaker1: 'win_rate' as const,
      tieBreaker2: 'join_time' as const, // Secondary tiebreaker to ensure ranking
      minimumTrades: 0,
      tiePrizeDistribution: 'split_equally' as const,
      disqualifyOnLiquidation: true,
    };
    const rules = {
      ...defaultRules,
      ...(competition.rules || {}),
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
    
    // STEP 4.6: Calculate Game Master referral fees FIRST (before recording platform fee)
    // GM fees come FROM the platform fee, so we need to calculate them first
    console.log(`🎮 Calculating Game Master referral fees...`);
    
    let totalGmEarnings = 0; // Track total GM earnings to subtract from platform fee
    const gmPayments: Array<{
      gmId: string;
      gmSubscription: any;
      users: { userId: string; userName: string; userEmail: string }[];
      feePercentage: number;
      totalEarning: number;
    }> = [];
    
    try {
      const db = mongoose.connection.db;
      if (db) {
        // Get all participants who have referredByGameMasterId
        const referredParticipants = await db.collection('user').find({
          id: { $in: participants.map(p => p.userId) },
          referredByGameMasterId: { $exists: true, $ne: null },
        }).toArray();
        
        console.log(`   Found ${referredParticipants.length} referred participants`);
        
        // Group by game master
        const gmEarningsMap = new Map<string, { 
          gmId: string; 
          users: { userId: string; userName: string; userEmail: string }[];
          totalEntryFees: number;
        }>();
        
        for (const user of referredParticipants) {
          const gmId = user.referredByGameMasterId;
          const participant = participants.find(p => p.userId === user.id);
          if (!participant || !gmId) continue;
          
          if (!gmEarningsMap.has(gmId)) {
            gmEarningsMap.set(gmId, { 
              gmId, 
              users: [], 
              totalEntryFees: 0 
            });
          }
          
          const gmData = gmEarningsMap.get(gmId)!;
          gmData.users.push({ 
            userId: user.id, 
            userName: user.name || 'Unknown', 
            userEmail: user.email 
          });
          gmData.totalEntryFees += competition.entryFee;
        }
        
        // Calculate earnings for each game master (but don't pay yet)
        for (const [gmId, gmData] of gmEarningsMap) {
          const gmSubscription = await db.collection('gamemastersubscriptions').findOne({
            userId: gmId,
            status: 'active',
          });
          
          if (!gmSubscription) {
            console.log(`   ⚠️ Game master ${gmId} has no active subscription, skipping`);
            continue;
          }
          
          const feePercentage = gmSubscription.limits?.referralFeePercentage || 5;
          const totalEarning = gmData.users.length * competition.entryFee * (feePercentage / 100);
          
          totalGmEarnings += totalEarning;
          gmPayments.push({
            gmId,
            gmSubscription,
            users: gmData.users,
            feePercentage,
            totalEarning,
          });
          
          console.log(`   📊 GM ${gmId}: ${gmData.users.length} referrals × €${competition.entryFee} × ${feePercentage}% = €${totalEarning.toFixed(2)}`);
        }
      }
    } catch (gmCalcError) {
      console.error('   ⚠️ Error calculating Game Master fees:', gmCalcError);
      // Continue without GM fees if calculation fails
    }
    
    // SAFEGUARD: Cap total GM earnings at the gross platform fee
    // This prevents platform from losing money if GM referral % > platform fee %
    let actualGmEarnings = totalGmEarnings;
    if (totalGmEarnings > actualPlatformFee) {
      console.warn(`   ⚠️ WARNING: Total GM earnings (${totalGmEarnings.toFixed(2)}) exceed platform fee (${actualPlatformFee.toFixed(2)})`);
      console.warn(`   ⚠️ Capping GM earnings at platform fee to prevent platform loss`);
      
      // Scale down all GM payments proportionally
      const scaleFactor = actualPlatformFee / totalGmEarnings;
      for (const payment of gmPayments) {
        payment.totalEarning = payment.totalEarning * scaleFactor;
      }
      actualGmEarnings = actualPlatformFee; // Cap at platform fee
    }
    
    // Calculate NET platform fee (platform fee minus GM referral fees)
    const netPlatformFee = Math.max(0, actualPlatformFee - actualGmEarnings);
    
    console.log(`💼 Platform fee breakdown:`);
    console.log(`   Gross platform fee: €${actualPlatformFee.toFixed(2)} (${competition.platformFeePercentage}%)`);
    console.log(`   GM referral fees:   €${actualGmEarnings.toFixed(2)} (from ${gmPayments.reduce((sum, p) => sum + p.users.length, 0)} referrals)`);
    if (totalGmEarnings !== actualGmEarnings) {
      console.log(`   (Capped from €${totalGmEarnings.toFixed(2)} to prevent platform loss)`);
    }
    console.log(`   NET platform fee:   €${netPlatformFee.toFixed(2)}`);
    
    // Record NET platform fee in financials (after subtracting GM fees)
    if (netPlatformFee > 0) {
      await PlatformFinancialsService.recordPlatformFee({
        amount: netPlatformFee,
        sourceType: 'competition',
        sourceId: competition._id.toString(),
        sourceName: competition.name,
        description: `Platform fee (${competition.platformFeePercentage}% - ${totalGmEarnings.toFixed(2)} GM fees) from ${competition.name}`,
      });
    }

    // STEP 4.7: Distribute Game Master referral fees (now that we've calculated and recorded platform fee)
    console.log(`🎮 Distributing Game Master referral fees...`);
    try {
      const db = mongoose.connection.db;
      if (db && gmPayments.length > 0) {
        for (const payment of gmPayments) {
          const { gmId, gmSubscription, users, feePercentage, totalEarning } = payment;
          
          // Calculate per-user earning from the (potentially scaled) totalEarning
          const perUserEarning = totalEarning / users.length;
          
          // Create earning records for each referred user
          for (const user of users) {
            const entryFee = competition.entryFee;
            // Use the calculated per-user earning (which may have been scaled if capped)
            const grossEarning = perUserEarning;
            const platformFee = 0; // GM gets full referral %, platform fee already deducted above
            const netEarning = grossEarning - platformFee;
            // Calculate effective percentage (may be lower than package rate if capped)
            const effectivePercentage = (perUserEarning / entryFee) * 100;
            
            // Create GameMasterEarning record
            await db.collection('gamemasterearnings').insertOne({
              gameMasterId: gmId,
              gameMasterEmail: gmSubscription.userEmail,
              sourceType: 'competition',
              sourceId: competition._id.toString(),
              sourceName: competition.name,
              referredUserId: user.userId,
              referredUserEmail: user.userEmail,
              referredUserName: user.userName,
              entryFeeAmount: entryFee,
              earningPercentage: effectivePercentage, // May be scaled down if capped
              originalPercentage: feePercentage, // Original package rate
              grossEarning,
              platformFee,
              netEarning,
              status: 'pending',
              eventStartTime: competition.startTime,
              eventEndTime: competition.endTime,
              participantCount: participants.length,
              wasCapped: effectivePercentage < feePercentage, // Flag if earnings were reduced
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            
            console.log(`   💰 GM ${gmId} earned ${netEarning.toFixed(2)} from ${user.userName}${effectivePercentage < feePercentage ? ' (capped)' : ''}`);
          }
          
          // Update game master subscription stats (totalEarning already calculated in payment object)
          await db.collection('gamemastersubscriptions').updateOne(
            { _id: gmSubscription._id },
            { 
              $inc: { 
                totalEarnings: totalEarning,
                pendingEarnings: totalEarning,
              },
              $set: { updatedAt: new Date() }
            }
          );
          
          // Credit to game master's wallet
          let gmWallet = await CreditWallet.findOne({ userId: gmId }).session(session);
          if (!gmWallet) {
            gmWallet = await CreditWallet.create(
              [{
                userId: gmId,
                creditBalance: 0,
                totalDeposited: 0,
                totalWithdrawn: 0,
                totalSpentOnCompetitions: 0,
                totalWonFromCompetitions: 0,
                isActive: true,
                kycVerified: false,
                withdrawalEnabled: false,
              }],
              { session }
            );
            gmWallet = gmWallet[0];
          }
          
          const balanceBefore = gmWallet.creditBalance || 0;
          const balanceAfter = balanceBefore + totalEarning;
          
          await CreditWallet.findOneAndUpdate(
            { userId: gmId },
            { $inc: { creditBalance: totalEarning } },
            { session }
          );
          
          // Create wallet transaction
          await WalletTransaction.create(
            [{
              userId: gmId,
              transactionType: 'gamemaster_earning',
              amount: totalEarning,
              balanceBefore,
              balanceAfter,
              competitionId: competition._id,
              status: 'completed',
              description: `🎮 Game Master referral earnings from ${competition.name} (${users.length} referred users)`,
              metadata: {
                competitionId: competition._id.toString(),
                competitionName: competition.name,
                referredUsersCount: users.length,
                feePercentage,
              },
            }],
            { session }
          );
          
          // Update earnings status to paid
          await db.collection('gamemasterearnings').updateMany(
            {
              gameMasterId: gmId,
              sourceId: competition._id.toString(),
              sourceType: 'competition',
            },
            {
              $set: {
                status: 'paid',
                paidAt: new Date(),
              },
            }
          );
          
          // Update subscription pending earnings
          await db.collection('gamemastersubscriptions').updateOne(
            { _id: gmSubscription._id },
            { 
              $inc: { pendingEarnings: -totalEarning }
            }
          );
          
          console.log(`   ✅ GM ${gmId}: Total earned ${totalEarning.toFixed(2)} from ${users.length} referrals`);
        }
      }
    } catch (gmError) {
      console.error('   ⚠️ Error processing Game Master fees (non-blocking):', gmError);
      // Don't fail the competition finalization for GM fee errors
    }

    // STEP 5: Update competition and participant statuses
    console.log(`🎯 Updating competition status...`);
    competition.status = 'completed';
    competition.winnerId = leaderboard[0]?.userId;
    competition.winnerPnL = leaderboard[0]?.pnl;
    competition.finalLeaderboard = leaderboard;
    await competition.save({ session });

    // CRITICAL: Update ALL participant statuses to 'completed' so they don't block withdrawals!
    // Only update participants that are still 'active' (not liquidated/disqualified)
    const participantUpdateResult = await CompetitionParticipant.updateMany(
      {
        competitionId: competition._id,
        status: 'active', // Only update active participants
      },
      {
        $set: { status: 'completed' },
      },
      { session }
    );
    console.log(`   ✅ Updated ${participantUpdateResult.modifiedCount} participant statuses to 'completed'`);

    await session.commitTransaction();
    // End session immediately after commit to prevent "abortTransaction after commitTransaction" error
    session.endSession();

    console.log(`✅ Competition ${competition.name} finalized successfully!`);
    console.log(`   Winners: ${winnerTransactions.length}`);
    console.log(`   Total Distributed: ${totalDistributed} credits`);
    console.log(`   Gross Platform Fee: ${actualPlatformFee.toFixed(2)} credits (${competition.platformFeePercentage}%)`);
    console.log(`   GM Referral Fees: ${actualGmEarnings.toFixed(2)} credits (paid to Game Masters)`);
    console.log(`   Net Platform Fee: ${netPlatformFee.toFixed(2)} credits (platform keeps)`);
    console.log(`   Platform Net Earned: ${(prizePool - totalDistributed - actualGmEarnings).toFixed(2)} credits`);

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
      // Import the module and get the default export (the notificationService instance)
      const notificationModule = await import('@/lib/services/notification.service');
      const notificationService = notificationModule.notificationService || notificationModule.default;
      
      if (!notificationService || typeof notificationService.notifyCompetitionWon !== 'function') {
        console.error('❌ notificationService not properly loaded, skipping notifications');
        throw new Error('notificationService methods not available');
      }
      
      console.log(`🔔 Sending competition end notifications...`);
      
      // Notify winners (rank 1 gets special notification) - non-blocking
      for (const dist of prizeDistributions) {
        const winner = leaderboard.find((l) => l.userId === dist.userId);
        if (winner) {
          if (dist.rank === 1) {
            // Winner notification - signature: (userId, competitionName, prize, position)
            notificationService.notifyCompetitionWon(
              winner.userId,
              competition.name,
              dist.prizeAmount,
              dist.rank
            ).catch((e: Error) => console.error('Failed to send winner notification:', e));
          } else if (dist.rank <= 3) {
            // Podium notification - signature: (userId, competitionName, prize, position)
            notificationService.notifyPodiumFinish(
              winner.userId,
              competition.name,
              dist.prizeAmount,
              dist.rank
            ).catch((e: Error) => console.error('Failed to send podium notification:', e));
          }
          
          // Send prize received notification to all winners - signature: (userId, competitionName, prize)
          notificationService.notifyPrizeReceived(
            winner.userId,
            competition.name,
            dist.prizeAmount
          ).catch((e: Error) => console.error('Failed to send prize notification:', e));
        }
      }
      
      // Notify disqualified participants - non-blocking
      const disqualifiedParticipants = leaderboard.filter(p => p.qualificationStatus === 'disqualified');
      const sendNotification = notificationModule.sendNotification;
      if (typeof sendNotification === 'function') {
        for (const participant of disqualifiedParticipants) {
          sendNotification({
            userId: participant.userId,
            type: 'competition_disqualified',
            metadata: {
              competitionId: competition._id.toString(),
              competitionName: competition.name,
              reason: participant.disqualificationReason || 'Did not meet competition requirements',
            },
          }).catch((e: Error) => console.error('Failed to send disqualification notification:', e));
        }
        if (disqualifiedParticipants.length > 0) {
          console.log(`🔔 Sent ${disqualifiedParticipants.length} disqualification notifications`);
        }
      }

      // Notify all participants about competition end - non-blocking
      // Signature: (userId, competitionName, finalPosition)
      for (const participant of leaderboard) {
        notificationService.notifyCompetitionEnded(
          participant.userId,
          competition.name,
          participant.rank || 0
        ).catch((e: Error) => console.error('Failed to send competition end notification:', e));
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

