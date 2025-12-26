import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import WithdrawalRequest from '@/database/models/withdrawal-request.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';

/**
 * POST /api/wallet/withdraw/[id]/cancel
 * Cancel a pending withdrawal request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await connectToDatabase();

    const withdrawal = await WithdrawalRequest.findById(id).session(mongoSession);

    if (!withdrawal) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Withdrawal request not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (withdrawal.userId !== session.user.id) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Can only cancel pending requests
    if (withdrawal.status !== 'pending') {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: `Cannot cancel withdrawal with status: ${withdrawal.status}` },
        { status: 400 }
      );
    }

    // Refund credits to wallet
    const wallet = await CreditWallet.findOne({ userId: session.user.id }).session(mongoSession);
    if (!wallet) {
      await mongoSession.abortTransaction();
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const balanceBefore = wallet.creditBalance;
    wallet.creditBalance += withdrawal.amountCredits;
    await wallet.save({ session: mongoSession });

    // Update withdrawal status
    withdrawal.status = 'cancelled';
    withdrawal.rejectionReason = 'Cancelled by user';
    withdrawal.walletBalanceAfter = wallet.creditBalance;
    await withdrawal.save({ session: mongoSession });

    // Record refund transaction
    await WalletTransaction.create(
      [{
        userId: session.user.id,
        transactionType: 'admin_adjustment',
        amount: withdrawal.amountCredits,
        balanceBefore,
        balanceAfter: wallet.creditBalance,
        currency: 'EUR',
        exchangeRate: withdrawal.exchangeRate,
        status: 'completed',
        description: 'Withdrawal request cancelled - credits refunded',
        metadata: {
          withdrawalRequestId: withdrawal._id,
        },
        processedAt: new Date(),
      }],
      { session: mongoSession }
    );

    await mongoSession.commitTransaction();

    return NextResponse.json({
      success: true,
      message: 'Withdrawal request cancelled. Credits have been refunded.',
      refundedCredits: withdrawal.amountCredits,
      newBalance: wallet.creditBalance,
    });
  } catch (error) {
    await mongoSession.abortTransaction();
    console.error('Error cancelling withdrawal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel withdrawal' },
      { status: 500 }
    );
  } finally {
    mongoSession.endSession();
  }
}

