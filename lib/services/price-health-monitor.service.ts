/**
 * Price Health Monitor Service
 * 
 * Monitors the health of price feeds in real-time and triggers alerts
 * when issues are detected (staleness, anomalies, disconnections).
 * 
 * Used for competition risk mitigation - ensures fair pricing during competitions.
 */

import { ForexSymbol, FOREX_PAIRS } from './pnl-calculator.service';
import { notificationService } from './notification.service';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

// Get array of forex symbols from the FOREX_PAIRS object
const FOREX_SYMBOLS = Object.keys(FOREX_PAIRS) as ForexSymbol[];

// ============================================
// Types & Interfaces
// ============================================

export type PriceHealthStatus = 'healthy' | 'degraded' | 'critical';

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
  source: 'websocket' | 'rest' | 'cache' | 'fallback';
}

export interface PriceHealthSnapshot {
  timestamp: Date;
  overallStatus: PriceHealthStatus;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  reconnectAttempts: number;
  symbols: SymbolHealthInfo[];
  healthyCount: number;
  degradedCount: number;
  criticalCount: number;
  alerts: PriceAlert[];
}

export interface PriceAlert {
  id: string;
  timestamp: Date;
  type: 'connection_lost' | 'connection_restored' | 'price_stale' | 'price_anomaly' | 'max_reconnect_reached' | 'critical_health';
  severity: 'warning' | 'error' | 'critical';
  symbol?: ForexSymbol;
  message: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface PriceHealthConfig {
  staleThresholdMs: number;           // How long without update = stale (default: 30s)
  criticalStaleThresholdMs: number;   // How long without update = critical (default: 60s)
  anomalyThresholdPercent: number;    // Price change % that triggers anomaly (default: 1%)
  alertCooldownMs: number;            // Minimum time between same type alerts (default: 60s)
  checkIntervalMs: number;            // How often to check health (default: 5s)
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: PriceHealthConfig = {
  staleThresholdMs: 30000,           // 30 seconds
  criticalStaleThresholdMs: 60000,   // 60 seconds  
  anomalyThresholdPercent: 1.0,      // 1% sudden change
  alertCooldownMs: 60000,            // 60 seconds between same alerts
  checkIntervalMs: 5000,             // Check every 5 seconds
};

// ============================================
// Global State (survives HMR)
// ============================================

const GLOBAL_KEY = '__PRICE_HEALTH_MONITOR__';

interface PriceHealthGlobalState {
  config: PriceHealthConfig;
  symbolHealth: Map<ForexSymbol, SymbolHealthInfo>;
  alerts: PriceAlert[];
  lastAlertTimes: Map<string, number>; // Alert type -> last alert timestamp
  checkInterval: NodeJS.Timeout | null;
  initialized: boolean;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  reconnectAttempts: number;
  lastConnectionChange: number;
  adminNotifiedOfDisconnect: boolean;
  subscribers: Set<(snapshot: PriceHealthSnapshot) => void>;
}

function getGlobalState(): PriceHealthGlobalState {
  if (!(globalThis as Record<string, unknown>)[GLOBAL_KEY]) {
    console.log('🏥 [PriceHealthMonitor] Initializing health monitor state');
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = {
      config: { ...DEFAULT_CONFIG },
      symbolHealth: new Map<ForexSymbol, SymbolHealthInfo>(),
      alerts: [],
      lastAlertTimes: new Map<string, number>(),
      checkInterval: null,
      initialized: false,
      connectionStatus: 'disconnected',
      reconnectAttempts: 0,
      lastConnectionChange: Date.now(),
      adminNotifiedOfDisconnect: false,
      subscribers: new Set(),
    };
  }
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as PriceHealthGlobalState;
}

// ============================================
// Price Health Monitor Class
// ============================================

class PriceHealthMonitorService {
  private get state() { return getGlobalState(); }

  /**
   * Initialize the health monitor
   */
  initialize(config?: Partial<PriceHealthConfig>): void {
    if (this.state.initialized) return;

    if (config) {
      this.state.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Initialize health info for all forex pairs
    for (const symbol of FOREX_SYMBOLS) {
      this.state.symbolHealth.set(symbol, {
        symbol,
        lastUpdate: 0,
        lastPrice: 0,
        previousPrice: 0,
        priceChangePercent: 0,
        staleDuration: Infinity,
        isStale: true,
        isAnomaly: false,
        status: 'critical',
        source: 'fallback',
      });
    }

    // Start periodic health checks
    this.startHealthChecks();
    this.state.initialized = true;
    console.log('🏥 [PriceHealthMonitor] Initialized with config:', this.state.config);
  }

  /**
   * Update price for a symbol (called from websocket-price-streamer)
   */
  updatePrice(
    symbol: ForexSymbol,
    price: number,
    source: 'websocket' | 'rest' | 'cache' | 'fallback'
  ): void {
    const now = Date.now();
    const health = this.state.symbolHealth.get(symbol);
    
    if (!health) return;

    const previousPrice = health.lastPrice;
    const previousUpdate = health.lastUpdate;

    // Calculate price change percentage
    let priceChangePercent = 0;
    if (previousPrice > 0 && previousUpdate > 0) {
      priceChangePercent = Math.abs((price - previousPrice) / previousPrice) * 100;
    }

    // Check for anomaly (sudden large price movement)
    const isAnomaly = priceChangePercent > this.state.config.anomalyThresholdPercent &&
                      (now - previousUpdate) < 1000; // Within 1 second

    // Update health info
    health.previousPrice = previousPrice;
    health.lastPrice = price;
    health.lastUpdate = now;
    health.priceChangePercent = priceChangePercent;
    health.staleDuration = 0;
    health.isStale = false;
    health.isAnomaly = isAnomaly;
    health.source = source;
    health.status = isAnomaly ? 'degraded' : 'healthy';

    // Trigger anomaly alert if needed
    if (isAnomaly) {
      this.triggerAlert({
        type: 'price_anomaly',
        severity: 'warning',
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
    status: 'connected' | 'reconnecting' | 'disconnected',
    reconnectAttempts: number = 0
  ): void {
    const previousStatus = this.state.connectionStatus;
    this.state.connectionStatus = status;
    this.state.reconnectAttempts = reconnectAttempts;
    this.state.lastConnectionChange = Date.now();

    // Connection lost
    if (previousStatus === 'connected' && status !== 'connected') {
      this.triggerAlert({
        type: 'connection_lost',
        severity: 'error',
        message: `WebSocket connection lost. Attempting to reconnect...`,
        metadata: { previousStatus, newStatus: status },
      });
      this.state.adminNotifiedOfDisconnect = false;
    }

    // Connection restored
    if (previousStatus !== 'connected' && status === 'connected') {
      this.triggerAlert({
        type: 'connection_restored',
        severity: 'warning',
        message: `WebSocket connection restored after ${reconnectAttempts} attempts`,
        metadata: { reconnectAttempts },
      });
      this.state.adminNotifiedOfDisconnect = false;
    }

    // Max reconnect attempts reached
    if (reconnectAttempts >= 10 && !this.state.adminNotifiedOfDisconnect) {
      this.triggerAlert({
        type: 'max_reconnect_reached',
        severity: 'critical',
        message: `Max reconnect attempts (10) reached! Price feed is DOWN. Manual intervention required.`,
        metadata: { reconnectAttempts },
      });
      this.state.adminNotifiedOfDisconnect = true;
      // Notify admin via system
      this.notifyAdminOfCriticalIssue('Price feed connection failed after maximum retry attempts');
    }
  }

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
   * Perform a health check on all symbols
   */
  private performHealthCheck(): void {
    const now = Date.now();
    let healthyCount = 0;
    let degradedCount = 0;
    let criticalCount = 0;

    for (const [symbol, health] of this.state.symbolHealth) {
      // Update stale duration
      if (health.lastUpdate > 0) {
        health.staleDuration = now - health.lastUpdate;
      }

      // Check staleness
      health.isStale = health.staleDuration > this.state.config.staleThresholdMs;

      // Determine status
      if (health.staleDuration > this.state.config.criticalStaleThresholdMs) {
        health.status = 'critical';
        criticalCount++;
        
        // Trigger stale alert
        this.triggerAlert({
          type: 'price_stale',
          severity: 'error',
          symbol,
          message: `Price for ${symbol} is critically stale (${Math.round(health.staleDuration / 1000)}s without update)`,
          metadata: { staleDuration: health.staleDuration },
        });
      } else if (health.isStale || health.isAnomaly) {
        health.status = 'degraded';
        degradedCount++;
      } else {
        health.status = 'healthy';
        healthyCount++;
      }
    }

    // Check overall health
    const overallStatus: PriceHealthStatus = 
      criticalCount > 0 ? 'critical' :
      degradedCount > FOREX_SYMBOLS.length / 4 ? 'degraded' : 'healthy';

    // Trigger critical health alert if too many symbols are unhealthy
    if (overallStatus === 'critical') {
      this.triggerAlert({
        type: 'critical_health',
        severity: 'critical',
        message: `Price feed health is CRITICAL: ${criticalCount} symbols critically stale`,
        metadata: { healthyCount, degradedCount, criticalCount },
      });
    }

    // Notify subscribers
    this.notifySubscribers();
  }

  /**
   * Trigger an alert (with cooldown to prevent spam)
   */
  private triggerAlert(alertData: Omit<PriceAlert, 'id' | 'timestamp' | 'acknowledged' | 'acknowledgedAt' | 'acknowledgedBy'>): void {
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

    console.log(`🚨 [PriceHealthMonitor] Alert: ${alert.severity.toUpperCase()} - ${alert.message}`);

    // Log to database for audit trail
    this.logAlertToDatabase(alert).catch(console.error);
  }

  /**
   * Log alert to database for audit trail
   */
  private async logAlertToDatabase(alert: PriceAlert): Promise<void> {
    try {
      await connectToDatabase();
      
      // Dynamic import to avoid circular dependencies
      const PriceHealthAlert = (await import('@/database/models/price-health-alert.model')).default;
      
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
      console.error('Failed to log alert to database:', error);
    }
  }

  /**
   * Notify admin of critical issue (creates admin notification)
   */
  private async notifyAdminOfCriticalIssue(message: string): Promise<void> {
    try {
      await connectToDatabase();
      
      // Get admin users from collection (no User model exists)
      const usersCollection = mongoose.connection.collection('user');
      const admins = await usersCollection.find({ role: 'admin' }).project({ _id: 1 }).toArray();

      for (const admin of admins) {
        try {
          await notificationService.createCustom({
            userId: admin._id.toString(),
            type: 'price_feed_critical',
            title: '🚨 Critical: Price Feed Issue',
            message,
            icon: 'alert-triangle',
            category: 'system',
            priority: 'urgent',
            color: 'red',
          });
        } catch {
          // Notification method may not exist, continue
        }
      }
    } catch (error) {
      console.error('Failed to notify admin:', error);
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
        console.error('Error in health subscriber:', error);
      }
    }
  }

  /**
   * Get current health snapshot
   */
  getHealthSnapshot(): PriceHealthSnapshot {
    const symbols = Array.from(this.state.symbolHealth.values());
    
    const healthyCount = symbols.filter(s => s.status === 'healthy').length;
    const degradedCount = symbols.filter(s => s.status === 'degraded').length;
    const criticalCount = symbols.filter(s => s.status === 'critical').length;

    const overallStatus: PriceHealthStatus = 
      criticalCount > 0 ? 'critical' :
      degradedCount > FOREX_SYMBOLS.length / 4 ? 'degraded' : 'healthy';

    return {
      timestamp: new Date(),
      overallStatus,
      connectionStatus: this.state.connectionStatus,
      reconnectAttempts: this.state.reconnectAttempts,
      symbols,
      healthyCount,
      degradedCount,
      criticalCount,
      alerts: this.state.alerts.slice(-20), // Last 20 alerts
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
        issues.push({ symbol, issue: 'No health data available' });
        continue;
      }

      if (health.status === 'critical') {
        issues.push({ 
          symbol, 
          issue: `Critically stale (${Math.round(health.staleDuration / 1000)}s without update)` 
        });
      } else if (health.isAnomaly) {
        issues.push({ 
          symbol, 
          issue: `Price anomaly detected (${health.priceChangePercent.toFixed(2)}% sudden change)` 
        });
      } else if (health.source === 'fallback') {
        issues.push({ 
          symbol, 
          issue: 'Using fallback prices (no live data)' 
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
    const alert = this.state.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    // Update in database
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
  private async updateAlertInDatabase(alertId: string, update: Partial<PriceAlert>): Promise<void> {
    try {
      await connectToDatabase();
      const PriceHealthAlert = (await import('@/database/models/price-health-alert.model')).default;
      await PriceHealthAlert.updateOne({ alertId }, { $set: update });
    } catch (error) {
      console.error('Failed to update alert in database:', error);
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
    return this.state.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PriceHealthConfig>): void {
    this.state.config = { ...this.state.config, ...config };
    console.log('🏥 [PriceHealthMonitor] Config updated:', this.state.config);
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
    console.log('🏥 [PriceHealthMonitor] Stopped');
  }
}

// Export singleton instance
export const priceHealthMonitor = new PriceHealthMonitorService();

// Export for convenience
export default priceHealthMonitor;
