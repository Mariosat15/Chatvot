"use server";

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

// Define required indexes for optimal performance
// COMPREHENSIVE LIST - includes leaderboard, trading, and all critical queries
// Collection names must match actual DB: "user" = Better Auth, Mongoose defaults = lowercase plural
const REQUIRED_INDEXES = {
  // ============================================
  // USER & AUTH INDEXES
  // ============================================
  /** Better Auth collection - used by getAllUsers (leaderboard) and getUserById; critical for scale */
  user: [
    { keys: { id: 1 }, options: { name: "id_1" } },
    { keys: { email: 1 }, options: { unique: true, name: "email_1" } },
    { keys: { role: 1 }, options: { name: "role_1" } },
    { keys: { email: 1, role: 1 }, options: { name: "email_1_role_1" } },
  ],
  users: [
    { keys: { email: 1 }, options: { unique: true, name: "email_1" } },
    { keys: { username: 1 }, options: { name: "username_1" } },
    { keys: { role: 1 }, options: { name: "role_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  /** Matchmaking / presence - find({ userId: { $in } }) */
  userpresences: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { status: 1 }, options: { name: "status_1" } },
    { keys: { lastHeartbeat: -1 }, options: { name: "lastHeartbeat_-1" } },
    {
      keys: { status: 1, acceptingChallenges: 1 },
      options: { name: "status_1_acceptingChallenges_1" },
    },
  ],
  userlevels: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { currentXP: -1 }, options: { name: "currentXP_-1" } },
    { keys: { level: -1 }, options: { name: "level_-1" } },
  ],
  userbadges: [
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    {
      keys: { userId: 1, badgeId: 1 },
      options: { unique: true, name: "userId_1_badgeId_1" },
    },
    { keys: { badgeId: 1 }, options: { name: "badgeId_1" } },
  ],

  // ============================================
  // COMPETITION INDEXES (LEADERBOARD CRITICAL)
  // ============================================
  competitions: [
    {
      keys: { status: 1, startTime: 1 },
      options: { name: "status_1_startTime_1" },
    },
    {
      keys: { status: 1, endTime: 1 },
      options: { name: "status_1_endTime_1" },
    },
    { keys: { slug: 1 }, options: { unique: true, name: "slug_1" } },
    { keys: { endTime: 1 }, options: { name: "endTime_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  competitionparticipants: [
    {
      keys: { competitionId: 1, userId: 1 },
      options: { unique: true, name: "competitionId_1_userId_1" },
    },
    {
      keys: { competitionId: 1, status: 1 },
      options: { name: "competitionId_1_status_1" },
    },
    {
      keys: { competitionId: 1, pnl: -1 },
      options: { name: "competitionId_1_pnl_-1" },
    }, // Leaderboard sorting
    {
      keys: { competitionId: 1, currentCapital: -1 },
      options: { name: "competitionId_1_currentCapital_-1" },
    },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    {
      keys: { userId: 1, currentRank: 1 },
      options: { name: "userId_1_currentRank_1" },
    }, // Global leaderboard
    { keys: { currentRank: 1 }, options: { name: "currentRank_1" } }, // Winner queries
  ],

  // ============================================
  // CHALLENGE INDEXES
  // ============================================
  challenges: [
    {
      keys: { status: 1, endTime: 1 },
      options: { name: "status_1_endTime_1" },
    },
    { keys: { challengerId: 1 }, options: { name: "challengerId_1" } },
    { keys: { challengedId: 1 }, options: { name: "challengedId_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  challengeparticipants: [
    {
      keys: { challengeId: 1, role: 1 },
      options: { name: "challengeId_1_role_1" },
    },
    {
      keys: { challengeId: 1, status: 1 },
      options: { name: "challengeId_1_status_1" },
    },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    {
      keys: { userId: 1, isWinner: 1 },
      options: { name: "userId_1_isWinner_1" },
    }, // Global leaderboard
  ],

  // ============================================
  // TRADING INDEXES
  // ============================================
  tradingpositions: [
    {
      keys: { participantId: 1, status: 1 },
      options: { name: "participantId_1_status_1" },
    },
    {
      keys: { competitionId: 1, status: 1 },
      options: { name: "competitionId_1_status_1" },
    },
    { keys: { userId: 1, status: 1 }, options: { name: "userId_1_status_1" } },
    { keys: { symbol: 1, status: 1 }, options: { name: "symbol_1_status_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
    { keys: { closedAt: -1 }, options: { name: "closedAt_-1" } }, // Recent trades
  ],
  tradingorders: [
    {
      keys: { participantId: 1, status: 1 },
      options: { name: "participantId_1_status_1" },
    },
    {
      keys: { competitionId: 1, status: 1 },
      options: { name: "competitionId_1_status_1" },
    },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],

  // ============================================
  // WITHDRAWAL REQUESTS (wallet/withdraw hot path)
  // ============================================
  withdrawalrequests: [
    {
      keys: { userId: 1, status: 1, createdAt: -1 },
      options: { name: "userId_1_status_1_createdAt_-1" },
    },
    { keys: { status: 1, createdAt: -1 }, options: { name: "status_1_createdAt_-1" } },
    { keys: { isSandbox: 1, status: 1 }, options: { name: "isSandbox_1_status_1" } },
    { keys: { requestedAt: -1 }, options: { name: "requestedAt_-1" } },
    { keys: { payoutId: 1 }, options: { name: "payoutId_1" } },
  ],

  // ============================================
  // WALLET & FINANCIAL INDEXES
  // ============================================
  wallets: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
    { keys: { balance: -1 }, options: { name: "balance_-1" } },
  ],
  creditwallets: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_1" } },
  ],
  wallettransactions: [
    {
      keys: { userId: 1, createdAt: -1 },
      options: { name: "userId_1_createdAt_-1" },
    },
    { keys: { walletId: 1, type: 1 }, options: { name: "walletId_1_type_1" } },
    { keys: { status: 1 }, options: { name: "status_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
    { keys: { competitionId: 1 }, options: { name: "competitionId_1" } },
    { keys: { challengeId: 1 }, options: { name: "challengeId_1" } },
  ],
  platformtransactions: [
    {
      keys: { type: 1, createdAt: -1 },
      options: { name: "type_1_createdAt_-1" },
    },
    { keys: { competitionId: 1 }, options: { name: "competitionId_1" } },
    { keys: { challengeId: 1 }, options: { name: "challengeId_1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],

  // ============================================
  // NOTIFICATION INDEXES (model uses isRead, not read)
  // ============================================
  notifications: [
    { keys: { userId: 1, isRead: 1 }, options: { name: "userId_1_isRead_1" } },
    {
      keys: { userId: 1, isRead: 1, createdAt: -1 },
      options: { name: "userId_1_isRead_1_createdAt_-1" },
    },
    {
      keys: { userId: 1, category: 1, createdAt: -1 },
      options: { name: "userId_1_category_1_createdAt_-1" },
    },
    { keys: { userId: 1, createdAt: -1 }, options: { name: "userId_1_createdAt_-1" } },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],

  // ============================================
  // MARKET DATA INDEXES (PRICE & CANDLES)
  // ============================================
  pricelogs: [
    {
      keys: { symbol: 1, timestamp: -1 },
      options: { name: "symbol_1_timestamp_-1" },
    },
    {
      keys: { timestamp: 1 },
      options: { expireAfterSeconds: 86400, name: "timestamp_1_ttl" },
    }, // TTL index - 24 hours
  ],
  candles_1m: [
    {
      keys: { symbol: 1, t: -1 },
      options: { name: "symbol_1_t_-1" },
    },
    {
      keys: { symbol: 1, t: 1 },
      options: { unique: true, name: "symbol_1_t_1" },
    },
  ],
  candles_historical_1m: [
    {
      keys: { symbol: 1, timestamp: -1 },
      options: { name: "symbol_1_timestamp_-1" },
    },
    {
      keys: { symbol: 1, timestamp: 1 },
      options: { name: "symbol_1_timestamp_1" },
    },
  ],
  candles_historical_5m: [
    {
      keys: { symbol: 1, timestamp: -1 },
      options: { name: "symbol_1_timestamp_-1" },
    },
    {
      keys: { symbol: 1, timestamp: 1 },
      options: { name: "symbol_1_timestamp_1" },
    },
  ],
  candles_historical_15m: [
    {
      keys: { symbol: 1, timestamp: -1 },
      options: { name: "symbol_1_timestamp_-1" },
    },
    {
      keys: { symbol: 1, timestamp: 1 },
      options: { name: "symbol_1_timestamp_1" },
    },
  ],
  candles_historical_30m: [
    {
      keys: { symbol: 1, timestamp: -1 },
      options: { name: "symbol_1_timestamp_-1" },
    },
    {
      keys: { symbol: 1, timestamp: 1 },
      options: { name: "symbol_1_timestamp_1" },
    },
  ],
  candles_historical_1h: [
    {
      keys: { symbol: 1, timestamp: -1 },
      options: { name: "symbol_1_timestamp_-1" },
    },
    {
      keys: { symbol: 1, timestamp: 1 },
      options: { name: "symbol_1_timestamp_1" },
    },
  ],
  candles_historical_4h: [
    {
      keys: { symbol: 1, timestamp: -1 },
      options: { name: "symbol_1_timestamp_-1" },
    },
    {
      keys: { symbol: 1, timestamp: 1 },
      options: { name: "symbol_1_timestamp_1" },
    },
  ],
  candles_historical_1d: [
    {
      keys: { symbol: 1, timestamp: -1 },
      options: { name: "symbol_1_timestamp_-1" },
    },
    {
      keys: { symbol: 1, timestamp: 1 },
      options: { name: "symbol_1_timestamp_1" },
    },
  ],

  // ============================================
  // MARKETPLACE INDEXES
  // ============================================
  marketplaceitems: [
    { keys: { slug: 1 }, options: { unique: true, name: "slug_1" } },
    {
      keys: { category: 1, isActive: 1 },
      options: { name: "category_1_isActive_1" },
    },
    { keys: { isActive: 1 }, options: { name: "isActive_1" } },
  ],
  userpurchases: [
    {
      keys: { userId: 1, itemId: 1 },
      options: { unique: true, name: "userId_1_itemId_1" },
    },
    { keys: { userId: 1 }, options: { name: "userId_1" } },
  ],

  // ============================================
  // AUDIT & SECURITY INDEXES
  // ============================================
  auditlogs: [
    {
      keys: { userId: 1, createdAt: -1 },
      options: { name: "userId_1_createdAt_-1" },
    },
    {
      keys: { action: 1, createdAt: -1 },
      options: { name: "action_1_createdAt_-1" },
    },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
  fraudevents: [
    {
      keys: { userId: 1, createdAt: -1 },
      options: { name: "userId_1_createdAt_-1" },
    },
    {
      keys: { type: 1, createdAt: -1 },
      options: { name: "type_1_createdAt_-1" },
    },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" } },
  ],
};

interface IndexInfo {
  collection: string;
  name: string;
  keys: Record<string, number>;
  required: boolean;
  exists: boolean;
  unique?: boolean;
  ttl?: number;
  /** When exists: true by same keys but different name (avoids duplicate create) */
  equivalentIndexName?: string;
  matchedByKeys?: boolean;
}

interface IndexStatus {
  collection: string;
  totalRequired: number;
  existing: number;
  missing: number;
  indexes: IndexInfo[];
}

// GET - Check index status
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const results: IndexStatus[] = [];
    let totalMissing = 0;
    let totalExisting = 0;

    for (const [collectionName, requiredIndexes] of Object.entries(
      REQUIRED_INDEXES,
    )) {
      try {
        // Check if collection exists
        const collections = await db
          .listCollections({ name: collectionName })
          .toArray();
        const collectionExists = collections.length > 0;

        const indexes: IndexInfo[] = [];
        let existingIndexes: Array<{
          name?: string;
          key: Record<string, number>;
          unique?: boolean;
          expireAfterSeconds?: number;
        }> = [];

        if (collectionExists) {
          existingIndexes = await db.collection(collectionName).indexes();
        }

        const keysToString = (key: Record<string, number>) =>
          JSON.stringify(key);

        for (const required of requiredIndexes) {
          const indexName = required.options.name;
          const requiredKeysStr = keysToString(required.keys);
          const byName = existingIndexes.find((idx) => idx.name === indexName);
          const byKeys = existingIndexes.find(
            (idx) => keysToString(idx.key) === requiredKeysStr,
          );
          const exists = !!byName || !!byKeys;
          const equivalentIndexName =
            !byName && byKeys ? byKeys.name : undefined;
          const matchedByKeys = !byName && !!byKeys;

          indexes.push({
            collection: collectionName,
            name: indexName,
            keys: required.keys,
            required: true,
            exists,
            unique: required.options.unique,
            ttl: required.options.expireAfterSeconds,
            equivalentIndexName,
            matchedByKeys,
          });

          if (exists) {
            totalExisting++;
          } else {
            totalMissing++;
          }
        }

        results.push({
          collection: collectionName,
          totalRequired: requiredIndexes.length,
          existing: indexes.filter((i) => i.exists).length,
          missing: indexes.filter((i) => !i.exists).length,
          indexes,
        });
      } catch (error) {
        console.warn(`Error checking indexes for ${collectionName}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalCollections: results.length,
        totalRequired: totalExisting + totalMissing,
        totalExisting,
        totalMissing,
        healthScore:
          totalMissing === 0
            ? 100
            : Math.round(
                (totalExisting / (totalExisting + totalMissing)) * 100,
              ),
      },
      /** System-wide: required = app-defined; existing = in DB (by name or same keys). Create only adds indexes not already present (no duplicates). */
      message:
        "Required indexes are defined by the app. 'Existing' includes indexes matched by same key spec (different name). Create Missing only adds indexes that do not already exist in the DB.",
      collections: results,
    });
  } catch (error) {
    console.error("Error checking indexes:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// POST - Create missing indexes
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { collections: targetCollections, createAll } = body;

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const results: {
      collection: string;
      index: string;
      status: "created" | "exists" | "error";
      error?: string;
    }[] = [];

    const collectionsToProcess = createAll
      ? Object.keys(REQUIRED_INDEXES)
      : targetCollections || [];

    for (const collectionName of collectionsToProcess) {
      const requiredIndexes =
        REQUIRED_INDEXES[collectionName as keyof typeof REQUIRED_INDEXES];
      if (!requiredIndexes) continue;

      try {
        // Get existing indexes
        const existingIndexes = await db
          .collection(collectionName)
          .indexes()
          .catch(() => []);
        const existingNames = new Set(existingIndexes.map((idx) => idx.name));

        for (const required of requiredIndexes) {
          const indexName = required.options.name;

          // Check if index with same name exists
          if (existingNames.has(indexName)) {
            results.push({
              collection: collectionName,
              index: indexName,
              status: "exists",
            });
            continue;
          }

          // Check if an index with the same keys already exists (different name)
          const keysString = JSON.stringify(required.keys);
          const existingWithSameKeys = existingIndexes.find(
            (idx) => JSON.stringify(idx.key) === keysString,
          );

          if (existingWithSameKeys) {
            results.push({
              collection: collectionName,
              index: indexName,
              status: "exists",
              error: `Equivalent index "${existingWithSameKeys.name}" already exists (no duplicate created)`,
            });
            continue;
          }

          try {
            // Create the index
            await db.collection(collectionName).createIndex(required.keys, {
              ...required.options,
              background: true,
            });

            results.push({
              collection: collectionName,
              index: indexName,
              status: "created",
            });
          } catch (indexError) {
            // Handle IndexOptionsConflict gracefully
            const errorMessage =
              indexError instanceof Error
                ? indexError.message
                : "Unknown error";
            const isConflict =
              errorMessage.includes("equivalent index") ||
              errorMessage.includes("IndexOptionsConflict") ||
              (indexError as { code?: number })?.code === 85;

            results.push({
              collection: collectionName,
              index: indexName,
              status: isConflict ? "exists" : "error",
              error: isConflict
                ? "Equivalent index exists with different name"
                : errorMessage,
            });

            if (!isConflict) {
              console.error(
                "Failed to create index",
                indexName,
                "on",
                collectionName,
                ":",
                indexError,
              );
            }
          }
        }
      } catch (collError) {
        console.error("Error processing", collectionName, ":", collError);
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const existed = results.filter((r) => r.status === "exists").length;
    const failed = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      summary: {
        created,
        existed,
        failed,
        total: results.length,
      },
      results,
    });
  } catch (error) {
    console.error("Error creating indexes:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
