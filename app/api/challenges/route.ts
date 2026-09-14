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
import {
  contestGameLabel,
  gameNeedsMarketHours,
  PROVIDER_GAME_TYPE,
} from "@/lib/games";
import {
  isSimulatorRequest,
  getSimulatorUserId,
} from "@/lib/services/simulator/simulator-mode";
import { resolveChallengeProviderGame } from "@/lib/services/games/challenge-provider-resolution";
import { getWillingnessByGameKey } from "@/lib/services/games/challenge-availability.service";
import {
  gameWillingnessRefusal,
  isWillingToBeChallengedAt,
} from "@/lib/services/games/challenge-willingness";
import { CHALLENGE_ROUND_START_POLICY } from "@/lib/services/games/challenge-round-config";
import { resolveAcceptDeadline } from "@/lib/services/challenges/accept-deadline";
import type { RoundStartPolicy } from "@/lib/services/games/round-types";

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
    const type = searchParams.get("type"); // 'sent', 'received', 'open', 'all'

    const query: Record<string, unknown> = {};

    // Filter by user
    if (type === "sent") {
      query.challengerId = session.user.id;
    } else if (type === "received") {
      query.challengedId = session.user.id;
    } else if (type === "open") {
      // Reason: challenges anybody may claim, which is the ONE list here that is not
      // about the caller. Three clauses, and dropping any of them shows a challenge that
      // cannot be accepted: still open (the flag), still unclaimed (all three shapes of
      // an empty seat, because a `$exists` filter alone reads a stored `""` as taken),
      // and not the caller's own - a player cannot take their own seat, so listing it
      // offers a button the accept route refuses.
      query.openToAnyone = true;
      query.challengedId = { $in: [null, ""] };
      query.challengerId = { $ne: session.user.id };
      query.status = "pending";
    } else {
      query.$or = [
        { challengerId: session.user.id },
        { challengedId: session.user.id },
      ];
    }

    // Filter by status. Reason: the open list pins `pending` itself and must not be
    // overridable from the query string - an accepted or completed challenge has a named
    // opponent and is nobody's to claim, so honouring `?type=open&status=active` would
    // list other people's live matches under a heading that invites you to join them.
    if (status && type !== "open") {
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
      // Reason: the lookup key for a provider game (`ChallengeGamePicker.tsx`). Absent
      // for a trading challenge, exactly as `Challenge.gameConfig` being absent IS the
      // statement "this is not a provider challenge" - see that model's own comment.
      // `settings` is the provider's raw config submission, validated and coerced against the
      // STORED schema by `resolveChallengeProviderGame` - never trusted as sent. The `{}`
      // default is no longer the ordinary case: since 13 Sep 2026 the dialog renders the
      // title's own settings form and submits them (`ChallengeSettingsFields.tsx`). It stays
      // because an API caller may still send none, and the resolver then fills the schema's
      // own defaults - the same values an untouched form would have submitted.
      providerKey,
      gameCode,
      settings: gameSettings = {},
      // Reason: offer the challenge to anybody rather than to one named player. An
      // explicit flag, never inferred from an absent `challengedId` - see
      // `lib/utils/open-challenge.ts` for which way each reading fails.
      openToAnyone = false,
    } = body;

    const isProviderChallenge = Boolean(providerKey && gameCode);
    const isOpenChallenge = openToAnyone === true;

    // VALIDATION: Early check for required fields
    //
    // Reason: refused rather than silently preferring one, because a request carrying both
    // is a caller with two intentions and we cannot tell which they meant - and guessing
    // "directed" would quietly turn an open challenge into a private one while guessing
    // "open" would offer a named friend's seat to a stranger. Either way a real entry fee
    // is debited by somebody nobody chose.
    if (isOpenChallenge && challengedId) {
      return errorResponse(
        "A challenge is either open to anyone or sent to one player, not both",
        400,
      );
    }
    if (!isOpenChallenge && !challengedId) {
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

    // Known in both modes (no DB dependency), because the provider resolver below needs
    // it to size the synthetic play window before the market-hours gate runs - see
    // `challenge-provider-resolution.ts`'s own comment for why. Reused at creation and by
    // the bounds check further down, which re-validates it for a real (non-simulator)
    // request.
    const actualDuration = duration ?? settings.minDurationMinutes;

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

    // The game this challenge will be stamped with. Resolved from the lookup key
    // (`providerKey` + `gameCode`), never from a client-supplied game type directly -
    // that would let anyone skip the market-hours gate on a trading challenge by
    // claiming to be a different game. Deriving the gate from the SAME value that gets
    // stored means the two can never disagree.
    let gameLabel = contestGameLabel();
    let resolvedGameSettings: Record<string, unknown> | undefined;
    // Reason: only used in the per-game willingness refusal below, which names the game
    // so the challenger knows to try a different one rather than to give up. "Trading"
    // matches `ChallengeGamePicker`'s own hard-coded first row - trading has no catalogue
    // entry to read a display name from.
    let gameDisplayName = "Trading";
    // How late a player may start a round. Resolved by the same call that pre-flighted the
    // challenge, so what is stored is what was checked - see `ChallengeProviderGameResolved`.
    let resolvedRoundStartPolicy: RoundStartPolicy | undefined;

    if (isProviderChallenge) {
      // Reason: this is also where the provider-only pre-flight checks live (title
      // exists, schema valid, `externalGamesEnabled` treated as a HARD refusal rather
      // than the warning a draft competition gets) - see that module's own comment for
      // why a challenge has no draft state to hide behind.
      const resolved = await resolveChallengeProviderGame({
        providerKey,
        gameCode,
        settings: gameSettings,
        durationMinutes: actualDuration,
      });

      if (!resolved.ok) {
        return errorResponse(resolved.error, 400, resolved.errors);
      }

      gameLabel = contestGameLabel(PROVIDER_GAME_TYPE, resolved.gameKey);
      gameDisplayName = resolved.displayName;
      resolvedGameSettings = resolved.settings;
      resolvedRoundStartPolicy = resolved.roundStartPolicy;
    }

    // ⏰ CHECK MARKET STATUS - only for games that trade against a live market. A
    // resolved provider game answers false here via `lib/games/provider/config.ts`, so
    // this needs no game-type branch of its own. Skip check in simulator mode for testing.
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

      // Can't challenge yourself. Reason: an open challenge has nobody to compare against
      // here, so the same rule is enforced at the moment somebody claims the seat - see
      // the accept route. The check is not skipped, it moves to where the answer exists.
      if (!isOpenChallenge && challengedId === challengerId) {
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

      // Validate duration (with safe defaults) - `actualDuration` was already resolved
      // above so the provider resolver could use the same value.
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
        challengedWillingness,
      ] = await withTimeout(
        Promise.all([
          CreditWallet.findOne({ userId: challengerId })
            .lean()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .exec() as Promise<any>,
          getUserById(challengerId),
          // Reason: the next three all ask a question about the opponent - who are they,
          // are they online, have we challenged them recently - and an open challenge has
          // no opponent to ask about. They resolve to null rather than being queried with
          // `undefined`, which would silently match documents that have no `challengedId`
          // at all: every other open challenge on the platform.
          isOpenChallenge ? Promise.resolve(null) : getUserById(challengedId),
          isOpenChallenge
            ? Promise.resolve(null)
            : (UserPresence.findOne({ userId: challengedId })
                .lean()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .exec() as Promise<any>),
          Challenge.countDocuments({ challengerId, status: "pending" }),
          Challenge.countDocuments({
            $or: isOpenChallenge
              ? [{ challengerId }]
              : [{ challengerId }, { challengedId }],
            status: "active",
          }),
          cooldownTime && !isOpenChallenge
            ? Challenge.findOne({
                challengerId,
                challengedId,
                createdAt: { $gte: cooldownTime },
              })
                .lean()
                .exec()
            : Promise.resolve(null),
          // Reason: withheld for an open challenge for the same reason as the three
          // opponent reads above - there is nobody to ask. An empty map rather than
          // null, so the predicate below reads the default without a null branch.
          isOpenChallenge
            ? Promise.resolve(new Map<string, boolean>())
            : getWillingnessByGameKey(challengedId),
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

      // Validate challenged user exists. Reason: the three opponent checks below are
      // withheld for an open challenge rather than answered "no" - there is no opponent
      // to be absent, offline or unwilling, and `requireBothOnline` in particular would
      // refuse every open challenge ever created.
      if (!isOpenChallenge) {
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

        // Then the same question about THIS game. Two switches, not one: the check above
        // is the master - every game at once - and this one is the player saying they
        // will trade but not race. The order is deliberate, because a player who has
        // switched challenges off entirely has not said anything about games, so telling
        // the challenger to try a different one would be false.
        if (
          !isWillingToBeChallengedAt(challengedWillingness, gameLabel.gameKey)
        ) {
          return errorResponse(gameWillingnessRefusal(gameDisplayName), 400);
        }
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

    // Get challenged user name (use placeholder in simulator mode).
    //
    // Reason: an open challenge stores no name at all rather than a placeholder such as
    // "Open" or "TBD". A placeholder is indistinguishable from a real display name once
    // stored, so every downstream screen would have to know which strings are fake, and
    // `isUnclaimedOpenChallenge` would stop being able to answer. The seat is filled with
    // the claimer's real name at accept time.
    let challengedName = isOpenChallenge
      ? undefined
      : `SimUser_${challengedId.slice(-6)}`;
    let challengedEmail = isOpenChallenge
      ? undefined
      : `simuser_${challengedId.slice(-6)}@test.simulator`;
    if (!isInSimulatorMode && challengedUser) {
      challengedName = challengedUser.name || challengedName;
      challengedEmail = challengedUser.email || challengedEmail;
    }

    // Generate unique slug
    const slug = `challenge-${nanoid(10)}`;

    // Reason: every trading-only field below has either a schema default (`rules.*`,
    // `leverage`, `marginSettings`, `maxPositionSize`, `maxOpenPositions`,
    // `allowShortSelling`, `marginCallThreshold`) or is conditionally required only for
    // trading (`startingCapital`) - see `challenge.model.ts`. A provider challenge omits
    // all of them rather than sending trading defaults for a game with no concept of
    // leverage or margin, exactly as `provider-contest.service.ts` does for competitions.
    // `contentSeed` and `startTime`/`endTime` are deliberately NOT set here - all three
    // are generated once at acceptance, after both players are known
    // (`app/api/challenges/[id]/accept/route.ts`).
    let gameSpecificFields: Record<string, unknown>;

    if (isProviderChallenge) {
      gameSpecificFields = {
        gameConfig: {
          providerKey,
          gameCode,
          settings: resolvedGameSettings,
        },
        // Hard-coded for a 1v1 - see `challenge-provider-resolution.ts`'s own comment
        // for why this is deliberately narrower than what Competition allows.
        attemptsPolicy: "single",
        // Taken from the resolver that just approved the challenge, never resolved again here:
        // this is the title's own operator-set rule, and a second read is a second chance for
        // the stored rule and the checked rule to differ. `??` and not `||` - both values are
        // strings, so the fallback is only for the impossible case of the resolver not having
        // run, and the permissive default is what every game we run uses.
        roundStartPolicy: resolvedRoundStartPolicy ?? CHALLENGE_ROUND_START_POLICY,
      };
    } else {
      // Uses universal TradingRiskSettings for trading rules
      console.log("📊 Using trading risk settings for challenge:", {
        maxLeverage: tradingRiskSettings.maxLeverage,
        marginLiquidation: tradingRiskSettings.marginLiquidation,
        marginCall: tradingRiskSettings.marginCall,
      });

      gameSpecificFields = {
        startingCapital: startingCapital || settings.defaultStartingCapital,
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
          disqualifyOnLiquidation: true, // LOCKED: liquidation = automatic loss
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
      };
    }

    const challenge = await Challenge.create({
      ...gameLabel,
      ...gameSpecificFields,
      slug,
      challengerId,
      challengerName,
      challengerEmail,
      // Reason: the three opponent keys are OMITTED for an open challenge rather than set
      // to undefined or "". `isUnclaimedOpenChallenge` treats all three shapes as empty,
      // but the accept-time claim filter is the reason to be exact here - an empty string
      // stored on the document is what a later `$exists` filter reads as taken.
      openToAnyone: isOpenChallenge,
      ...(isOpenChallenge
        ? {}
        : { challengedId, challengedName, challengedEmail }),
      entryFee: actualEntryFee,
      prizePool,
      platformFeePercentage,
      platformFeeAmount,
      winnerPrize,
      acceptDeadline: resolveAcceptDeadline(settings, isOpenChallenge),
      duration: actualDuration,
      status: "pending",
    });

    // Send notification to challenged user (skip in simulator mode).
    //
    // Reason: skipped for an open challenge, because there is nobody to tell. Sending
    // with an undefined recipient is the failure worth naming - `notificationService.send`
    // would either throw into the catch below and log a false error, or write a row
    // addressed to nobody that the notifications screen then renders for no user.
    if (!isInSimulatorMode && !isOpenChallenge) {
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
        openToAnyone: challenge.openToAnyone,
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
