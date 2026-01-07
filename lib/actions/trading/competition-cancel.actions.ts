'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import mongoose from 'mongoose';

/**
 * Cancel a competition and refund ALL participants their FULL entry fee
 * This includes the platform fee portion - users get a complete refund
 */
export async function cancelCompetitionAndRefund(
  competitionId: string,
  reason: string
): Promise<{ success: boolean; refundedCount: number; totalRefunded: number }> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await connectToDatabase();

    console.log(`🚫 Starting competition cancellation and refund: ${competitionId}`);
    console.log(`   Reason: ${reason}`);

    // Get the competition
    const competition = await Competition.findById(competitionId).session(session);
    if (!competition) {
      throw new Error('Competition not found');
    }

    // Get all participants
    const participants = await CompetitionParticipant.find({
      competitionId: competitionId,
    }).session(session);

    console.log(`👥 Found ${participants.length} participants to refund`);

    const entryFee = competition.entryFee;
    let totalRefunded = 0;
    let refundedCount = 0;

    // Import notification service
    const { notificationService } = await import('@/lib/services/notification.service');

    // Refund each participant
    for (const participant of participants) {
      const userId = participant.userId.toString();

      // Get participant's wallet
      const wallet = await CreditWallet.findOne({ userId }).session(session);
      if (!wallet) {
        console.log(`⚠️ No wallet found for user ${userId}, skipping`);
        continue;
      }

      // Calculate FULL refund (entry fee that was charged)
      // The prizePool already has the platform fee deducted, but we refund the ORIGINAL entry fee
      const refundAmount = entryFee;
      const newBalance = wallet.creditBalance + refundAmount;

      // Update wallet balance AND tracking fields
      // Refund adds to totalWonFromCompetitions (it's credits received)
      // This keeps the accounting correct for reconciliation
      await CreditWallet.findByIdAndUpdate(
        wallet._id,
        {
          $inc: { 
            creditBalance: refundAmount,
            totalWonFromCompetitions: refundAmount, // Track refund as credits received
          },
        },
        { session }
      );

      // Create refund transaction
      await WalletTransaction.create(
        [{
          userId,
          transactionType: 'competition_refund',
          amount: refundAmount,
          balanceBefore: wallet.creditBalance,
          balanceAfter: newBalance,
          competitionId: competitionId,
          status: 'completed',
          description: `Competition cancelled - Full refund for "${competition.name}"`,
          metadata: {
            competitionName: competition.name,
            cancellationReason: reason,
            originalEntryFee: entryFee,
          },
        }],
        { session }
      );

      // Update participant status
      await CompetitionParticipant.findByIdAndUpdate(
        participant._id,
        {
          $set: { 
            status: 'refunded',
          },
        },
        { session }
      );

      // Send notifications
      try {
        await notificationService.notifyCompetitionCancelled(
          userId,
          competitionId,
          competition.name,
          reason,
          entryFee
        );
      } catch (notifError) {
        console.error(`Error sending cancellation notification to ${userId}:`, notifError);
      }

      totalRefunded += refundAmount;
      refundedCount++;

      console.log(`   💰 Refunded ${refundAmount} credits to user ${userId} (new balance: ${newBalance})`);
    }

    // Update competition status and clear prize pool (it's been refunded)
    await Competition.findByIdAndUpdate(
      competitionId,
      {
        $set: {
          status: 'cancelled',
          cancellationReason: reason,
          prizePool: 0, // Prize pool is now empty (refunded)
        },
      },
      { session }
    );

    await session.commitTransaction();

    console.log(`✅ Competition "${competition.name}" cancelled successfully`);
    console.log(`   Refunded: ${refundedCount} participants`);
    console.log(`   Total refunded: ${totalRefunded} credits`);

    // Revalidate pages to show updated status
    revalidatePath(`/competitions/${competitionId}`);
    revalidatePath(`/competitions/${competitionId}/trade`);
    revalidatePath('/competitions');
    revalidatePath('/admin/competitions');

    return {
      success: true,
      refundedCount,
      totalRefunded,
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Error cancelling competition:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Manually cancel a competition (admin action)
 * Can be used before or after start time
 */
export async function adminCancelCompetition(
  competitionId: string,
  reason: string,
  adminId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await connectToDatabase();

    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return { success: false, message: 'Competition not found' };
    }

    // Can only cancel upcoming or draft competitions manually
    if (!['upcoming', 'draft'].includes(competition.status)) {
      return { 
        success: false, 
        message: `Cannot cancel a ${competition.status} competition. Only draft or upcoming competitions can be cancelled.` 
      };
    }

    // If there are participants, refund them
    const participantCount = competition.currentParticipants || 0;
    if (participantCount > 0) {
      const result = await cancelCompetitionAndRefund(competitionId, reason);
      return {
        success: true,
        message: `Competition cancelled. Refunded ${result.refundedCount} participants (${result.totalRefunded} credits total).`,
      };
    }

    // No participants - just cancel
    await Competition.findByIdAndUpdate(competitionId, {
      $set: {
        status: 'cancelled',
        cancellationReason: reason,
      },
    });

    return {
      success: true,
      message: 'Competition cancelled (no participants to refund).',
    };
  } catch (error) {
    console.error('Error in adminCancelCompetition:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cancel competition',
    };
  }
}

