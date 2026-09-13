import { NextRequest } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import { positionEventBroadcaster } from "@/lib/services/position-event-broadcaster";

/**
 * SSE Endpoint for Real-Time Position Events
 *
 * Clients subscribe to this endpoint to receive instant notifications
 * when positions are closed (TP/SL), opened, or modified.
 *
 * Architecture (Shared Fan-Out):
 * - All SSE connections share a SINGLE global poller (PositionEventBroadcaster)
 * - The broadcaster runs 1 MongoDB query every 3s regardless of client count
 * - Results are grouped by userId+competitionId and fanned out in-memory
 * - With 5,000 clients: 1 query/3s instead of 5,000 queries/3s
 *
 * The positionevents collection has 60s TTL → stays tiny, so one full scan is cheap.
 *
 * Usage:
 * const eventSource = new EventSource('/api/trading/position-events?competitionId=xxx');
 * eventSource.onmessage = (event) => { const data = JSON.parse(event.data); }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const competitionId = searchParams.get("competitionId");

    if (!competitionId) {
      return new Response("Missing competitionId", { status: 400 });
    }

    await connectToDatabase();

    // Unique ID for this SSE connection
    const subscriberId = `${session.user.id}:${competitionId}:${Date.now()}`;

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection message
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "connected" })}\n\n`,
          ),
        );

        // Keep-alive interval (every 15 seconds)
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
          } catch {
            // Connection closed
            clearInterval(keepAliveInterval);
          }
        }, 15000);

        // Subscribe to the shared broadcaster — no individual polling!
        // The broadcaster runs 1 global query and fans out matching events
        positionEventBroadcaster.subscribe(
          subscriberId,
          session.user.id,
          competitionId,
          (events: any[]) => {
            try {
              for (const event of events) {
                const eventData = {
                  type: "position_event",
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
                  },
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`),
                );
              }
            } catch {
              // Stream closed, unsubscribe
              positionEventBroadcaster.unsubscribe(subscriberId);
              clearInterval(keepAliveInterval);
            }
          },
        );

        // Cleanup on close
        request.signal.addEventListener("abort", () => {
          positionEventBroadcaster.unsubscribe(subscriberId);
          clearInterval(keepAliveInterval);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error("[SSE] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
