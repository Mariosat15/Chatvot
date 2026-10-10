/**
 * Worker Database Configuration
 *
 * Connects to the same MongoDB as the main app.
 * Pool sizes are read from MDB Cluster settings (Admin → MDB Cluster).
 * Falls back to sensible defaults if settings are not configured.
 */

import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from root .env file
// Works for both dev (tsx) and production (compiled to dist/worker)
// Use path.sep to check for exact 'dist' folder (not substring like 'distributed')
const isCompiledBuild = __dirname.split(path.sep).includes("dist");
const envPath = isCompiledBuild
  ? path.resolve(__dirname, "../../../.env") // From dist/worker/config/
  : path.resolve(__dirname, "../../.env"); // From worker/config/
dotenv.config({ path: envPath });

let isConnected = false;

/**
 * Load worker pool settings from MDB Cluster settings in DB.
 * Falls back to defaults (5/1) on any error.
 */
async function loadWorkerPoolSettings(
  uri: string,
): Promise<{ maxPoolSize: number; minPoolSize: number }> {
  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      serverMonitoringMode: "poll",
    });
    await client.connect();
    const doc = await client
      .db()
      .collection("mdbclustersettings")
      .findOne({ _id: "global-mdb-cluster-settings" as any });
    await client.close();

    if (doc) {
      return {
        maxPoolSize: doc.workerMaxPoolSize ?? 5,
        minPoolSize: doc.workerMinPoolSize ?? 1,
      };
    }
  } catch {
    // Settings not available — use defaults
  }
  return { maxPoolSize: 5, minPoolSize: 1 };
}

export async function connectToDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI not found in environment variables");
  }

  try {
    const pool = await loadWorkerPoolSettings(MONGODB_URI);

    // Don't override dbName - use whatever is in the connection string
    // The URI already specifies the database (e.g., .../chatvolt?...)
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: pool.maxPoolSize,
      minPoolSize: pool.minPoolSize,
      bufferCommands: false,
      serverMonitoringMode: "poll",
    });

    isConnected = true;
    console.log(
      `✅ Worker connected to MongoDB (pool: ${pool.maxPoolSize}/${pool.minPoolSize})`,
    );
  } catch (error) {
    console.error("❌ Worker MongoDB connection error:", error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("👋 Worker disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Worker MongoDB disconnect error:", error);
  }
}
