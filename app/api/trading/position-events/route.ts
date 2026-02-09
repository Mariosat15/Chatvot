import { NextRequest } from "next/server";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { connectToDatabase } from "@/database/mongoose";
import PositionEvent from "@/database/models/position-event.model";

/**
 * SSE Endpoint for Real-Time Position Events
 *
 * Clients subscribe to this endpoint to receive instant notifications
 * when positions are closed (TP/SL), opened, or modified.
 *
 * This replaces polling and provides < 2s latency updates.
 *
 * Architecture:
 * - Each SSE connection tracks a cursor (lastCheckedAt timestamp)
 * - Polls MongoDB with { userId, competitionId, createdAt: { $gt: lastCheckedAt } }
 * - This query is FULLY COVERED by the compound index {userId, competitionId, createdAt}
 * - No write operations needed (old approach used $addToSet on every poll)
 * - Events auto-delete after 60s (TTL), so the collection stays tiny
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

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Cursor: track the last event time we've seen
        // Start from 60s ago to catch any recent events (TTL is 60s so nothing older exists)
        let lastCheckedAt = new Date(Date.now() - 60_000);

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

        // Poll for new events using cursor-based approach
        // Query uses compound index {userId, competitionId, createdAt} — no collection scan
        // No write operations (old $addToSet approach wrote on every poll)
        const pollInterval = setInterval(async () => {
          try {
            const events = await PositionEvent.find({
              userId: session.user.id,
              competitionId,
              createdAt: { $gt: lastCheckedAt },
            })
              .sort({ createdAt: -1 })
              .limit(10)
              .lean();

            if (events.length > 0) {
              // Advance cursor to the newest event's timestamp
              const newestEvent = events[0] as any;
              if (newestEvent.createdAt > lastCheckedAt) {
                lastCheckedAt = newestEvent.createdAt;
              }

              // Send each event (oldest first for chronological order)
              for (let i = events.length - 1; i >= 0; i--) {
                const event = events[i] as any;
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
            }
          } catch (error) {
            console.error("[SSE] Error polling events:", error);
          }
        }, 1500); // Poll every 1.5s (was 500ms — 3x fewer queries, still fast enough for trade events)

        // Cleanup on close
        request.signal.addEventListener("abort", () => {
          clearInterval(keepAliveInterval);
          clearInterval(pollInterval);
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
