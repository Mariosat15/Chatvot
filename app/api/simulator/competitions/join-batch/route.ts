import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';

/**
 * POST /api/simulator/competitions/join-batch
 * Batch join multiple users to a competition (MUCH faster than individual joins)
 * Only for simulator mode in development
 */
export async function POST(request: NextRequest) {
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (!isSimulatorMode || !isDev) {
    return NextResponse.json(
      { success: false, error: 'Only available in simulator mode' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { competitionId, userIds } = body;

    if (!competitionId || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json(
        { success: false, error: 'competitionId and userIds array required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get competition details
    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return NextResponse.json(
        { success: false, error: 'Competition not found' },
        { status: 404 }
      );
    }

    if (competition.status !== 'upcoming' && competition.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Competition is not accepting participants' },
        { status: 400 }
      );
    }

    // Check who is already joined
    const existingParticipants = await CompetitionParticipant.find({
      competitionId,
      userId: { $in: userIds },
    }).lean();
    const alreadyJoinedSet = new Set(existingParticipants.map(p => p.userId));
    
    // Filter to only new users
    const newUserIds = userIds.filter((id: string) => !alreadyJoinedSet.has(id));
    
    if (newUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        joined: 0,
        alreadyJoined: userIds.length,
        message: 'All users already joined',
      });
    }

    // Check available spots
    const availableSpots = competition.maxParticipants - competition.currentParticipants;
    const usersToJoin = newUserIds.slice(0, availableSpots);

    if (usersToJoin.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Competition is full',
      }, { status: 400 });
    }

    const entryFee = competition.entryFee || 0;
    const now = new Date();

    // If there's an entry fee, handle wallet operations
    if (entryFee > 0) {
      // Get all wallets in one query
      const wallets = await CreditWallet.find({ userId: { $in: usersToJoin } }).lean();
      const walletMap = new Map(wallets.map(w => [w.userId, w]));

      // Filter users with sufficient balance
      const usersWithBalance = usersToJoin.filter((userId: string) => {
        const wallet = walletMap.get(userId);
        return wallet && wallet.creditBalance >= entryFee;
      });

      if (usersWithBalance.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No users have sufficient balance',
        }, { status: 400 });
      }

      // Bulk update wallets
      const walletOps = usersWithBalance.map((userId: string) => ({
        updateOne: {
          filter: { userId },
          update: {
            $inc: { 
              creditBalance: -entryFee, 
              totalSpentOnCompetitions: entryFee 
            },
          },
        },
      }));

      // Create transactions
      const transactions = usersWithBalance.map((userId: string) => {
        const wallet = walletMap.get(userId);
        return {
          userId,
          transactionType: 'competition_entry',
          amount: -entryFee,
          balanceBefore: wallet?.creditBalance || 0,
          balanceAfter: (wallet?.creditBalance || 0) - entryFee,
          currency: 'EUR',
          exchangeRate: 1,
          status: 'completed',
          competitionId,
          description: `Entry fee for ${competition.name}`,
          processedAt: now,
          metadata: { simulatorMode: true },
        };
      });

      // Create participants
      const participants = usersWithBalance.map((userId: string) => ({
        competitionId,
        userId,
        username: `SimUser_${userId.slice(-6)}`,
        email: `simuser_${userId.slice(-6)}@test.simulator`,
        startingCapital: competition.startingCapital,
        currentCapital: competition.startingCapital,
        availableCapital: competition.startingCapital,
        pnl: 0,
        pnlPercent: 0,
        unrealizedPnl: 0,
        currentPnl: 0,
        currentPnlPercent: 0,
        tradesCount: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        status: 'active',
        joinedAt: now,
      }));

      // Execute all operations in parallel
      await Promise.all([
        CreditWallet.bulkWrite(walletOps, { ordered: false }),
        WalletTransaction.insertMany(transactions, { ordered: false }),
        CompetitionParticipant.insertMany(participants, { ordered: false }),
        Competition.findByIdAndUpdate(competitionId, {
          $inc: { currentParticipants: usersWithBalance.length },
        }),
      ]);

      return NextResponse.json({
        success: true,
        joined: usersWithBalance.length,
        alreadyJoined: alreadyJoinedSet.size,
        insufficientBalance: usersToJoin.length - usersWithBalance.length,
      });
    } else {
      // No entry fee - just create participants
      const participants = usersToJoin.map((userId: string) => ({
        competitionId,
        userId,
        username: `SimUser_${userId.slice(-6)}`,
        email: `simuser_${userId.slice(-6)}@test.simulator`,
        startingCapital: competition.startingCapital,
        currentCapital: competition.startingCapital,
        availableCapital: competition.startingCapital,
        pnl: 0,
        pnlPercent: 0,
        unrealizedPnl: 0,
        currentPnl: 0,
        currentPnlPercent: 0,
        tradesCount: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        status: 'active',
        joinedAt: now,
      }));

      await Promise.all([
        CompetitionParticipant.insertMany(participants, { ordered: false }),
        Competition.findByIdAndUpdate(competitionId, {
          $inc: { currentParticipants: usersToJoin.length },
        }),
      ]);

      return NextResponse.json({
        success: true,
        joined: usersToJoin.length,
        alreadyJoined: alreadyJoinedSet.size,
      });
    }
  } catch (error) {
    console.error('Batch competition join error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

