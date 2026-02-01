import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

// All collections to clean
const COLLECTIONS_TO_CLEAN = [
  "candles_1m",
  "candles_historical_1m",
  "candles_historical_5m",
  "candles_historical_15m",
  "candles_historical_30m",
  "candles_historical_1h",
  "candles_historical_4h",
  "candles_historical_1d",
  "candles_historical_1w",
  "candles_historical_1M",
];

interface CleanupResult {
  deleted: number;
  before: number;
  after: number;
  dataRange?: { oldest: string; newest: string };
  deleteOldestCutoff?: string;
  keepRecentCutoff?: string;
  operations: string[];
}

/**
 * POST - Run candle cleanup
 *
 * Supports two independent cleanup types that can run together:
 * 1. deleteOldest: Delete the oldest X days of data (from the start of data)
 * 2. keepRecent: Keep only last X days (delete anything older than X days from now)
 *
 * Both can be enabled simultaneously to maintain constant database size
 *
 * Body: {
 *   deleteOldest: { enabled: boolean, days: number }
 *   keepRecent: { enabled: boolean, days: number }
 *   includeHistorical: boolean  // Include historical collections (default: true)
 *
 *   // Legacy support (deprecated)
 *   days: number
 *   mode: 'keepRecent' | 'deleteOldest'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();

    // Support both new and legacy formats
    let deleteOldestConfig = body.deleteOldest;
    let keepRecentConfig = body.keepRecent;
    const includeHistorical = body.includeHistorical ?? true;

    // Legacy support: convert old format to new
    if (
      !deleteOldestConfig &&
      !keepRecentConfig &&
      (body.mode || body.days !== undefined)
    ) {
      if (body.mode === "deleteOldest") {
        deleteOldestConfig = {
          enabled: true,
          days: body.days ?? body.daysToKeep ?? 1,
        };
        keepRecentConfig = { enabled: false, days: 365 };
      } else {
        deleteOldestConfig = { enabled: false, days: 1 };
        keepRecentConfig = {
          enabled: true,
          days: body.days ?? body.daysToKeep ?? 30,
        };
      }
    }

    // Default configs
    deleteOldestConfig = deleteOldestConfig || { enabled: false, days: 1 };
    keepRecentConfig = keepRecentConfig || { enabled: false, days: 365 };

    // Validate
    if (!deleteOldestConfig.enabled && !keepRecentConfig.enabled) {
      return NextResponse.json(
        {
          error: "At least one cleanup type must be enabled",
          success: false,
        },
        { status: 400 },
      );
    }

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 500 },
      );
    }

    console.log(
      `🧹 [Cleanup] Delete Oldest: ${deleteOldestConfig.enabled ? `${deleteOldestConfig.days} days` : "OFF"}`,
    );
    console.log(
      `🧹 [Cleanup] Keep Recent: ${keepRecentConfig.enabled ? `${keepRecentConfig.days} days` : "OFF"}`,
    );
    console.log(`🧹 [Cleanup] Include Historical: ${includeHistorical}`);

    // Determine which collections to clean
    const collectionsToClean = includeHistorical
      ? COLLECTIONS_TO_CLEAN
      : ["candles_1m"];

    let totalDeleted = 0;
    let totalBefore = 0;
    let totalAfter = 0;
    const results: Record<string, CleanupResult> = {};

    for (const collectionName of collectionsToClean) {
      // Check if collection exists
      const collections = await db
        .listCollections({ name: collectionName })
        .toArray();
      if (collections.length === 0) continue;

      const collection = db.collection(collectionName);
      const countBefore = await collection.countDocuments();

      if (countBefore === 0) continue;

      totalBefore += countBefore;

      // Determine the timestamp field
      const isHistorical = collectionName.includes("historical");
      const timeField = isHistorical ? "timestamp" : "t";

      // Get oldest and newest documents for context
      const oldestDoc = await collection.findOne(
        {},
        { sort: { [timeField]: 1 } },
      );
      const newestDoc = await collection.findOne(
        {},
        { sort: { [timeField]: -1 } },
      );

      if (!oldestDoc || !newestDoc) continue;

      // Get timestamps
      let oldestTime: number;
      let newestTime: number;
      if (isHistorical) {
        oldestTime = new Date(oldestDoc.timestamp).getTime();
        newestTime = new Date(newestDoc.timestamp).getTime();
      } else {
        oldestTime = oldestDoc.t * 1000;
        newestTime = newestDoc.t * 1000;
      }

      console.log(
        `🧹 [Cleanup] ${collectionName}: Data range: ${new Date(oldestTime).toISOString()} to ${new Date(newestTime).toISOString()}`,
      );

      const operations: string[] = [];
      let collectionDeleted = 0;
      let deleteOldestCutoff: string | undefined;
      let keepRecentCutoff: string | undefined;

      // OPERATION 1: Delete Oldest (from start of data)
      if (deleteOldestConfig.enabled && deleteOldestConfig.days > 0) {
        const cutoffTime =
          oldestTime + deleteOldestConfig.days * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(cutoffTime);

        let deleteQuery: Record<string, unknown>;
        if (isHistorical) {
          deleteQuery = { timestamp: { $lt: cutoffDate } };
        } else {
          deleteQuery = { t: { $lt: Math.floor(cutoffTime / 1000) } };
        }

        deleteOldestCutoff = cutoffDate.toISOString();
        console.log(
          `🧹 [Cleanup] ${collectionName}: Deleting oldest ${deleteOldestConfig.days} days (before ${deleteOldestCutoff})`,
        );

        const result = await collection.deleteMany(deleteQuery);
        collectionDeleted += result.deletedCount;
        operations.push(
          `Deleted oldest ${deleteOldestConfig.days} days: ${result.deletedCount} records`,
        );
      }

      // OPERATION 2: Keep Recent (delete older than X days from now)
      if (keepRecentConfig.enabled && keepRecentConfig.days >= 0) {
        const cutoffTime =
          Date.now() - keepRecentConfig.days * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(cutoffTime);

        let deleteQuery: Record<string, unknown>;
        if (isHistorical) {
          deleteQuery = { timestamp: { $lt: cutoffDate } };
        } else {
          deleteQuery = { t: { $lt: Math.floor(cutoffTime / 1000) } };
        }

        keepRecentCutoff = cutoffDate.toISOString();
        console.log(
          `🧹 [Cleanup] ${collectionName}: Keeping last ${keepRecentConfig.days} days (deleting before ${keepRecentCutoff})`,
        );

        const result = await collection.deleteMany(deleteQuery);
        collectionDeleted += result.deletedCount;
        operations.push(
          `Keep recent ${keepRecentConfig.days} days: ${result.deletedCount} records`,
        );
      }

      const countAfter = await collection.countDocuments();
      totalDeleted += collectionDeleted;
      totalAfter += countAfter;

      console.log(
        `🧹 [Cleanup] ${collectionName}: Deleted ${collectionDeleted} of ${countBefore}`,
      );

      results[collectionName] = {
        deleted: collectionDeleted,
        before: countBefore,
        after: countAfter,
        dataRange: {
          oldest: new Date(oldestTime).toISOString(),
          newest: new Date(newestTime).toISOString(),
        },
        deleteOldestCutoff,
        keepRecentCutoff,
        operations,
      };
    }

    // Estimate size (avg ~200 bytes per doc)
    const avgDocSize = 200;
    const freedSpace = totalDeleted * avgDocSize;

    console.log(
      `🧹 [Cleanup] Total: Deleted ${totalDeleted} candles, freed ~${(freedSpace / 1024 / 1024).toFixed(2)} MB`,
    );

    const cleanupResult = {
      success: true,
      deleteOldest: deleteOldestConfig,
      keepRecent: keepRecentConfig,
      includeHistorical,
      deletedCount: totalDeleted,
      before: {
        count: totalBefore,
        sizeMB: ((totalBefore * avgDocSize) / 1024 / 1024).toFixed(2),
      },
      after: {
        count: totalAfter,
        sizeMB: ((totalAfter * avgDocSize) / 1024 / 1024).toFixed(2),
      },
      freedMB: (freedSpace / 1024 / 1024).toFixed(2),
      collections: results,
      timestamp: new Date().toISOString(),
    };

    // Update settings with last run time and results
    const MarketDataSettings = mongoose.models.MarketDataSettings;
    if (MarketDataSettings) {
      await MarketDataSettings.findOneAndUpdate(
        { key: "market_data_settings" },
        {
          $set: {
            "cleanup.lastRun": new Date(),
            "cleanup.lastResults": cleanupResult,
          },
        },
      );
    }

    return NextResponse.json({
      success: true,
      cleanup: cleanupResult,
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
