import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase, withTimeout } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeSettings from "@/database/models/trading/challenge-settings.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import UserPresence from "@/database/models/user-presence.model";
import TradingRiskSettings from "@/database/models/trading-risk-settings.model";
import { getUserById } from "@/lib/utils/user-lookup";
import { nanoid } from "nanoid";
import { trackTiming, errorResponse } from "@/lib/utils/api-utils";
import { canJoinChallenge } from "@/lib/services/market-hours.service";
import { contestGameLabel, gameNeedsMarketHours } from "@/lib/games";
import {
  isSimulatorRequest,
  getSimulatorUserId,
} from "@/lib/services/simulator/simulator-mode";

// Request timeout for this route (5 seconds)
const _REQUEST_TIMEOUT_MS = 5000;
// Individual DB operation timeout (3 seconds)
const DB_TIMEOUT_MS = 3000;

// GET - Get user's challenges
export async function GET(request: NextRequest) {
  const timing = trackTiming("GET /api/challenges");

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type"); // 'sent', 'received', 'all'

    const query: Record<string, unknown> = {};

    // Filter by user
    if (type === "sent") {
      query.challengerId = session.user.id;
    } else if (type === "received") {
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
      Challenge.find(query).sort({ createdAt: -1 }).limit(50).lean().exec(),
      DB_TIMEOUT_MS,
      "Challenge.find",
    );

    timing.end(200);
    return NextResponse.json({ challenges });
  } catch (error) {
    timing.end(0); // Log any slow request

    // Handle timeout specifically
    if (error instanceof Error && error.message.includes("timed out")) {
      console.error("⏱️ Challenge GET timeout:", error.message);
      return errorResponse("Request timeout - please try again", 504, error);
    }

    console.error("Error fetching challenges:", error);
    return errorResponse("Failed to fetch challenges", 500, error);
  }
}

