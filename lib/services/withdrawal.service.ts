import mongoose from 'mongoose';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import WithdrawalSettings from '@/database/models/withdrawal-settings.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import UserBankAccount from '@/database/models/user-bank-account.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';

/**
 * Withdrawal Service - MANUAL MODE ONLY
 * 
 * This is how most trading platforms work:
 * 
 * Flow:
 * 1. User adds bank account (IBAN) in their profile
 * 2. User requests withdrawal → System deducts credits immediately
 * 3. Admin reviews request in Admin Panel
 * 4. Admin logs into company bank & transfers money to user's IBAN
 * 5. Admin marks withdrawal as "completed" in Admin Panel
 * 6. User receives notification
 * 
 * Users do NOT need:
 * - Stripe account
 * - PayPal account
 * - Any payment processor account
 * 
 * Users only need:
 * - A bank account with IBAN (added in their Wallet → Bank Accounts)
 */

export interface ProcessWithdrawalResult {
  success: boolean;
  payoutId?: string;
  error?: string;
  status: 'completed' | 'failed' | 'processing' | 'pending';
}

/**
 * Approve a withdrawal request (Admin action)
 * This marks it as ready for manual processing
 */
export async function approveWithdrawal(
  withdrawalId: string,
  adminId: string,
  adminEmail: string
): Promise<ProcessWithdrawalResult> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const withdrawal = await WithdrawalRequest.findById(withdrawalId).session(session);
    
    if (!withdrawal) {
      await session.abortTransaction();
      return { success: false, error: 'Withdrawal not found', status: 'failed' };
    }

    if (withdrawal.status !== 'pending') {
      await session.abortTransaction();
      return { 
        success: false, 
        error: `Cannot approve withdrawal with status: ${withdrawal.status}`, 
        status: 'failed' 
      };
    }

    // Get user's bank account for admin reference
    const bankAccount = await UserBankAccount.findOne({
      userId: withdrawal.userId,
      isDefault: true,
      isActive: true,
    }).session(session);

    if (!bankAccount) {
      await session.abortTransaction();
      return {
        success: false,
        error: 'User has no bank account configured',
        status: 'failed',
      };
    }

    // Generate reference ID for tracking
    const referenceId = `WD-${Date.now()}-${withdrawal._id.toString().slice(-6).toUpperCase()}`;

    // Update to approved status
    withdrawal.status = 'approved';
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = adminId;
    withdrawal.processedByEmail = adminEmail;
    withdrawal.payoutId = referenceId;
    withdrawal.payoutMethod = 'manual_bank_transfer';
    withdrawal.payoutProvider = 'manual';
    withdrawal.bankDetails = {
      accountHolderName: bankAccount.accountHolderName,
      iban: `****${bankAccount.iban?.slice(-4) || 'N/A'}`,
      bankName: bankAccount.bankName,
    };
    await withdrawal.save({ session });

    // Log for admin
    console.log(`\n🏦 WITHDRAWAL APPROVED - Reference: ${referenceId}`);
    console.log(`   Amount: €${withdrawal.netAmountEUR.toFixed(2)}`);
    console.log(`   User: ${withdrawal.userEmail}`);
    console.log(`   Recipient: ${bankAccount.accountHolderName}`);
    console.log(`   IBAN: ${bankAccount.iban}`);
    console.log(`   Bank: ${bankAccount.bankName || 'N/A'}`);
    console.log(`   Country: ${bankAccount.country}`);
    console.log(`\n   📋 ADMIN ACTION REQUIRED:`);
    console.log(`   1. Log into your company bank account`);
    console.log(`   2. Transfer €${withdrawal.netAmountEUR.toFixed(2)} to the above IBAN`);
    console.log(`   3. Use reference: ${referenceId}`);
    console.log(`   4. Mark as "completed" in Admin Panel after transfer\n`);

    await session.commitTransaction();

    return {
      success: true,
      payoutId: referenceId,
      status: 'processing', // Approved = waiting for admin to do manual transfer
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error approving withdrawal:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 'failed' 
    };
  } finally {
    session.endSession();
  }
}

