import { NextResponse } from "next/server";
import os from "os";
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
  dataUsedMB?: number;
  dataLimitMB?: number;
  dataUsagePercent?: number;
}

interface CollectionStats {
  name: string;
  documents: number;
  sizeMB: number;
  storageSizeMB: number;
  indexSizeMB: number;
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

    // Get all collections from database
    const allCollections = await db.listCollections().toArray();

    // Filter for candle-related collections (both exact matches and pattern matches)
    const candlePatterns = ["candles_1m", "candles_historical_"];
    const candleCollectionNames = allCollections
      .map((c) => c.name)
      .filter((name) =>
        candlePatterns.some(
          (pattern) => name.startsWith(pattern) || name === pattern,
        ),
      );

    const collectionStats: CollectionStats[] = [];

    for (const collName of candleCollectionNames) {
      try {
        const collection = db.collection(collName);

        // Use countDocuments for accurate count (works on all MongoDB versions)
        const docCount = await collection.countDocuments();

        // Try to get collection stats using aggregate $collStats (works on Atlas)
        let sizeMB = 0;
        let storageSizeMB = 0;
        let indexSizeMB = 0;

        try {
          // Method 1: Try collStats command
          const statsResult = await db.command({ collStats: collName });
          sizeMB =
            Math.round(((statsResult.size || 0) / (1024 * 1024)) * 100) / 100;
          storageSizeMB =
            Math.round(((statsResult.storageSize || 0) / (1024 * 1024)) * 100) /
            100;
          indexSizeMB =
            Math.round(
              ((statsResult.totalIndexSize || 0) / (1024 * 1024)) * 100,
            ) / 100;
        } catch {
          // Method 2: Try aggregate $collStats (Atlas-compatible)
          try {
            const aggStats = await collection
              .aggregate([{ $collStats: { storageStats: {} } }])
              .toArray();

            if (aggStats.length > 0 && aggStats[0].storageStats) {
              const storage = aggStats[0].storageStats;
              sizeMB =
                Math.round(((storage.size || 0) / (1024 * 1024)) * 100) / 100;
              storageSizeMB =
                Math.round(((storage.storageSize || 0) / (1024 * 1024)) * 100) /
                100;
              indexSizeMB =
                Math.round(
                  ((storage.totalIndexSize || 0) / (1024 * 1024)) * 100,
                ) / 100;
            }
          } catch {
            // Method 3: Estimate size from document count (rough estimate)
            // Assume ~200 bytes per candle document
            sizeMB = Math.round(((docCount * 200) / (1024 * 1024)) * 100) / 100;
          }
        }

        collectionStats.push({
          name: collName,
          documents: docCount,
          sizeMB,
          storageSizeMB,
          indexSizeMB,
        });
      } catch (err) {
        console.error(`Error getting stats for ${collName}:`, err);
      }
    }

    // Sort by document count descending
    collectionStats.sort((a, b) => b.documents - a.documents);

    return {
      database: {
        name: db.databaseName,
        sizeMB:
          Math.round(((dbStats.dataSize || 0) / (1024 * 1024)) * 100) / 100,
        storageSizeMB:
          Math.round(((dbStats.storageSize || 0) / (1024 * 1024)) * 100) / 100,
        collections: dbStats.collections || 0,
        documents: dbStats.objects || 0,
        indexes: dbStats.indexes || 0,
        indexSizeMB:
          Math.round(((dbStats.indexSize || 0) / (1024 * 1024)) * 100) / 100,
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
