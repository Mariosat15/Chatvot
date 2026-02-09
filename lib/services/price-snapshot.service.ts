/**
 * Price Snapshot Service
 *
 * Takes periodic snapshots of all forex prices during active competitions.
 * Used for risk mitigation - provides fallback prices for emergency finalization.
 */

import { ForexSymbol } from "./pnl-calculator.service";
import { priceHealthMonitor } from "./price-health-monitor.service";
import { connectToDatabase } from "@/database/mongoose";

// ============================================
// Types
// ============================================

export interface PriceSnapshotData {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  source: "websocket" | "api" | "rest" | "cache" | "fallback";
  isValid: boolean;
  staleDuration?: number;
}

export interface SnapshotResult {
  success: boolean;
  snapshotId?: string;
  timestamp: Date;
  healthStatus: "healthy" | "degraded" | "critical";
  priceCount: number;
  healthyCount: number;
}

// ============================================
// Configuration
// ============================================

const SNAPSHOT_INTERVAL_MS = 60000; // Take snapshot every 1 minute
const MAX_SNAPSHOTS_PER_COMPETITION = 1440; // Keep 24 hours of snapshots (at 1/min)

// ============================================
// Global State
// ============================================

const GLOBAL_KEY = "__PRICE_SNAPSHOT_SERVICE__";

interface SnapshotGlobalState {
  snapshotTimer: NodeJS.Timeout | null;
  isRunning: boolean;
  lastSnapshotTime: number;
  snapshotCount: number;
}

function getGlobalState(): SnapshotGlobalState {
  if (!(globalThis as Record<string, unknown>)[GLOBAL_KEY]) {
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = {
      snapshotTimer: null,
      isRunning: false,
      lastSnapshotTime: 0,
      snapshotCount: 0,
    };
  }
  return (globalThis as Record<string, unknown>)[
    GLOBAL_KEY
  ] as SnapshotGlobalState;
}

// ============================================
// Price Snapshot Service Class
// ============================================

class PriceSnapshotService {
  private get state() {
    return getGlobalState();
  }

  /**
   * Start automatic snapshot collection
   */
  start(): void {
    if (this.state.isRunning) {
      return;
    }
    this.state.isRunning = true;

    // Take initial snapshot
    this.takeSnapshot("auto").catch(console.error);

    // Schedule periodic snapshots
    this.state.snapshotTimer = setInterval(() => {
      this.takeSnapshot("auto").catch(console.error);
    }, SNAPSHOT_INTERVAL_MS);
  }

  /**
   * Stop automatic snapshot collection
   */
  stop(): void {
    if (this.state.snapshotTimer) {
      clearInterval(this.state.snapshotTimer);
      this.state.snapshotTimer = null;
    }
    this.state.isRunning = false;
  }

  /**
   * Take a snapshot of all prices
   */
  async takeSnapshot(
    type: "auto" | "manual" | "alert",
    competitionId?: string,
    triggeredBy?: string,
    notes?: string,
  ): Promise<SnapshotResult> {
    try {
      const timestamp = new Date();
      const healthSnapshot = priceHealthMonitor.getHealthSnapshot();

      // Collect price data
      const prices: PriceSnapshotData[] = [];
      let healthyCount = 0;

      for (const symbolInfo of healthSnapshot.symbols) {
        const price: PriceSnapshotData = {
          symbol: symbolInfo.symbol,
          bid: symbolInfo.lastPrice * 0.99995, // Approximate bid
          ask: symbolInfo.lastPrice * 1.00005, // Approximate ask
          mid: symbolInfo.lastPrice,
          spread: symbolInfo.lastPrice * 0.0001,
          source: symbolInfo.source,
          isValid: symbolInfo.status !== "critical" && !symbolInfo.isStale,
          staleDuration: symbolInfo.staleDuration,
        };

        // Try to get more accurate bid/ask from price cache
        try {
          const priceCache = await this.getPriceFromCache(symbolInfo.symbol);
          if (priceCache) {
            price.bid = priceCache.bid;
            price.ask = priceCache.ask;
            price.mid = priceCache.mid;
            price.spread = priceCache.spread;
            price.source = priceCache.source;
          }
        } catch {
          // Use approximated values
        }

        prices.push(price);
        if (price.isValid) healthyCount++;
      }

      // Save to database
      await connectToDatabase();
      const PriceSnapshot = (
        await import("@/database/models/trading/price-snapshot.model")
      ).default;

      const snapshot = await PriceSnapshot.create({
        competitionId,
        timestamp,
        snapshotType: type,
        triggeredBy,
        prices,
        healthStatus: healthSnapshot.overallStatus,
        connectionStatus: healthSnapshot.connectionStatus,
        healthySymbolCount: healthyCount,
        totalSymbolCount: prices.length,
        notes,
      });

      this.state.lastSnapshotTime = timestamp.getTime();
      this.state.snapshotCount++;

      // Cleanup old snapshots if needed (for specific competition)
      if (competitionId) {
        await this.cleanupOldSnapshots(competitionId);
      }

      return {
        success: true,
        snapshotId: snapshot._id.toString(),
        timestamp,
        healthStatus: healthSnapshot.overallStatus,
        priceCount: prices.length,
        healthyCount,
      };
    } catch (error) {
      console.error("📸 [PriceSnapshot] Error taking snapshot:", error);
      return {
        success: false,
        timestamp: new Date(),
        healthStatus: "critical",
        priceCount: 0,
        healthyCount: 0,
      };
    }
  }

