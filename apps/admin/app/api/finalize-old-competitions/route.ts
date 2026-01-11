import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import TradingPosition from '@/database/models/trading/trading-position.model';
import TradeHistory from '@/database/models/trading/trade-history.model';
import { getRealPrice } from '@/lib/services/real-forex-prices.service';
import mongoose from 'mongoose';

/**
 * Admin API: FORCE finalize old completed competitions
 * This will close any open positions and create trade history
 * even if competition status is already "completed"
 * POST /api/admin/finalize-old-competitions
 */
export async function POST(_request: Request) {
  try {
    await connectToDatabase();

    // Find all completed competitions
    const completedCompetitions = await Competition.find({
      status: 'completed',
      endTime: { $lt: new Date() }, // Already ended
    }).select('_id name endTime');

    if (completedCompetitions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No completed competitions need finalization',
        finalized: 0,
      });
    }

    console.log(`🔄 Found ${completedCompetitions.length} completed competitions to force-finalize`);

    const results = [];
    let finalized = 0;
    let skipped = 0;
    let errors = 0;

    for (const comp of completedCompetitions) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        console.log(`\n🏁 Force-finalizing: ${comp.name} (${comp._id})`);

        // Check if there are any open positions
        const openPositions = await TradingPosition.find({
          competitionId: comp._id,
          status: 'open',
        }).session(session);

        if (openPositions.length === 0) {
          console.log(`  ⏭️  No open positions found, skipping`);
          await session.abortTransaction();
          skipped++;
          results.push({
            competitionId: comp._id,
            name: comp.name,
            status: 'skipped',
            reason: 'No open positions',
          });
          continue;
        }

        console.log(`  📊 Closing ${openPositions.length} open positions...`);

        let positionsClosed = 0;
        let tradeHistoryCreated = 0;

        for (const position of openPositions) {
          try {
            // Get current market price
            const priceData = await getRealPrice(position.symbol);
            if (!priceData) {
              console.error(`    ❌ Could not get price for ${position.symbol}, skipping`);
              continue;
            }
            const exitPrice = position.side === 'long' ? priceData.bid : priceData.ask;

            console.log(`    Closing ${position.symbol} ${position.side} at ${exitPrice}`);

            // Calculate P&L
            const priceDiff = position.side === 'long'
              ? exitPrice - position.entryPrice
              : position.entryPrice - exitPrice;
            const positionPnL = priceDiff * position.quantity * 10000; // Forex pip value
            const isWinner = positionPnL > 0;

            console.log(`      Entry: ${position.entryPrice}, Exit: ${exitPrice}, P&L: $${positionPnL.toFixed(2)}`);

            // Create a dummy close order for admin force-close
            const TradingOrder = (await import('@/database/models/trading/trading-order.model')).default;
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
                  orderSource: 'system_admin',
                },
              ],
              { session }
            );

            // Update position to closed
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
            positionsClosed++;

            // Create TradeHistory record (this was missing!)
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
                  holdingTimeSeconds: Math.floor((Date.now() - position.openedAt.getTime()) / 1000),
                  closeReason: 'competition_end',
                  leverage: position.leverage,
                  marginUsed: position.marginUsed,
                  hadStopLoss: !!position.stopLoss,
                  hadTakeProfit: !!position.takeProfit,
                  openOrderId: position.openOrderId,
                  closeOrderId: closeOrder[0]._id.toString(),
                  positionId: position._id.toString(),
                  isWinner: isWinner,
                },
              ],
              { session }
            );
            tradeHistoryCreated++;

            // Update participant stats
            const participant = await CompetitionParticipant.findOne({
              competitionId: position.competitionId,
              userId: position.userId,
            }).session(session);

            if (participant) {
              const newPnL = participant.pnl + positionPnL;
              const newCapital = participant.currentCapital + positionPnL;
              const newTotalTrades = participant.totalTrades + 1;
              const newWinningTrades = participant.winningTrades + (isWinner ? 1 : 0);
              const _newLosingTrades = participant.losingTrades + (isWinner ? 0 : 1);
              const winRate = newTotalTrades > 0 ? (newWinningTrades / newTotalTrades) * 100 : 0;

              await CompetitionParticipant.findByIdAndUpdate(
                participant._id,
                {
                  $inc: {
                    totalTrades: 1,
                    winningTrades: isWinner ? 1 : 0,
                    losingTrades: isWinner ? 0 : 1,
                    currentOpenPositions: -1,
                  },
                  $set: {
                    currentCapital: newCapital,
                    availableCapital: newCapital - (participant.usedMargin - position.marginUsed),
                    usedMargin: participant.usedMargin - position.marginUsed,
                    pnl: newPnL,
                    pnlPercentage: (newPnL / participant.startingCapital) * 100,
                    winRate: winRate,
                  },
                },
                { session }
              );
            }

            console.log(`      ✅ Position closed & TradeHistory created: P&L = $${positionPnL.toFixed(2)}`);
          } catch (posError) {
            console.error(`    ❌ Error closing position ${position._id}:`, posError);
            // Continue with other positions
          }
        }

        await session.commitTransaction();
        console.log(`  ✅ Successfully closed ${positionsClosed} positions, created ${tradeHistoryCreated} trade records`);
        
        finalized++;
        results.push({
          competitionId: comp._id,
          name: comp.name,
          status: 'finalized',
          positionsClosed,
          tradeHistoryCreated,
        });
      } catch (error) {
        await session.abortTransaction();
        console.error(`  ❌ Error force-finalizing ${comp.name}:`, error);
        errors++;
        results.push({
          competitionId: comp._id,
          name: comp.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        session.endSession();
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${completedCompetitions.length} competitions`,
      finalized,
      skipped,
      errors,
      results,
    });
  } catch (error) {
    console.error('Error force-finalizing old competitions:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to finalize competitions',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

