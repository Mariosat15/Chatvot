import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { verifyGameMasterAuth } from "@/lib/admin/auth";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";

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

    if (
      subscription.currentPeriodCompetitionsCreated >=
      subscription.limits.maxCompetitionsPerDay
    ) {
      return NextResponse.json(
        {
          error: `You have reached your daily limit of ${subscription.limits.maxCompetitionsPerDay} competition(s). Try again tomorrow.`,
          dailyLimit: subscription.limits.maxCompetitionsPerDay,
          created: subscription.currentPeriodCompetitionsCreated,
        },
        { status: 429 },
      );
    }

    // Check max participants limit
    if (maxParticipants > subscription.limits.maxUsersPerCompetition) {
      return NextResponse.json(
        {
          error: `Maximum participants cannot exceed ${subscription.limits.maxUsersPerCompetition}`,
          maxAllowed: subscription.limits.maxUsersPerCompetition,
        },
        { status: 400 },
      );
    }

    // Get user details for gameMasterName
    const user = await db.collection("user").findOne({ id: auth.userId });
    const gameMasterName = user?.name || auth.name || "Game Master";

    // Create competition
    const competition = {
      _id: new ObjectId(),
      name,
      description: description || "",
      status: "upcoming",
      entryFee: parseFloat(entryFee),
      prizePool: parseFloat(prizePool),
      maxParticipants: parseInt(maxParticipants),
      currentParticipants: 0,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      registrationDeadline: registrationDeadline
        ? new Date(registrationDeadline)
        : new Date(startTime),
      allowedSymbols: allowedSymbols || ["EUR/USD", "GBP/USD", "USD/JPY"],
      leverage: leverage || 100,
      tags: tags || [],
      imageUrl: imageUrl || null,
      gameMasterId: auth.userId,
      gameMasterName,
      createdBy: auth.userId, // Game master is the creator
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