  /**
   * Get price from websocket cache
   */
  private async getPriceFromCache(symbol: ForexSymbol): Promise<{
    bid: number;
    ask: number;
    mid: number;
    spread: number;
    source: "websocket" | "api" | "rest" | "cache" | "fallback";
  } | null> {
    try {
      const { getCachedPrice } = await import("./websocket-price-streamer");
      const price = getCachedPrice(symbol);
      if (price) {
        return {
          bid: price.bid,
          ask: price.ask,
          mid: price.mid,
          spread: price.spread,
          source: price.source,
        };
      }
    } catch {
      // Cache not available
    }
    return null;
  }

  /**
   * Cleanup old snapshots to prevent database bloat
   */
  private async cleanupOldSnapshots(competitionId: string): Promise<void> {
    try {
      const PriceSnapshot = (
        await import("@/database/models/trading/price-snapshot.model")
      ).default;

      // Count snapshots for this competition
      const count = await PriceSnapshot.countDocuments({ competitionId });

      if (count > MAX_SNAPSHOTS_PER_COMPETITION) {
        // Delete oldest snapshots beyond limit
        const toDelete = count - MAX_SNAPSHOTS_PER_COMPETITION;
        const oldSnapshots = await PriceSnapshot.find({ competitionId })
          .sort({ timestamp: 1 })
          .limit(toDelete)
          .select("_id");

        const ids = oldSnapshots.map((s) => s._id);
        await PriceSnapshot.deleteMany({ _id: { $in: ids } });
      }
    } catch (error) {
      console.error("Error cleaning up snapshots:", error);
    }
  }

  /**
   * Get the last healthy snapshot for a competition or globally
   */
  async getLastHealthySnapshot(competitionId?: string): Promise<{
    snapshotId: string;
    timestamp: Date;
    prices: Map<string, { bid: number; ask: number }>;
  } | null> {
    try {
      await connectToDatabase();
      const PriceSnapshot = (
        await import("@/database/models/trading/price-snapshot.model")
      ).default;

      const query: Record<string, unknown> = { healthStatus: "healthy" };
      if (competitionId) {
        query.competitionId = competitionId;
      }

      const snapshot = await PriceSnapshot.findOne(query).sort({
        timestamp: -1,
      });
      if (!snapshot) return null;

      const prices = new Map<string, { bid: number; ask: number }>();
      for (const price of snapshot.prices) {
        if (price.isValid) {
          prices.set(price.symbol, { bid: price.bid, ask: price.ask });
        }
      }

      return {
        snapshotId: snapshot._id.toString(),
        timestamp: snapshot.timestamp,
        prices,
      };
    } catch (error) {
      console.error("Error getting last healthy snapshot:", error);
      return null;
    }
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshotById(snapshotId: string): Promise<{
    snapshotId: string;
    timestamp: Date;
    healthStatus: string;
    prices: Map<string, { bid: number; ask: number }>;
  } | null> {
    try {
      await connectToDatabase();
      const PriceSnapshot = (
        await import("@/database/models/trading/price-snapshot.model")
      ).default;

      const snapshot = await PriceSnapshot.findById(snapshotId);
      if (!snapshot) return null;

      const prices = new Map<string, { bid: number; ask: number }>();
      for (const price of snapshot.prices) {
        prices.set(price.symbol, { bid: price.bid, ask: price.ask });
      }

      return {
        snapshotId: snapshot._id.toString(),
        timestamp: snapshot.timestamp,
        healthStatus: snapshot.healthStatus,
        prices,
      };
    } catch (error) {
      console.error("Error getting snapshot by ID:", error);
      return null;
    }
  }

  /**
   * Get recent snapshots for a competition
   */
  async getRecentSnapshots(
    competitionId?: string,
    limit: number = 60,
  ): Promise<
    Array<{
      snapshotId: string;
      timestamp: Date;
      healthStatus: string;
      healthyCount: number;
      totalCount: number;
      snapshotType: string;
    }>
  > {
    try {
      await connectToDatabase();
      const PriceSnapshot = (
        await import("@/database/models/trading/price-snapshot.model")
      ).default;

      const query: Record<string, unknown> = {};
      if (competitionId) {
        query.competitionId = competitionId;
      }

      const snapshots = await PriceSnapshot.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .select(
          "timestamp healthStatus healthySymbolCount totalSymbolCount snapshotType",
        );

      return snapshots.map((s) => ({
        snapshotId: s._id.toString(),
        timestamp: s.timestamp,
        healthStatus: s.healthStatus,
        healthyCount: s.healthySymbolCount,
        totalCount: s.totalSymbolCount,
        snapshotType: s.snapshotType,
      }));
    } catch (error) {
      console.error("Error getting recent snapshots:", error);
      return [];
    }
  }

  /**
   * Mark a snapshot as used for finalization
   */
  async markSnapshotAsUsed(
    snapshotId: string,
    competitionId: string,
  ): Promise<void> {
    try {
      await connectToDatabase();
      const PriceSnapshot = (
        await import("@/database/models/trading/price-snapshot.model")
      ).default;

      await PriceSnapshot.findByIdAndUpdate(snapshotId, {
        $set: {
          isUsedForFinalization: true,
          usedForCompetitionId: competitionId,
        },
      });
    } catch (error) {
      console.error("Error marking snapshot as used:", error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    lastSnapshotTime: number;
    snapshotCount: number;
    snapshotInterval: number;
  } {
    return {
      isRunning: this.state.isRunning,
      lastSnapshotTime: this.state.lastSnapshotTime,
      snapshotCount: this.state.snapshotCount,
      snapshotInterval: SNAPSHOT_INTERVAL_MS,
    };
  }
}

// Export singleton instance
export const priceSnapshotService = new PriceSnapshotService();
export default priceSnapshotService;
