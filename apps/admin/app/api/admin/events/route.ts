import { NextRequest } from 'next/server';
import { adminEventsService, AdminEvent } from '@/lib/services/admin-events.service';
import { verifyAdminAuth } from '@/lib/admin/auth';

/**
 * Server-Sent Events (SSE) endpoint for real-time admin updates
 * 
 * When one admin makes a change, all other admins receive the event
 * and can refresh their data automatically.
 */
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const auth = await verifyAdminAuth(request);
  if (!auth.isAuthenticated) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create a unique client ID
  const clientId = `${auth.adminId}-${Date.now()}`;
  
  // Get last event timestamp from query (for reconnection)
  const lastEventTime = request.nextUrl.searchParams.get('since');
  const since = lastEventTime ? parseInt(lastEventTime, 10) : undefined;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial connection message
      const connectMsg = JSON.stringify({
        type: 'connected',
        clientId,
        subscriberCount: adminEventsService.getSubscriberCount() + 1,
        timestamp: Date.now(),
      });
      controller.enqueue(encoder.encode(`data: ${connectMsg}\n\n`));

      // Send any missed events (for reconnection)
      const missedEvents = adminEventsService.getRecentEvents(since);
      if (missedEvents.length > 0) {
        missedEvents.forEach(event => {
          const eventMsg = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${eventMsg}\n\n`));
        });
      }

      // Subscribe to events
      const unsubscribe = adminEventsService.subscribe(clientId, (event: AdminEvent) => {
        try {
          // Don't send events back to the admin who triggered them
          if (event.adminId === auth.adminId) {
            return;
          }
          
          const eventMsg = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${eventMsg}\n\n`));
        } catch (error) {
          // Stream might be closed
          console.error('Failed to send SSE event:', error);
        }
      });

      // Keep connection alive with heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          const ping = JSON.stringify({ type: 'ping', timestamp: Date.now() });
          controller.enqueue(encoder.encode(`data: ${ping}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        console.log(`📡 SSE connection closed: ${clientId}`);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

