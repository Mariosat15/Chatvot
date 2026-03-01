/**
 * Price Health Monitor Service
 *
 * Monitors the health of price feeds in real-time and triggers alerts
 * when issues are detected (staleness, anomalies, disconnections).
 *
 * SMART FEATURES:
 * - Checks admin-configured market hours / holidays / weekends before alerting.
 * - Crypto = 24/7; Forex = Mon–Fri; Stocks/Indices/Commodities = per-schedule.
 * - Alert cooldown: 20 minutes per symbol (prevents log spam).
 * - "Infinitys" bug fixed — shows "never received" when no tick has arrived.
 *
 * Used for competition risk mitigation — ensures fair pricing during competitions.
 *
 * IMPORTANT: Only monitors symbols that are ENABLED in the admin TradingSymbol settings.
 * Disabled symbols are not monitored to avoid false alerts.
 */

import { ForexSymbol, FOREX_PAIRS } from "./pnl-calculator.service";
import { notificationService } from "./notification.service";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";

// Get array of forex symbols from the FOREX_PAIRS object (used as fallback)
const FOREX_SYMBOLS_FALLBACK = Object.keys(FOREX_PAIRS) as ForexSymbol[];

// ============================================
// Types & Interfaces
// ============================================

export type PriceHealthStatus =
  | "healthy"
  | "degraded"
  | "critical"
  | "market_closed";

export interface SymbolHealthInfo {
  symbol: ForexSymbol;
  lastUpdate: number;
  lastPrice: number;
  previousPrice: number;
  priceChangePercent: number;
  staleDuration: number; // ms since last update
  isStale: boolean;
  isAnomaly: boolean;
  status: PriceHealthStatus;
  source: "websocket" | "rest" | "cache" | "fallback";
  /** Asset class derived from symbol characteristics */
  assetClass: AssetClass;
  /** If market_closed, explains why (weekend, holiday, after-hours) */
  closedReason?: string;
}

export type AssetClass =
  | "forex"
  | "crypto"
  | "stocks"
  | "indices"
  | "commodities";

export interface MarketStatusInfo {
  isOpen: boolean;
  reason?: string;
  isHoliday?: boolean;
  holidayName?: string;
  nextOpenDescription?: string;
}

export interface PriceHealthSnapshot {
  timestamp: Date;
  overallStatus: PriceHealthStatus;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  reconnectAttempts: number;
  symbols: SymbolHealthInfo[];
  healthyCount: number;
  degradedCount: number;
  criticalCount: number;
  marketClosedCount: number;
  alerts: PriceAlert[];
  /** Per-asset-class market status */
  marketStatus: Record<AssetClass, MarketStatusInfo>;
}

