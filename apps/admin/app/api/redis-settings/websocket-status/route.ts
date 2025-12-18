import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { getConnectionStatus } from '@/lib/services/websocket-price-streamer';

export async function GET() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get WebSocket connection status
    const status = getConnectionStatus();

    return NextResponse.json({
      connected: status.connected,
      authenticated: status.authenticated,
      subscribed: status.subscribed,
      cachedPairs: status.cachedPairs,
      lastUpdate: status.lastUpdate,
      reconnectAttempts: status.reconnectAttempts,
    });
  } catch (error) {
    console.error('Failed to get WebSocket status:', error);
    return NextResponse.json({
      connected: false,
      authenticated: false,
      subscribed: false,
      cachedPairs: 0,
      lastUpdate: 0,
      reconnectAttempts: 0,
      error: 'Failed to get status',
    });
  }
}

