import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { resetWebSocket, getConnectionStatus } from '@/lib/services/websocket-price-streamer';

export async function POST() {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset the WebSocket connection
    resetWebSocket();

    // Wait a moment for reconnection to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get new status
    const status = getConnectionStatus();

    return NextResponse.json({
      success: true,
      message: 'WebSocket reset initiated',
      status: {
        connected: status.connected,
        authenticated: status.authenticated,
        subscribed: status.subscribed,
        cachedPairs: status.cachedPairs,
      },
    });
  } catch (error) {
    console.error('Failed to reset WebSocket:', error);
    return NextResponse.json(
      { error: 'Failed to reset WebSocket', success: false },
      { status: 500 }
    );
  }
}

