import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Challenge from '@/database/models/trading/challenge.model';
import ChallengeSettings from '@/database/models/trading/challenge-settings.model';
import TradingRiskSettings from '@/database/models/trading-risk-settings.model';
import { nanoid } from 'nanoid';

/**
 * POST /api/simulator/challenges
 * Bulk create challenges for the simulator
 * MUCH faster than creating one at a time (single DB roundtrip)
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
    const { challenges } = body;

    if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
      return NextResponse.json(
        { success: false, error: 'challenges array is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Get settings once for all challenges
    const [settings, tradingRiskSettings] = await Promise.all([
      ChallengeSettings.getSingleton(),
      TradingRiskSettings.getSingleton(),
    ]);

    // Prepare bulk insert documents
    const now = new Date();
    const challengeDocs = challenges.map((c: {
      challengerId: string;
      challengedId: string;
      entryFee?: number;
      duration?: number;
    }) => {
      const entryFee = c.entryFee ?? 10;
      const prizePool = entryFee * 2;
      const platformFeePercentage = settings.platformFeePercentage;
      const platformFeeAmount = Math.floor(prizePool * (platformFeePercentage / 100));
      const winnerPrize = prizePool - platformFeeAmount;

      return {
        slug: `sim-challenge-${nanoid(10)}`,
        challengerId: c.challengerId,
        challengerName: `SimUser_${c.challengerId.slice(-6)}`,
        challengerEmail: `simuser_${c.challengerId.slice(-6)}@test.simulator`,
        challengedId: c.challengedId,
        challengedName: `SimUser_${c.challengedId.slice(-6)}`,
        challengedEmail: `simuser_${c.challengedId.slice(-6)}@test.simulator`,
        entryFee,
        startingCapital: settings.defaultStartingCapital,
        prizePool,
        platformFeePercentage,
        platformFeeAmount,
        winnerPrize,
        acceptDeadline: new Date(now.getTime() + settings.acceptDeadlineMinutes * 60 * 1000),
        duration: c.duration ?? 30,
        status: 'pending',
        assetClasses: settings.defaultAssetClasses,
        allowedSymbols: [],
        blockedSymbols: [],
        leverage: {
          enabled: tradingRiskSettings.maxLeverage > 1,
          min: tradingRiskSettings.minLeverage || 1,
          max: tradingRiskSettings.maxLeverage,
        },
        rules: {
          rankingMethod: 'pnl',
          tieBreaker1: 'trades_count',
          minimumTrades: 1,
          disqualifyOnLiquidation: true,
        },
        maxPositionSize: tradingRiskSettings.maxPositionSize,
        maxOpenPositions: tradingRiskSettings.maxOpenPositions,
        allowShortSelling: true,
        marginCallThreshold: 50,
        createdAt: now,
        updatedAt: now,
      };
    });

    // Bulk insert - MUCH faster than individual creates
    const result = await Challenge.insertMany(challengeDocs, { ordered: false });

    return NextResponse.json({
      success: true,
      created: result.length,
      challenges: result.map(c => ({
        _id: c._id.toString(),
        challengerId: c.challengerId,
        challengedId: c.challengedId,
      })),
    });
  } catch (error) {
    console.error('Error bulk creating challenges:', error);
    
    // Handle partial success from unordered insert
    if (error instanceof Error && 'insertedDocs' in error) {
      const bulkError = error as Error & { insertedDocs: unknown[] };
      return NextResponse.json({
        success: true,
        created: bulkError.insertedDocs?.length || 0,
        error: 'Some challenges failed to create',
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create challenges' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/simulator/challenges
 * Delete simulator challenges
 */
export async function DELETE(request: NextRequest) {
  const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  if (!isSimulatorMode && !isDev) {
    return NextResponse.json(
      { success: false, error: 'Simulator mode not enabled' },
      { status: 403 }
    );
  }

  try {
    await connectToDatabase();

    // Delete challenges created by simulator (identified by slug prefix or email pattern)
    const result = await Challenge.deleteMany({
      $or: [
        { slug: { $regex: /^sim-challenge-/ } },
        { challengerEmail: { $regex: /@test\.simulator$/ } },
      ],
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting simulator challenges:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete challenges' },
      { status: 500 }
    );
  }
}

