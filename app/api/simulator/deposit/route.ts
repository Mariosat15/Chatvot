import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';

/**
 * POST /api/simulator/deposit
 * Simulator endpoint to add credits to a user's wallet
 */
export async function POST(request: NextRequest) {
  // Only allow in development or with simulator mode header
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
    const { userId, amount } = body;

    if (!userId || amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'userId and amount are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Start MongoDB transaction for atomic operations
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
      // Find or create wallet
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

      // Add credits
      wallet.creditBalance += amount;
      wallet.totalDeposited += amount;
      await wallet.save({ session: mongoSession });

      // Create transaction record
      const [transaction] = await WalletTransaction.create([{
        userId,
        transactionType: 'deposit',
        amount,
        balanceBefore,
        balanceAfter: wallet.creditBalance,
        currency: 'EUR',
        exchangeRate: 1,
        status: 'completed',
        description: 'Simulator deposit',
        processedAt: new Date(),
        metadata: {
          simulatorMode: true,
        },
      }], { session: mongoSession });

      // Commit transaction
      await mongoSession.commitTransaction();
      mongoSession.endSession();

      // Trigger badge evaluation after deposit
      console.log(`🏅 Triggering badge evaluation for user ${userId} after simulator deposit...`);
      try {
        const { evaluateUserBadges } = await import('@/lib/services/badge-evaluation.service');
        const result = await evaluateUserBadges(userId);
        if (result.newBadges.length > 0) {
          console.log(`🏅 User earned ${result.newBadges.length} new badges after simulator deposit`);
        }
      } catch (badgeError) {
        console.error('❌ Error evaluating badges after simulator deposit:', badgeError);
      }

      return NextResponse.json({
        success: true,
        wallet: {
          balance: wallet.creditBalance,
        },
        transactionId: transaction._id.toString(),
      });
    } catch (txError) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
      throw txError;
    }
  } catch (error) {
    console.error('Simulator deposit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
