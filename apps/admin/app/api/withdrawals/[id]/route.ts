import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import UserBankAccount from '@/database/models/user-bank-account.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * GET /api/withdrawals/[id]
 * Get a specific withdrawal request with bank details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const withdrawal = await WithdrawalRequest.findById(id).lean();
    if (!withdrawal) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    // Get user's bank details
    const bankAccount = await UserBankAccount.findOne({
      userId: withdrawal.userId,
      isDefault: true,
      isActive: true,
    }).lean();

    return NextResponse.json({
      success: true,
      withdrawal: {
        ...withdrawal,
        userBankDetails: bankAccount ? {
          accountHolderName: bankAccount.accountHolderName,
          iban: bankAccount.iban,
          bankName: bankAccount.bankName,
          swiftBic: bankAccount.swiftBic,
          country: bankAccount.country,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error fetching withdrawal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch withdrawal' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/withdrawals/[id]
 * Update withdrawal status
 * 
 * MANUAL WITHDRAWAL FLOW:
 * - pending → approved: Admin approves, ready for bank transfer
 * - approved → completed: Admin has transferred money via bank
 * - pending/approved → rejected: Refund credits to user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reason, bankTransferRef, adminNote, companyBankUsed } = body;

    await connectToDatabase();

    const withdrawal = await WithdrawalRequest.findById(id).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    const validTransitions: Record<string, string[]> = {
      pending: ['approved', 'rejected', 'cancelled'],
      approved: ['processing', 'completed', 'rejected', 'cancelled'],
      processing: ['completed', 'failed'],
      failed: ['processing', 'rejected'],
    };

    if (!validTransitions[withdrawal.status]?.includes(action)) {
      await session.abortTransaction();
      return NextResponse.json(
        { success: false, error: `Cannot transition from ${withdrawal.status} to ${action}` },
        { status: 400 }
      );
    }

    // Handle each action
    switch (action) {
      case 'approved':
        // Generate reference for admin tracking
        const referenceId = `WD-${Date.now()}-${withdrawal._id.toString().slice(-6).toUpperCase()}`;
        
        withdrawal.status = 'approved';
        withdrawal.processedBy = admin.adminId;
        withdrawal.processedByEmail = admin.email;
        withdrawal.processedAt = new Date();
        withdrawal.payoutId = referenceId;
        // Preserve original payout method, only set provider to manual
        withdrawal.payoutProvider = 'manual';
        if (adminNote) withdrawal.adminNote = adminNote;

        // Log details based on payout method
        const isCardRefund = withdrawal.payoutMethod === 'original_method';
        
        if (isCardRefund) {
          console.log(`\n💳 WITHDRAWAL APPROVED (Card Refund) - Reference: ${referenceId}`);
          console.log(`   Amount: €${withdrawal.netAmountEUR.toFixed(2)}`);
          console.log(`   User: ${withdrawal.userEmail}`);
          if (withdrawal.originalCardDetails) {
            console.log(`   Card: ${withdrawal.originalCardDetails.brand} •••• ${withdrawal.originalCardDetails.last4}`);
          }
          console.log(`   Original Payment: ${withdrawal.originalPaymentId || 'Look up in Stripe'}`);
          console.log(`\n   📋 Issue refund of €${withdrawal.netAmountEUR.toFixed(2)} via payment provider, then mark as COMPLETED\n`);
        } else {
          // Bank transfer
          const bankAccount = await UserBankAccount.findOne({
            userId: withdrawal.userId,
            isDefault: true,
            isActive: true,
          }).session(session);

          if (bankAccount) {
            console.log(`\n🏦 WITHDRAWAL APPROVED (Bank Transfer) - Reference: ${referenceId}`);
            console.log(`   Amount: €${withdrawal.netAmountEUR.toFixed(2)}`);
            console.log(`   User: ${withdrawal.userEmail}`);
            console.log(`   IBAN: ${bankAccount.iban}`);
            console.log(`   Bank: ${bankAccount.bankName || 'N/A'}`);
            console.log(`\n   📋 Transfer €${withdrawal.netAmountEUR.toFixed(2)} to above IBAN, then mark as COMPLETED\n`);
          }
        }
        break;

      case 'rejected':
      case 'cancelled':
        withdrawal.status = action === 'rejected' ? 'rejected' : 'cancelled';
        withdrawal.rejectedBy = admin.adminId;
        withdrawal.rejectedAt = new Date();
        withdrawal.rejectionReason = reason || `${action} by admin`;
        if (adminNote) withdrawal.adminNote = adminNote;

        // Refund credits to user wallet
        const wallet = await CreditWallet.findOne({ userId: withdrawal.userId }).session(session);
        if (wallet) {
          const balanceBefore = wallet.creditBalance;
          wallet.creditBalance += withdrawal.amountCredits;
          await wallet.save({ session });

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
              description: `Withdrawal ${action} - credits refunded`,
              metadata: {
                withdrawalRequestId: withdrawal._id,
                reason: withdrawal.rejectionReason,
              },
              processedAt: new Date(),
            }],
            { session }
          );

          withdrawal.walletBalanceAfter = wallet.creditBalance;
        }
        break;

      case 'processing':
        withdrawal.status = 'processing';
        withdrawal.processedAt = new Date();
        break;

      case 'completed':
        withdrawal.status = 'completed';
        withdrawal.completedAt = new Date();
        withdrawal.payoutStatus = 'completed';
        if (bankTransferRef) {
          withdrawal.adminNote = (withdrawal.adminNote || '') + `\nBank ref: ${bankTransferRef}`;
        }
        if (adminNote) {
          withdrawal.adminNote = (withdrawal.adminNote || '') + (withdrawal.adminNote ? '\n' : '') + adminNote;
        }
        
        // Save company bank used for this withdrawal
        if (companyBankUsed && companyBankUsed.bankId) {
          // Store the bank details - IBAN should come pre-masked from frontend or mask it here
          const maskIban = (iban: string | undefined) => {
            if (!iban) return undefined;
            // If already masked, don't re-mask
            if (iban.startsWith('****')) return iban;
            // Show last 4 chars
            return `****${iban.slice(-4)}`;
          };
          
          const bankDataToSave = {
            bankId: companyBankUsed.bankId,
            accountName: companyBankUsed.accountName,
            accountHolderName: companyBankUsed.accountHolderName,
            bankName: companyBankUsed.bankName,
            iban: maskIban(companyBankUsed.iban),
            accountNumber: companyBankUsed.accountNumber ? 
              (companyBankUsed.accountNumber.startsWith('****') ? companyBankUsed.accountNumber : `****${companyBankUsed.accountNumber.slice(-4)}`) 
              : undefined,
            country: companyBankUsed.country,
            currency: companyBankUsed.currency,
          };
          
          withdrawal.companyBankUsed = bankDataToSave;
          
          // Update admin bank account statistics
          try {
            const AdminBankAccount = (await import('@/database/models/admin-bank-account.model')).default;
            await AdminBankAccount.findByIdAndUpdate(
              companyBankUsed.bankId,
              {
                $inc: { 
                  totalWithdrawals: 1, 
                  totalAmount: withdrawal.netAmountEUR 
                },
                $set: { lastUsedAt: new Date() },
              },
              { session }
            );
          } catch (bankUpdateError) {
            console.error('Failed to update admin bank stats:', bankUpdateError);
            // Don't fail the withdrawal for this
          }
        }

        // Update wallet's total withdrawn
        const userWallet = await CreditWallet.findOne({ userId: withdrawal.userId }).session(session);
        if (userWallet) {
          userWallet.totalWithdrawn += withdrawal.amountCredits;
          await userWallet.save({ session });
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
        
        // Platform fee is what we charge user, bank fee is what bank charges us
        // Net earning = platform fee - bank fee
        const platformFeeCharged = withdrawal.platformFee || 0;
        const netEarning = platformFeeCharged - calculatedBankFee;
        
        console.log(`💵 Withdrawal fee breakdown:`);
        console.log(`   Net amount transferred: €${withdrawalNetAmount.toFixed(2)}`);
        console.log(`   Platform fee (we charged): €${platformFeeCharged.toFixed(2)}`);
        console.log(`   Bank fee (${feeSettings.bankWithdrawalFeePercentage}% + €${feeSettings.bankWithdrawalFeeFixed}): €${calculatedBankFee.toFixed(2)}`);
        console.log(`   Net platform earning: €${netEarning.toFixed(2)}`);
        
        // Record platform transaction for withdrawal fee
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
            processedBy: admin.adminId,
            processedByEmail: admin.email,
          }],
          { session }
        );

        console.log(`✅ Withdrawal ${withdrawal._id} marked as COMPLETED by ${admin.email}`);
        break;

      case 'failed':
        withdrawal.status = 'failed';
        withdrawal.failureReason = reason || 'Bank transfer failed';
        withdrawal.failedAt = new Date();
        if (adminNote) withdrawal.adminNote = adminNote;
        
        // CRITICAL: Refund credits when withdrawal fails
        const walletForRefund = await CreditWallet.findOne({ userId: withdrawal.userId }).session(session);
        if (walletForRefund) {
          const balanceBeforeRefund = walletForRefund.creditBalance;
          walletForRefund.creditBalance += withdrawal.amountCredits;
          await walletForRefund.save({ session });

          // Record refund transaction
          await WalletTransaction.create(
            [{
              userId: withdrawal.userId,
              transactionType: 'withdrawal_refund',
              amount: withdrawal.amountCredits,
              balanceBefore: balanceBeforeRefund,
              balanceAfter: walletForRefund.creditBalance,
              currency: 'EUR',
              exchangeRate: withdrawal.exchangeRate,
              status: 'completed',
              description: `Withdrawal failed - credits refunded: ${withdrawal.failureReason}`,
              metadata: {
                withdrawalRequestId: withdrawal._id,
                reason: withdrawal.failureReason,
              },
              processedAt: new Date(),
            }],
            { session }
          );

          withdrawal.walletBalanceAfter = walletForRefund.creditBalance;
          console.log(`💰 Refunded ${withdrawal.amountCredits} credits to user ${withdrawal.userId} due to failed withdrawal`);
        }
        break;
    }

    await withdrawal.save({ session });
    await session.commitTransaction();

    // Log action to audit log (after successful commit)
    const adminInfo = {
      id: admin.adminId || 'unknown',
      email: admin.email || 'unknown',
      name: admin.adminId,
      role: 'admin' as const,
    };
    const userName = withdrawal.userName || withdrawal.userEmail || 'Unknown';

    try {
      switch (action) {
        case 'approved':
          await auditLogService.logWithdrawalApproved(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR
          );
          break;
        case 'rejected':
          await auditLogService.logWithdrawalRejected(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
            reason
          );
          break;
        case 'cancelled':
          await auditLogService.logWithdrawalCancelled(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
            reason
          );
          break;
        case 'processing':
          await auditLogService.logWithdrawalProcessing(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR
          );
          break;
        case 'completed':
          await auditLogService.logWithdrawalCompleted(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
            withdrawal.netAmountEUR,
            withdrawal.payoutMethod || 'manual'
          );
          break;
        case 'failed':
          await auditLogService.logWithdrawalFailed(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
            reason
          );
          break;
      }
    } catch (logError) {
      console.error('Failed to log withdrawal action to audit log:', logError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: `Withdrawal ${action} successfully`,
      withdrawal,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating withdrawal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update withdrawal' },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}

