import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { verifyGameMasterAuth } from "@/lib/admin/auth";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { contestGameLabel } from "@/lib/games";
import {
  checkGameMasterCanCreate,
  checkRouteCanCreateGameType,
  MIN_CONTEST_PARTICIPANTS,
  resolveCreationLimits,
} from "@/lib/services/gamemaster/game-permissions";

/**
 * GET /api/gamemaster/competitions
 * Get list of competitions created by this game master
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyGameMasterAuth();
    if (!auth.isAuthenticated || !auth.isGameMaster) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    // Build query
    const query: Record<string, unknown> = {
      gameMasterId: auth.userId,
    };

    if (status) {
      query.status = status;
    }

    // Get competitions with pagination
    const competitions = await db
      .collection("competitions")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count
    const total = await db.collection("competitions").countDocuments(query);

    return NextResponse.json({
      competitions: competitions.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        description: c.description,
        status: c.status,
        entryFee: c.entryFee,
        prizePool: c.prizePool,
        maxParticipants: c.maxParticipants,
        currentParticipants: c.currentParticipants,
        startTime: c.startTime,
        endTime: c.endTime,
        registrationDeadline: c.registrationDeadline,
        createdAt: c.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching competitions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/gamemaster/competitions
 * Create a new competition (with limits)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyGameMasterAuth();
    if (!auth.isAuthenticated || !auth.isGameMaster) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      entryFee,
      prizePool,
      maxParticipants,
      startTime,
      endTime,
      registrationDeadline,
      allowedSymbols,
      leverage,
      tags,
      imageUrl,
      startingCapital,
    } = body;

    // Validate required fields
    if (
      !name ||
      !entryFee ||
      !prizePool ||
      !maxParticipants ||
      !startTime ||
      !endTime
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 },
      );
    }

    // Get subscription to check limits
    const subscription = await db
      .collection("gamemastersubscriptions")
      .findOne({
        userId: auth.userId,
        status: "active",
      });

    if (!subscription) {
      return NextResponse.json(
        { error: "No active Game Master subscription" },
        { status: 403 },
      );
    }

    // Check if subscription is expired
    if (new Date(subscription.endDate) < new Date()) {
      return NextResponse.json(
        { error: "Your Game Master subscription has expired" },
        { status: 403 },
      );
    }

    // Check daily competition limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Reset daily counter if it's a new day
    const lastResetDate = new Date(subscription.lastCompetitionResetDate);
    lastResetDate.setHours(0, 0, 0, 0);

    if (today > lastResetDate) {
      // New day - reset counter
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

    // The CURRENT package, which this route did not read at all before.
    //
    // The main app's copy of this route has always read it, with a comment saying so: "this
    // ensures if admin changes the package, the GM cannot bypass restrictions". That was
    // true of that file and false of the platform, because this route reached the same
    // collection with the cached `subscription.limits` and is reachable by the same person -
    // a Game Master signs in here with their ordinary credentials at
    // `/api/gamemaster-auth/login`. So the documented protection had a second door.
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

    const effectiveLimits = resolveCreationLimits({
      limits: subscription.limits,
      packageConfig,
      override: subscription.competitionCreationOverride,
      overrideLimits: subscription.overrideLimits,
    });

    // This route never checked `canCreateCompetitions` at all, in any form, so a Game Master
    // whose package withdraws competition creation could create them here. The shared gate
    // checks it, the game and the daily quota in one call, in that order.
    const verdict = checkGameMasterCanCreate({
      limits: effectiveLimits,
      requestedGameType: body.gameType,
      competitionsCreatedToday: subscription.currentPeriodCompetitionsCreated,
    });

    if (!verdict.ok) {
      // Reason the daily limit keeps its 429 while the other refusals are 403: the existing
      // client branches on the status to decide whether to say "try again tomorrow", and a
      // quota is genuinely rate limiting rather than a permission problem.
      return NextResponse.json(
        {
          error: verdict.message,
          reason: verdict.reason,
          ...(verdict.reason === "daily_limit_reached"
            ? {
                dailyLimit: effectiveLimits.maxCompetitionsPerDay,
                created: subscription.currentPeriodCompetitionsCreated,
              }
            : {}),
        },
        { status: verdict.reason === "daily_limit_reached" ? 429 : 403 },
      );
    }

    const capability = checkRouteCanCreateGameType(verdict.gameType);
    if (!capability.ok) {
      return NextResponse.json(
        { error: capability.message, reason: capability.reason },
        { status: 400 },
      );
    }

    // Check max participants limit
    if (maxParticipants > effectiveLimits.maxUsersPerCompetition) {
      return NextResponse.json(
        {
          error: `Maximum participants cannot exceed ${effectiveLimits.maxUsersPerCompetition}`,
          maxAllowed: effectiveLimits.maxUsersPerCompetition,
        },
        { status: 400 },
      );
    }

    // Get user details for gameMasterName
    const user = await db.collection("user").findOne({ id: auth.userId });
    const gameMasterName = user?.name || auth.name || "Game Master";

    // Reason: Generate a unique slug from the competition name.
    // The Competition model has a unique index on slug — null/missing slug
    // causes E11000 duplicate key errors on the second insert.
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let slug = baseSlug || `comp-${Date.now()}`;
    let counter = 1;

    // Check for existing slugs and increment if needed
    while (await db.collection("competitions").findOne({ slug })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    // Create competition
    // Reason: Include all schema-required fields with sensible defaults.
    // This route uses raw insertOne (bypassing Mongoose), so schema defaults
    // don't apply — every required field must be explicitly set.
    const competition = {
      _id: new ObjectId(),
      name,
      description: description || "",
      slug,
      status: "upcoming",
      entryFee: parseFloat(entryFee),
      startingCapital: startingCapital ? parseFloat(startingCapital) : 10000,
      // Reason: Start at 0 — actual prize pool is built incrementally via $inc
      // when each user enters (competition.actions.ts enterCompetition).
      // Setting to a pre-calculated estimate caused double-counting: the estimate
      // was stored AND each entry fee was added on top, creating phantom credits.
      prizePool: 0,
      // This route has always hard-coded the right number, which is why it never had the
      // main app's single-player defect. It reads the shared constant so the two cannot
      // drift: a literal here matching the floor by coincidence is the same trap as a
      // migration carrying its own copy of a default.
      minParticipants: MIN_CONTEST_PARTICIPANTS,
      maxParticipants: parseInt(maxParticipants),
      currentParticipants: 0,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      registrationDeadline: registrationDeadline
        ? new Date(registrationDeadline)
        : new Date(startTime),
      allowedSymbols: allowedSymbols || ["EUR/USD", "GBP/USD", "USD/JPY"],
      leverage: leverage || 100,
      competitionType: "time_based",
      platformFeePercentage: 20,
      prizeDistribution: [
        { rank: 1, percentage: 50 },
        { rank: 2, percentage: 30 },
        { rank: 3, percentage: 20 },
      ],
      rules: {
        rankingMetric: "pnl",
        tieBreaker1: "trades_count",
        minimumTrades: 0,
        tiePrizeDistribution: "split_equally",
        disqualifyOnLiquidation: true,
      },
      levelRequirement: { enabled: false, minLevel: 1 },
      maxPositionSize: 20,
      maxOpenPositions: 10,
      allowShortSelling: false,
      marginCallThreshold: 100,
      tags: tags || [],
      imageUrl: imageUrl || null,
      gameMasterId: auth.userId,
      gameMasterName,
      createdBy: auth.userId,
      // Reason: this route inserts with the raw MongoDB driver, so Mongoose schema
      // defaults never run and the game label would be absent (risk R7).
      //
      // The type comes from the GATE's resolved value rather than from the request body or
      // a literal, so the label cannot disagree with what was actually permitted. See the
      // same call in the main app's copy for the full reasoning.
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
      },
      limits: {
        dailyRemaining:
          subscription.limits.maxCompetitionsPerDay -
          subscription.currentPeriodCompetitionsCreated -
          1,
        maxParticipants: subscription.limits.maxUsersPerCompetition,
      },
      message: "Competition created successfully!",
    });
  } catch (error) {
    console.error("Error creating competition:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
