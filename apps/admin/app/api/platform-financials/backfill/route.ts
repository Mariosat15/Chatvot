import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { PlatformTransaction } from '@/database/models/platform-financials.model';
import CreditConversionSettings from '@/database/models/credit-conversion-settings.model';

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-in-production'
);

async function verifyAdminToken(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

// POST - Backfill deposit/withdrawal fees for existing transactions
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const feeSettings = await CreditConversionSettings.getSingleton();
    
    // Find completed deposits that don't have corresponding PlatformTransaction entries
    const completedDeposits = await WalletTransaction.find({
      transactionType: 'deposit',
      status: 'completed',
    }).lean();
    
    // Get existing platform transactions to avoid duplicates
    const existingPlatformTxIds = new Set(
      (await PlatformTransaction.find({ transactionType: 'deposit_fee' })
        .select('sourceId')
        .lean())
        .map((tx: any) => tx.sourceId)
    );
    
    let backfilledCount = 0;
    const errors: string[] = [];
    
    for (const deposit of completedDeposits) {
      const depositId = (deposit._id as any).toString();
      
      // Skip if already has platform transaction
      if (existingPlatformTxIds.has(depositId)) {
        continue;
      }
      
      const eurAmount = deposit.metadata?.eurAmount || deposit.amount;
      
      // Calculate fees using current settings
      const platformDepositFeePercentage = feeSettings.platformDepositFeePercentage || 0;
      const platformFeeAmount = (eurAmount * platformDepositFeePercentage) / 100;
      
      const bankDepositFeePercentage = feeSettings.bankDepositFeePercentage || 2.9;
      const bankDepositFeeFixed = feeSettings.bankDepositFeeFixed || 0.30;
      const bankFeeTotal = (eurAmount * bankDepositFeePercentage / 100) + bankDepositFeeFixed;
      
      const netEarning = platformFeeAmount - bankFeeTotal;
      
      // Only record if there's a fee
      if (platformFeeAmount > 0) {
        try {
          await PlatformTransaction.create({
            transactionType: 'deposit_fee',
            amount: platformFeeAmount,
            amountEUR: platformFeeAmount,
            sourceType: 'user_deposit',
            sourceId: depositId,
            userId: deposit.userId,
            feeDetails: {
              depositAmount: eurAmount,
              platformFee: platformFeeAmount,
              bankFee: bankFeeTotal,
              netEarning: netEarning,
            },
            description: `[Backfill] Deposit fee: €${platformFeeAmount.toFixed(2)} (Bank: €${bankFeeTotal.toFixed(2)}, Net: €${netEarning.toFixed(2)})`,
          });
          backfilledCount++;
        } catch (error) {
          errors.push(`Failed to backfill deposit ${depositId}: ${error}`);
        }
      }
    }
    
    // Do the same for completed withdrawals
    const completedWithdrawals = await WalletTransaction.find({
      transactionType: 'withdrawal',
      status: 'completed',
    }).lean();
    
    const existingWithdrawalTxIds = new Set(
      (await PlatformTransaction.find({ transactionType: 'withdrawal_fee' })
        .select('sourceId')
        .lean())
        .map((tx: any) => tx.sourceId)
    );
    
    let withdrawalBackfilledCount = 0;
    
    for (const withdrawal of completedWithdrawals) {
      const withdrawalId = (withdrawal._id as any).toString();
      
      if (existingWithdrawalTxIds.has(withdrawalId)) {
        continue;
      }
      
      const eurAmount = withdrawal.metadata?.eurAmount || Math.abs(withdrawal.amount);
      
      const platformWithdrawalFeePercentage = feeSettings.platformWithdrawalFeePercentage || 0;
      const platformFeeAmount = (eurAmount * platformWithdrawalFeePercentage) / 100;
      
      const bankWithdrawalFeePercentage = feeSettings.bankWithdrawalFeePercentage || 0.25;
      const bankWithdrawalFeeFixed = feeSettings.bankWithdrawalFeeFixed || 0.25;
      const bankFeeTotal = (eurAmount * bankWithdrawalFeePercentage / 100) + bankWithdrawalFeeFixed;
      
      const netEarning = platformFeeAmount - bankFeeTotal;
      
      if (platformFeeAmount > 0) {
        try {
          await PlatformTransaction.create({
            transactionType: 'withdrawal_fee',
            amount: platformFeeAmount,
            amountEUR: platformFeeAmount,
            sourceType: 'user_withdrawal',
            sourceId: withdrawalId,
            userId: withdrawal.userId,
            feeDetails: {
              withdrawalAmount: eurAmount,
              platformFee: platformFeeAmount,
              bankFee: bankFeeTotal,
              netEarning: netEarning,
            },
            description: `[Backfill] Withdrawal fee: €${platformFeeAmount.toFixed(2)} (Bank: €${bankFeeTotal.toFixed(2)}, Net: €${netEarning.toFixed(2)})`,
          });
          withdrawalBackfilledCount++;
        } catch (error) {
          errors.push(`Failed to backfill withdrawal ${withdrawalId}: ${error}`);
        }
      }
    }
    
    console.log(`💰 Backfill complete: ${backfilledCount} deposits, ${withdrawalBackfilledCount} withdrawals`);
    
    return NextResponse.json({
      success: true,
      depositsBackfilled: backfilledCount,
      withdrawalsBackfilled: withdrawalBackfilledCount,
      totalDeposits: completedDeposits.length,
      totalWithdrawals: completedWithdrawals.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error backfilling fees:', error);
    return NextResponse.json(
      { error: 'Failed to backfill fees' },
      { status: 500 }
    );
  }
}

// DELETE - Clear all platform financial transactions (for database reset)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    // Delete all platform transactions
    const result = await PlatformTransaction.deleteMany({});
    
    console.log(`🗑️ Cleared ${result.deletedCount} platform transactions`);
    
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: 'All platform financial data has been cleared',
    });
  } catch (error) {
    console.error('Error clearing platform financials:', error);
    return NextResponse.json(
      { error: 'Failed to clear platform financials' },
      { status: 500 }
    );
  }
}

