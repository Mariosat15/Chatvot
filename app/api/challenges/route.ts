import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase, withTimeout } from '@/database/mongoose';
import Challenge from '@/database/models/trading/challenge.model';
import ChallengeSettings from '@/database/models/trading/challenge-settings.model';
import CreditWallet from '@/database/models/trading/credit-wallet.model';
import UserPresence from '@/database/models/user-presence.model';
import TradingRiskSettings from '@/database/models/trading-risk-settings.model';
import { getUserById } from '@/lib/utils/user-lookup';
import { nanoid } from 'nanoid';
import { trackTiming, errorResponse } from '@/lib/utils/api-utils';

// Request timeout for this route (5 seconds)
const REQUEST_TIMEOUT_MS = 5000;
// Individual DB operation timeout (3 seconds)
const DB_TIMEOUT_MS = 3000;

// GET - Get user's challenges
export async function GET(request: NextRequest) {
  const timing = trackTiming('GET /api/challenges');
  
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type'); // 'sent', 'received', 'all'

    const query: Record<string, unknown> = {};

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

    // PERFORMANCE: Add timeout to prevent long-running queries
    const challenges = await withTimeout(
      Challenge.find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec(),
      DB_TIMEOUT_MS,
      'Challenge.find'
    );

    timing.end(200);
    return NextResponse.json({ challenges });
  } catch (error) {
    timing.end(0); // Log any slow request
    
    // Handle timeout specifically
    if (error instanceof Error && error.message.includes('timed out')) {
      console.error('⏱️ Challenge GET timeout:', error.message);
      return errorResponse('Request timeout - please try again', 504, error);
    }
    
    console.error('Error fetching challenges:', error);
    return errorResponse('Failed to fetch challenges', 500, error);
  }
}

