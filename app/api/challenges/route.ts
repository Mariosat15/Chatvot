import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import Challenge from '@/database/models/trading/challenge.model';
import ChallengeSettings from '@/database/models/trading/challenge-settings.model';
import ChallengeParticipant from '@/database/models/trading/challenge-participant.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import UserPresence from '@/database/models/user-presence.model';
import TradingRiskSettings from '@/database/models/trading-risk-settings.model';
import { getUserById } from '@/lib/utils/user-lookup';
import { nanoid } from 'nanoid';

// GET - Get user's challenges
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type'); // 'sent', 'received', 'all'

    const query: any = {};

    // Filter by user
    if (type === 'sent') {
      query.challengerId = session.user.id;
    } else if (type === 'received') {
      query.challengedId = session.user.id;
    } else {
      query.$or = [
        { challengerId: session.user.id },
        { challengedId: session.user.id },
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    const challenges = await Challenge.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

// POST - Create a new challenge
export async function POST(request: NextRequest) {
  try {
    // Check for simulator mode
    const isSimulatorMode = request.headers.get('X-Simulator-Mode') === 'true';
    const simulatorUserId = request.headers.get('X-Simulator-User-Id');
    const isDev = process.env.NODE_ENV === 'development';
    
    let challengerId: string;
    let challengerName: string;
    let challengerEmail: string;
    
    const body = await request.json();
    const {
      challengedId,
      entryFee,
      duration, // in minutes
      startingCapital,
      assetClasses,
      rankingMethod,
      tieBreaker1,
      tieBreaker2,
      minimumTrades,
    } = body;
    
    if ((isSimulatorMode || simulatorUserId) && isDev) {
      // Simulator mode - accept challengerId from header or body
      const simUserId = simulatorUserId || body.challengerId;
      if (!simUserId) {
        return NextResponse.json({ error: 'challengerId required in simulator mode (X-Simulator-User-Id header or body.challengerId)' }, { status: 400 });
      }
      challengerId = simUserId;
      challengerName = `SimUser_${challengerId.slice(-6)}`;
      challengerEmail = `simuser_${challengerId.slice(-6)}@test.simulator`;
    } else {
      // Normal mode - require authentication
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      challengerId = session.user.id;
      challengerName = session.user.name || 'Unknown';
      challengerEmail = session.user.email || '';
    }

    await connectToDatabase();
    
    // Drop stale challengeCode index if it exists (from old schema)
    try {
      const indexes = await Challenge.collection.indexes();
      const hasStaleIndex = indexes.some((idx: any) => idx.name === 'challengeCode_1');
      if (hasStaleIndex) {
        await Challenge.collection.dropIndex('challengeCode_1');
        console.log('Dropped stale challengeCode_1 index');
      }
    } catch (indexError) {
      // Index might not exist - that's OK
    }

    // Get challenge settings and universal trading risk settings
    // Force fresh read by setting {new: true} context
    const settings = await ChallengeSettings.getSingleton();
    const tradingRiskSettings = await TradingRiskSettings.getSingleton();
    
    // Log current settings for debugging
    console.log('📋 Challenge settings loaded:', {
      challengeCooldownMinutes: settings.challengeCooldownMinutes,
      maxPendingChallenges: settings.maxPendingChallenges,
      maxActiveChallenges: settings.maxActiveChallenges
    });

    // Skip most validation in simulator mode
    const isInSimulatorMode = (isSimulatorMode || simulatorUserId) && isDev;
    if (!isInSimulatorMode) {
      // Validate challenges are enabled
      if (!settings.challengesEnabled) {
        return NextResponse.json(
          { error: 'Challenges are currently disabled' },
          { status: 400 }
        );
      }

      // Can't challenge yourself
      if (challengedId === challengerId) {
        return NextResponse.json(
          { error: 'You cannot challenge yourself' },
          { status: 400 }
        );
      }

      // Validate entry fee
      if (entryFee < settings.minEntryFee || entryFee > settings.maxEntryFee) {
        return NextResponse.json(
          { error: `Entry fee must be between ${settings.minEntryFee} and ${settings.maxEntryFee} credits` },
          { status: 400 }
        );
      }

      // Validate duration
      if (duration < settings.minDurationMinutes || duration > settings.maxDurationMinutes) {
        return NextResponse.json(
          { error: `Duration must be between ${settings.minDurationMinutes} and ${settings.maxDurationMinutes} minutes` },
          { status: 400 }
        );
      }

      // Check challenger's wallet balance
      const challengerWallet = await CreditWallet.findOne({ userId: challengerId });
      if (!challengerWallet || challengerWallet.creditBalance < entryFee) {
        return NextResponse.json(
          { error: 'Insufficient credits' },
          { status: 400 }
        );
      }

      // Check if challenged user exists and is online
      const challengedUser = await getUserById(challengedId);
      if (!challengedUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Check if challenged user is accepting challenges
      const challengedPresence = await UserPresence.findOne({ userId: challengedId });
      if (settings.requireBothOnline && (!challengedPresence || challengedPresence.status !== 'online')) {
        return NextResponse.json(
          { error: 'User is not online' },
          { status: 400 }
        );
      }

      if (challengedPresence && !challengedPresence.acceptingChallenges) {
        return NextResponse.json(
          { error: 'User is not accepting challenges' },
          { status: 400 }
        );
      }

      // Check pending challenges limit
      const pendingChallenges = await Challenge.countDocuments({
        challengerId,
        status: 'pending',
      });

      if (pendingChallenges >= settings.maxPendingChallenges) {
        return NextResponse.json(
          { error: `You have too many pending challenges (max: ${settings.maxPendingChallenges})` },
          { status: 400 }
        );
      }

      // Check active challenges limit
      const activeChallenges = await Challenge.countDocuments({
        $or: [
          { challengerId },
          { challengedId },
        ],
        status: 'active',
      });

      if (activeChallenges >= settings.maxActiveChallenges) {
        return NextResponse.json(
          { error: `You have too many active challenges (max: ${settings.maxActiveChallenges})` },
          { status: 400 }
        );
      }

      // Check cooldown with same user
      if (settings.challengeCooldownMinutes > 0) {
        const cooldownTime = new Date(Date.now() - settings.challengeCooldownMinutes * 60 * 1000);
        const recentChallenge = await Challenge.findOne({
          challengerId,
          challengedId,
          createdAt: { $gte: cooldownTime },
        });

        if (recentChallenge) {
          return NextResponse.json(
            { error: `Please wait ${settings.challengeCooldownMinutes} minutes before challenging this user again` },
            { status: 400 }
          );
        }
      }
    }

    // Calculate prize pool and fees
    const actualEntryFee = entryFee ?? 10;
    const prizePool = actualEntryFee * 2;
    const platformFeePercentage = settings.platformFeePercentage;
    const platformFeeAmount = Math.floor(prizePool * (platformFeePercentage / 100));
    const winnerPrize = prizePool - platformFeeAmount;

    // Get challenger info (skip in simulator mode - we already have it)
    if (!isInSimulatorMode) {
      const challengerUser = await getUserById(challengerId);
      if (challengerUser) {
        challengerName = challengerUser.name || challengerName;
        challengerEmail = challengerUser.email || challengerEmail;
      }
    }
    
    // Get challenged user name (use placeholder in simulator mode)
    let challengedName = `SimUser_${challengedId.slice(-6)}`;
    let challengedEmail = `simuser_${challengedId.slice(-6)}@test.simulator`;
    if (!isInSimulatorMode) {
      const challengedUser = await getUserById(challengedId);
      if (challengedUser) {
        challengedName = challengedUser.name || challengedName;
        challengedEmail = challengedUser.email || challengedEmail;
      }
    }
    
    // Generate unique slug
    const slug = `challenge-${nanoid(10)}`;

    // Create the challenge - uses universal TradingRiskSettings for trading rules
    const challenge = await Challenge.create({
      slug,
      challengerId,
      challengerName,
      challengerEmail,
      challengedId,
      challengedName,
      challengedEmail,
      entryFee: actualEntryFee,
      startingCapital: startingCapital || settings.defaultStartingCapital,
      prizePool,
      platformFeePercentage,
      platformFeeAmount,
      winnerPrize,
      acceptDeadline: new Date(Date.now() + settings.acceptDeadlineMinutes * 60 * 1000),
      duration,
      status: 'pending',
      assetClasses: assetClasses || settings.defaultAssetClasses,
      allowedSymbols: [],
      blockedSymbols: [],
      leverage: {
        enabled: tradingRiskSettings.maxLeverage > 1,
        min: tradingRiskSettings.minLeverage || 1,
        max: tradingRiskSettings.maxLeverage,
      },
      rules: {
        rankingMethod: rankingMethod || 'pnl',
        tieBreaker1: tieBreaker1 || 'trades_count',
        tieBreaker2: tieBreaker2 || undefined,
        minimumTrades: Math.max(1, minimumTrades || 1), // At least 1 trade required
        disqualifyOnLiquidation: true,
      },
      maxPositionSize: tradingRiskSettings.maxPositionSize,
      maxOpenPositions: tradingRiskSettings.maxOpenPositions,
      allowShortSelling: true, // Allow short selling by default
      marginCallThreshold: 50, // Default 50% - same as competitions
    });

    // Send notification to challenged user (skip in simulator mode)
    if (!isInSimulatorMode) {
      try {
        const { notificationService } = await import('@/lib/services/notification.service');
        await notificationService.send({
          userId: challengedId,
          templateId: 'challenge_received',
          metadata: {
            challengeId: challenge._id.toString(),
            challengerName: challenge.challengerName,
            entryFee: actualEntryFee,
            duration,
            winnerPrize,
          },
        });
      } catch (notifError) {
        console.error('Error sending challenge notification:', notifError);
      }
    }

    return NextResponse.json({
      success: true,
      challenge: {
        _id: challenge._id,
        slug: challenge.slug,
        challengedName: challenge.challengedName,
        entryFee: challenge.entryFee,
        duration: challenge.duration,
        winnerPrize: challenge.winnerPrize,
        acceptDeadline: challenge.acceptDeadline,
        status: challenge.status,
      },
    });
  } catch (error) {
    console.error('Error creating challenge:', error);
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}