export interface PriceAlert {
  id: string;
  timestamp: Date;
  type:
    | "connection_lost"
    | "connection_restored"
    | "price_stale"
    | "price_anomaly"
    | "max_reconnect_reached"
    | "critical_health";
  severity: "warning" | "error" | "critical";
  symbol?: ForexSymbol;
  message: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface PriceHealthConfig {
  staleThresholdMs: number; // How long without update = stale (default: 30s)
  criticalStaleThresholdMs: number; // How long without update = critical (default: 60s)
  anomalyThresholdPercent: number; // Price change % that triggers anomaly (default: 1%)
  alertCooldownMs: number; // Minimum time between same type alerts (default: 20min)
  checkIntervalMs: number; // How often to check health (default: 10s)
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: PriceHealthConfig = {
  staleThresholdMs: 30_000, // 30 seconds
  criticalStaleThresholdMs: 60_000, // 60 seconds
  anomalyThresholdPercent: 1.0, // 1% sudden change
  // Reason: 20-minute cooldown prevents log spam while still catching real issues.
  alertCooldownMs: 1_200_000, // 20 minutes (was 60s — caused severe log spam)
  checkIntervalMs: 10_000, // Check every 10 seconds (was 5s — unnecessary)
};

// ============================================
// Global State (survives HMR)
// ============================================

const GLOBAL_KEY = "__PRICE_HEALTH_MONITOR__";

interface PriceHealthGlobalState {
  config: PriceHealthConfig;
  symbolHealth: Map<ForexSymbol, SymbolHealthInfo>;
  enabledSymbols: ForexSymbol[]; // Symbols enabled in admin settings
  alerts: PriceAlert[];
  lastAlertTimes: Map<string, number>; // Alert type -> last alert timestamp
  checkInterval: NodeJS.Timeout | null;
  initialized: boolean;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  reconnectAttempts: number;
  lastConnectionChange: number;
  adminNotifiedOfDisconnect: boolean;
  subscribers: Set<(snapshot: PriceHealthSnapshot) => void>;
  /** Cached market status per asset class (refreshed every 60s) */
  marketStatusCache: Map<AssetClass, { status: MarketStatusInfo; ts: number }>;
}

function getGlobalState(): PriceHealthGlobalState {
  if (!(globalThis as Record<string, unknown>)[GLOBAL_KEY]) {
    console.log("🏥 [PriceHealthMonitor] Initializing health monitor state");
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = {
      config: { ...DEFAULT_CONFIG },
      symbolHealth: new Map<ForexSymbol, SymbolHealthInfo>(),
      enabledSymbols: [], // Will be populated from database
      alerts: [],
      lastAlertTimes: new Map<string, number>(),
      checkInterval: null,
      initialized: false,
      connectionStatus: "disconnected",
      reconnectAttempts: 0,
      lastConnectionChange: Date.now(),
      adminNotifiedOfDisconnect: false,
      subscribers: new Set(),
      marketStatusCache: new Map(),
    };
  }
  return (globalThis as Record<string, unknown>)[
    GLOBAL_KEY
  ] as PriceHealthGlobalState;
}

// ============================================
// Asset Class Resolver
// ============================================

/**
 * Determine the asset class for a symbol.
 * Currently all FOREX_PAIRS entries are forex. In the future
 * if crypto/stocks/indices/commodities are added, this function
 * should check the TradingSymbol model's category or a mapping.
 */
function resolveAssetClass(symbol: ForexSymbol): AssetClass {
  // Reason: All symbols in the FOREX_PAIRS master list are forex.
  // If the platform adds crypto (BTC/USD, ETH/USD) or stocks in the future,
  // this function should be extended to classify them correctly.
  if (symbol in FOREX_PAIRS) {
    return "forex";
  }
  return "forex"; // Safe default
}

// ============================================
// Price Health Monitor Class
// ============================================

class PriceHealthMonitorService {
  private get state() {
    return getGlobalState();
  }

  /**
   * Initialize the health monitor
   * Fetches enabled symbols from the database and only monitors those.
   */
  async initialize(config?: Partial<PriceHealthConfig>): Promise<void> {
    if (this.state.initialized) return;

    if (config) {
      this.state.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Fetch enabled symbols from database
    await this.loadEnabledSymbols();

    // Start periodic health checks
    this.startHealthChecks();
    this.state.initialized = true;
    console.log(
      "🏥 [PriceHealthMonitor] Initialized — alert cooldown:",
      `${this.state.config.alertCooldownMs / 60000}min,`,
      `check interval: ${this.state.config.checkIntervalMs / 1000}s`,
    );
    console.log(
      `🏥 [PriceHealthMonitor] Monitoring ${this.state.enabledSymbols.length} enabled symbols`,
    );
  }

  /**
   * Load enabled symbols from the TradingSymbol database collection
   * Only monitors symbols that are enabled in admin settings
   */
  private async loadEnabledSymbols(): Promise<void> {
    try {
      await connectToDatabase();

      // Fetch enabled symbols from TradingSymbol collection
      const TradingSymbol = (
        await import("@/database/models/trading/symbol-settings.model")
      ).default;
      const enabledDocs = await TradingSymbol.find({ enabled: true })
        .select("symbol")
        .lean();

      if (enabledDocs && enabledDocs.length > 0) {
        this.state.enabledSymbols = (
          enabledDocs as unknown as Array<{ symbol: string }>
        )
          .map((doc) => doc.symbol as ForexSymbol)
          .filter((symbol) => symbol in FOREX_PAIRS);

        console.log(
          `🏥 [PriceHealthMonitor] Loaded ${this.state.enabledSymbols.length} enabled symbols from database`,
        );
      } else {
        console.log(
          "🏥 [PriceHealthMonitor] No enabled symbols in database, using fallback (all symbols)",
        );
        this.state.enabledSymbols = [...FOREX_SYMBOLS_FALLBACK];
      }
    } catch (error) {
      console.warn(
        "🏥 [PriceHealthMonitor] Failed to load symbols from database, using fallback:",
        error,
      );
      this.state.enabledSymbols = [...FOREX_SYMBOLS_FALLBACK];
    }

    // Initialize health info only for enabled symbols
    this.state.symbolHealth.clear();
    for (const symbol of this.state.enabledSymbols) {
      this.state.symbolHealth.set(symbol, {
        symbol,
        lastUpdate: 0,
        lastPrice: 0,
        previousPrice: 0,
        priceChangePercent: 0,
        staleDuration: Infinity,
        isStale: true,
        isAnomaly: false,
        status: "critical",
        source: "fallback",
        assetClass: resolveAssetClass(symbol),
      });
    }
  }

  /**
   * Refresh the list of enabled symbols
   * Call this when admin changes symbol enabled/disabled state
   */
  async refreshEnabledSymbols(): Promise<void> {
    const previousSymbols = new Set(this.state.enabledSymbols);

    await this.loadEnabledSymbols();

    const newSymbols = this.state.enabledSymbols.filter(
      (s) => !previousSymbols.has(s),
    );
    const removedSymbols = Array.from(previousSymbols).filter(
      (s) => !this.state.enabledSymbols.includes(s),
    );

    if (newSymbols.length > 0) {
      console.log(
        `🏥 [PriceHealthMonitor] Added symbols to monitoring: ${newSymbols.join(", ")}`,
      );
    }
    if (removedSymbols.length > 0) {
      console.log(
        `🏥 [PriceHealthMonitor] Removed symbols from monitoring: ${removedSymbols.join(", ")}`,
      );
    }

    this.notifySubscribers();
  }

  /**
   * Get list of currently monitored symbols
   */
  getMonitoredSymbols(): ForexSymbol[] {
    return [...this.state.enabledSymbols];
  }

  /**
   * Check if a symbol is currently being monitored
   */
  isSymbolMonitored(symbol: ForexSymbol): boolean {
    return this.state.enabledSymbols.includes(symbol);
  }

  /**
   * Update price for a symbol (called from websocket-price-streamer)
   * Only updates if the symbol is enabled in admin settings
   */
  updatePrice(
    symbol: ForexSymbol,
    price: number,
    source: "websocket" | "rest" | "cache" | "fallback",
  ): void {
    if (!this.state.enabledSymbols.includes(symbol)) {
      return;
    }

    const now = Date.now();
    const health = this.state.symbolHealth.get(symbol);

    if (!health) return;

    const previousPrice = health.lastPrice;
    const previousUpdate = health.lastUpdate;

    // Calculate price change percentage
    let priceChangePercent = 0;
    if (previousPrice > 0 && previousUpdate > 0) {
      priceChangePercent =
        Math.abs((price - previousPrice) / previousPrice) * 100;
    }

    // Check for anomaly (sudden large price movement)
    const isAnomaly =
      priceChangePercent > this.state.config.anomalyThresholdPercent &&
      now - previousUpdate < 1000;

    // Update health info
    health.previousPrice = previousPrice;
    health.lastPrice = price;
    health.lastUpdate = now;
    health.priceChangePercent = priceChangePercent;
    health.staleDuration = 0;
    health.isStale = false;
    health.isAnomaly = isAnomaly;
    health.source = source;
    health.status = isAnomaly ? "degraded" : "healthy";
    health.closedReason = undefined;

    // Trigger anomaly alert if needed
    if (isAnomaly) {
      this.triggerAlert({
        type: "price_anomaly",
        severity: "warning",
        symbol,
        message: `Price anomaly detected for ${symbol}: ${priceChangePercent.toFixed(2)}% change in < 1 second`,
        metadata: {
          previousPrice,
          newPrice: price,
          changePercent: priceChangePercent,
        },
      });
    }
  }

  /**
   * Update connection status (called from websocket-price-streamer)
   */
  updateConnectionStatus(
    status: "connected" | "reconnecting" | "disconnected",
    reconnectAttempts: number = 0,
  ): void {
    const previousStatus = this.state.connectionStatus;
    this.state.connectionStatus = status;
    this.state.reconnectAttempts = reconnectAttempts;
    this.state.lastConnectionChange = Date.now();

    if (previousStatus === "connected" && status !== "connected") {
      this.triggerAlert({
        type: "connection_lost",
        severity: "error",
        message: `WebSocket connection lost. Attempting to reconnect...`,
        metadata: { previousStatus, newStatus: status },
      });
      this.state.adminNotifiedOfDisconnect = false;
    }

    if (previousStatus !== "connected" && status === "connected") {
      this.triggerAlert({
        type: "connection_restored",
        severity: "warning",
        message: `WebSocket connection restored after ${reconnectAttempts} attempts`,
        metadata: { reconnectAttempts },
      });
      this.state.adminNotifiedOfDisconnect = false;
    }

    if (reconnectAttempts >= 10 && !this.state.adminNotifiedOfDisconnect) {
      this.triggerAlert({
        type: "max_reconnect_reached",
        severity: "critical",
        message: `Max reconnect attempts (10) reached! Price feed is DOWN. Manual intervention required.`,
        metadata: { reconnectAttempts },
      });
      this.state.adminNotifiedOfDisconnect = true;
      this.notifyAdminOfCriticalIssue(
        "Price feed connection failed after maximum retry attempts",
      );
    }
  }

  // ─── Market Hours Integration ──────────────────────────────────────────

  /**
   * Check if the market for a given asset class is currently open.
   * Uses a 60-second cache to avoid hammering the DB on every health check.
   */
  private async getMarketStatus(
    assetClass: AssetClass,
  ): Promise<MarketStatusInfo> {
    const cached = this.state.marketStatusCache.get(assetClass);
    if (cached && Date.now() - cached.ts < 60_000) {
      return cached.status;
    }

    try {
      // Dynamic import to avoid circular deps
      const { isMarketOpen } = await import("./market-hours.service");
      const result = await isMarketOpen(assetClass);

      const status: MarketStatusInfo = {
        isOpen: result.isOpen,
        reason: result.reason,
        isHoliday: result.isHoliday,
        holidayName: result.holidayName,
      };

      // Add helpful context about when market reopens
      if (!result.isOpen) {
        status.nextOpenDescription = this.estimateNextOpen(assetClass);
      }

      this.state.marketStatusCache.set(assetClass, {
        status,
        ts: Date.now(),
      });
      return status;
    } catch (error) {
      console.warn(
        `🏥 [PriceHealthMonitor] Failed to check market hours for ${assetClass}:`,
        error,
      );
      // Reason: If market hours check fails, assume open to avoid
      // suppressing real alerts. Better to have a false positive
      // than miss a real price feed outage.
      return { isOpen: true };
    }
  }

  /**
   * Estimate when the market next opens (human-readable).
   */
  private estimateNextOpen(assetClass: AssetClass): string {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat

    if (assetClass === "crypto") {
      return "Crypto markets are 24/7";
    }

    if (assetClass === "forex") {
      // Forex is closed Sat 00:00 → Sun ~22:00 UTC
      if (dayOfWeek === 6) {
        return "Reopens Sunday ~22:00 UTC";
      }
      if (dayOfWeek === 0) {
        const hour = now.getUTCHours();
        if (hour < 22) {
          return "Reopens today ~22:00 UTC";
        }
        return "Should be open now";
      }
      // Weekday — likely after-hours or holiday
      return "Check market schedule in admin settings";
    }

    // Stocks / indices / commodities
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return "Reopens Monday";
    }
    return "Check trading schedule in admin settings";
  }

  /**
   * Get aggregated market status for all relevant asset classes.
   */
  private async getAllMarketStatuses(): Promise<
    Record<AssetClass, MarketStatusInfo>
  > {
    // Determine which asset classes we actually monitor
    const assetClasses = new Set<AssetClass>();
    for (const health of this.state.symbolHealth.values()) {
      assetClasses.add(health.assetClass);
    }
    // Always include forex since it's the primary
    assetClasses.add("forex");

    const statuses: Record<AssetClass, MarketStatusInfo> = {
      forex: { isOpen: true },
      crypto: { isOpen: true },
      stocks: { isOpen: true },
      indices: { isOpen: true },
      commodities: { isOpen: true },
    };

    await Promise.all(
      Array.from(assetClasses).map(async (ac) => {
        statuses[ac] = await this.getMarketStatus(ac);
      }),
    );

    return statuses;
  }

  // ─── Health Checks ─────────────────────────────────────────────────────

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.state.checkInterval) {
      clearInterval(this.state.checkInterval);
    }

    this.state.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.state.config.checkIntervalMs);
  }

  /**
   * Perform a health check on all symbols.
   * Now market-hours-aware: symbols whose market is closed
   * are marked as "market_closed" instead of "critical".
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now();
    let healthyCount = 0;
    let degradedCount = 0;
    let criticalCount = 0;
    let marketClosedCount = 0;

    // Fetch market statuses (cached, max 1 DB call per 60s per asset class)
    const marketStatuses = await this.getAllMarketStatuses();

    for (const [symbol, health] of this.state.symbolHealth) {
      // Update stale duration
      if (health.lastUpdate > 0) {
        health.staleDuration = now - health.lastUpdate;
      }

      // ⚡ CRITICAL: Check if this symbol's market is closed
      const mktStatus = marketStatuses[health.assetClass];
      if (mktStatus && !mktStatus.isOpen) {
        // Market is closed — do NOT flag as stale/critical
        health.status = "market_closed";
        health.closedReason = mktStatus.isHoliday
          ? `Holiday: ${mktStatus.holidayName}`
          : mktStatus.reason || "Market closed";
        health.isStale = false;
        marketClosedCount++;
        continue;
      }

      // Market is open — evaluate staleness normally
      health.closedReason = undefined;

      health.isStale =
        health.staleDuration > this.state.config.staleThresholdMs;

      if (health.staleDuration > this.state.config.criticalStaleThresholdMs) {
        health.status = "critical";
        criticalCount++;

        // Reason: Format the stale duration properly.
        // When lastUpdate is 0 (never received), staleDuration is Infinity.
        const staleDesc =
          health.lastUpdate === 0
            ? "never received a price tick"
            : `${Math.round(health.staleDuration / 1000)}s without update`;

        this.triggerAlert({
          type: "price_stale",
          severity: "error",
          symbol,
          message: `Price for ${symbol} is critically stale (${staleDesc})`,
          metadata: { staleDuration: health.staleDuration },
        });
      } else if (health.isStale || health.isAnomaly) {
        health.status = "degraded";
        degradedCount++;
      } else {
        health.status = "healthy";
        healthyCount++;
      }
    }

    // Determine overall status — ignore market_closed symbols
    const activeCount = healthyCount + degradedCount + criticalCount;
    const overallStatus: PriceHealthStatus =
      activeCount === 0
        ? "market_closed" // All symbols have their market closed
        : criticalCount > 0
          ? "critical"
          : degradedCount > activeCount / 4
            ? "degraded"
            : "healthy";

    // Only trigger critical health alert if market is open and symbols are stale
    if (overallStatus === "critical" && criticalCount > 0) {
      this.triggerAlert({
        type: "critical_health",
        severity: "critical",
        message: `Price feed health is CRITICAL: ${criticalCount} symbol(s) critically stale while market is open`,
        metadata: { healthyCount, degradedCount, criticalCount, marketClosedCount },
      });
    }

    this.notifySubscribers();
  }

  /**
   * Trigger an alert (with cooldown to prevent spam)
   */
  private triggerAlert(
    alertData: Omit<
      PriceAlert,
      "id" | "timestamp" | "acknowledged" | "acknowledgedAt" | "acknowledgedBy"
    >,
  ): void {
    const alertKey = alertData.symbol
      ? `${alertData.type}_${alertData.symbol}`
      : alertData.type;

    const lastAlert = this.state.lastAlertTimes.get(alertKey) || 0;
    const now = Date.now();

    // Check cooldown
    if (now - lastAlert < this.state.config.alertCooldownMs) {
      return; // Skip - still in cooldown
    }

    const alert: PriceAlert = {
      id: `alert_${now}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      ...alertData,
      acknowledged: false,
    };

    this.state.alerts.push(alert);
    this.state.lastAlertTimes.set(alertKey, now);

    // Keep only last 100 alerts
    if (this.state.alerts.length > 100) {
      this.state.alerts = this.state.alerts.slice(-100);
    }

    console.log(
      `🚨 [PriceHealthMonitor] Alert: ${alert.severity.toUpperCase()} - ${alert.message}`,
    );

    // Log to database for audit trail
    this.logAlertToDatabase(alert).catch(console.error);
  }

  /**
   * Log alert to database for audit trail
   */
  private async logAlertToDatabase(alert: PriceAlert): Promise<void> {
    try {
      await connectToDatabase();

      const PriceHealthAlert = (
        await import("@/database/models/price-health-alert.model")
      ).default;

      await PriceHealthAlert.create({
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        symbol: alert.symbol,
        message: alert.message,
        metadata: alert.metadata,
        acknowledged: alert.acknowledged,
        createdAt: alert.timestamp,
      });
    } catch (error) {
      // Don't crash if logging fails
      console.error("Failed to log alert to database:", error);
    }
  }

  /**
   * Notify admin of critical issue (creates admin notification)
   */
  private async notifyAdminOfCriticalIssue(message: string): Promise<void> {
    try {
      await connectToDatabase();

      const usersCollection = mongoose.connection.collection("user");
      const admins = await usersCollection
        .find({ role: "admin" })
        .project({ _id: 1 })
        .toArray();

      for (const admin of admins) {
        try {
          await notificationService.createCustom({
            userId: admin._id.toString(),
            type: "price_feed_critical",
            title: "🚨 Critical: Price Feed Issue",
            message,
            icon: "alert-triangle",
            category: "system",
            priority: "urgent",
            color: "red",
          });
        } catch {
          // Notification method may not exist, continue
        }
      }
    } catch (error) {
      console.error("Failed to notify admin:", error);
    }
  }

  /**
   * Subscribe to health updates
   */
  subscribe(callback: (snapshot: PriceHealthSnapshot) => void): () => void {
    this.state.subscribers.add(callback);
    return () => this.state.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of health update
   */
  private notifySubscribers(): void {
    const snapshot = this.getHealthSnapshot();
    for (const callback of this.state.subscribers) {
      try {
        callback(snapshot);
      } catch (error) {
        console.error("Error in health subscriber:", error);
      }
    }
  }

  /**
   * Get current health snapshot
   * Only includes enabled symbols that are being monitored
   */
  getHealthSnapshot(): PriceHealthSnapshot {
    const symbols = Array.from(this.state.symbolHealth.values()).filter((s) =>
      this.state.enabledSymbols.includes(s.symbol),
    );

    const healthyCount = symbols.filter((s) => s.status === "healthy").length;
    const degradedCount = symbols.filter((s) => s.status === "degraded").length;
    const criticalCount = symbols.filter((s) => s.status === "critical").length;
    const marketClosedCount = symbols.filter(
      (s) => s.status === "market_closed",
    ).length;

    const activeCount = healthyCount + degradedCount + criticalCount;
    const overallStatus: PriceHealthStatus =
      activeCount === 0
        ? "market_closed"
        : criticalCount > 0
          ? "critical"
          : degradedCount > activeCount / 4
            ? "degraded"
            : "healthy";

    // Build market status from cache
    const marketStatus: Record<AssetClass, MarketStatusInfo> = {
      forex: { isOpen: true },
      crypto: { isOpen: true },
      stocks: { isOpen: true },
      indices: { isOpen: true },
      commodities: { isOpen: true },
    };
    for (const [ac, cached] of this.state.marketStatusCache) {
      marketStatus[ac] = cached.status;
    }

    return {
      timestamp: new Date(),
      overallStatus,
      connectionStatus: this.state.connectionStatus,
      reconnectAttempts: this.state.reconnectAttempts,
      symbols,
      healthyCount,
      degradedCount,
      criticalCount,
      marketClosedCount,
      alerts: this.state.alerts.slice(-20),
      marketStatus,
    };
  }

  /**
   * Get health status for a specific symbol
   */
  getSymbolHealth(symbol: ForexSymbol): SymbolHealthInfo | undefined {
    return this.state.symbolHealth.get(symbol);
  }

  /**
   * Check if prices are safe for competition finalization
   * Returns true if all prices are healthy, false if any are stale/anomalous
   */
  arePricesSafeForFinalization(symbols: ForexSymbol[]): {
    safe: boolean;
    issues: Array<{ symbol: ForexSymbol; issue: string }>;
  } {
    const issues: Array<{ symbol: ForexSymbol; issue: string }> = [];

    for (const symbol of symbols) {
      const health = this.state.symbolHealth.get(symbol);

      if (!health) {
        issues.push({ symbol, issue: "No health data available" });
        continue;
      }

      if (health.status === "critical") {
        issues.push({
          symbol,
          issue: `Critically stale (${Math.round(health.staleDuration / 1000)}s without update)`,
        });
      } else if (health.isAnomaly) {
        issues.push({
          symbol,
          issue: `Price anomaly detected (${health.priceChangePercent.toFixed(2)}% sudden change)`,
        });
      } else if (health.source === "fallback") {
        issues.push({
          symbol,
          issue: "Using fallback prices (no live data)",
        });
      }
    }

    return {
      safe: issues.length === 0,
      issues,
    };
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.state.alerts.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.updateAlertInDatabase(alertId, {
      acknowledged: true,
      acknowledgedAt: alert.acknowledgedAt,
      acknowledgedBy,
    }).catch(console.error);

    return true;
  }

  /**
   * Update alert in database
   */
  private async updateAlertInDatabase(
    alertId: string,
    update: Partial<PriceAlert>,
  ): Promise<void> {
    try {
      await connectToDatabase();
      const PriceHealthAlert = (
        await import("@/database/models/price-health-alert.model")
      ).default;
      await PriceHealthAlert.updateOne({ alertId }, { $set: update });
    } catch (error) {
      console.error("Failed to update alert in database:", error);
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 20): PriceAlert[] {
    return this.state.alerts.slice(-limit);
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): PriceAlert[] {
    return this.state.alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PriceHealthConfig>): void {
    this.state.config = { ...this.state.config, ...config };
    console.log("🏥 [PriceHealthMonitor] Config updated:", this.state.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): PriceHealthConfig {
    return { ...this.state.config };
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.state.checkInterval) {
      clearInterval(this.state.checkInterval);
      this.state.checkInterval = null;
    }
    this.state.initialized = false;
    console.log("🏥 [PriceHealthMonitor] Stopped");
  }
}

// Export singleton instance
export const priceHealthMonitor = new PriceHealthMonitorService();

// Export for convenience
export default priceHealthMonitor;
