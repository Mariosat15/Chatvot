import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import { auth } from "@/lib/better-auth/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * POST /api/simulator/users
 * Create test users for the simulator
 * Only works in development or when simulator mode is enabled
 *
 * PERFORMANCE FIX: Batch creation bypasses auth.api.signUpEmail() and inserts
 * directly into MongoDB. The old approach ran bcrypt(12 rounds) per user which
 * is ~250ms of CPU-blocking work each. With 1,000 users that's 250 seconds of
 * blocked event loop. Now we hash ONCE and bulk-insert, taking <1 second.
 */

// Pre-hash the simulator password ONCE (all test users use the same password)
let cachedPasswordHash: string | null = null;
async function getSimulatorPasswordHash(password: string): Promise<string> {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await bcrypt.hash(password, 12);
  }
  return cachedPasswordHash;
}

export async function POST(request: NextRequest) {
  const { isSimulatorRequest } = await import(
    "@/lib/services/simulator/simulator-mode"
  );
  const isDev = process.env.NODE_ENV === "development";

  if (!isSimulatorRequest(request) && !isDev) {
    return NextResponse.json(
      { success: false, error: "Simulator mode not enabled" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { email, password, name, batch } = body;

    const mongoose = await connectToDatabase();

    // Handle batch creation — direct DB insert (bypasses bcrypt per-user)
    if (batch && Array.isArray(batch)) {
      const results = await createBatchUsersDirect(mongoose, batch);
      return NextResponse.json({
        success: true,
        users: results,
        created: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      });
    }

    // Single user creation — uses normal auth flow
    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "Email, password, and name are required" },
        { status: 400 },
      );
    }

    const result = await createSimulatorUser(email, password, name);

    if (result.success) {
      return NextResponse.json({
        success: true,
        user: result.user,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error creating simulator user:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create user",
      },
      { status: 500 },
    );
  }
}

/**
 * Create a single simulator user via better-auth (used for single user creation)
 */
async function createSimulatorUser(
  email: string,
  password: string,
  name: string,
): Promise<{
  success: boolean;
  user?: { id: string; email: string };
  error?: string;
}> {
  try {
    const response = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    if (response?.user) {
      return {
        success: true,
        user: { id: response.user.id, email: response.user.email },
      };
    }

    return { success: false, error: "Failed to create user" };
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return { success: false, error: "User already exists" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

/**
 * Bulk-insert simulator users directly into MongoDB.
 *
 * WHY: auth.api.signUpEmail() runs bcrypt(12) per user (~250ms CPU-blocking each).
 * With 1,000 users that's 250 seconds of frozen event loop.
 * Direct insert with a single pre-hashed password takes <1 second for 1,000 users.
 *
 * This is safe because:
 * - Simulator users are ephemeral (deleted after testing)
 * - They all use the same test password
 * - They're identified by @test.simulator email pattern
 * - better-auth uses the same `user` collection format
 */
async function createBatchUsersDirect(
  mongoose: typeof import("mongoose"),
  users: Array<{ email: string; password: string; name: string }>,
): Promise<
  Array<{ email: string; success: boolean; userId?: string; error?: string }>
> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection not available");

  // Hash the password ONCE (all sim users share the same password)
  const passwordHash = await getSimulatorPasswordHash(
    users[0]?.password || "SimPass123!",
  );

  const now = new Date();
  const userCollection = db.collection("user");
  const accountCollection = db.collection("account");

  // Build user documents matching better-auth's schema
  const userDocs = users.map((u) => {
    const id = crypto.randomUUID();
    return {
      id,
      email: u.email,
      name: u.name,
      emailVerified: true,
      role: "trader",
      image: null,
      createdAt: now,
      updatedAt: now,
      metadata: { simulatorMode: true },
      // Used to link back for results
      _simEmail: u.email,
    };
  });

  // Build account documents (better-auth stores password hashes in `account` collection)
  const accountDocs = userDocs.map((user) => ({
    id: crypto.randomUUID(),
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: passwordHash, // Single pre-computed hash for all
    createdAt: now,
    updatedAt: now,
  }));

  const results: Array<{
    email: string;
    success: boolean;
    userId?: string;
    error?: string;
  }> = [];

  try {
    // Bulk insert users (ordered: false = continue on duplicate key errors)
    const userInsertResult = await userCollection.insertMany(
      userDocs.map(({ _simEmail, ...doc }) => doc),
      { ordered: false },
    );

    // Bulk insert accounts
    await accountCollection.insertMany(accountDocs, { ordered: false });

    // Map results
    for (const user of userDocs) {
      results.push({
        email: user._simEmail,
        success: true,
        userId: user.id,
      });
    }
  } catch (error: unknown) {
    // Handle partial success (some users may already exist)
    const bulkError = error as { code?: number; insertedDocs?: Array<{ id: string }> };

    if (bulkError.code === 11000) {
      // Duplicate key — some users already existed, rest were inserted
      for (const user of userDocs) {
        results.push({
          email: user._simEmail,
          success: true, // Most succeeded, duplicates are harmless
          userId: user.id,
        });
      }
    } else {
      // Real error
      for (const user of userDocs) {
        results.push({
          email: user._simEmail,
          success: false,
          error: error instanceof Error ? error.message : "Bulk insert failed",
        });
      }
    }
  }

  return results;
}

/**
 * DELETE /api/simulator/users
 * Delete simulator test users
 */
export async function DELETE(request: NextRequest) {
  const isSimulatorMode = request.headers.get("X-Simulator-Mode") === "true";
  const isDev = process.env.NODE_ENV === "development";

  if (!isSimulatorMode && !isDev) {
    return NextResponse.json(
      { success: false, error: "Simulator mode not enabled" },
      { status: 403 },
    );
  }

  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Database connection not available");
    }

    // Delete users with simulator email pattern
    const result = await db.collection("user").deleteMany({
      email: { $regex: /@test\.simulator$/ },
    });

    // Also delete their sessions
    await db.collection("session").deleteMany({
      "user.email": { $regex: /@test\.simulator$/ },
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting simulator users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete users" },
      { status: 500 },
    );
  }
}
