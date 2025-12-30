/**
 * Manual Deposit Completion API
 * 
 * Allows admin to manually credit users for failed deposits
 * when the payment was actually successful but our system failed to credit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import PlatformFinancials from '@/database/models/platform-financials.model';
import { auditLogService } from '@/lib/services/audit-log.service';
import mongoose from 'mongoose';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await context.params;
    const body = await request.json();
    const { reason, verificationNotes } = body;

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a detailed reason (min 10 characters)' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the failed deposit transaction
    const failedDeposit = await WalletTransaction.findById(transactionId).session(session);
    
    if (!failedDeposit) {
      await session.abortTransaction();
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (failedDeposit.transactionType !== 'deposit') {
      await session.abortTransaction();
      return NextResponse.json(
        { error: 'This transaction is not a deposit' },
        { status: 400 }
      );
    }

    if (failedDeposit.status === 'completed') {
      await session.abortTransaction();
      return NextResponse.json(
        { error: 'This deposit is already completed' },
        { status: 400 }
      );
    }

    // Check if manual credit already exists for this transaction
    const existingManualCredit = await WalletTransaction.findOne({
      'metadata.originalTransactionId': transactionId,
      transactionType: 'manual_deposit_credit',
    }).session(session);

    if (existingManualCredit) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: 'Manual credit already processed for this deposit' },
        { status: 400 }
      );
    }

    // Get the user's wallet
    const wallet = await CreditWallet.findOne({ userId: failedDeposit.userId }).session(session);
    
    if (!wallet) {
      await session.abortTransaction();
      return NextResponse.json({ error: 'User wallet not found' }, { status: 404 });
    }

    // Calculate credits to add (same as original deposit)
    const creditsToAdd = Math.abs(failedDeposit.amount);
    const eurAmount = failedDeposit.metadata?.eurAmount || failedDeposit.metadata?.baseAmount || 0;
    
    // Get current balance
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + creditsToAdd;

    // Create manual deposit credit transaction
    const manualCreditTransaction = await WalletTransaction.create([{
      userId: failedDeposit.userId,
      transactionType: 'manual_deposit_credit',
      amount: creditsToAdd,
      balanceBefore,
      balanceAfter,
      currency: failedDeposit.currency || 'EUR',
      exchangeRate: failedDeposit.exchangeRate || 1,
      status: 'completed',
      provider: 'admin_manual',
      description: `Manual credit for failed deposit - ${reason}`,
      metadata: {
        originalTransactionId: transactionId,
        originalProvider: failedDeposit.provider,
        originalProviderTransactionId: failedDeposit.providerTransactionId,
        eurAmount,
        creditsAdded: creditsToAdd,
        adminEmail: admin.email,
        adminReason: reason,
        verificationNotes: verificationNotes || null,
        processedAt: new Date().toISOString(),
        originalFailureReason: failedDeposit.failureReason,
        vatAmount: failedDeposit.metadata?.vatAmount || 0,
        platformFeeAmount: failedDeposit.metadata?.platformFeeAmount || 0,
      },
      processedAt: new Date(),
    }], { session });

    // Update user's wallet balance
    await CreditWallet.findByIdAndUpdate(
      wallet._id,
      {
        $inc: { balance: creditsToAdd },
        $set: { lastTransactionAt: new Date() },
      },
      { session }
    );

    // Update original failed deposit to mark it as manually resolved
    await WalletTransaction.findByIdAndUpdate(
      transactionId,
      {
        $set: {
          'metadata.manuallyResolved': true,
          'metadata.manualResolutionId': manualCreditTransaction[0]._id.toString(),
          'metadata.manualResolutionAt': new Date().toISOString(),
          'metadata.resolvedByAdmin': admin.email,
        },
      },
      { session }
    );

    // Record in platform financials (deposit revenue)
    const platformFeeAmount = failedDeposit.metadata?.platformFeeAmount || 0;
    const bankFeeAmount = failedDeposit.metadata?.bankFeeAmount || 0;
    
    if (eurAmount > 0) {
      await PlatformFinancials.create([{
        date: new Date(),
        type: 'deposit_fee',
        amount: platformFeeAmount,
        currency: 'EUR',
        userId: failedDeposit.userId,
        transactionId: manualCreditTransaction[0]._id.toString(),
        description: `Manual deposit credit - Platform fee from failed deposit resolution`,
        metadata: {
          originalTransactionId: transactionId,
          eurAmount,
          platformFee: platformFeeAmount,
          bankFee: bankFeeAmount,
          netPlatformEarning: platformFeeAmount - bankFeeAmount,
          adminEmail: admin.email,
        },
      }], { session });
    }

    // Log the action
    await auditLogService.log({
      action: 'manual_deposit_credit',
      adminEmail: admin.email || 'unknown',
      targetUserId: failedDeposit.userId,
      details: `Manually credited ${creditsToAdd} credits (€${eurAmount}) for failed deposit ${transactionId}. Reason: ${reason}`,
      metadata: {
        originalTransactionId: transactionId,
        newTransactionId: manualCreditTransaction[0]._id.toString(),
        creditsAdded: creditsToAdd,
        eurAmount,
        reason,
        verificationNotes,
      },
    });

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      message: `Successfully credited ${creditsToAdd} credits to user`,
      data: {
        transactionId: manualCreditTransaction[0]._id,
        originalTransactionId: transactionId,
        creditsAdded: creditsToAdd,
        eurAmount,
        newBalance: balanceAfter,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error completing manual deposit:', error);
    return NextResponse.json(
      { error: 'Failed to process manual deposit credit' },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}

/**
 * GET - Get details for manual completion review
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: transactionId } = await context.params;

    await connectToDatabase();

    const transaction = await WalletTransaction.findById(transactionId).lean();
    
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Get user info
    const usersCollection = mongoose.connection.collection('users');
    const user = await usersCollection.findOne(
      { id: transaction.userId },
      { projection: { name: 1, email: 1, id: 1 } }
    );

    // Check if already manually resolved
    const existingManualCredit = await WalletTransaction.findOne({
      'metadata.originalTransactionId': transactionId,
      transactionType: 'manual_deposit_credit',
    }).lean();

    return NextResponse.json({
      transaction: {
        ...transaction,
        user: user || { name: 'Unknown', email: 'Unknown' },
      },
      alreadyResolved: !!existingManualCredit,
      manualCreditTransaction: existingManualCredit || null,
    });
  } catch (error) {
    console.error('Error fetching deposit details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deposit details' },
      { status: 500 }
    );
  }
}

