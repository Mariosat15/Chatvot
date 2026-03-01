import { NextRequest, NextResponse } from "next/server";
import { priceHealthMonitor } from "@/lib/services/price-health-monitor.service";
import { priceSnapshotService } from "@/lib/services/price-snapshot.service";

/**
 * GET /api/internal/price-health
 * Internal API for admin dashboard to fetch price health status.
 * Now includes market status context (open/closed/holiday) per asset class.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify internal API key
    const internalKey = request.headers.get("x-internal-key");
    const expectedKey = process.env.INTERNAL_API_KEY || "internal-key";

    if (internalKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize health monitor if not already (async - loads enabled symbols from DB)
    await priceHealthMonitor.initialize();

    // Get health snapshot (now includes market status)
    const healthSnapshot = priceHealthMonitor.getHealthSnapshot();

    // Get snapshot service status
    const snapshotStatus = priceSnapshotService.getStatus();

    return NextResponse.json({
      success: true,
      health: {
        timestamp: healthSnapshot.timestamp.toISOString(),
        overallStatus: healthSnapshot.overallStatus,
        connectionStatus: healthSnapshot.connectionStatus,
        reconnectAttempts: healthSnapshot.reconnectAttempts,
        healthyCount: healthSnapshot.healthyCount,
        degradedCount: healthSnapshot.degradedCount,
        criticalCount: healthSnapshot.criticalCount,
        marketClosedCount: healthSnapshot.marketClosedCount,
        symbols: healthSnapshot.symbols.map((s) => ({
          symbol: s.symbol,
          status: s.status,
          lastUpdate: s.lastUpdate,
          staleDuration: s.staleDuration,
          isStale: s.isStale,
          isAnomaly: s.isAnomaly,
          source: s.source,
          lastPrice: s.lastPrice,
          assetClass: s.assetClass,
          closedReason: s.closedReason,
        })),
        alerts: healthSnapshot.alerts.map((a) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          symbol: a.symbol,
          message: a.message,
          timestamp: a.timestamp,
          acknowledged: a.acknowledged,
        })),
        marketStatus: healthSnapshot.marketStatus,
      },
      snapshot: {
        isRunning: snapshotStatus.isRunning,
        lastSnapshotTime: snapshotStatus.lastSnapshotTime,
        snapshotCount: snapshotStatus.snapshotCount,
        snapshotInterval: snapshotStatus.snapshotInterval,
      },
    });
  } catch (error) {
    console.error("Error getting price health:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/internal/price-health
 * Actions: acknowledge alert, refresh enabled symbols
 */
export async function POST(request: NextRequest) {
  try {
    const internalKey = request.headers.get("x-internal-key");
    const expectedKey = process.env.INTERNAL_API_KEY || "internal-key";

    if (internalKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, alertId, acknowledgedBy } = body;

    // Action: Refresh enabled symbols (called when admin changes symbol enabled state)
    if (action === "refreshSymbols") {
      await priceHealthMonitor.refreshEnabledSymbols();
      const monitoredSymbols = priceHealthMonitor.getMonitoredSymbols();
      return NextResponse.json({
        success: true,
        message: `Refreshed enabled symbols. Now monitoring ${monitoredSymbols.length} symbols.`,
        monitoredCount: monitoredSymbols.length,
        symbols: monitoredSymbols,
      });
    }

    // Action: Acknowledge ALL alerts
    if (action === "acknowledgeAll") {
      const count = priceHealthMonitor.acknowledgeAllAlerts(
        acknowledgedBy || "admin",
      );
      return NextResponse.json({
        success: true,
        message: `${count} alert(s) acknowledged`,
        acknowledgedCount: count,
      });
    }

    // Action: Acknowledge a single alert
    if (action === "acknowledge" || alertId) {
      if (!alertId) {
        return NextResponse.json(
          { error: "alertId is required" },
          { status: 400 },
        );
      }

      const success = priceHealthMonitor.acknowledgeAlert(
        alertId,
        acknowledgedBy || "admin",
      );

      return NextResponse.json({
        success,
        message: success ? "Alert acknowledged" : "Alert not found",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing price-health action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
