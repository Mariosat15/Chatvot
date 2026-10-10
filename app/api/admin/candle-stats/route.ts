import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

/**
 * Get candle database statistics
 * Use this to monitor database growth
 */
export async function GET() {
  try {
    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 500 },
      );
    }

    // Get collection stats using aggregate (stats() is deprecated)
    const collection = db.collection("candles_1m");
    const totalCount = await collection.countDocuments();

    // Get storage stats using $collStats
    let storageSize = 0;
    let avgObjSize = 0;
    let indexCount = 0;
    let totalIndexSize = 0;

    try {
      const collStats = await collection
        .aggregate([{ $collStats: { storageStats: {} } }])
        .toArray();

      if (collStats.length > 0 && collStats[0].storageStats) {
        storageSize = collStats[0].storageStats.size || 0;
        avgObjSize = collStats[0].storageStats.avgObjSize || 0;
        indexCount = collStats[0].storageStats.nindexes || 0;
        totalIndexSize = collStats[0].storageStats.totalIndexSize || 0;
      }
    } catch {
      // Fallback: estimate based on count (avg ~100 bytes per candle doc)
      storageSize = totalCount * 100;
      avgObjSize = 100;
    }

    // Get date range
    const oldestCandle = await collection.findOne({}, { sort: { t: 1 } });
    const newestCandle = await collection.findOne({}, { sort: { t: -1 } });

    // Count by symbol
    const symbolCounts = await collection
      .aggregate([
        { $group: { _id: "$symbol", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    return NextResponse.json({
      totalCandles: totalCount,
      storage: {
        bytes: storageSize,
        mb: (storageSize / 1024 / 1024).toFixed(2),
        avgDocBytes: Math.round(avgObjSize),
      },
      indexes: {
        count: indexCount,
        sizeBytes: totalIndexSize,
        sizeMB: (totalIndexSize / 1024 / 1024).toFixed(2),
      },
      dateRange: {
        oldest: oldestCandle
          ? new Date(oldestCandle.t * 1000).toISOString()
          : null,
        newest: newestCandle
          ? new Date(newestCandle.t * 1000).toISOString()
          : null,
        daysOfData:
          oldestCandle && newestCandle
            ? Math.round((newestCandle.t - oldestCandle.t) / 86400)
            : 0,
      },
      symbolCounts: symbolCounts.slice(0, 10), // Top 10 symbols
      projectedGrowth: {
        perDay: "~9.5 MB",
        perMonth: "~285 MB",
        perYear: "~3.4 GB",
      },
      recommendation:
        totalCount > 500000
          ? "⚠️ Consider running cleanup script to remove old candles"
          : "✅ Database size is healthy",
    });
  } catch (error) {
    console.error("Error getting candle stats:", error);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
