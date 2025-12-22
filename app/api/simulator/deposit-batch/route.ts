import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';

/**
 * POST /api/simulator/deposit-batch
 * Batch deposit to multiple users at once (MUCH faster than individual deposits)
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
    const { deposits } = body;

    if (!deposits || !Array.isArray(deposits)) {
      return NextResponse.json(
        { success: false, error: 'deposits array required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const userIds = deposits.map((d: { userId: string }) => d.userId);
    
    // Fetch all wallets in one query
    const existingWallets = await CreditWallet.find({ userId: { $in: userIds } }).lean();
    const walletMap = new Map(existingWallets.map(w => [w.userId, w]));

    // Prepare bulk operations
    const walletOps: any[] = [];
    const transactionDocs: any[] = [];

    for (const deposit of deposits) {
      const { userId, amount } = deposit;
      if (!userId || amount === undefined) continue;

      const existingWallet = walletMap.get(userId);
      const balanceBefore = existingWallet?.creditBalance || 0;
      const balanceAfter = balanceBefore + amount;

      if (existingWallet) {
        // Update existing wallet
        walletOps.push({
          updateOne: {
            filter: { userId },
            update: { 
              $inc: { creditBalance: amount, totalDeposited: amount } 
            },
          },
        });
      } else {
        // Create new wallet
        walletOps.push({
          updateOne: {
            filter: { userId },
            update: {
              $setOnInsert: {
                userId,
                totalWithdrawn: 0,
                totalSpentOnCompetitions: 0,
                totalWonFromCompetitions: 0,
                totalSpentOnChallenges: 0,
                totalWonFromChallenges: 0,
                isActive: true,
                kycVerified: false,
                withdrawalEnabled: false,
              },
              $inc: { creditBalance: amount, totalDeposited: amount },
            },
            upsert: true,
          },
        });
      }

      // Prepare transaction document
      transactionDocs.push({
        userId,
        transactionType: 'deposit',
        amount,
        balanceBefore,
        balanceAfter,
        currency: 'EUR',
        exchangeRate: 1,
        status: 'completed',
        description: 'Simulator deposit',
        processedAt: new Date(),
        metadata: { simulatorMode: true },
      });
    }

    // Execute bulk operations in parallel
    const [walletResult] = await Promise.all([
      walletOps.length > 0 ? CreditWallet.bulkWrite(walletOps, { ordered: false }) : null,
      transactionDocs.length > 0 ? WalletTransaction.insertMany(transactionDocs, { ordered: false }) : null,
    ]);

    return NextResponse.json({
      success: true,
      processed: deposits.length,
      walletsModified: walletResult?.modifiedCount || 0,
      walletsCreated: walletResult?.upsertedCount || 0,
    });
  } catch (error) {
    console.error('Simulator batch deposit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

