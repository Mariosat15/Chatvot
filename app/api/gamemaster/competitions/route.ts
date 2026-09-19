import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import GameMasterSubscription from "@/database/models/gamemaster/gamemaster-subscription.model";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { contestGameLabel } from "@/lib/games";
import {
  checkGameMasterCanCreate,
  checkRouteCanCreateGameType,
  clampMinParticipants,
  resolveCreationLimits,
} from "@/lib/services/gamemaster/game-permissions";

/**
 * GET /api/gamemaster/competitions
 * Get competitions created by this Game Master
 */
export async function GET() {
  try {
    await connectToDatabase();

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const userId = session.user.id;
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection failed" },
        { status: 500 },
      );
    }

    // Check if user is a Game Master
    const subscription = await GameMasterSubscription.findOne({
      userId,
      status: "active",
    });
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: "Not a Game Master" },
        { status: 403 },
      );
    }

    // Get CURRENT package settings (not cached subscription limits)
    let currentLimits = {
      maxCompetitionsPerDay: subscription.limits?.maxCompetitionsPerDay || 1,
      maxUsersPerCompetition: subscription.limits?.maxUsersPerCompetition || 50,
      canCreateCompetitions:
        subscription.limits?.canCreateCompetitions !== false,
    };

    if (subscription.packageId) {
      const currentPackage = await MarketplaceItem.findById(
        subscription.packageId,
      ).lean();
      if (currentPackage?.gameMasterConfig) {
        currentLimits = {
          maxCompetitionsPerDay:
            currentPackage.gameMasterConfig.maxCompetitionsPerDay || 1,
          maxUsersPerCompetition:
            currentPackage.gameMasterConfig.maxUsersPerCompetition || 50,
          canCreateCompetitions:
            currentPackage.gameMasterConfig.canCreateCompetitions !== false,
        };
      }
    }

    // Get competitions created by this Game Master
    const competitions = await db
      .collection("competitions")
      .find({ gameMasterId: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      competitions: competitions.map((c) => ({
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
        maxCompetitionsPerDay: currentLimits.maxCompetitionsPerDay,
        maxUsersPerCompetition: currentLimits.maxUsersPerCompetition,
        canCreateCompetitions: currentLimits.canCreateCompetitions,
        currentPeriodCreated: subscription.currentPeriodCompetitionsCreated,
        remaining: currentLimits.canCreateCompetitions
          ? currentLimits.maxCompetitionsPerDay -
            (subscription.currentPeriodCompetitionsCreated || 0)
          : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching GM competitions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
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
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
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
    if (
      !name ||
      !entryFee ||
      !startingCapital ||
      !maxParticipants ||
      !startTime ||
      !endTime
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection failed" },
        { status: 500 },
      );
    }

    // Get subscription to check limits
    const subscription = await db
      .collection("gamemastersubscriptions")
      .findOne({
        userId,
        status: "active",
      });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: "No active Game Master subscription" },
        { status: 403 },
      );
    }

    // Check if subscription is expired
    if (new Date(subscription.endDate) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Your Game Master subscription has expired" },
        { status: 403 },
      );
    }

    // The CURRENT package, not the cached limits. Reason: the cache is what this Game
    // Master bought and the package is what the operator currently offers, so reading the
    // cache first is how a tightened tier is bypassed by everyone already subscribed. It
    // stays a fallback because a package can be DELETED while somebody is subscribed to it.
    let packageConfig = null;
    if (subscription.packageId) {
      try {
        const currentPackage = await db.collection("marketplaceitems").findOne({
          _id: new ObjectId(subscription.packageId),
        });
        packageConfig = currentPackage?.gameMasterConfig ?? null;
      } catch (e) {
        console.error("Error fetching package:", e);
      }
    }

    // One rule, shared with the admin-hosted copy of this route. Before this existed the
    // two disagreed about every question it answers - see `game-permissions.ts`.
    const effectiveLimits = resolveCreationLimits({
      limits: subscription.limits,
      packageConfig,
      override: subscription.competitionCreationOverride,
      overrideLimits: subscription.overrideLimits,
    });

    // Check daily competition limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastResetDate = new Date(subscription.lastCompetitionResetDate);
    lastResetDate.setHours(0, 0, 0, 0);

    // Reset daily counter if it's a new day
    if (today > lastResetDate) {
      await db.collection("gamemastersubscriptions").updateOne(
        { _id: subscription._id },
        {
          $set: {
            currentPeriodCompetitionsCreated: 0,
            lastCompetitionResetDate: new Date(),
          },
        },
      );
      subscription.currentPeriodCompetitionsCreated = 0;
    }

    // Permission to create, then the game, then the daily quota - in that order, so a Game
    // Master whose package forbids creation is not told to come back tomorrow.
    const verdict = checkGameMasterCanCreate({
      limits: effectiveLimits,
      requestedGameType: body.gameType,
      competitionsCreatedToday: subscription.currentPeriodCompetitionsCreated,
    });

    if (!verdict.ok) {
      return NextResponse.json(
        { success: false, error: verdict.message, reason: verdict.reason },
        { status: 403 },
      );
    }

    // Separately from whether this Game Master is PERMITTED the game: can this route build
    // one? Only trading, and it refuses rather than mislabelling - see
    // `checkRouteCanCreateGameType`, which explains why an immutable `gameKey` makes that
    // the difference between a visible refusal and unrecoverable data.
    const capability = checkRouteCanCreateGameType(verdict.gameType);
    if (!capability.ok) {
      return NextResponse.json(
        { success: false, error: capability.message, reason: capability.reason },
        { status: 400 },
      );
    }

    // Check max participants limit
    const effectiveMaxParticipants = Math.min(
      parseInt(maxParticipants),
      effectiveLimits.maxUsersPerCompetition,
    );

    // Calculate prize pool
    const entryFeeNum = parseFloat(entryFee);
    const platformFee = platformFeePercentage || 10;
    const estimatedPrizePool =
      effectiveMaxParticipants * entryFeeNum * (1 - platformFee / 100);

    // Build allowed symbols based on asset classes
    const allowedSymbols: string[] = [];
    const assetClassesArray: string[] = [];

    // Handle both array and object format for assetClasses
    if (Array.isArray(assetClasses)) {
      if (assetClasses.includes("forex")) {
        allowedSymbols.push(
          "EUR/USD",
          "GBP/USD",
          "USD/JPY",
          "USD/CHF",
          "AUD/USD",
          "USD/CAD",
          "NZD/USD",
        );
        assetClassesArray.push("forex");
      }
      if (assetClasses.includes("crypto")) {
        allowedSymbols.push("BTC/USD", "ETH/USD", "XRP/USD", "SOL/USD");
        assetClassesArray.push("crypto");
      }
      if (assetClasses.includes("stocks")) {
        allowedSymbols.push("AAPL", "GOOGL", "MSFT", "TSLA", "AMZN");
        assetClassesArray.push("stocks");
      }
    } else {
      if (assetClasses?.forex !== false) {
        allowedSymbols.push(
          "EUR/USD",
          "GBP/USD",
          "USD/JPY",
          "USD/CHF",
          "AUD/USD",
          "USD/CAD",
          "NZD/USD",
        );
        assetClassesArray.push("forex");
      }
      if (assetClasses?.crypto) {
        allowedSymbols.push("BTC/USD", "ETH/USD", "XRP/USD", "SOL/USD");
        assetClassesArray.push("crypto");
      }
      if (assetClasses?.stocks) {
        allowedSymbols.push("AAPL", "GOOGL", "MSFT", "TSLA", "AMZN");
        assetClassesArray.push("stocks");
      }
    }

    // Default rules if not provided
    const defaultRules = {
      rankingMethod: "pnl",
      tieBreaker1: "trades_count",
      minimumTrades: 1,
      disqualifyOnLiquidation: true,
      tiePrizeDistribution: "split_equally",
    };

    // Reason: Generate a unique slug from the competition name.
    // The Competition model has a unique index on slug — null/missing slug
    // causes E11000 duplicate key errors on the second insert.
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug || `comp-${Date.now()}`;
    let counter = 1;

    while (await db.collection("competitions").findOne({ slug })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    // Create competition
    const competition = {
      _id: new ObjectId(),
      name,
      description: description || "",
      slug,
      status: "upcoming",
      entryFee: entryFeeNum,
      startingCapital: parseFloat(startingCapital),
      // Reason: Start at 0 — actual prize pool is built incrementally via $inc
      // when each user enters (competition.actions.ts enterCompetition).
      // Setting this to estimatedPrizePool caused double-counting: the estimate
      // was stored here AND each entry fee was added on top, inflating the pool
      // far beyond what was actually collected.
      prizePool: 0,
      estimatedPrizePool, // For display purposes only (client shows this before users join)
      // Reason this is clamped rather than `parseInt(minParticipants) || 2`: that expression
      // is wrong in exactly one direction and it is the direction that matters. `"1"` parses
      // to 1, which is TRUTHY, so it passed straight through - and `minParticipants: 1`
      // means the auto-cancel-and-refund below the minimum can never fire, so a single
      // player pays an entry fee and takes the pot back minus the platform fee. That is a
      // paid solo game, which no paid format on this platform may be. `"0"` and `""` were
      // caught only by luck, being falsy.
      minParticipants: clampMinParticipants(minParticipants),
      maxParticipants: effectiveMaxParticipants,
      currentParticipants: 0,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      registrationDeadline: new Date(startTime),
      allowedSymbols:
        allowedSymbols.length > 0
          ? allowedSymbols
          : ["EUR/USD", "GBP/USD", "USD/JPY"],
      assetClasses:
        assetClassesArray.length > 0 ? assetClassesArray : ["forex"],
      leverage: leverage || 30,
      platformFeePercentage: platformFee,
      prizeDistribution: prizeDistribution || [
        { rank: 1, percentage: 70 },
        { rank: 2, percentage: 20 },
        { rank: 3, percentage: 10 },
      ],
      // Game Master fields
      gameMasterId: userId,
      gameMasterName: session.user.name || "Game Master",
      createdBy: userId,
      // Competition rules (use provided or defaults)
      rules: rules
        ? {
            rankingMethod: rules.rankingMethod || defaultRules.rankingMethod,
            tieBreaker1: rules.tieBreaker1 || defaultRules.tieBreaker1,
            tieBreaker2: rules.tieBreaker2,
            minimumTrades: rules.minimumTrades ?? defaultRules.minimumTrades,
            minimumWinRate: rules.minimumWinRate,
            disqualifyOnLiquidation:
              rules.disqualifyOnLiquidation ??
              defaultRules.disqualifyOnLiquidation,
            tiePrizeDistribution:
              rules.tiePrizeDistribution || defaultRules.tiePrizeDistribution,
          }
        : defaultRules,
      // Level requirement
      levelRequirement: levelRequirement?.enabled
        ? {
            enabled: true,
            minLevel: levelRequirement.minLevel || 1,
            maxLevel: levelRequirement.maxLevel,
          }
        : { enabled: false },
      // Risk limits
      riskLimits: riskLimits?.enabled
        ? {
            enabled: true,
            maxDrawdownPercent: riskLimits.maxDrawdownPercent || 50,
            dailyLossLimitPercent: riskLimits.dailyLossLimitPercent || 20,
            equityCheckEnabled: riskLimits.equityCheckEnabled || false,
            equityDrawdownPercent: riskLimits.equityDrawdownPercent || 30,
          }
        : { enabled: false },
      // Difficulty setting
      difficulty: difficulty
        ? {
            mode: difficulty.mode || "auto",
            manualLevel: difficulty.manualLevel,
          }
        : { mode: "auto" },
      // Reason: These fields are required by the Mongoose schema but since we use
      // raw insertOne (bypassing Mongoose), defaults don't apply.
      competitionType: "time_based",
      maxPositionSize: 20,
      maxOpenPositions: 10,
      allowShortSelling: false,
      marginCallThreshold: 100,
      // Reason: same bypass, for the game label (risk R7).
      //
      // The type comes from the GATE's resolved value, not from the request body and not
      // from a literal. Taking it from the body would let a caller be admitted as one game
      // and written as another; hard-coding it would let a future widening of
      // `allowedGameTypes` grant a game that is then stored with the wrong label. Two gates
      // have already run on this value: the Game Master's `allowedGameTypes`, and what this
      // route can actually build - so it can only be trading today, and it will follow the
      // allow-list correctly when that changes.
      ...contestGameLabel(verdict.gameType),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("competitions").insertOne(competition);

    // Update subscription counters
    await db.collection("gamemastersubscriptions").updateOne(
      { _id: subscription._id },
      {
        $inc: {
          currentPeriodCompetitionsCreated: 1,
          totalCompetitionsCreated: 1,
        },
        $set: { updatedAt: new Date() },
      },
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
        // Reason `Math.max(0, ...)`: `currentPeriodCompetitionsCreated` is incremented by
        // the write above, and a cap lowered by an operator after a Game Master had already
        // created several contests makes this arithmetic negative. "-2 remaining today" is
        // not a fact about anything.
        dailyRemaining: Math.max(
          0,
          effectiveLimits.maxCompetitionsPerDay -
            (subscription.currentPeriodCompetitionsCreated ?? 0) -
            1,
        ),
        maxParticipants: effectiveLimits.maxUsersPerCompetition,
      },
      message: "Competition created successfully!",
    });
  } catch (error) {
    console.error("Error creating competition:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