/**
 * Mark withdrawal as completed (Admin action)
 * Call this AFTER admin has manually transferred money via their bank
 */
export async function completeWithdrawal(
  withdrawalId: string,
  adminId: string,
  adminEmail: string,
  bankTransferReference?: string
): Promise<ProcessWithdrawalResult> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const withdrawal = await WithdrawalRequest.findById(withdrawalId).session(session);
    
    if (!withdrawal) {
      await session.abortTransaction();
      return { success: false, error: 'Withdrawal not found', status: 'failed' };
    }

    if (!['approved', 'processing'].includes(withdrawal.status)) {
      await session.abortTransaction();
      return { 
        success: false, 
        error: `Cannot complete withdrawal with status: ${withdrawal.status}`, 
        status: 'failed' 
      };
    }

    // Mark as completed
    withdrawal.status = 'completed';
    withdrawal.completedAt = new Date();
    withdrawal.payoutStatus = 'completed';
    if (bankTransferReference) {
      withdrawal.adminNote = `Bank transfer ref: ${bankTransferReference}`;
    }
    await withdrawal.save({ session });

    // Update wallet's total withdrawn
    const wallet = await CreditWallet.findOne({ userId: withdrawal.userId }).session(session);
    if (wallet) {
      wallet.totalWithdrawn += withdrawal.amountCredits;
      await wallet.save({ session });
    }

    // Update wallet transaction to completed
    // Note: withdrawalRequestId is stored as ObjectId, need to match it properly
    const walletTxUpdate = await WalletTransaction.updateOne(
      { 
        userId: withdrawal.userId,
        transactionType: 'withdrawal',
        status: 'pending',
        $or: [
          { 'metadata.withdrawalRequestId': withdrawal._id },
          { 'metadata.withdrawalRequestId': withdrawal._id.toString() },
        ],
      },
      {
        status: 'completed',
        paymentId: withdrawal.payoutId,
        processedAt: new Date(),
        description: `Withdrawal completed - €${withdrawal.netAmountEUR.toFixed(2)} sent to bank`,
      },
      { session }
    );
    console.log(`   Updated wallet transaction: ${walletTxUpdate.modifiedCount} modified`);

    // Update bank account stats
    const bankAccount = await UserBankAccount.findOne({
      userId: withdrawal.userId,
      isDefault: true,
      isActive: true,
    }).session(session);

    if (bankAccount) {
      bankAccount.lastUsedAt = new Date();
      bankAccount.lastPayoutId = withdrawal.payoutId;
      bankAccount.totalPayouts += 1;
      bankAccount.totalPayoutAmount += withdrawal.netAmountEUR;
      await bankAccount.save({ session });
    }

    // Calculate bank fee from settings (what bank charges us for the payout)
    const CreditConversionSettings = (await import('@/database/models/credit-conversion-settings.model')).default;
    const feeSettings = await CreditConversionSettings.getSingleton();
    
    // Bank fee is calculated on the net amount (what we actually transfer to user)
    const withdrawalNetAmount = withdrawal.netAmountEUR || 0;
    const calculatedBankFee = (withdrawalNetAmount * (feeSettings.bankWithdrawalFeePercentage || 0) / 100) 
      + (feeSettings.bankWithdrawalFeeFixed || 0);
    
    // Update withdrawal with calculated bank fee
    withdrawal.bankFee = calculatedBankFee;
    await withdrawal.save({ session });
    
    // Platform fee is what we charge user, bank fee is what bank charges us
    const platformFeeCharged = withdrawal.platformFee || 0;
    const netEarning = platformFeeCharged - calculatedBankFee;
    
    console.log(`💵 Withdrawal fee breakdown:`);
    console.log(`   Net amount transferred: €${withdrawalNetAmount.toFixed(2)}`);
    console.log(`   Platform fee (we charged): €${platformFeeCharged.toFixed(2)}`);
    console.log(`   Bank fee (${feeSettings.bankWithdrawalFeePercentage}% + €${feeSettings.bankWithdrawalFeeFixed}): €${calculatedBankFee.toFixed(2)}`);
    console.log(`   Net platform earning: €${netEarning.toFixed(2)}`);
    
    // Record platform fee as revenue
    await PlatformTransaction.create(
      [{
        transactionType: 'withdrawal_fee',
        amount: withdrawal.platformFeeCredits || 0,
        amountEUR: platformFeeCharged,
        sourceType: 'user_withdrawal',
        sourceId: withdrawal._id.toString(),
        sourceName: withdrawal.userEmail,
        userId: withdrawal.userId,
        feeDetails: {
          withdrawalAmount: withdrawal.amountEUR,
          platformFee: platformFeeCharged,           // What we charged user
          bankFee: calculatedBankFee,                // What bank takes from us
          netEarning: netEarning,                    // What we actually keep
          netAmount: withdrawalNetAmount,            // What user receives
        },
        description: `Withdrawal fee from ${withdrawal.userEmail}`,
      }],
      { session }
    );

    await session.commitTransaction();

    console.log(`✅ Withdrawal ${withdrawal._id} marked as COMPLETED by ${adminEmail}`);

    // Send notification to user
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      await notificationService.notifyWithdrawalCompleted(withdrawal.userId, withdrawal.netAmountEUR);
    } catch (notifyError) {
      console.error('Failed to send withdrawal notification:', notifyError);
    }

    return {
      success: true,
      payoutId: withdrawal.payoutId,
      status: 'completed',
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error completing withdrawal:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 'failed' 
    };
  } finally {
    session.endSession();
  }
}

