import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import WalletTransaction from '@/database/models/trading/wallet-transaction.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

/**
 * POST /api/competitions/[id]/join
 * Join a competition
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: competitionId } = await context.params;
    
    // Check for simulator mode first
    const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
    const simulatorUserId = request.headers.get('X-Simulator-User-Id');
    const isDev = process.env.NODE_ENV === 'development';
    
    let userId: string;
    let userEmail: string;
    let userName: string;
    
    if ((isSimulatorMode || simulatorUserId) && isDev) {
      // In simulator mode, accept userId from header or body
      let bodyUserId: string | undefined;
      try {
        const body = await request.json();
        bodyUserId = body.userId;
      } catch {
        // No body or invalid JSON
      }
      
      const simUserId = simulatorUserId || bodyUserId;
      if (!simUserId) {
        return NextResponse.json(
          { success: false, error: 'userId required in simulator mode (X-Simulator-User-Id header or body.userId)' },
          { status: 400 }
        );
      }
      userId = simUserId;
      userEmail = `simuser_${userId.slice(-6)}@test.simulator`;
      userName = `SimUser_${userId.slice(-6)}`;
    } else {
      // Normal mode - require authentication
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = session.user.id;
      userEmail = session.user.email || '';
      userName = session.user.name || 'Unknown';
    }

    await connectToDatabase();

    // Check if competition exists and is joinable
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

    if (competition.currentParticipants >= competition.maxParticipants) {
      return NextResponse.json(
        { success: false, error: 'Competition is full' },
        { status: 400 }
      );
    }

    // Check if already joined
    const existingParticipant = await CompetitionParticipant.findOne({
      competitionId,
      userId,
    });

    if (existingParticipant) {
      return NextResponse.json({
        success: true,
        message: 'Already joined',
        participantId: existingParticipant._id.toString(),
      });
    }

    // Check and deduct entry fee
    if (competition.entryFee > 0) {
      const wallet = await CreditWallet.findOne({ userId });
      if (!wallet || wallet.creditBalance < competition.entryFee) {
        return NextResponse.json(
          { success: false, error: 'Insufficient balance' },
          { status: 400 }
        );
      }

      const balanceBefore = wallet.creditBalance;
      wallet.creditBalance -= competition.entryFee;
      wallet.totalSpentOnCompetitions += competition.entryFee;
      await wallet.save();

      // Record transaction
      const transaction = new WalletTransaction({
        userId,
        transactionType: 'competition_entry',
        amount: -competition.entryFee,
        balanceBefore,
        balanceAfter: wallet.creditBalance,
        currency: 'EUR',
        exchangeRate: 1,
        status: 'completed',
        competitionId,
        description: `Entry fee for ${competition.name}`,
        processedAt: new Date(),
      });
      await transaction.save();
    }

    // Create participant
    const participant = new CompetitionParticipant({
      competitionId,
      userId,
      username: userName,
      email: userEmail,
      startingCapital: competition.startingCapital,
      currentCapital: competition.startingCapital,
      availableCapital: competition.startingCapital,
      usedMargin: 0,
      pnl: 0,
      pnlPercentage: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      currentOpenPositions: 0,
      maxDrawdown: 0,
      maxDrawdownPercentage: 0,
      currentRank: 0,
      highestRank: 0,
      status: 'active',
      marginCallWarnings: 0,
      enteredAt: new Date(),
    });

    await participant.save();

    // Update competition participant count
    await Competition.findByIdAndUpdate(competitionId, {
      $inc: { currentParticipants: 1 },
    });

    return NextResponse.json({
      success: true,
      participantId: participant._id.toString(),
      competition: {
        name: competition.name,
        startingCapital: competition.startingCapital,
      },
    });
  } catch (error) {
    console.error('Competition join error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

