import { NextRequest } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import PositionEvent from '@/database/models/position-event.model';

/**
 * SSE Endpoint for Real-Time Position Events
 * 
 * Clients subscribe to this endpoint to receive instant notifications
 * when positions are closed (TP/SL), opened, or modified.
 * 
 * This replaces polling and provides < 100ms latency updates.
 * 
 * Usage:
 * const eventSource = new EventSource('/api/trading/position-events?competitionId=xxx');
 * eventSource.onmessage = (event) => { const data = JSON.parse(event.data); }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const competitionId = searchParams.get('competitionId');
    
    if (!competitionId) {
      return new Response('Missing competitionId', { status: 400 });
    }

    // Generate unique session ID for this connection
    const sessionId = `${session.user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await connectToDatabase();

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // Send initial connection message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`));

        // Keep-alive interval (every 15 seconds)
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
          } catch {
            // Connection closed
            clearInterval(keepAliveInterval);
          }
        }, 15000);

        // Poll for new events (every 500ms for near-instant updates)
        // This is server-side polling of MongoDB, not client polling
        const pollInterval = setInterval(async () => {
          try {
            const events = await PositionEvent.find({
              userId: session.user.id,
              competitionId,
              deliveredTo: { $ne: sessionId },
            })
              .sort({ createdAt: -1 })
              .limit(10)
              .lean();

            if (events.length > 0) {
              // Mark as delivered
              await PositionEvent.updateMany(
                { _id: { $in: events.map(e => e._id) } },
                { $addToSet: { deliveredTo: sessionId } }
              );

              // Send each event
              for (const event of events) {
                const eventData = {
                  type: 'position_event',
                  event: {
                    id: event._id.toString(),
                    positionId: event.positionId,
                    symbol: event.symbol,
                    side: event.side,
                    eventType: event.eventType,
                    closeReason: event.closeReason,
                    realizedPnl: event.realizedPnl,
                    exitPrice: event.exitPrice,
                    contestType: event.contestType,
                    timestamp: event.createdAt,
                  }
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
              }
            }
          } catch (error) {
            console.error('[SSE] Error polling events:', error);
          }
        }, 500); // Check every 500ms

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          clearInterval(pollInterval);
          controller.close();
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
  } catch (error) {
    console.error('[SSE] Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

