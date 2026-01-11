import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
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

    // Start MongoDB transaction for atomic operations
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // If transactionId is provided, approve specific transaction
      if (transactionId) {
        const transaction = await WalletTransaction.findById(transactionId).session(mongoSession);
        if (!transaction) {
          await mongoSession.abortTransaction();
          mongoSession.endSession();
          return NextResponse.json(
            { success: false, error: 'Transaction not found' },
            { status: 404 }
          );
        }

        if (transaction.status !== 'pending') {
          await mongoSession.abortTransaction();
          mongoSession.endSession();
          return NextResponse.json({
            success: true,
            message: 'Transaction already processed',
          });
        }

        // Update transaction status
        transaction.status = 'completed';
        transaction.processedAt = new Date();
        await transaction.save({ session: mongoSession });

        // Update wallet balance
        const wallet = await CreditWallet.findOne({ userId: transaction.userId }).session(mongoSession);
        if (wallet) {
          wallet.creditBalance += transaction.amount;
          wallet.totalDeposited += transaction.amount;
          await wallet.save({ session: mongoSession });
        }

        await mongoSession.commitTransaction();
        mongoSession.endSession();

        // Trigger badge evaluation for the depositing user
        try {
          const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
          await evaluateUserBadges(transaction.userId);
        } catch (badgeError) {
          console.error('Error evaluating badges:', badgeError);
        }

        return NextResponse.json({
          success: true,
          transactionId: transaction._id.toString(),
        });
      }

      // If userId and amount provided, create and approve a new transaction
      if (userId && amount) {
        let wallet = await CreditWallet.findOne({ userId }).session(mongoSession);
        const balanceBefore = wallet?.creditBalance || 0;

        if (!wallet) {
          [wallet] = await CreditWallet.create([{
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
          }], { session: mongoSession });
        }

        wallet.creditBalance += amount;
        wallet.totalDeposited += amount;
        await wallet.save({ session: mongoSession });

        const [transaction] = await WalletTransaction.create([{
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
        }], { session: mongoSession });

        await mongoSession.commitTransaction();
        mongoSession.endSession();

        // Trigger badge evaluation
        try {
          const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
          await evaluateUserBadges(userId);
        } catch (badgeError) {
          console.error('Error evaluating badges:', badgeError);
        }

        return NextResponse.json({
          success: true,
          transactionId: transaction._id.toString(),
          newBalance: wallet.creditBalance,
        });
      }

      // Approve all pending transactions (each in its own mini-transaction for safety)
      const pendingTransactions = await WalletTransaction.find({ status: 'pending' }).session(mongoSession);
      let approvedCount = 0;

      for (const transaction of pendingTransactions) {
        transaction.status = 'completed';
        transaction.processedAt = new Date();
        await transaction.save({ session: mongoSession });

        const wallet = await CreditWallet.findOne({ userId: transaction.userId }).session(mongoSession);
        if (wallet && transaction.amount > 0) {
          wallet.creditBalance += transaction.amount;
          wallet.totalDeposited += transaction.amount;
          await wallet.save({ session: mongoSession });
        }
        approvedCount++;
      }

      await mongoSession.commitTransaction();
      mongoSession.endSession();

      // Trigger badge evaluation for all users who had transactions approved
      const uniqueUserIds = [...new Set(pendingTransactions.map(t => t.userId))];
      for (const uid of uniqueUserIds) {
        try {
          const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
          await evaluateUserBadges(uid);
        } catch (badgeError) {
          console.error(`Error evaluating badges for user ${uid}:`, badgeError);
        }
      }

      return NextResponse.json({
        success: true,
        approvedCount,
      });
    } catch (txError) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
      throw txError;
    }
  } catch (error) {
    console.error('Simulator payment approval error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

