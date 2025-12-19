import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';

/**
 * POST /api/simulator/payments/approve
 * Simulator endpoint to approve pending payments
 */
export async function POST(request: NextRequest) {
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (!isSimulatorMode && !isDev) {
    return NextResponse.json(
      { success: false, error: 'Simulator mode not enabled' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { transactionId, userId, amount } = body;

    await connectToDatabase();

    // If transactionId is provided, approve specific transaction
    if (transactionId) {
      const transaction = await WalletTransaction.findById(transactionId);
      if (!transaction) {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }

      if (transaction.status !== 'pending') {
        return NextResponse.json({
          success: true,
          message: 'Transaction already processed',
        });
      }

      // Update transaction status
      transaction.status = 'completed';
      transaction.processedAt = new Date();
      await transaction.save();

      // Update wallet balance
      const wallet = await CreditWallet.findOne({ userId: transaction.userId });
      if (wallet) {
        wallet.creditBalance += transaction.amount;
        wallet.totalDeposited += transaction.amount;
        await wallet.save();
      }

      return NextResponse.json({
        success: true,
        transactionId: transaction._id.toString(),
      });
    }

    // If userId and amount provided, create and approve a new transaction
    if (userId && amount) {
      let wallet = await CreditWallet.findOne({ userId });
      const balanceBefore = wallet?.creditBalance || 0;

      if (!wallet) {
        wallet = new CreditWallet({
          userId,
          creditBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          totalSpentOnCompetitions: 0,
          totalWonFromCompetitions: 0,
          totalSpentOnChallenges: 0,
          totalWonFromChallenges: 0,
          isActive: true,
          kycVerified: false,
          withdrawalEnabled: false,
        });
      }

      wallet.creditBalance += amount;
      wallet.totalDeposited += amount;
      await wallet.save();

      const transaction = new WalletTransaction({
        userId,
        transactionType: 'deposit',
        amount,
        balanceBefore,
        balanceAfter: wallet.creditBalance,
        currency: 'EUR',
        exchangeRate: 1,
        status: 'completed',
        description: 'Simulator approved payment',
        processedAt: new Date(),
        metadata: {
          simulatorMode: true,
          approvedBy: 'simulator',
        },
      });
      await transaction.save();

      return NextResponse.json({
        success: true,
        transactionId: transaction._id.toString(),
        newBalance: wallet.creditBalance,
      });
    }

    // Approve all pending transactions
    const pendingTransactions = await WalletTransaction.find({ status: 'pending' });
    let approvedCount = 0;

    for (const transaction of pendingTransactions) {
      transaction.status = 'completed';
      transaction.processedAt = new Date();
      await transaction.save();

      const wallet = await CreditWallet.findOne({ userId: transaction.userId });
      if (wallet && transaction.amount > 0) {
        wallet.creditBalance += transaction.amount;
        wallet.totalDeposited += transaction.amount;
        await wallet.save();
      }
      approvedCount++;
    }

    return NextResponse.json({
      success: true,
      approvedCount,
    });
  } catch (error) {
    console.error('Simulator payment approval error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

