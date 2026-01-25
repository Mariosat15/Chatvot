import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import GameMasterSubscription from '@/database/models/gamemaster/gamemaster-subscription.model';

/**
 * GET /api/gamemaster/competitions
 * Get competitions created by this Game Master
 */
export async function GET() {
  try {
    await connectToDatabase();
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 500 });
    }

    // Check if user is a Game Master
    const subscription = await GameMasterSubscription.findOne({ userId, status: 'active' });
    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Not a Game Master' }, { status: 403 });
    }

    // Get competitions created by this Game Master
    const competitions = await db.collection('competitions')
      .find({ gameMasterId: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      competitions: competitions.map(c => ({
        id: c._id.toString(),
        name: c.name,
        status: c.status,
        entryFee: c.entryFee,
        prizePool: c.prizePool,
        currentParticipants: c.currentParticipants || 0,
        maxParticipants: c.maxParticipants,
        startTime: c.startTime,
        endTime: c.endTime,
        createdAt: c.createdAt,
      })),
      limits: {
        maxCompetitionsPerDay: subscription.limits.maxCompetitionsPerDay,
        maxUsersPerCompetition: subscription.limits.maxUsersPerCompetition,
        currentPeriodCreated: subscription.currentPeriodCompetitionsCreated,
        remaining: subscription.limits.maxCompetitionsPerDay - subscription.currentPeriodCompetitionsCreated,
      },
    });
  } catch (error) {
    console.error('Error fetching GM competitions:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gamemaster/competitions
 * Create a new competition as Game Master
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    
    const {
      name,
      description,
      entryFee,
      startingCapital,
      minParticipants,
      maxParticipants,
      startTime,
      endTime,
      leverage,
      platformFeePercentage,
      assetClasses,
      prizeDistribution,
      rules,
      levelRequirement,
      riskLimits,
      difficulty,
    } = body;

    // Validate required fields
    if (!name || !entryFee || !startingCapital || !maxParticipants || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 500 });
    }

    // Get subscription to check limits
    const subscription = await db.collection('gamemastersubscriptions').findOne({
      userId,
      status: 'active',
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'No active Game Master subscription' },
        { status: 403 }
      );
    }

    // Check if subscription is expired
    if (new Date(subscription.endDate) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Your Game Master subscription has expired' },
        { status: 403 }
      );
    }

    // Check if GM is allowed to create competitions
    // Override takes precedence, then falls back to package setting
    // Check if GM can create competitions (based on package setting)
    if (subscription.limits?.canCreateCompetitions === false) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Your package does not allow competition creation. Upgrade your package to create competitions.' 
        },
        { status: 403 }
      );
    }

    // Use package limits directly
    const effectiveMaxCompetitionsPerDay = subscription.limits?.maxCompetitionsPerDay || 1;
    const effectiveMaxUsersPerCompetition = subscription.limits?.maxUsersPerCompetition || 50;

    // Check daily competition limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastResetDate = new Date(subscription.lastCompetitionResetDate);
    lastResetDate.setHours(0, 0, 0, 0);
    
    // Reset daily counter if it's a new day
    if (today > lastResetDate) {
      await db.collection('gamemastersubscriptions').updateOne(
        { _id: subscription._id },
        { 
          $set: { 
            currentPeriodCompetitionsCreated: 0,
            lastCompetitionResetDate: new Date(),
          }
        }
      );
      subscription.currentPeriodCompetitionsCreated = 0;
    }

    // Check if limit reached
    if (subscription.currentPeriodCompetitionsCreated >= effectiveMaxCompetitionsPerDay) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Daily limit reached. You can create ${effectiveMaxCompetitionsPerDay} competition(s) per day.` 
        },
        { status: 403 }
      );
    }

    // Check max participants limit
    const effectiveMaxParticipants = Math.min(
      parseInt(maxParticipants),
      effectiveMaxUsersPerCompetition
    );

    // Calculate prize pool
    const entryFeeNum = parseFloat(entryFee);
    const platformFee = platformFeePercentage || 10;
    const estimatedPrizePool = effectiveMaxParticipants * entryFeeNum * (1 - platformFee / 100);

    // Build allowed symbols based on asset classes
    const allowedSymbols: string[] = [];
    const assetClassesArray: string[] = [];
    
    // Handle both array and object format for assetClasses
    if (Array.isArray(assetClasses)) {
      if (assetClasses.includes('forex')) {
        allowedSymbols.push('EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD');
        assetClassesArray.push('forex');
      }
      if (assetClasses.includes('crypto')) {
        allowedSymbols.push('BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD');
        assetClassesArray.push('crypto');
      }
      if (assetClasses.includes('stocks')) {
        allowedSymbols.push('AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN');
        assetClassesArray.push('stocks');
      }
    } else {
      if (assetClasses?.forex !== false) {
        allowedSymbols.push('EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD');
        assetClassesArray.push('forex');
      }
      if (assetClasses?.crypto) {
        allowedSymbols.push('BTC/USD', 'ETH/USD', 'XRP/USD', 'SOL/USD');
        assetClassesArray.push('crypto');
      }
      if (assetClasses?.stocks) {
        allowedSymbols.push('AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN');
        assetClassesArray.push('stocks');
      }
    }

    // Default rules if not provided
    const defaultRules = {
      rankingMethod: 'pnl',
      tieBreaker1: 'trades_count',
      minimumTrades: 1,
      disqualifyOnLiquidation: true,
      tiePrizeDistribution: 'split_equally',
    };

    // Create competition
    const competition = {
      _id: new ObjectId(),
      name,
      description: description || '',
      status: 'upcoming',
      entryFee: entryFeeNum,
      startingCapital: parseFloat(startingCapital),
      prizePool: estimatedPrizePool,
      minParticipants: parseInt(minParticipants) || 2,
      maxParticipants: effectiveMaxParticipants,
      currentParticipants: 0,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      registrationDeadline: new Date(startTime),
      allowedSymbols: allowedSymbols.length > 0 ? allowedSymbols : ['EUR/USD', 'GBP/USD', 'USD/JPY'],
      assetClasses: assetClassesArray.length > 0 ? assetClassesArray : ['forex'],
      leverage: leverage || 30,
      platformFeePercentage: platformFee,
      prizeDistribution: prizeDistribution || [
        { rank: 1, percentage: 70 },
        { rank: 2, percentage: 20 },
        { rank: 3, percentage: 10 },
      ],
      // Game Master fields
      gameMasterId: userId,
      gameMasterName: session.user.name || 'Game Master',
      createdBy: userId,
      // Competition rules (use provided or defaults)
      rules: rules ? {
        rankingMethod: rules.rankingMethod || defaultRules.rankingMethod,
        tieBreaker1: rules.tieBreaker1 || defaultRules.tieBreaker1,
        tieBreaker2: rules.tieBreaker2,
        minimumTrades: rules.minimumTrades ?? defaultRules.minimumTrades,
        minimumWinRate: rules.minimumWinRate,
        disqualifyOnLiquidation: rules.disqualifyOnLiquidation ?? defaultRules.disqualifyOnLiquidation,
        tiePrizeDistribution: rules.tiePrizeDistribution || defaultRules.tiePrizeDistribution,
      } : defaultRules,
      // Level requirement
      levelRequirement: levelRequirement?.enabled ? {
        enabled: true,
        minLevel: levelRequirement.minLevel || 1,
        maxLevel: levelRequirement.maxLevel,
      } : { enabled: false },
      // Risk limits
      riskLimits: riskLimits?.enabled ? {
        enabled: true,
        maxDrawdownPercent: riskLimits.maxDrawdownPercent || 50,
        dailyLossLimitPercent: riskLimits.dailyLossLimitPercent || 20,
        equityCheckEnabled: riskLimits.equityCheckEnabled || false,
        equityDrawdownPercent: riskLimits.equityDrawdownPercent || 30,
      } : { enabled: false },
      // Difficulty setting
      difficulty: difficulty ? {
        mode: difficulty.mode || 'auto',
        manualLevel: difficulty.manualLevel,
      } : { mode: 'auto' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('competitions').insertOne(competition);

    // Update subscription counters
    await db.collection('gamemastersubscriptions').updateOne(
      { _id: subscription._id },
      { 
        $inc: { 
          currentPeriodCompetitionsCreated: 1,
          totalCompetitionsCreated: 1,
        },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({
      success: true,
      competition: {
        id: competition._id.toString(),
        name: competition.name,
        status: competition.status,
        startTime: competition.startTime,
        endTime: competition.endTime,
        entryFee: competition.entryFee,
        prizePool: competition.prizePool,
        maxParticipants: competition.maxParticipants,
      },
      limits: {
        dailyRemaining: effectiveMaxCompetitionsPerDay - subscription.currentPeriodCompetitionsCreated - 1,
        maxParticipants: effectiveMaxUsersPerCompetition,
      },
      message: 'Competition created successfully!',
    });
  } catch (error) {
    console.error('Error creating competition:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
