import { NextResponse } from "next/server";
import os from "os";
import v8 from "v8";
import { exec } from "child_process";
import { promisify } from "util";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

const execAsync = promisify(exec);

interface PM2Process {
  name: string;
  pid: number;
  pm_id: number;
  monit: {
    memory: number;
    cpu: number;
  };
  pm2_env: {
    status: string;
    pm_uptime: number;
    restart_time: number;
  };
}

async function getPM2Processes(): Promise<PM2Process[]> {
  try {
    const { stdout } = await execAsync("pm2 jlist", { timeout: 5000 });
    const processes = JSON.parse(stdout);
    return processes;
  } catch (error) {
    console.error("Error getting PM2 processes:", error);
    return [];
  }
}

async function getWebSocketConnections(): Promise<{
  connections: number;
  subscribedSymbols: number;
}> {
  try {
    // The WebSocket server runs on WEBSOCKET_PORT (default 3003) internally
    // Use localhost to access the internal HTTP /stats endpoint
    const wsPort = process.env.WEBSOCKET_PORT || "3003";
    const statsUrl = `http://localhost:${wsPort}/stats`;

    const response = await fetch(statsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        connections: data.connections || 0,
        subscribedSymbols: data.subscribedSymbols || 0,
      };
    }
    console.log(
      `[Server Monitor] WebSocket stats fetch failed: ${response.status}`,
    );
    return { connections: 0, subscribedSymbols: 0 };
  } catch (error) {
    // If we can't reach the websocket server, return 0
    console.log(
      `[Server Monitor] WebSocket stats error:`,
      error instanceof Error ? error.message : error,
    );
    return { connections: 0, subscribedSymbols: 0 };
  }
}

interface DatabaseStats {
  name: string;
  sizeMB: number;
  storageSizeMB: number;
  collections: number;
  documents: number;
  indexes: number;
  indexSizeMB: number;
  // Atlas-specific (if available)
  totalSizeMB: number;
  storageLimitMB: number;
  storageUsagePercent: number;
}

interface CollectionStats {
  name: string;
  documents: number;
  sizeMB: number;
  storageSizeMB: number;
  indexSizeMB: number;
  category: "users" | "trading" | "competitions" | "journey" | "candles" | "marketplace" | "system" | "other";
}

// Categorize collection by name
function categorizeCollection(name: string): CollectionStats["category"] {
  const lowerName = name.toLowerCase();
  
  // User-related
  if (lowerName.includes("user") || lowerName.includes("session") || lowerName.includes("account") || lowerName.includes("kyc") || lowerName.includes("verification")) {
    return "users";
  }
  // Trading-related
  if (lowerName.includes("trade") || lowerName.includes("wallet") || lowerName.includes("credit") || lowerName.includes("transaction") || lowerName.includes("order") || lowerName.includes("position")) {
    return "trading";
  }
  // Competition-related
  if (lowerName.includes("competition") || lowerName.includes("challenge") || lowerName.includes("participant") || lowerName.includes("leaderboard")) {
    return "competitions";
  }
  // Journey/Gamification
  if (lowerName.includes("journey") || lowerName.includes("milestone") || lowerName.includes("badge") || lowerName.includes("xp") || lowerName.includes("level") || lowerName.includes("progress")) {
    return "journey";
  }
  // Candles/Market data
  if (lowerName.includes("candle") || lowerName.includes("price") || lowerName.includes("market")) {
    return "candles";
  }
  // Marketplace
  if (lowerName.includes("marketplace") || lowerName.includes("product") || lowerName.includes("purchase") || lowerName.includes("vendor")) {
    return "marketplace";
  }
  // System collections
  if (lowerName.startsWith("system.") || lowerName === "sessions" || lowerName.includes("config") || lowerName.includes("setting")) {
    return "system";
  }
  
  return "other";
}

