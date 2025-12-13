/**
 * Recovery Script: Recalculate Participant Stats from Trade History
 * 
 * This script fixes participant statistics for competitions where the totalTrades
 * counter bug caused stats to remain at 0. It reconstructs accurate stats from
 * the TradeHistory records that were successfully saved.
 * 
 * Usage: ts-node scripts/fix-participant-stats.ts [competitionId]
 */

import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import TradeHistory from '@/database/models/trading/trade-history.model';
import mongoose from 'mongoose';

async function recalculateParticipantStats(competitionId?: string) {
  try {
    await connectToDatabase();
    console.log('🔗 Connected to database');

    // Find participants to fix
    const query = competitionId ? { competitionId } : { totalTrades: 0 };
    const participants = await CompetitionParticipant.find(query);

    console.log(`\n📊 Found ${participants.length} participants to fix`);

    if (participants.length === 0) {
      console.log('✅ No participants need fixing!');
      return;
    }

    let fixed = 0;
    let skipped = 0;

    for (const participant of participants) {
      const participantId = participant._id.toString();

      // Get all trade history for this participant
      const trades = await TradeHistory.find({ participantId }).lean();

      if (trades.length === 0) {
        console.log(`  ⚠️  ${participant.username}: No trade history found (skipping)`);
        skipped++;
        continue;
      }

      // Recalculate stats from trade history
      let totalPnL = 0;
      let winningTrades = 0;
      let losingTrades = 0;
      let totalWinAmount = 0;
      let totalLossAmount = 0;
      let largestWin = 0;
      let largestLoss = 0;

      for (const trade of trades) {
        const pnl = trade.realizedPnl || 0;
        totalPnL += pnl;

        if (pnl > 0) {
          winningTrades++;
          totalWinAmount += pnl;
          largestWin = Math.max(largestWin, pnl);
        } else if (pnl < 0) {
          losingTrades++;
          totalLossAmount += Math.abs(pnl);
          largestLoss = Math.min(largestLoss, pnl);
        }
      }

      const totalTrades = trades.length;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const averageWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
      const averageLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0;

      const currentCapital = participant.startingCapital + totalPnL;
      const pnlPercentage = (totalPnL / participant.startingCapital) * 100;

      // Update participant
      await CompetitionParticipant.findByIdAndUpdate(participant._id, {
        $set: {
          totalTrades,
          winningTrades,
          losingTrades,
          winRate,
          pnl: totalPnL,
          pnlPercentage,
          realizedPnl: totalPnL,
          currentCapital,
          averageWin,
          averageLoss,
          largestWin,
          largestLoss,
        },
      });

      console.log(`  ✅ ${participant.username}:`);
      console.log(`     Trades: ${totalTrades} (${winningTrades}W/${losingTrades}L)`);
      console.log(`     P&L: $${totalPnL.toFixed(2)} (${pnlPercentage.toFixed(2)}%)`);
      console.log(`     Win Rate: ${winRate.toFixed(1)}%`);
      console.log(`     Capital: $${participant.startingCapital} → $${currentCapital.toFixed(2)}`);

      fixed++;
    }

    console.log(`\n✅ Recovery complete!`);
    console.log(`   Fixed: ${fixed} participants`);
    console.log(`   Skipped: ${skipped} participants (no trades)`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
const competitionId = process.argv[2]; // Optional: specific competition ID

if (competitionId) {
  console.log(`🎯 Fixing specific competition: ${competitionId}\n`);
} else {
  console.log(`🌍 Fixing ALL participants with totalTrades = 0\n`);
}

recalculateParticipantStats(competitionId)
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