/**
 * Reject a withdrawal request (Admin action)
 * Refunds credits back to user's wallet
 */
export async function rejectWithdrawal(
  withdrawalId: string,
  adminId: string,
  adminEmail: string,
  reason: string
): Promise<ProcessWithdrawalResult> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const withdrawal = await WithdrawalRequest.findById(withdrawalId).session(session);
    
    if (!withdrawal) {
      await session.abortTransaction();
      return { success: false, error: 'Withdrawal not found', status: 'failed' };
    }

    if (!['pending', 'approved', 'processing'].includes(withdrawal.status)) {
      await session.abortTransaction();
      return { 
        success: false, 
        error: `Cannot reject withdrawal with status: ${withdrawal.status}`, 
        status: 'failed' 
      };
    }

    // Mark as rejected
    withdrawal.status = 'rejected';
    withdrawal.rejectedAt = new Date();
    withdrawal.rejectedBy = adminId;
    withdrawal.rejectionReason = reason;
    await withdrawal.save({ session });

    // Refund credits to wallet
    const wallet = await CreditWallet.findOne({ userId: withdrawal.userId }).session(session);
    if (wallet) {
      const balanceBefore = wallet.creditBalance;
      wallet.creditBalance += withdrawal.amountCredits;
      await wallet.save({ session });

      withdrawal.walletBalanceAfter = wallet.creditBalance;
      await withdrawal.save({ session });

      // Record refund transaction
      await WalletTransaction.create(
        [{
          userId: withdrawal.userId,
          transactionType: 'admin_adjustment',
          amount: withdrawal.amountCredits,
          balanceBefore,
          balanceAfter: wallet.creditBalance,
          currency: 'EUR',
          exchangeRate: withdrawal.exchangeRate,
          status: 'completed',
          description: `Withdrawal rejected - credits refunded: ${reason}`,
          metadata: {
            withdrawalRequestId: withdrawal._id,
            rejectionReason: reason,
            rejectedBy: adminEmail,
          },
          processedAt: new Date(),
        }],
        { session }
      );
    }

    // Update original withdrawal transaction
    const walletTxUpdate = await WalletTransaction.updateOne(
      { 
        userId: withdrawal.userId,
        transactionType: 'withdrawal',
        status: 'pending',
        $or: [
          { 'metadata.withdrawalRequestId': withdrawal._id },
          { 'metadata.withdrawalRequestId': withdrawal._id.toString() },
        ],
      },
      {
        status: 'failed',
        failureReason: reason,
        description: `Withdrawal rejected: ${reason}`,
      },
      { session }
    );
    console.log(`   Updated wallet transaction: ${walletTxUpdate.modifiedCount} modified`);

    await session.commitTransaction();

    console.log(`❌ Withdrawal ${withdrawal._id} REJECTED by ${adminEmail}: ${reason}`);

    // Send notification to user
    try {
      const { notificationService } = await import('@/lib/services/notification.service');
      await notificationService.notifyWithdrawalFailed(withdrawal.userId, withdrawal.amountEUR, reason);
    } catch (notifyError) {
      console.error('Failed to send rejection notification:', notifyError);
    }

    return {
      success: true,
      status: 'failed', // Status from user perspective
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error rejecting withdrawal:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 'failed' 
    };
  } finally {
    session.endSession();
  }
}

