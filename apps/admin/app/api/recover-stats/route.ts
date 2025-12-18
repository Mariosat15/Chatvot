import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import TradeHistory from '@/database/models/trading/trade-history.model';

/**
 * Admin API: Recover participant stats from trade history
 * POST /api/admin/recover-stats
 * Body: { competitionId?: string } (optional - if not provided, fixes all)
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { competitionId } = body;

    // Find participants to fix (either specific competition or all with totalTrades=0)
    const query = competitionId ? { competitionId } : { totalTrades: 0 };
    const participants = await CompetitionParticipant.find(query);

    console.log(`📊 Found ${participants.length} participants to fix`);

    if (participants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No participants need fixing',
        fixed: 0,
        skipped: 0,
      });
    }

    let fixed = 0;
    let skipped = 0;
    const results = [];

    for (const participant of participants) {
      const participantId = participant._id.toString();
      
      console.log(`\n👤 Processing: ${participant.username}`);
      console.log(`   Competition: ${participant.competitionId}`);
      console.log(`   Participant ID: ${participantId}`);
      console.log(`   User ID: ${participant.userId}`);

      // Try to find trade history by participantId OR by userId+competitionId
      let trades = await TradeHistory.find({ participantId }).lean();
      
      if (trades.length > 0) {
        console.log(`   ✅ Found ${trades.length} trades by participantId`);
      }
      
      // Fallback: If no trades found by participantId, try by userId + competitionId
      if (trades.length === 0) {
        trades = await TradeHistory.find({
          userId: participant.userId,
          competitionId: participant.competitionId,
        }).lean();
        
        if (trades.length > 0) {
          console.log(`  ℹ️  ${participant.username}: Found ${trades.length} trades by userId+competitionId (participantId mismatch)`);
        }
      }

      if (trades.length === 0) {
        // Last resort: Check if there are ANY positions (open or closed)
        const TradingPosition = (await import('@/database/models/trading/trading-position.model')).default;
        
        // First, check ALL positions for this user in this competition
        const allPositions = await TradingPosition.find({
          userId: participant.userId,
          competitionId: participant.competitionId,
        }).lean();

        console.log(`  🔍 ${participant.username}: Found ${allPositions.length} total positions (statuses: ${allPositions.map((p: any) => p.status).join(', ')})`);

        if (allPositions.length > 0) {
          // Check if any have profitLoss data
          const positionsWithPnL = allPositions.filter((p: any) => p.profitLoss !== undefined && p.profitLoss !== null);
          
          if (positionsWithPnL.length > 0) {
            console.log(`  ℹ️  ${participant.username}: Found ${positionsWithPnL.length} positions with P&L data (reconstructing from positions)`);
            // Convert positions to trade-like objects
            trades = positionsWithPnL.map((pos: any) => ({
              realizedPnl: pos.profitLoss || 0,
            })) as unknown as typeof trades;
          } else {
            console.log(`  ⚠️  ${participant.username}: ${allPositions.length} positions found but NONE have profitLoss data (likely never closed)`);
            skipped++;
            continue;
          }
        } else {
          console.log(`  ⚠️  ${participant.username}: No positions found at all (never traded)`);
          skipped++;
          continue;
        }
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

      const result = {
        username: participant.username,
        totalTrades,
        winningTrades,
        losingTrades,
        pnl: totalPnL,
        pnlPercentage,
        winRate,
      };

      console.log(`  ✅ ${participant.username}: ${totalTrades} trades, P&L: $${totalPnL.toFixed(2)}`);
      results.push(result);
      fixed++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recovered stats for ${fixed} participants`,
      fixed,
      skipped,
      results,
    });
  } catch (error) {
    console.error('Error recovering stats:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to recover stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

