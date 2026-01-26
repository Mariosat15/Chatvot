import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';

/**
 * GET /api/price-health
 * Get current price feed health status
 * 
 * This endpoint fetches health data from the main app's price health monitor
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to fetch from main app's API
    const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${mainAppUrl}/api/internal/price-health`, {
        headers: {
          'x-internal-key': process.env.INTERNAL_API_KEY || 'internal-key',
        },
        next: { revalidate: 5 }, // Cache for 5 seconds
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch {
      // Main app not available - return mock/default status
    }

    // Return default status when main app is not available
    return NextResponse.json({
      success: true,
      health: {
        timestamp: new Date().toISOString(),
        overallStatus: 'unknown',
        connectionStatus: 'unknown',
        reconnectAttempts: 0,
        healthyCount: 0,
        degradedCount: 0,
        criticalCount: 0,
        symbols: [],
        alerts: [],
        message: 'Price health data unavailable - main app may not be running',
      },
    });

  } catch (error) {
    console.error('Error fetching price health:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/price-health
 * Proxy POST requests to main app (acknowledge alerts, refresh symbols)
 * 
 * This allows the client-side widget to call the admin API, which then
 * securely proxies to the main app with proper credentials.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const mainAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${mainAppUrl}/api/internal/price-health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || 'internal-key',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { error: errorData.error || 'Failed to communicate with main app' },
          { status: response.status }
        );
      }
    } catch (error) {
      console.error('Error proxying to main app:', error);
      return NextResponse.json(
        { error: 'Main app not reachable. Make sure the main Chartvolt app is running.' },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Error processing price-health POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
