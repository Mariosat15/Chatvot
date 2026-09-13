"use server";

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

export async function POST() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    console.log("\n🧹 Starting Trading Test Data Cleanup...");

    let deletedCount = 0;

    // Pattern to match trading test data
    const testPattern = { $regex: "TEST_TRADE_", $options: "i" };

    // Collections to clean
    const collections = [
      "competitions",
      "competitionparticipants",
      "tradingpositions",
      "tradingorders",
      "tradehistories",
      "wallets",
      "wallettransactions",
    ];

    for (const collectionName of collections) {
      try {
        const result = await db.collection(collectionName).deleteMany({
          $or: [
            { testRunId: testPattern },
            {
              testRunId: {
                $exists: true,
                $regex: "TEST_TRADE_",
                $options: "i",
              },
            },
            { name: testPattern },
            { username: testPattern },
            { isTest: true },
          ],
        });
        if (result.deletedCount > 0) {
          console.log(
            `🗑️ Deleted ${result.deletedCount} from ${collectionName}`,
          );
          deletedCount += result.deletedCount;
        }
      } catch (e) {
        console.warn(`Warning: Failed to clean ${collectionName}:`, e);
      }
    }

    console.log(`✅ Cleanup complete: ${deletedCount} documents deleted\n`);

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} test documents`,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