async function getDatabaseStats(): Promise<{
  database: DatabaseStats;
  collections: CollectionStats[];
} | null> {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) return null;

    // Get database stats
    const dbStats = await db.stats();

    // Get ALL collections from database
    const allCollections = await db.listCollections().toArray();
    const allCollectionNames = allCollections.map((c) => c.name);

    const collectionStats: CollectionStats[] = [];

    // Process ALL collections
    for (const collName of allCollectionNames) {
      try {
        const collection = db.collection(collName);

        // Use estimatedDocumentCount for faster results (or countDocuments for accuracy)
        let docCount = 0;
        try {
          docCount = await collection.estimatedDocumentCount();
        } catch {
          docCount = await collection.countDocuments();
        }

        // Try to get collection stats
        let sizeMB = 0;
        let storageSizeMB = 0;
        let indexSizeMB = 0;

        try {
          // Method 1: Try collStats command
          const statsResult = await db.command({ collStats: collName });
          sizeMB = Math.round(((statsResult.size || 0) / (1024 * 1024)) * 100) / 100;
          storageSizeMB = Math.round(((statsResult.storageSize || 0) / (1024 * 1024)) * 100) / 100;
          indexSizeMB = Math.round(((statsResult.totalIndexSize || 0) / (1024 * 1024)) * 100) / 100;
        } catch {
          // Method 2: Try aggregate $collStats (Atlas-compatible)
          try {
            const aggStats = await collection
              .aggregate([{ $collStats: { storageStats: {} } }])
              .toArray();

            if (aggStats.length > 0 && aggStats[0].storageStats) {
              const storage = aggStats[0].storageStats;
              sizeMB = Math.round(((storage.size || 0) / (1024 * 1024)) * 100) / 100;
              storageSizeMB = Math.round(((storage.storageSize || 0) / (1024 * 1024)) * 100) / 100;
              indexSizeMB = Math.round(((storage.totalIndexSize || 0) / (1024 * 1024)) * 100) / 100;
            }
          } catch {
            // Method 3: Estimate size (rough estimate based on avg doc size)
            sizeMB = Math.round(((docCount * 500) / (1024 * 1024)) * 100) / 100;
          }
        }

        collectionStats.push({
          name: collName,
          documents: docCount,
          sizeMB,
          storageSizeMB,
          indexSizeMB,
          category: categorizeCollection(collName),
        });
      } catch (err) {
        console.error(`Error getting stats for ${collName}:`, err);
      }
    }

    // Sort by size descending (largest first)
    collectionStats.sort((a, b) => b.sizeMB - a.sizeMB);

    // Calculate totals
    const totalSizeMB = Math.round(((dbStats.dataSize || 0) / (1024 * 1024)) * 100) / 100;
    const totalStorageMB = Math.round(((dbStats.storageSize || 0) / (1024 * 1024)) * 100) / 100;
    const totalIndexMB = Math.round(((dbStats.indexSize || 0) / (1024 * 1024)) * 100) / 100;
    const totalUsedMB = totalSizeMB + totalIndexMB;

    // Detect actual storage limit intelligently:
    // 1. Explicit env var override (highest priority)
    // 2. MongoDB's fsTotalSize from dbStats (available on dedicated tiers M10+)
    // 3. Auto-detect tier from actual usage (shared tiers: M0=512MB, M2=2GB, M5=5GB)
    let storageLimitMB: number;
    if (process.env.MONGODB_STORAGE_LIMIT_MB) {
      storageLimitMB = parseInt(process.env.MONGODB_STORAGE_LIMIT_MB, 10);
    } else if (dbStats.fsTotalSize && dbStats.fsTotalSize > 0) {
      // Dedicated tier — fsTotalSize gives the actual disk allocated to the cluster
      storageLimitMB = Math.round(dbStats.fsTotalSize / (1024 * 1024));
    } else {
      // Shared tier — auto-detect based on what's actually stored
      // M0 = 512MB, M2 = 2GB, M5 = 5GB. If usage exceeds a tier, they're on a higher one.
      if (totalUsedMB > 5120) storageLimitMB = 10240;       // M10 (10 GB)
      else if (totalUsedMB > 2048) storageLimitMB = 5120;   // M5  (5 GB)
      else if (totalUsedMB > 512) storageLimitMB = 2048;    // M2  (2 GB)
      else storageLimitMB = 512;                             // M0  (512 MB)
    }
    const storageUsagePercent = Math.min(100, (totalUsedMB / storageLimitMB) * 100);

    return {
      database: {
        name: db.databaseName,
        sizeMB: totalSizeMB,
        storageSizeMB: totalStorageMB,
        collections: dbStats.collections || allCollectionNames.length,
        documents: dbStats.objects || 0,
        indexes: dbStats.indexes || 0,
        indexSizeMB: totalIndexMB,
        totalSizeMB: totalUsedMB,
        storageLimitMB,
        storageUsagePercent: Math.round(storageUsagePercent * 100) / 100,
      },
      collections: collectionStats,
    };
  } catch (error) {
    console.error("Error getting database stats:", error);
    return null;
  }
}

export async function GET() {
  try {
    // Get PM2 process stats
    const pm2Processes = await getPM2Processes();

    // Get WebSocket connection stats
    const wsStats = await getWebSocketConnections();

    // Get database stats
    const dbStats = await getDatabaseStats();

    // Get system stats
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const processes = pm2Processes.map((proc) => ({
      name: proc.name,
      pid: proc.pid,
      status: proc.pm2_env?.status || "unknown",
      cpu: proc.monit?.cpu || 0,
      memory: proc.monit?.memory || 0,
      memoryMB: (proc.monit?.memory || 0) / (1024 * 1024),
      uptime: proc.pm2_env?.pm_uptime
        ? Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000)
        : 0,
      restarts: proc.pm2_env?.restart_time || 0,
    }));

    const heapStats = v8.getHeapStatistics();
    const adminHeapLimitMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);

    const systemStats = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      totalMemory: Math.round((totalMemory / (1024 * 1024 * 1024)) * 100) / 100, // GB
      freeMemory: Math.round((freeMemory / (1024 * 1024 * 1024)) * 100) / 100, // GB
      usedMemory: Math.round((usedMemory / (1024 * 1024 * 1024)) * 100) / 100, // GB
      memoryUsagePercent: (usedMemory / totalMemory) * 100,
      loadAverage: os.loadavg(),
      uptime: os.uptime(),
      adminHeapLimitMB,
    };

    return NextResponse.json({
      processes,
      system: systemStats,
      websocket: wsStats,
      database: dbStats,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Server monitor error:", error);
    return NextResponse.json(
      { error: "Failed to get server stats" },
      { status: 500 },
    );
  }
}