// POST - Create a new challenge
export async function POST(request: NextRequest) {
  const timing = trackTiming("POST /api/challenges");

  try {
    // Check for simulator mode.
    // Reason: this branch skips authentication and the fraud/restriction gates,
    // acting as whichever user id the caller names. It previously accepted the
    // X-Simulator-User-Id header on its own, so an unauthenticated caller could
    // create a challenge as any user. It now requires the internal secret.
    const allowSimulatorMode = isSimulatorRequest(request);
    const simulatorUserId = allowSimulatorMode
      ? getSimulatorUserId(request)
      : null;

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
      // disqualifyOnLiquidation is always true for challenges (locked)
       
      disqualifyOnLiquidation: _disqualifyOnLiquidationIgnored = true,
    } = body;

    // VALIDATION: Early check for required fields
    if (!challengedId) {
      return errorResponse("challengedId is required", 400);
    }

    if (allowSimulatorMode) {
      // Simulator mode - accept challengerId from header or body
      const simUserId = simulatorUserId || body.challengerId;
      if (!simUserId) {
        return errorResponse(
          "challengerId required in simulator mode (X-Simulator-User-Id header or body.challengerId)",
          400,
        );
      }
      challengerId = simUserId;
      challengerName = `SimUser_${challengerId.slice(-6)}`;
      challengerEmail = `simuser_${challengerId.slice(-6)}@test.simulator`;
    } else {
      // Normal mode - require authentication
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user?.id) {
        return errorResponse("Unauthorized", 401);
      }
      // Reason: Require verified email before a user can create challenges.
      // Blocks spam accounts that never completed email confirmation from
      // interacting with real users.
      if (
        (session.user as { emailVerified?: boolean }).emailVerified !== true
      ) {
        return errorResponse(
          "Please verify your email address before creating challenges.",
          403,
        );
      }
      challengerId = session.user.id;
      challengerName = session.user.name || "Unknown";
      challengerEmail = session.user.email || "";
    }

    await connectToDatabase();

    // PERFORMANCE: Batch fetch settings in parallel with timeout (saves ~100ms)
    const [settings, tradingRiskSettings] = await withTimeout(
      Promise.all([
        ChallengeSettings.getSingleton(),
        TradingRiskSettings.getSingleton(),
      ]),
      DB_TIMEOUT_MS,
      "Settings fetch",
    );

    // Skip most validation in simulator mode
    const isInSimulatorMode = allowSimulatorMode;

    // ✅ CHECK USER RESTRICTIONS - Blocked users cannot create challenges.
    // Reason: check BOTH the competition gate (legacy behaviour) and the
    // dedicated challenge gate so `duplicateKYCBlockChallenges` is honoured
    // independently of the competition block.
    if (!isInSimulatorMode) {
      const { canUserPerformAction } =
        await import("@/lib/services/user-restriction.service");
      const [competitionCheck, challengeCheck] = await Promise.all([
        canUserPerformAction(challengerId, "enterCompetition"),
        canUserPerformAction(challengerId, "enterChallenge"),
      ]);
      const restrictionCheck = !competitionCheck.allowed
        ? competitionCheck
        : challengeCheck;

      if (!restrictionCheck.allowed) {
        console.log(
          `❌ Challenge creation blocked for user ${challengerId}: ${restrictionCheck.reason}`,
        );
        return errorResponse(
          restrictionCheck.reason ||
            "Your account is restricted and cannot create challenges. Please contact support.",
          403,
        );
      }

      // 🛡️ FRAUD ENTRY GATE — VPN/Proxy/Tor/Datacenter blocks + device/risk
      // thresholds + per-hour throttle (admin-configurable, fail-open).
      const gateIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        request.headers.get("cf-connecting-ip") ||
        undefined;
      const { assertEntryFraudGate } = await import(
        "@/lib/services/fraud/entry-fraud-gate.service"
      );
      const entryGate = await assertEntryFraudGate({
        userId: challengerId,
        ip: gateIp || undefined,
      });
      if (!entryGate.allowed) {
        console.log(
          `❌ Challenge creation blocked by fraud gate for user ${challengerId}: ${entryGate.reason}`,
        );
        return errorResponse(
          entryGate.reason || "Entry is not allowed at this time.",
          403,
        );
      }
    }

    // The game this challenge will be stamped with. Trading today, because this route
    // sets no gameType and the schema defaults to it; X5 takes it from the request once
    // provider challenges exist. Deriving the gate from the SAME value that gets stored
    // means the two can never disagree.
    //
    // Reason: deliberately not read from the request body. A client-supplied game type
    // would let anyone skip the market-hours gate on a trading challenge by claiming to
    // be a different game.
    const gameLabel = contestGameLabel();

    // ⏰ CHECK MARKET STATUS - only for games that trade against a live market.
    // Skip check in simulator mode for testing
    if (!isInSimulatorMode && gameNeedsMarketHours(gameLabel.gameType)) {
      try {
        const marketCheck = await canJoinChallenge();
        if (!marketCheck.canJoin) {
          return errorResponse(
            marketCheck.reason ||
              "Cannot create challenge: Market is currently closed.",
            400,
          );
        }
      } catch (marketError) {
        console.warn(
          "⚠️ Market hours check failed, using fallback:",
          marketError,
        );
        // Fallback: time-based check (existing logic)
        try {
          const { isForexMarketOpen } =
            await import("@/lib/services/real-forex-prices.service");
          const marketOpen = await isForexMarketOpen();
          if (!marketOpen) {
            return errorResponse(
              "Cannot create challenge: Forex market is currently closed.",
              400,
            );
          }
        } catch {
          // Ultimate fallback: weekend check
          const now = new Date();
          const utcDay = now.getUTCDay();
          const utcHour = now.getUTCHours();
          const isClosed =
            utcDay === 6 ||
            (utcDay === 0 && utcHour < 22) ||
            (utcDay === 5 && utcHour >= 22);
          if (isClosed) {
            return errorResponse(
              "Cannot create challenge: Forex market is currently closed (Weekend).",
              400,
            );
          }
        }
      }
    }

    // Variables to store fetched user data (reused later)
    let challengerUser: Awaited<ReturnType<typeof getUserById>> | null = null;
    let challengedUser: Awaited<ReturnType<typeof getUserById>> | null = null;

    if (!isInSimulatorMode) {
      // Validate challenges are enabled
      if (!settings.challengesEnabled) {
        return errorResponse("Challenges are currently disabled", 400);
      }

      // Can't challenge yourself
      if (challengedId === challengerId) {
        return errorResponse("You cannot challenge yourself", 400);
      }

      // Validate entry fee (with safe defaults)
      const actualEntryFee = entryFee ?? settings.minEntryFee;
      if (
        actualEntryFee < settings.minEntryFee ||
        actualEntryFee > settings.maxEntryFee
      ) {
        return errorResponse(
          `Entry fee must be between ${settings.minEntryFee} and ${settings.maxEntryFee} credits`,
          400,
        );
      }

      // Validate duration (with safe defaults)
      const actualDuration = duration ?? settings.minDurationMinutes;
      if (
        actualDuration < settings.minDurationMinutes ||
        actualDuration > settings.maxDurationMinutes
      ) {
        return errorResponse(
          `Duration must be between ${settings.minDurationMinutes} and ${settings.maxDurationMinutes} minutes`,
          400,
        );
      }

      // PERFORMANCE: Batch fetch user data, wallet, and presence in parallel with timeout
      const cooldownTime =
        settings.challengeCooldownMinutes > 0
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
          CreditWallet.findOne({ userId: challengerId })
            .lean()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .exec() as Promise<any>,
          getUserById(challengerId),
          getUserById(challengedId),
          UserPresence.findOne({ userId: challengedId })
            .lean()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .exec() as Promise<any>,
          Challenge.countDocuments({ challengerId, status: "pending" }),
          Challenge.countDocuments({
            $or: [{ challengerId }, { challengedId }],
            status: "active",
          }),
          cooldownTime
            ? Challenge.findOne({
                challengerId,
                challengedId,
                createdAt: { $gte: cooldownTime },
              })
                .lean()
                .exec()
            : Promise.resolve(null),
        ]),
        DB_TIMEOUT_MS,
        "Validation queries",
      );

      // Store for later use (avoid duplicate fetches)
      challengerUser = fetchedChallengerUser;
      challengedUser = fetchedChallengedUser;

      // Validate wallet balance
      if (
        !challengerWallet ||
        challengerWallet.creditBalance < actualEntryFee
      ) {
        return errorResponse("Insufficient credits", 400);
      }

      // Validate challenged user exists
      if (!challengedUser) {
        return errorResponse("User not found", 404);
      }

      // Check if challenged user is online (if required)
      if (
        settings.requireBothOnline &&
        (!challengedPresence || challengedPresence.status !== "online")
      ) {
        return errorResponse("User is not online", 400);
      }

      // Check if challenged user is accepting challenges
      // FIX: Only check if presence exists AND explicitly set to false
      if (
        challengedPresence &&
        challengedPresence.acceptingChallenges === false
      ) {
        return errorResponse("User is not accepting challenges", 400);
      }

      // Check pending challenges limit
      if (pendingChallenges >= settings.maxPendingChallenges) {
        return errorResponse(
          `You have too many pending challenges (max: ${settings.maxPendingChallenges})`,
          400,
        );
      }

      // Check active challenges limit
      if (activeChallenges >= settings.maxActiveChallenges) {
        return errorResponse(
          `You have too many active challenges (max: ${settings.maxActiveChallenges})`,
          400,
        );
      }

      // Check cooldown with same user
      if (recentChallenge) {
        return errorResponse(
          `Please wait ${settings.challengeCooldownMinutes} minutes before challenging this user again`,
          400,
        );
      }
    }

    // Calculate prize pool and fees
    // BUG FIX: Use settings.minEntryFee as default (consistent with validation)
    const actualEntryFee = entryFee ?? settings.minEntryFee;
    const prizePool = actualEntryFee * 2;
    const platformFeePercentage = settings.platformFeePercentage;
    const platformFeeAmount = Math.floor(
      prizePool * (platformFeePercentage / 100),
    );
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
    console.log("📊 Using trading risk settings for challenge:", {
      maxLeverage: tradingRiskSettings.maxLeverage,
      marginLiquidation: tradingRiskSettings.marginLiquidation,
      marginCall: tradingRiskSettings.marginCall,
    });

    const challenge = await Challenge.create({
      ...gameLabel,
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
      acceptDeadline: new Date(
        Date.now() + settings.acceptDeadlineMinutes * 60 * 1000,
      ),
      duration: duration ?? settings.minDurationMinutes, // Use settings default if not provided
      status: "pending",
      assetClasses: assetClasses || settings.defaultAssetClasses,
      allowedSymbols: [],
      blockedSymbols: [],
      leverage: {
        enabled: tradingRiskSettings.maxLeverage > 1,
        min: tradingRiskSettings.minLeverage || 1,
        max: tradingRiskSettings.maxLeverage,
      },
      rules: {
        rankingMethod: rankingMethod || "pnl",
        tieBreaker1: tieBreaker1 || "trades_count",
        tieBreaker2: tieBreaker2 || undefined,
        minimumTrades: Math.max(1, minimumTrades || 1), // At least 1 trade required
        disqualifyOnLiquidation: true, // LOCKED: Always true for challenges - liquidation = automatic loss
      },
      maxPositionSize: tradingRiskSettings.maxPositionSize,
      maxOpenPositions: tradingRiskSettings.maxOpenPositions,
      allowShortSelling: true, // Allow short selling by default
      marginCallThreshold: tradingRiskSettings.marginCall || 100,
      // Save all margin settings from risk settings
      marginSettings: {
        liquidation: tradingRiskSettings.marginLiquidation || 50,
        call: tradingRiskSettings.marginCall || 100,
        warning: tradingRiskSettings.marginWarning || 150,
        safe: tradingRiskSettings.marginSafe || 200,
      },
    });

    // Send notification to challenged user (skip in simulator mode)
    if (!isInSimulatorMode) {
      try {
        const { notificationService } =
          await import("@/lib/services/notification.service");
        await notificationService.send({
          userId: challengedId,
          templateId: "challenge_received",
          variables: {
            // Changed from 'metadata' to 'variables'
            challengeId: challenge._id.toString(),
            challengeSlug: challenge.slug, // For actionUrl
            challengerName: challenge.challengerName,
            opponentName: challenge.challengerName, // Alias for template compatibility
            entryFee: actualEntryFee,
            duration,
            winnerPrize,
          },
        });
      } catch (notifError) {
        console.error("Error sending challenge notification:", notifError);
      }

      // Reason: Push instant WS notification so the challenged user sees a popup
      // without waiting for polling. Best-effort — failure here is non-blocking.
      try {
        const { wsNotifier } = await import(
          "@/lib/services/messaging/websocket-notifier"
        );
        await wsNotifier.notifyChallengeReceived(challengedId, {
          _id: challenge._id.toString(),
          slug: challenge.slug,
          challengerName: challenge.challengerName,
          entryFee: challenge.entryFee,
          duration: challenge.duration,
          winnerPrize: challenge.winnerPrize,
          startingCapital: challenge.startingCapital,
          rankingMethod: challenge.rules?.rankingMethod || "pnl",
          acceptDeadline: challenge.acceptDeadline,
          createdAt: challenge.createdAt,
        });
      } catch (wsError) {
        // Non-critical — the polling fallback still works
        console.warn("⚠️ WS challenge push failed:", wsError);
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
    if (error instanceof Error && error.message.includes("timed out")) {
      console.error("⏱️ Challenge POST timeout:", error.message);
      return errorResponse("Request timeout - please try again", 504, error);
    }

    // Handle duplicate key errors (race condition)
    if (error instanceof Error && error.message.includes("duplicate key")) {
      console.warn("⚠️ Challenge duplicate key - possible race condition");
      return errorResponse(
        "Challenge already exists - please try again",
        409,
        error,
      );
    }

    console.error("Error creating challenge:", error);
    return errorResponse("Failed to create challenge", 500, error);
  }
}
