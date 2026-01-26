import { NextRequest, NextResponse } from 'next/server';
import { priceHealthMonitor } from '@/lib/services/price-health-monitor.service';
import { priceSnapshotService } from '@/lib/services/price-snapshot.service';

/**
 * GET /api/internal/price-health
 * Internal API for admin dashboard to fetch price health status
 */
export async function GET(request: NextRequest) {
  try {
    // Verify internal API key
    const internalKey = request.headers.get('x-internal-key');
    const expectedKey = process.env.INTERNAL_API_KEY || 'internal-key';
    
    if (internalKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize health monitor if not already
    priceHealthMonitor.initialize();

    // Get health snapshot
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
        symbols: healthSnapshot.symbols.map(s => ({
          symbol: s.symbol,
          status: s.status,
          lastUpdate: s.lastUpdate,
          staleDuration: s.staleDuration,
          isStale: s.isStale,
          isAnomaly: s.isAnomaly,
          source: s.source,
          lastPrice: s.lastPrice,
        })),
        alerts: healthSnapshot.alerts.map(a => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          symbol: a.symbol,
          message: a.message,
          timestamp: a.timestamp,
          acknowledged: a.acknowledged,
        })),
      },
      snapshot: {
        isRunning: snapshotStatus.isRunning,
        lastSnapshotTime: snapshotStatus.lastSnapshotTime,
        snapshotCount: snapshotStatus.snapshotCount,
        snapshotInterval: snapshotStatus.snapshotInterval,
      },
    });

  } catch (error) {
    console.error('Error getting price health:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/internal/price-health/acknowledge
 * Acknowledge a price health alert
 */
export async function POST(request: NextRequest) {
  try {
    const internalKey = request.headers.get('x-internal-key');
    const expectedKey = process.env.INTERNAL_API_KEY || 'internal-key';
    
    if (internalKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { alertId, acknowledgedBy } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'alertId is required' }, { status: 400 });
    }

    const success = priceHealthMonitor.acknowledgeAlert(alertId, acknowledgedBy || 'admin');

    return NextResponse.json({
      success,
      message: success ? 'Alert acknowledged' : 'Alert not found',
    });

  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
