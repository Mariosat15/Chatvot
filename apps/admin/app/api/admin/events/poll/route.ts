import { NextRequest, NextResponse } from 'next/server';
import { adminEventsService } from '@/lib/services/admin-events.service';
import { verifyAdminAuth } from '@/lib/admin/auth';

/**
 * Polling endpoint for admin events
 * 
 * Returns events since the last poll timestamp.
 * This is more reliable than SSE with Next.js App Router.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth(request);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get last event timestamp from query
    const since = request.nextUrl.searchParams.get('since');
    const sinceTimestamp = since ? parseInt(since, 10) : undefined;

    // Get recent events (excluding events from this admin)
    const allEvents = adminEventsService.getRecentEvents(sinceTimestamp);
    const events = allEvents.filter(event => event.adminId !== auth.adminId);

    return NextResponse.json({
      success: true,
      events,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Poll endpoint error:', error);
    return NextResponse.json({ error: 'Failed to poll events' }, { status: 500 });
  }
}