// POST - Create a new challenge
export async function POST(request: NextRequest) {
  const timing = trackTiming('POST /api/challenges');
  
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
    
    // VALIDATION: Early check for required fields
    if (!challengedId) {
      return errorResponse('challengedId is required', 400);
    }
    
    if ((isSimulatorMode || simulatorUserId) && isDev) {
      // Simulator mode - accept challengerId from header or body
      const simUserId = simulatorUserId || body.challengerId;
      if (!simUserId) {
        return errorResponse('challengerId required in simulator mode (X-Simulator-User-Id header or body.challengerId)', 400);
      }
      challengerId = simUserId;
      challengerName = `SimUser_${challengerId.slice(-6)}`;
      challengerEmail = `simuser_${challengerId.slice(-6)}@test.simulator`;
    } else {
      // Normal mode - require authentication
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user?.id) {
        return errorResponse('Unauthorized', 401);
      }
      challengerId = session.user.id;
      challengerName = session.user.name || 'Unknown';
      challengerEmail = session.user.email || '';
    }

    await connectToDatabase();

    // PERFORMANCE: Batch fetch settings in parallel with timeout (saves ~100ms)
    const [settings, tradingRiskSettings] = await withTimeout(
      Promise.all([
        ChallengeSettings.getSingleton(),
        TradingRiskSettings.getSingleton(),
      ]),
      DB_TIMEOUT_MS,
      'Settings fetch'
    );

    // Skip most validation in simulator mode
    const isInSimulatorMode = (isSimulatorMode || simulatorUserId) && isDev;
    
    // Variables to store fetched user data (reused later)
    let challengerUser: Awaited<ReturnType<typeof getUserById>> | null = null;
    let challengedUser: Awaited<ReturnType<typeof getUserById>> | null = null;
    
    if (!isInSimulatorMode) {
      // Validate challenges are enabled
      if (!settings.challengesEnabled) {
        return errorResponse('Challenges are currently disabled', 400);
      }

      // Can't challenge yourself
      if (challengedId === challengerId) {
        return errorResponse('You cannot challenge yourself', 400);
      }

      // Validate entry fee (with safe defaults)
      const actualEntryFee = entryFee ?? settings.minEntryFee;
      if (actualEntryFee < settings.minEntryFee || actualEntryFee > settings.maxEntryFee) {
        return errorResponse(`Entry fee must be between ${settings.minEntryFee} and ${settings.maxEntryFee} credits`, 400);
      }

      // Validate duration (with safe defaults)
      const actualDuration = duration ?? settings.minDurationMinutes;
      if (actualDuration < settings.minDurationMinutes || actualDuration > settings.maxDurationMinutes) {
        return errorResponse(`Duration must be between ${settings.minDurationMinutes} and ${settings.maxDurationMinutes} minutes`, 400);
      }

      // PERFORMANCE: Batch fetch user data, wallet, and presence in parallel with timeout
      const cooldownTime = settings.challengeCooldownMinutes > 0 
        ? new Date(Date.now() - settings.challengeCooldownMinutes * 60 * 1000)
        : null;
      
      const [
        challengerWallet,
        fetchedChallengerUser,
        fetchedChallengedUser,
        challengedPresence,
        pendingChallenges,
        activeChallenges,
        recentChallenge,
      ] = await withTimeout(
        Promise.all([
          CreditWallet.findOne({ userId: challengerId }).lean().exec(),
          getUserById(challengerId),
          getUserById(challengedId),
          UserPresence.findOne({ userId: challengedId }).lean().exec(),
          Challenge.countDocuments({ challengerId, status: 'pending' }),
          Challenge.countDocuments({
            $or: [{ challengerId }, { challengedId }],
            status: 'active',
          }),
          cooldownTime 
            ? Challenge.findOne({ challengerId, challengedId, createdAt: { $gte: cooldownTime } }).lean().exec()
            : Promise.resolve(null),
        ]),
        DB_TIMEOUT_MS,
        'Validation queries'
      );
      
      // Store for later use (avoid duplicate fetches)
      challengerUser = fetchedChallengerUser;
      challengedUser = fetchedChallengedUser;

      // Validate wallet balance
      if (!challengerWallet || challengerWallet.creditBalance < actualEntryFee) {
        return errorResponse('Insufficient credits', 400);
      }

      // Validate challenged user exists
      if (!challengedUser) {
        return errorResponse('User not found', 404);
      }

      // Check if challenged user is online (if required)
      if (settings.requireBothOnline && (!challengedPresence || challengedPresence.status !== 'online')) {
        return errorResponse('User is not online', 400);
      }

      // Check if challenged user is accepting challenges
      // FIX: Only check if presence exists AND explicitly set to false
      if (challengedPresence && challengedPresence.acceptingChallenges === false) {
        return errorResponse('User is not accepting challenges', 400);
      }

      // Check pending challenges limit
      if (pendingChallenges >= settings.maxPendingChallenges) {
        return errorResponse(`You have too many pending challenges (max: ${settings.maxPendingChallenges})`, 400);
      }

      // Check active challenges limit
      if (activeChallenges >= settings.maxActiveChallenges) {
        return errorResponse(`You have too many active challenges (max: ${settings.maxActiveChallenges})`, 400);
      }

      // Check cooldown with same user
      if (recentChallenge) {
        return errorResponse(`Please wait ${settings.challengeCooldownMinutes} minutes before challenging this user again`, 400);
      }
    }

    // Calculate prize pool and fees
    // BUG FIX: Use settings.minEntryFee as default (consistent with validation)
    const actualEntryFee = entryFee ?? settings.minEntryFee;
    const prizePool = actualEntryFee * 2;
    const platformFeePercentage = settings.platformFeePercentage;
    const platformFeeAmount = Math.floor(prizePool * (platformFeePercentage / 100));
    const winnerPrize = prizePool - platformFeeAmount;

    // Use already fetched user data (no duplicate queries!)
    if (!isInSimulatorMode && challengerUser) {
      challengerName = challengerUser.name || challengerName;
      challengerEmail = challengerUser.email || challengerEmail;
    }
    
    // Get challenged user name (use placeholder in simulator mode)
    let challengedName = `SimUser_${challengedId.slice(-6)}`;
    let challengedEmail = `simuser_${challengedId.slice(-6)}@test.simulator`;
    if (!isInSimulatorMode && challengedUser) {
      challengedName = challengedUser.name || challengedName;
      challengedEmail = challengedUser.email || challengedEmail;
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
      duration: duration ?? settings.minDurationMinutes, // Use settings default if not provided
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

    timing.end(300); // Log if slower than 300ms
    
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
    timing.end(0); // Log any slow request on error
    
    // Handle timeout specifically
    if (error instanceof Error && error.message.includes('timed out')) {
      console.error('⏱️ Challenge POST timeout:', error.message);
      return errorResponse('Request timeout - please try again', 504, error);
    }
    
    // Handle duplicate key errors (race condition)
    if (error instanceof Error && error.message.includes('duplicate key')) {
      console.warn('⚠️ Challenge duplicate key - possible race condition');
      return errorResponse('Challenge already exists - please try again', 409, error);
    }
    
    console.error('Error creating challenge:', error);
    return errorResponse('Failed to create challenge', 500, error);
  }
}

