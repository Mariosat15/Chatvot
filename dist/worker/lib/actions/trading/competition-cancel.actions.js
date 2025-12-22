'use server';
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelCompetitionAndRefund = cancelCompetitionAndRefund;
exports.adminCancelCompetition = adminCancelCompetition;
const cache_1 = require("next/cache");
const mongoose_1 = require("@/database/mongoose");
const competition_model_1 = __importDefault(require("@/database/models/trading/competition.model"));
const competition_participant_model_1 = __importDefault(require("@/database/models/trading/competition-participant.model"));
const credit_wallet_model_1 = __importDefault(require("@/database/models/trading/credit-wallet.model"));
const wallet_transaction_model_1 = __importDefault(require("@/database/models/trading/wallet-transaction.model"));
const mongoose_2 = __importDefault(require("mongoose"));
/**
 * Cancel a competition and refund ALL participants their FULL entry fee
 * This includes the platform fee portion - users get a complete refund
 */
async function cancelCompetitionAndRefund(competitionId, reason) {
    const session = await mongoose_2.default.startSession();
    session.startTransaction();
    try {
        await (0, mongoose_1.connectToDatabase)();
        console.log(`🚫 Starting competition cancellation and refund: ${competitionId}`);
        console.log(`   Reason: ${reason}`);
        // Get the competition
        const competition = await competition_model_1.default.findById(competitionId).session(session);
        if (!competition) {
            throw new Error('Competition not found');
        }
        // Get all participants
        const participants = await competition_participant_model_1.default.find({
            competitionId: competitionId,
        }).session(session);
        console.log(`👥 Found ${participants.length} participants to refund`);
        const entryFee = competition.entryFee;
        let totalRefunded = 0;
        let refundedCount = 0;
        // Import notification service
        const { notificationService } = await Promise.resolve().then(() => __importStar(require('@/lib/services/notification.service')));
        // Refund each participant
        for (const participant of participants) {
            const userId = participant.userId.toString();
            // Get participant's wallet
            const wallet = await credit_wallet_model_1.default.findOne({ userId }).session(session);
            if (!wallet) {
                console.log(`⚠️ No wallet found for user ${userId}, skipping`);
                continue;
            }
            // Calculate FULL refund (entry fee that was charged)
            // The prizePool already has the platform fee deducted, but we refund the ORIGINAL entry fee
            const refundAmount = entryFee;
            const newBalance = wallet.creditBalance + refundAmount;
            // Update wallet balance
            await credit_wallet_model_1.default.findByIdAndUpdate(wallet._id, {
                $inc: { creditBalance: refundAmount },
            }, { session });
            // Create refund transaction
            await wallet_transaction_model_1.default.create([{
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
                }], { session });
            // Update participant status
            await competition_participant_model_1.default.findByIdAndUpdate(participant._id, {
                $set: {
                    status: 'refunded',
                },
            }, { session });
            // Send notifications
            try {
                await notificationService.notifyCompetitionCancelled(userId, competitionId, competition.name, reason, entryFee);
            }
            catch (notifError) {
                console.error(`Error sending cancellation notification to ${userId}:`, notifError);
            }
            totalRefunded += refundAmount;
            refundedCount++;
            console.log(`   💰 Refunded ${refundAmount} credits to user ${userId} (new balance: ${newBalance})`);
        }
        // Update competition status and clear prize pool (it's been refunded)
        await competition_model_1.default.findByIdAndUpdate(competitionId, {
            $set: {
                status: 'cancelled',
                cancellationReason: reason,
                prizePool: 0, // Prize pool is now empty (refunded)
            },
        }, { session });
        await session.commitTransaction();
        console.log(`✅ Competition "${competition.name}" cancelled successfully`);
        console.log(`   Refunded: ${refundedCount} participants`);
        console.log(`   Total refunded: ${totalRefunded} credits`);
        // Revalidate pages to show updated status
        (0, cache_1.revalidatePath)(`/competitions/${competitionId}`);
        (0, cache_1.revalidatePath)(`/competitions/${competitionId}/trade`);
        (0, cache_1.revalidatePath)('/competitions');
        (0, cache_1.revalidatePath)('/admin/competitions');
        return {
            success: true,
            refundedCount,
            totalRefunded,
        };
    }
    catch (error) {
        await session.abortTransaction();
        console.error('❌ Error cancelling competition:', error);
        throw error;
    }
    finally {
        session.endSession();
    }
}
/**
 * Manually cancel a competition (admin action)
 * Can be used before or after start time
 */
async function adminCancelCompetition(competitionId, reason, adminId) {
    try {
        await (0, mongoose_1.connectToDatabase)();
        const competition = await competition_model_1.default.findById(competitionId);
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
        await competition_model_1.default.findByIdAndUpdate(competitionId, {
            $set: {
                status: 'cancelled',
                cancellationReason: reason,
            },
        });
        return {
            success: true,
            message: 'Competition cancelled (no participants to refund).',
        };
    }
    catch (error) {
        console.error('Error in adminCancelCompetition:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to cancel competition',
        };
    }
}
