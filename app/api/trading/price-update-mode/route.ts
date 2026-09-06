import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

/**
 * GET - Get current price update mode and intervals
 * This is called by the chart to determine whether to use polling or websocket
 *
 * NOTE: We query MongoDB directly to avoid Mongoose model caching issues
 * between the admin app and main app
 */
export async function GET() {
  try {
    await connectToDatabase();

    // Query MongoDB collection directly (bypasses Mongoose model cache)
    // The admin app creates this in collection: marketdatasettings
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const settings = await db
      .collection("marketdatasettings")
      .findOne({ key: "market_data_settings" });

    return NextResponse.json({
      mode: settings?.priceUpdateMode || "polling",
      pollingIntervalMs: settings?.pollingIntervalMs || 200,
      websocketIntervalMs: settings?.websocketIntervalMs || 200,
      cacheTTL: 10000,
    });
  } catch (error) {
    console.error("Error getting price update mode:", error);
    // Default to polling on error
    return NextResponse.json({
      mode: "polling",
      pollingIntervalMs: 200,
      websocketIntervalMs: 200,
      cacheTTL: 10000,
    });
  }
}
