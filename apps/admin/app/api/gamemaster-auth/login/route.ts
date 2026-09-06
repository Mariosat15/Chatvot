import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { generateGameMasterToken } from "@/lib/admin/auth";

/**
 * POST /api/gamemaster-auth/login
 * Login endpoint for game masters
 * Game masters use their regular user credentials but get limited admin access
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
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

    // Find user by email (using Better Auth user collection)
    const user = await db.collection("user").findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Verify password
    // Better Auth stores passwords in 'account' collection linked to user
    const account = await db.collection("account").findOne({
      userId: user._id.toString(),
      providerId: "credential",
    });

    if (!account?.password) {
      return NextResponse.json(
        { error: "Invalid credentials - no password set" },
        { status: 401 },
      );
    }

    const isValidPassword = await bcrypt.compare(password, account.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Check if user has an active game master subscription
    const subscription = await db
      .collection("gamemastersubscriptions")
      .findOne({
        userId: user._id.toString(),
        status: "active",
      });

    if (!subscription) {
      return NextResponse.json(
        {
          error:
            "No active Game Master subscription found. Please purchase and activate a Game Master package from the marketplace.",
        },
        { status: 403 },
      );
    }

    // Check if subscription has expired
    if (new Date(subscription.endDate) < new Date()) {
      return NextResponse.json(
        {
          error:
            "Your Game Master subscription has expired. Please renew to continue.",
        },
        { status: 403 },
      );
    }

    // Generate game master token
    const token = await generateGameMasterToken(
      user._id.toString(),
      user.email,
      user.name || "Game Master",
    );

    // Update last login on subscription
    await db
      .collection("gamemastersubscriptions")
      .updateOne(
        { _id: subscription._id },
        { $set: { lastLogin: new Date() } },
      );

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || "Game Master",
      },
      subscription: {
        id: subscription._id.toString(),
        referralCode: subscription.referralCode,
        endDate: subscription.endDate,
        totalReferredUsers: subscription.totalReferredUsers,
        totalEarnings: subscription.totalEarnings,
      },
    });

    // Set the game master token cookie
    response.cookies.set("gm_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Game master login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
