/**
 * Early End Check Job
 * 
 * Checks for competitions/challenges that should end early because:
 * - All participants are eliminated (liquidated) or disqualified
 * - In challenges: one player is out while the other wins by default
 * 
 * This runs every minute alongside other jobs.
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '../config/database';

export interface EarlyEndCheckResult {
  competitionsEnded: number;
  challengesEnded: number;
  errors: string[];
}

export async function runEarlyEndCheck(): Promise<EarlyEndCheckResult> {
  const result: EarlyEndCheckResult = {
    competitionsEnded: 0,
    challengesEnded: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }

    const competitionsCollection = db.collection('competitions');
    const participantsCollection = db.collection('competitionparticipants');
    const challengesCollection = db.collection('challenges');
    const challengeParticipantsCollection = db.collection('challengeparticipants');

    const now = new Date();

    // ============================================
    // 1. CHECK COMPETITIONS FOR EARLY END
    // ============================================
    const activeCompetitions = await competitionsCollection.find({
      status: 'active',
      endTime: { $gt: now }, // Still has time remaining
    }).toArray();

    for (const competition of activeCompetitions) {
      try {
        // Get all participants for this competition
        const participants = await participantsCollection.find({
          competitionId: competition._id,
        }).toArray();

        if (participants.length === 0) continue;

        // Count by status
        const activeCount = participants.filter(p => p.status === 'active').length;
        const liquidatedCount = participants.filter(p => p.status === 'liquidated').length;
        const disqualifiedCount = participants.filter(p => p.status === 'disqualified').length;

        // If there are still active players, continue normally
        if (activeCount > 0) continue;

        // All players are out - need to end early
        console.log(`\n   🏁 [EARLY END] Competition "${competition.name}" - All players eliminated!`);
        console.log(`      Active: ${activeCount}, Liquidated: ${liquidatedCount}, Disqualified: ${disqualifiedCount}`);

        if (disqualifiedCount === participants.length) {
          // ALL players disqualified - prize pool goes to platform (unclaimed pools)
          console.log(`      ❌ All players disqualified - prize goes to unclaimed pools`);
          
          // Record unclaimed pool for platform
          const prizePool = competition.prizePool || 0;
          if (prizePool > 0) {
            const platformTransactionsCollection = db.collection('platformtransactions');
            await platformTransactionsCollection.insertOne({
              transactionType: 'unclaimed_pool',
              amount: prizePool,
              amountEUR: prizePool, // Simplified - in production use conversion rate
              sourceType: 'competition',
              sourceId: competition._id.toString(),
              sourceName: competition.name,
              unclaimedReason: 'all_disqualified',
              originalPoolAmount: prizePool,
              winnersCount: 0,
              expectedWinnersCount: competition.prizeDistribution?.length || 3,
              description: `All participants disqualified in ${competition.name} - pool goes to platform`,
              createdAt: now,
              updatedAt: now,
            });
            console.log(`      💰 Recorded ${prizePool} credits to unclaimed pools`);
          }
          
          await competitionsCollection.updateOne(
            { _id: competition._id },
            {
              $set: {
                status: 'completed',
                completedAt: now,
                earlyEndReason: 'All participants disqualified - prize to platform',
                noWinners: true,
              }
            }
          );
          result.competitionsEnded++;
        } else {
          // Some or all players liquidated - finalize normally to rank by equity
          console.log(`      🏆 Finalizing competition to rank liquidated players by equity`);
          
          // Import and call finalize function
          const { finalizeCompetition } = await import('../../lib/actions/trading/competition-end.actions');
          const finalizeResult = await finalizeCompetition(competition._id.toString());
          
          if (finalizeResult?.success) {
            // Update with early end reason
            await competitionsCollection.updateOne(
              { _id: competition._id },
              {
                $set: {
                  earlyEndReason: 'All participants eliminated before end time',
                }
              }
            );
            result.competitionsEnded++;
          } else {
            result.errors.push(`Competition ${competition._id}: ${finalizeResult?.message || 'Failed to finalize'}`);
          }
        }
      } catch (error) {
        result.errors.push(`Competition ${competition._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // ============================================
    // 2. CHECK CHALLENGES FOR EARLY END
    // ============================================
    const activeChallenges = await challengesCollection.find({
      status: 'active',
      endTime: { $gt: now }, // Still has time remaining
    }).toArray();

    for (const challenge of activeChallenges) {
      try {
        // Get both participants
        const participants = await challengeParticipantsCollection.find({
          challengeId: challenge._id,
        }).toArray();

        if (participants.length !== 2) continue;

        const challenger = participants.find(p => p.role === 'challenger');
        const opponent = participants.find(p => p.role === 'opponent');

        if (!challenger || !opponent) continue;

        // Check if both are still active
        const challengerActive = challenger.status === 'active';
        const opponentActive = opponent.status === 'active';
        const challengerLiquidated = challenger.status === 'liquidated';
        const opponentLiquidated = opponent.status === 'liquidated';
        const challengerDisqualified = challenger.status === 'disqualified';
        const opponentDisqualified = opponent.status === 'disqualified';

        // If both still active, continue normally
        if (challengerActive && opponentActive) continue;

        console.log(`\n   ⚔️ [EARLY END] Challenge ${challenge._id}`);
        console.log(`      Challenger: ${challenger.status}, Opponent: ${opponent.status}`);

        let winnerId: string | null = null;
        let winnerRole: 'challenger' | 'opponent' | null = null;
        let endReason = '';
        let noWinner = false;

        // Determine winner based on scenarios
        if (challengerDisqualified && opponentDisqualified) {
          // Both disqualified - prize pool goes to platform (unclaimed pools)
          endReason = 'Both players disqualified - prize to platform';
          noWinner = true;
          console.log(`      ❌ Both disqualified - prize goes to unclaimed pools`);
        } else if (challengerDisqualified && opponentActive) {
          // Challenger disqualified, opponent wins
          winnerId = opponent.userId.toString();
          winnerRole = 'opponent';
          endReason = 'Challenger disqualified';
          console.log(`      🏆 Opponent wins (challenger disqualified)`);
        } else if (opponentDisqualified && challengerActive) {
          // Opponent disqualified, challenger wins
          winnerId = challenger.userId.toString();
          winnerRole = 'challenger';
          endReason = 'Opponent disqualified';
          console.log(`      🏆 Challenger wins (opponent disqualified)`);
        } else if (challengerLiquidated && opponentActive) {
          // Challenger liquidated, opponent wins
          winnerId = opponent.userId.toString();
          winnerRole = 'opponent';
          endReason = 'Challenger liquidated';
          console.log(`      🏆 Opponent wins (challenger liquidated)`);
        } else if (opponentLiquidated && challengerActive) {
          // Opponent liquidated, challenger wins
          winnerId = challenger.userId.toString();
          winnerRole = 'challenger';
          endReason = 'Opponent liquidated';
          console.log(`      🏆 Challenger wins (opponent liquidated)`);
        } else if (challengerLiquidated && opponentLiquidated) {
          // Both liquidated - compare final equity
          const challengerEquity = challenger.currentCapital + (challenger.unrealizedPnl || 0);
          const opponentEquity = opponent.currentCapital + (opponent.unrealizedPnl || 0);
          
          if (challengerEquity > opponentEquity) {
            winnerId = challenger.userId.toString();
            winnerRole = 'challenger';
            endReason = `Both liquidated - challenger had higher equity ($${challengerEquity.toFixed(2)} vs $${opponentEquity.toFixed(2)})`;
          } else if (opponentEquity > challengerEquity) {
            winnerId = opponent.userId.toString();
            winnerRole = 'opponent';
            endReason = `Both liquidated - opponent had higher equity ($${opponentEquity.toFixed(2)} vs $${challengerEquity.toFixed(2)})`;
          } else {
            // Tie - no winner (very rare)
            endReason = 'Both liquidated with equal equity';
            noWinner = true;
          }
          console.log(`      ${noWinner ? '❌' : '🏆'} Both liquidated - ${endReason}`);
        } else if (challengerLiquidated && opponentDisqualified) {
          // Challenger liquidated but played fair, opponent disqualified
          winnerId = challenger.userId.toString();
          winnerRole = 'challenger';
          endReason = 'Opponent disqualified (challenger liquidated but played fair)';
          console.log(`      🏆 Challenger wins (liquidated > disqualified)`);
        } else if (opponentLiquidated && challengerDisqualified) {
          // Opponent liquidated but played fair, challenger disqualified
          winnerId = opponent.userId.toString();
          winnerRole = 'opponent';
          endReason = 'Challenger disqualified (opponent liquidated but played fair)';
          console.log(`      🏆 Opponent wins (liquidated > disqualified)`);
        } else {
          // Unknown state, skip
          continue;
        }

        // End the challenge early
        if (noWinner) {
          // Both disqualified - prize pool goes to platform (NO refund)
          const prizePool = (challenge.entryFee || 0) * 2;
          
          if (prizePool > 0) {
            const platformTransactionsCollection = db.collection('platformtransactions');
            await platformTransactionsCollection.insertOne({
              transactionType: 'unclaimed_pool',
              amount: prizePool,
              amountEUR: prizePool, // Simplified - in production use conversion rate
              sourceType: 'challenge',
              sourceId: challenge._id.toString(),
              sourceName: `${challenge.challengerName || 'Challenger'} vs ${challenge.challengedName || 'Opponent'}`,
              unclaimedReason: 'all_disqualified',
              originalPoolAmount: prizePool,
              winnersCount: 0,
              expectedWinnersCount: 1,
              description: `Both players disqualified in challenge - pool goes to platform`,
              createdAt: now,
              updatedAt: now,
            });
            console.log(`      💰 Recorded ${prizePool} credits to unclaimed pools`);
          }
          
          await challengesCollection.updateOne(
            { _id: challenge._id },
            {
              $set: {
                status: 'completed',
                completedAt: now,
                earlyEndReason: endReason,
                noWinner: true,
              }
            }
          );
        } else if (winnerId && winnerRole) {
          // Award winner the prize pool
          const prizePool = (challenge.entryFee || 0) * 2;
          const walletsCollection = db.collection('creditwallets');
          
          await walletsCollection.updateOne(
            { userId: new mongoose.Types.ObjectId(winnerId) },
            { $inc: { creditBalance: prizePool } }
          );
          
          // Update challenge
          await challengesCollection.updateOne(
            { _id: challenge._id },
            {
              $set: {
                status: 'completed',
                completedAt: now,
                winnerId: new mongoose.Types.ObjectId(winnerId),
                winnerRole: winnerRole,
                earlyEndReason: endReason,
              }
            }
          );
          
          // Update participants
          await challengeParticipantsCollection.updateOne(
            { challengeId: challenge._id, role: winnerRole },
            { $set: { isWinner: true } }
          );
          
          console.log(`      💰 Awarded ${prizePool} credits to winner`);
          
          // Send notifications
          try {
            const { sendNotification } = await import('../../lib/services/notification.service');
            await sendNotification({
              userId: winnerId,
              type: 'challenge_won',
              metadata: { challengeId: challenge._id.toString(), prize: prizePool },
            });
          } catch {
            // Notification failure is not critical
          }
        }

        result.challengesEnded++;
      } catch (error) {
        result.errors.push(`Challenge ${challenge._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Critical error: ${error}`);
    return result;
  }
}

export default runEarlyEndCheck;