/**
 * Get withdrawal statistics for admin dashboard
 */
export async function getWithdrawalStats(): Promise<{
  pending: { count: number; totalEUR: number };
  approved: { count: number; totalEUR: number };
  completedToday: { count: number; totalEUR: number };
  completedThisMonth: { count: number; totalEUR: number };
  rejectedToday: { count: number; totalEUR: number };
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const stats = await WithdrawalRequest.aggregate([
    {
      $facet: {
        pending: [
          { $match: { status: 'pending' } },
          { $group: { _id: null, count: { $sum: 1 }, totalEUR: { $sum: '$amountEUR' } } },
        ],
        approved: [
          { $match: { status: { $in: ['approved', 'processing'] } } },
          { $group: { _id: null, count: { $sum: 1 }, totalEUR: { $sum: '$amountEUR' } } },
        ],
        completedToday: [
          { $match: { status: 'completed', completedAt: { $gte: today } } },
          { $group: { _id: null, count: { $sum: 1 }, totalEUR: { $sum: '$amountEUR' } } },
        ],
        completedThisMonth: [
          { $match: { status: 'completed', completedAt: { $gte: startOfMonth } } },
          { $group: { _id: null, count: { $sum: 1 }, totalEUR: { $sum: '$amountEUR' } } },
        ],
        rejectedToday: [
          { $match: { status: 'rejected', rejectedAt: { $gte: today } } },
          { $group: { _id: null, count: { $sum: 1 }, totalEUR: { $sum: '$amountEUR' } } },
        ],
      },
    },
  ]);

  const extractStats = (arr: any[]) => ({
    count: arr[0]?.count || 0,
    totalEUR: arr[0]?.totalEUR || 0,
  });

  return {
    pending: extractStats(stats[0].pending),
    approved: extractStats(stats[0].approved),
    completedToday: extractStats(stats[0].completedToday),
    completedThisMonth: extractStats(stats[0].completedThisMonth),
    rejectedToday: extractStats(stats[0].rejectedToday),
  };
}

/**
 * Get pending withdrawals with user bank details for admin
 */
export async function getPendingWithdrawalsForAdmin(): Promise<any[]> {
  const withdrawals = await WithdrawalRequest.find({
    status: { $in: ['pending', 'approved', 'processing'] },
  }).sort({ requestedAt: -1 }).lean();

  // Fetch bank details for each withdrawal
  const withdrawalsWithBankDetails = await Promise.all(
    withdrawals.map(async (withdrawal) => {
      const bankAccount = await UserBankAccount.findOne({
        userId: withdrawal.userId,
        isDefault: true,
        isActive: true,
      }).lean();

      return {
        ...withdrawal,
        fullBankDetails: bankAccount ? {
          accountHolderName: bankAccount.accountHolderName,
          iban: bankAccount.iban,
          bankName: bankAccount.bankName,
          swiftBic: bankAccount.swiftBic,
          country: bankAccount.country,
        } : null,
      };
    })
  );

  return withdrawalsWithBankDetails;
}
