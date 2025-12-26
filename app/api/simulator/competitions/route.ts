import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';

/**
 * POST /api/simulator/competitions
 * Simulator endpoint to create competitions
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
    const { 
      name,
      description,
      entryFee = 10,
      prizePool = 1000,
      maxParticipants = 100,
      startDate,
      endDate,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const startTime = startDate ? new Date(startDate) : new Date(Date.now() + 5 * 60 * 1000); // 5 min from now
    const endTime = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const competition = new Competition({
      name,
      description: description || `Simulator competition: ${name}`,
      slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      
      // Entry & Capital
      entryFee: 0, // Free for simulator tests
      startingCapital: 10000,
      minParticipants: 2,
      maxParticipants,
      currentParticipants: 0,
      
      // Timing
      startTime,
      endTime,
      registrationDeadline: startTime,
      
      // Status
      status: 'upcoming',
      
      // Trading Rules
      assetClasses: ['forex'],
      allowedSymbols: [],
      blockedSymbols: [],
      leverage: {
        enabled: true,
        min: 1,
        max: 100,
        default: 50,
      },
      
      // Competition Type
      competitionType: 'time_based',
      
      // Prize Distribution
      prizePool,
      platformFeePercentage: 10,
      prizeDistribution: [
        { rank: 1, percentage: 50 },
        { rank: 2, percentage: 30 },
        { rank: 3, percentage: 20 },
      ],
      
      // Rules
      rules: {
        rankingMethod: 'pnl',
        tieBreaker1: 'trades_count',
        minimumTrades: 1,
        tiePrizeDistribution: 'split_equally',
        disqualifyOnLiquidation: false,
      },
      
      // Level Requirements
      levelRequirement: {
        enabled: false,
        minLevel: 1,
      },
      
      // Restrictions
      maxPositionSize: 100,
      maxOpenPositions: 10,
      allowShortSelling: true,
      marginCallThreshold: 50,
      
      // Risk Limits
      riskLimits: {
        maxDrawdownPercent: 50,
        dailyLossLimitPercent: 20,
        equityDrawdownPercent: 50,
        equityCheckEnabled: false,
        enabled: false,
      },
      
      // Admin
      createdBy: 'simulator',
      
      // Metadata
      metadata: {
        simulatorMode: true,
      },
    });

    await competition.save();

    return NextResponse.json({
      success: true,
      competition: {
        _id: competition._id.toString(),
        name: competition.name,
        status: competition.status,
      },
    });
  } catch (error) {
    console.error('Simulator competition creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
